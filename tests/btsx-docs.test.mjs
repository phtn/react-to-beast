import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileBeast } from "beast-tsrx";
import { compile } from "octane/compiler";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const referencesDirectory = path.join(
  path.dirname(testsDirectory),
  "skills",
  "react-to-beast",
  "references",
);

test("every BTSX reference example compiles through Beast and Octane", async () => {
  const referenceFiles = (await readdir(referencesDirectory)).filter((name) => name.endsWith(".md")).sort();
  let examples = 0;

  for (const referenceFile of referenceFiles) {
    const markdown = await readFile(path.join(referencesDirectory, referenceFile), "utf8");
    const blocks = [...markdown.matchAll(/```btsx\n([\s\S]*?)```/g)];
    for (let index = 0; index < blocks.length; index += 1) {
      const filename = path.join(referencesDirectory, `${referenceFile}-${index + 1}.btsx`);
      const tsrx = compileBeast(blocks[index][1], { filename });
      for (const mode of ["client", "server"]) {
        const result = compile(tsrx, filename.replace(/\.btsx$/u, ".tsrx"), {
          mode,
          hmr: false,
          dev: false,
        });
        assert.deepEqual(result.diagnostics, [], `${referenceFile} example ${index + 1} (${mode})`);
      }
      examples += 1;
    }
  }

  assert.ok(examples >= 10, `Expected at least 10 BTSX examples, found ${examples}.`);
});
