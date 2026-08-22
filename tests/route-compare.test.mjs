import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(testsDirectory);
const compareScript = path.join(
  repositoryRoot,
  "skills/react-to-beast/scripts/react-beast-route-compare.mjs",
);

function fixture(name) {
  return path.join(testsDirectory, "fixtures", name);
}

test("matches the normalized React Router source and executable Beast target contracts", () => {
  const result = spawnSync(process.execPath, [
    compareScript,
    fixture("react-router-data"),
    fixture("beast-routing-app"),
    "--json",
    "-",
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const comparison = JSON.parse(result.stdout);
  assert.equal(comparison.schemaVersion, 1);
  assert.equal(comparison.status, "matched");
  assert.deepEqual(comparison.summary, {
    sourceRoutes: 5,
    targetRoutes: 5,
    matched: 5,
    reviewCount: 0,
  });
  assert.deepEqual(comparison.sourceOnly, []);
  assert.deepEqual(comparison.targetOnly, []);
  assert.deepEqual(comparison.mismatches, []);
});

test("matches the normalized TanStack source and executable Beast target contracts", () => {
  const result = spawnSync(process.execPath, [
    compareScript,
    fixture("tanstack-code"),
    fixture("beast-tanstack-routing-app"),
    "--json",
    "-",
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const comparison = JSON.parse(result.stdout);
  assert.equal(comparison.status, "matched");
  assert.equal(comparison.summary.matched, 4);
  assert.equal(comparison.summary.reviewCount, 0);
  assert.ok(comparison.applicationCheckpoints.includes("search-round-trip"));
  assert.ok(comparison.applicationCheckpoints.includes("redirect-history"));
});

test("reports route additions, removals, and capability changes for review", () => {
  const result = spawnSync(process.execPath, [
    compareScript,
    fixture("react-router-declarative"),
    fixture("beast-routing-app"),
    "--json",
    "-",
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const comparison = JSON.parse(result.stdout);
  assert.equal(comparison.status, "review-required");
  assert.ok(comparison.summary.reviewCount > 0);
  assert.ok(comparison.sourceOnly.length > 0 || comparison.targetOnly.length > 0 || comparison.mismatches.length > 0);
  assert.doesNotMatch(result.stdout, /project loader failed/);
});

test("prints a concise Markdown comparison", () => {
  const result = spawnSync(process.execPath, [
    compareScript,
    fixture("react-router-data"),
    fixture("beast-routing-app"),
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Route contract comparison/);
  assert.match(result.stdout, /Status: matched/);
  assert.match(result.stdout, /5 normalized route contracts match/);
});
