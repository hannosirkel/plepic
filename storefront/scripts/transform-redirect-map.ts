import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import { registerHooks } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The repository targets Node 24, whose built-in TypeScript loader requires
 * explicit .ts extensions. Source imports use emitted .js extensions instead,
 * so this CLI maps only a missing relative .js sibling to its checked-in .ts
 * source before dynamically importing the real transformer.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        context.parentURL?.startsWith("file:") === true &&
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        specifier.endsWith(".js")
      ) {
        const typescriptUrl = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(typescriptUrl))) {
          return nextResolve(typescriptUrl.href, context);
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json")) {
      const value = JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as unknown;
      return {
        format: "module",
        shortCircuit: true,
        source: `export default ${JSON.stringify(value)};`,
      };
    }
    return nextLoad(url, context);
  },
});

interface CliPaths {
  readonly input: string;
  readonly output: string;
}

function parseArguments(arguments_: readonly string[]): CliPaths {
  if (
    arguments_.length !== 4 ||
    arguments_[0] !== "--input" ||
    arguments_[2] !== "--output" ||
    arguments_[1] === undefined ||
    arguments_[3] === undefined
  ) {
    throw new Error("usage: transform-redirect-map --input INPUT.json --output OUTPUT.json");
  }

  const input = resolve(arguments_[1]);
  const output = resolve(arguments_[3]);
  if (input === output) {
    throw new Error("input and output paths must be different");
  }
  return { input, output };
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function canonicalOutputPath(outputPath: string): Promise<string> {
  try {
    return await realpath(outputPath);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    return resolve(await realpath(dirname(outputPath)), basename(outputPath));
  }
}

async function refuseInputOutputAlias(paths: CliPaths): Promise<void> {
  const [canonicalInput, canonicalOutput, inputStat] = await Promise.all([
    realpath(paths.input),
    canonicalOutputPath(paths.output),
    stat(paths.input),
  ]);

  if (canonicalInput === canonicalOutput) {
    throw new Error("input and output paths must identify different files");
  }

  try {
    const outputStat = await stat(paths.output);
    if (inputStat["dev"] === outputStat["dev"] && inputStat.ino === outputStat.ino) {
      throw new Error("input and output paths must identify different files");
    }
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
}

async function writeAtomically(outputPath: string, contents: string): Promise<void> {
  const temporaryPath = resolve(
    dirname(outputPath),
    `.${basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function main(): Promise<void> {
  const paths = parseArguments(process.argv.slice(2));
  await refuseInputOutputAlias(paths);
  const transformerUrl = new URL("../src/config/redirect-map-transform.ts", import.meta.url);
  const { transformRedirectMap } = (await import(transformerUrl.href)) as typeof import(
    "../src/config/redirect-map-transform.js"
  );
  const input = JSON.parse(await readFile(paths.input, "utf8")) as unknown;
  const output = transformRedirectMap(input, paths.input);
  await writeAtomically(paths.output, `${JSON.stringify(output)}\n`);
  console["info"](
    JSON.stringify({ event: "redirect_map_transformed", input: paths.input, output: paths.output }),
  );
}

try {
  await main();
} catch (error) {
  console.error(`redirect-map transform failed: ${String(error)}`);
  process.exitCode = 1;
}
