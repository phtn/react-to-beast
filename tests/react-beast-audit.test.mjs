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

  assert.equal(report.schemaVersion, 2);
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
      category: "routing",
      status: "review-required",
      declaredIn: ["package.json"],
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
  assert.deepEqual(report.recommendedPhases, ["foundation", "interactive", "routing", "server"]);
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
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).schemaVersion, 2);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("produces source-located interactive findings and a parity state matrix", () => {
  const report = auditFixture("react-interactive");
  const findingCodes = report.interactive.findings.items.map((finding) => finding.code);
  const profileMatrix = report.interactive.stateMatrix.entries.find(
    (entry) => entry.file === "src/InteractiveProfile.tsx",
  );

  assert.equal(report.react.hooks.useState, 4);
  assert.equal(report.react.apis.forwardRef, 1);
  assert.equal(report.interactive.controls.textEntry.count, 3);
  assert.equal(report.interactive.controls.checkable.count, 1);
  assert.equal(report.interactive.controls.select.count, 1);
  assert.equal(report.react.textInputOnChange.count, 1);
  assert.ok(findingCodes.includes("INTERACTIVE_NATIVE_TEXT_ONCHANGE"));
  assert.ok(findingCodes.includes("INTERACTIVE_SYNTHETIC_EVENT_TYPE_REWRITE"));
  assert.ok(findingCodes.includes("INTERACTIVE_FORWARD_REF_REWRITE"));
  assert.ok(findingCodes.includes("INTERACTIVE_CLASS_COMPONENT_REWRITE"));
  assert.ok(findingCodes.includes("INTERACTIVE_CLASS_ERROR_BOUNDARY_REWRITE"));
  assert.ok(findingCodes.includes("INTERACTIVE_EFFECT_CLEANUP_REVIEW"));
  assert.equal(
    findingCodes.filter((code) => code === "INTERACTIVE_OMITTED_DEPENDENCY_SEMANTICS").length,
    3,
  );
  assert.ok(report.interactive.findings.items.every((finding) => finding.file && finding.line > 0 && finding.reason));
  assert.deepEqual(
    profileMatrix.checks.map((check) => check.id),
    [
      "checkable-activation",
      "context-provider-update",
      "effect-ownership",
      "form-submit",
      "pending-error-retry",
      "portal-ownership",
      "ref-lifecycle",
      "select-change",
      "state-update",
      "text-every-edit",
      "uncontrolled-reset",
    ],
  );
  assert.deepEqual(
    report.dependencies.bindingCandidates.map(({ source, candidate, category }) => ({ source, candidate, category })),
    [
      { source: "@radix-ui/react-dialog", candidate: "@octanejs/radix", category: "ui" },
      { source: "framer-motion", candidate: "@octanejs/motion", category: "animation" },
      { source: "lucide-react", candidate: "@octanejs/lucide", category: "icons" },
      { source: "react-hook-form", candidate: "@octanejs/hook-form", category: "forms" },
      { source: "styled-components", candidate: "@octanejs/styled-components", category: "styling" },
      { source: "swr", candidate: "@octanejs/swr", category: "data" },
      { source: "zustand", candidate: "@octanejs/zustand", category: "state" },
    ],
  );
  assert.equal(report.risk.level, "high");
  assert.ok(report.risk.blockers.includes("INTERACTIVE_API_REWRITE"));
});

test("renders the interactive matrix as source-safe Markdown", () => {
  const source = path.join(testsDirectory, "fixtures", "react-interactive");
  const result = spawnSync(process.execPath, [auditScript, source, "--matrix", "-"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Interactive parity matrix/);
  assert.match(result.stdout, /src\/InteractiveProfile\.tsx \| text-every-edit/);
  assert.doesNotMatch(result.stdout, /setInterval\(\(\)/);
  assert.equal(result.stderr, "");
});

test("does not echo malformed package contents in its report", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "react-beast-invalid-package-"));
  try {
    await writeFile(
      path.join(temporaryDirectory, "package.json"),
      '{"name":"do-not-echo-this-value", trailing}',
      "utf8",
    );
    const result = spawnSync(process.execPath, [auditScript, temporaryDirectory, "--json", "-"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).inventory.packages[0].parseError, "invalid-json");
    assert.doesNotMatch(result.stdout, /do-not-echo-this-value/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
