import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(testsDirectory);
const auditScript = path.join(repositoryRoot, "skills/react-to-beast/scripts/react-beast-audit.mjs");

function auditFixture(name, style = "tailwind") {
  const source = path.join(testsDirectory, "fixtures", name);
  const result = spawnSync(process.execPath, [auditScript, source, "--style", style, "--json", "-"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("audits a basic Vite app and defaults toward a staged interactive port", () => {
  const report = auditFixture("vite-basic");

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.requested.styling, "tailwind");
  assert.deepEqual(report.target, { candidate: "vite-spa", status: "default" });
  assert.deepEqual(report.frameworks, ["react", "vite"]);
  assert.equal(report.react.components.count, 1);
  assert.equal(report.react.hooks.useState, 1);
  assert.equal(report.react.textInputOnChange.count, 1);
  assert.equal(report.styling.cssModules.count, 1);
  assert.equal(report.risk.level, "medium");
  assert.ok(report.risk.warnings.includes("NATIVE_INPUT_EVENT_REVIEW"));
  assert.deepEqual(report.recommendedPhases, ["foundation", "interactive"]);
});

test("recognizes React Router data mode and proposes a reviewed Octane binding", () => {
  const report = auditFixture("react-router-data");
  const routeIds = report.routing.models.map((model) => model.id);

  assert.deepEqual(routeIds, ["react-router-data"]);
  assert.deepEqual(report.dependencies.bindingCandidates, [
    {
      source: "react-router-dom",
      candidate: "@octanejs/remix-router",
      status: "review-required",
    },
  ]);
  assert.equal(report.routing.requiresContractReview, true);
  assert.equal(report.risk.level, "high");
  assert.ok(report.risk.warnings.includes("ROUTE_CONTRACT_REQUIRED"));
  assert.deepEqual(report.recommendedPhases, ["foundation", "interactive", "routing"]);
});

test("flags Next.js App Router server and styling boundaries", () => {
  const report = auditFixture("next-app", "css");

  assert.equal(report.requested.styling, "css");
  assert.deepEqual(report.target, { candidate: "rsbuild-full-app", status: "review-required" });
  assert.ok(report.frameworks.includes("nextjs"));
  assert.deepEqual(report.routing.models.map((model) => model.id), ["next-app"]);
  assert.deepEqual(report.react.nextImports, ["next/image"]);
  assert.equal(report.styling.cssInJs.count, 1);
  assert.deepEqual(report.risk.blockers, ["NEXT_RSC_REWRITE", "SERVER_ACTION_REWRITE"]);
  assert.equal(report.risk.level, "critical");
  assert.deepEqual(report.recommendedPhases, ["foundation", "routing", "server"]);
});

test("prints help without reading a source tree", () => {
  const result = spawnSync(process.execPath, [auditScript, "--help"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--style <tailwind\|css>/);
  assert.equal(result.stderr, "");
});

test("refuses to replace a JSON report unless force is explicit", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "react-beast-audit-"));
  const outputPath = path.join(temporaryDirectory, "report.json");
  const source = path.join(testsDirectory, "fixtures", "vite-basic");

  try {
    await writeFile(outputPath, "keep me\n", "utf8");
    const refused = spawnSync(process.execPath, [auditScript, source, "--json", outputPath], {
      encoding: "utf8",
    });

    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /EEXIST/);
    assert.equal(await readFile(outputPath, "utf8"), "keep me\n");

    const replaced = spawnSync(process.execPath, [auditScript, source, "--json", outputPath, "--force"], {
      encoding: "utf8",
    });
    assert.equal(replaced.status, 0, replaced.stderr);
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).schemaVersion, 1);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
