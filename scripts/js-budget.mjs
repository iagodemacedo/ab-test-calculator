// Fails when the JavaScript a page can load exceeds the PRD section 18 budget (150 KB gzip).
// Follows <script src>, modulepreload links and static and dynamic chunk imports plus module workers, per page.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = resolve("dist");
const BUDGET = 150 * 1024;

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? htmlFiles(p)
      : f.endsWith(".html")
        ? [p]
        : [];
  });

const gz = (buf) => gzipSync(buf, { level: 9 }).length;

function chunkClosure(entry, seen) {
  if (seen.has(entry)) return;
  seen.add(entry);
  const code = readFileSync(entry, "utf8");
  for (const m of code.matchAll(/["']((?:\.\.?\/|\/)[^"']+\.js)["']/g)) {
    const next = m[1].startsWith("/")
      ? join(DIST, m[1])
      : resolve(dirname(entry), m[1]);
    chunkClosure(next, seen);
  }
}

let failed = false;
for (const html of htmlFiles(DIST)) {
  const text = readFileSync(html, "utf8");
  const seen = new Set();
  for (const m of text.matchAll(
    /<(?:script[^>]+src|link[^>]+href)="([^"]+\.js)"/g,
  )) {
    if (m[1].startsWith("/")) chunkClosure(join(DIST, m[1]), seen);
  }
  // Astro island hydration scripts reference component chunks through attributes.
  for (const m of text.matchAll(
    /(?:component-url|renderer-url)="([^"]+\.js)"/g,
  ))
    chunkClosure(join(DIST, m[1]), seen);
  let total = 0;
  for (const f of seen) total += gz(readFileSync(f));
  for (const m of text.matchAll(
    /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g,
  ))
    total += gz(Buffer.from(m[1]));
  const over = total > BUDGET;
  failed ||= over;
  console.log(
    `${over ? "FAIL" : "ok  "} ${(total / 1024).toFixed(1).padStart(6)} KB gzip  ${html.replace(DIST, "")}`,
  );
}
console.log(`budget ${BUDGET / 1024} KB gzip per page`);
process.exit(failed ? 1 : 0);
