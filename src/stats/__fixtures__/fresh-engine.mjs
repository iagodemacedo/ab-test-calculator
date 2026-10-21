// Runs the engine in a new Node process, so each run starts with cold JIT state. Plain JS
// because the project has no Node type declarations.
import { execFile } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const engine = fileURLToPath(new URL("../index.ts", import.meta.url));

const child = `
import { registerHooks } from "node:module";
registerHooks({
  resolve: (specifier, context, next) =>
    next(/^\\.\\.?\\//.test(specifier) && !/\\.\\w+$/.test(specifier) ? specifier + ".ts" : specifier, context),
});
const { analyze } = await import(process.argv[1]);
const { inputs, settings } = JSON.parse(process.argv[2]);
process.stdout.write(JSON.stringify(inputs.map((input) => analyze(input, settings))));
`;

export const cores = availableParallelism();

/**
 * JSON of analyze(input, settings) for each input, in order, in one fresh process.
 * @param {readonly string[]} v8Flags
 * @param {{ inputs: readonly unknown[]; settings: unknown }} calls
 * @returns {Promise<string>}
 */
export async function analyzeInFreshEngine(v8Flags, calls) {
  const args = [...v8Flags, "--no-warnings", "--input-type=module", "-e", child, engine, JSON.stringify(calls)];
  const { stdout } = await run(process.execPath, args);
  return stdout;
}
