#!/usr/bin/env node
// Browser driver for verify-ab-test-calculator.
// Each invocation connects over CDP to the Chromium started by `ctl browser start`,
// acts on the first tab, and disconnects. The tab, cookies and localStorage persist
// between invocations because they live in the browser process, not in this script.
//
// Usage: node browser.mjs <command> [flags]   (normally called through `ctl browser`)
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const STATE = process.env.ABCALC_STATE;
const APP_URL = process.env.ABCALC_APP_URL;
const CDP_PORT = process.env.ABCALC_CDP_PORT;
if (!STATE || !CDP_PORT) {
  console.error("ABCALC_STATE and ABCALC_CDP_PORT must be set (use scripts/ctl, not this file directly)");
  process.exit(2);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; i++; }
  } else positional.push(rest[i]);
}

const timeout = Number(flags.timeout ?? 10000);

function out(obj) {
  console.log(JSON.stringify(obj));
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function locator(page) {
  if (flags.role) return page.getByRole(flags.role, { name: flags.name, exact: flags.exact === true || flags.exact === "true" });
  if (flags.label) return page.getByLabel(flags.label, { exact: true });
  if (flags.text) return page.getByText(flags.text, { exact: false });
  if (flags.testid) return page.getByTestId(flags.testid);
  if (flags.css) return page.locator(flags.css); // last resort, e.g. --css html to read data-theme
  throw new Error("target needs --role <role> --name <name>, --label <label>, --text <text>, --testid <id> or --css <selector>");
}

async function start() {
  const pidFile = join(STATE, "chrome.pid");
  if (existsSync(pidFile)) {
    out({ ok: false, error: "browser already started for this run", pid: readFileSync(pidFile, "utf8").trim() });
    process.exit(1);
  }
  const profile = join(STATE, "chrome-profile");
  mkdirSync(profile, { recursive: true });
  // Prefer Playwright's headless shell: the full Chromium build needs desktop libraries
  // (libcups, libcairo, libpango) that this machine does not have.
  const full = chromium.executablePath();
  const shell = full.replace(/chromium-(\d+)\/chrome-linux64\/chrome$/, "chromium_headless_shell-$1/chrome-headless-shell-linux64/chrome-headless-shell");
  const exe = process.env.ABCALC_CHROME ?? (existsSync(shell) ? shell : full);
  const log = openSync(join(STATE, "chrome.log"), "a");
  const child = spawn(
    exe,
    [
      ...(exe === full ? ["--headless=new"] : []),
      `--remote-debugging-port=${CDP_PORT}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,1000",
      ...(flags.lang ? [`--lang=${flags.lang}`, `--accept-lang=${flags.lang}`] : []),
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        const v = await res.json();
        out({ ok: true, pid: child.pid, cdp: `http://127.0.0.1:${CDP_PORT}`, browser: v.Browser });
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch {}
  rmSync(pidFile, { force: true });
  const tail = readFileSync(join(STATE, "chrome.log"), "utf8").split("\n").filter(Boolean).slice(-3).join(" | ");
  out({ ok: false, error: "chromium did not open the CDP port", exe, log_tail: tail });
  process.exit(1);
}

async function withPage(fn) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  try {
    const context = browser.contexts()[0];
    await context.grantPermissions(["clipboard-read", "clipboard-write"], APP_URL ? { origin: new URL(APP_URL).origin } : undefined).catch(() => {});
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(timeout);
    if (flags.viewport) {
      const match = /^(\d+)x(\d+)$/.exec(flags.viewport);
      if (!match) throw new Error('--viewport must be WIDTHxHEIGHT');
      await page.setViewportSize({ width: Number(match[1]), height: Number(match[2]) });
    }
    if (flags.block) {
      await page.route(`**${flags.block}*`, (route) => route.abort("failed"));
    }
    if (flags["color-scheme"]) await page.emulateMedia({ colorScheme: flags["color-scheme"] });
    const recorded = [];
    if (flags.record) page.on("request", (r) => recorded.push({ method: r.method(), url: r.url(), body: r.postData() ?? null }));
    const result = await fn(page, context);
    if (flags.record) {
      await new Promise((r) => setTimeout(r, 500));
      ensureDir(flags.record);
      writeFileSync(flags.record, JSON.stringify(recorded, null, 2));
    }
    return result;
  } finally {
    await browser.close(); // disconnects only; the CDP browser keeps running
  }
}

async function afterAction(page) {
  if (flags["wait-text"]) await page.getByText(flags["wait-text"], { exact: false }).filter({ visible: true }).first().waitFor({ state: "visible" });
  if (flags["wait-gone"]) await page.getByText(flags["wait-gone"], { exact: false }).first().waitFor({ state: "hidden" });
  if (flags["wait-url"]) await page.waitForURL((u) => u.toString().includes(flags["wait-url"]));
}

const commands = {
  start,
  async goto() {
    const target = positional[0];
    if (!target) throw new Error("goto needs a path or URL");
    const url = /^(https?|about):/.test(target) ? target : new URL(target, APP_URL).toString();
    await withPage(async (page) => {
      const res = await page.goto(url, { waitUntil: "load" });
      if (flags["wait-ready"] !== "false" && url !== "about:blank") {
        await page.locator('main[data-ready="true"]').waitFor({ state: "attached" }).catch(() => {
          throw new Error('page loaded but main[data-ready="true"] never appeared (island not hydrated)');
        });
      }
      await afterAction(page);
      out({ ok: true, status: res?.status(), url: page.url(), title: await page.title() });
    });
  },
  async click() {
    await withPage(async (page) => {
      await locator(page).first().click();
      await afterAction(page);
      out({ ok: true, url: page.url() });
    });
  },
  async hover() {
    await withPage(async (page) => {
      await locator(page).first().hover();
      await afterAction(page);
      out({ ok: true });
    });
  },
  async fill() {
    if (flags.value === undefined) throw new Error("fill needs --value");
    await withPage(async (page) => {
      await locator(page).first().fill(String(flags.value));
      await afterAction(page);
      out({ ok: true });
    });
  },
  async press() {
    const key = positional[0];
    if (!key) throw new Error("press needs a key, e.g. Tab or Enter");
    await withPage(async (page) => {
      if (flags.role || flags.label || flags.text || flags.testid || flags.css) await locator(page).first().press(key);
      else await page.keyboard.press(key);
      await afterAction(page);
      out({ ok: true });
    });
  },
  async text() {
    await withPage(async (page) => {
      const loc = locator(page).first();
      await loc.waitFor({ state: "attached" });
      out({ ok: true, text: (await loc.innerText()).trim() });
    });
  },
  async value() {
    await withPage(async (page) => {
      out({ ok: true, value: await locator(page).first().inputValue() });
    });
  },
  async attr() {
    if (!flags.attr) throw new Error("attr needs --attr <name>");
    await withPage(async (page) => {
      out({ ok: true, value: await locator(page).first().getAttribute(flags.attr) });
    });
  },
  async url() {
    await withPage(async (page) => out({ ok: true, url: page.url() }));
  },
  async clipboard() {
    await withPage(async (page) => out({ ok: true, text: await page.evaluate(() => navigator.clipboard.readText()) }));
  },
  async storage() {
    // Read-only view of localStorage, for proving the local draft exists or was cleared.
    await withPage(async (page) =>
      out({ ok: true, keys: await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)?.length ?? 0]))) }),
    );
  },
  async snapshot() {
    const path = flags.path;
    if (!path) throw new Error("snapshot needs --path <file>");
    await withPage(async (page) => {
      const target = flags.role || flags.label || flags.text || flags.testid || flags.css ? locator(page).first() : page.locator("body");
      const aria = await target.ariaSnapshot();
      ensureDir(path);
      writeFileSync(path, `# url: ${page.url()}\n# taken: ${new Date().toISOString()}\n${aria}\n`);
      out({ ok: true, path, lines: aria.split("\n").length });
    });
  },
  async screenshot() {
    const path = flags.path;
    if (!path) throw new Error("screenshot needs --path <file.png>");
    await withPage(async (page) => {
      ensureDir(path);
      const target = flags.role || flags.label || flags.text || flags.testid || flags.css ? locator(page).first() : null;
      if (target) await target.screenshot({ path });
      else await page.screenshot({ path, fullPage: flags.full === true || flags.full === "true" });
      out({ ok: true, path, url: page.url() });
    });
  },
  async layout() {
    await withPage(async (page) => {
      const value = await locator(page).first().evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { width: bounds.width, height: bounds.height, clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth, text: element.textContent,
          letterSpacing: style.letterSpacing, opacity: style.opacity,
          colors: [...element.querySelectorAll("path[stroke]")].map((path) => path.getAttribute("stroke")),
          shadedAreas: element.querySelectorAll('path[fill-opacity="0.18"]').length };
      });
      out({ ok: true, ...value });
    });
  },
  async network() {
    // Records every request URL the page makes while reloading the current page.
    // Used to prove that the URL fragment and test numbers never leave the browser.
    const path = flags.path;
    await withPage(async (page) => {
      const seen = [];
      page.on("request", (r) => seen.push({ method: r.method(), url: r.url(), body: r.postData() ?? null }));
      await page.reload({ waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, Number(flags.settle ?? 1500)));
      if (path) { ensureDir(path); writeFileSync(path, JSON.stringify(seen, null, 2)); }
      out({ ok: true, count: seen.length, path: path ?? null });
    });
  },
};

const fn = commands[cmd];
if (!fn) {
  console.error(`unknown command: ${cmd}\ncommands: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}
try {
  await fn();
} catch (err) {
  out({ ok: false, command: cmd, error: String(err?.message ?? err).split("\n")[0] });
  process.exit(1);
}
