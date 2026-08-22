#!/usr/bin/env node

import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_FILES = 20_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_REPORTED_PATHS = 500;
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".css",
  ".scss",
  ".sass",
  ".less",
]);
const IGNORED_DIRECTORIES = new Set([
  ".beast",
  ".git",
  ".next",
  ".output",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
]);

const BINDING_CANDIDATES = new Map([
  ["@apollo/client", "@octanejs/apollo-client"],
  ["@dnd-kit/core", "@octanejs/dnd-kit"],
  ["@floating-ui/react", "@octanejs/floating-ui"],
  ["@radix-ui/react", "@octanejs/radix"],
  ["@reduxjs/toolkit", "@octanejs/redux-toolkit"],
  ["@tanstack/react-query", "@octanejs/tanstack-query"],
  ["@tanstack/react-router", "@octanejs/tanstack-router"],
  ["framer-motion", "@octanejs/motion"],
  ["jotai", "@octanejs/jotai"],
  ["lucide-react", "@octanejs/lucide"],
  ["react-hook-form", "@octanejs/hook-form"],
  ["react-i18next", "@octanejs/i18next"],
  ["react-redux", "@octanejs/redux"],
  ["react-router", "@octanejs/remix-router"],
  ["react-router-dom", "@octanejs/remix-router"],
  ["recharts", "@octanejs/recharts"],
  ["sonner", "@octanejs/sonner"],
  ["zustand", "@octanejs/zustand"],
]);

const CSS_IN_JS_PACKAGES = new Set([
  "@compiled/react",
  "@emotion/react",
  "@emotion/styled",
  "@stitches/react",
  "@vanilla-extract/css",
  "linaria",
  "styled-components",
  "styled-jsx",
]);

const KNOWN_REACT_PACKAGES = new Set([
  "react",
  "react-dom",
  "react-is",
  "react-refresh",
  "react-scripts",
  "next",
  "vite",
  "@vitejs/plugin-react",
  "@vitejs/plugin-react-swc",
  "@remix-run/dev",
  "@remix-run/node",
  "@remix-run/react",
  "@react-router/dev",
  ...BINDING_CANDIDATES.keys(),
]);

const HOOK_NAMES = [
  "useActionState",
  "useCallback",
  "useContext",
  "useDeferredValue",
  "useEffect",
  "useId",
  "useImperativeHandle",
  "useInsertionEffect",
  "useLayoutEffect",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition",
];

const REACT_API_NAMES = [
  "cloneElement",
  "createContext",
  "createPortal",
  "createRef",
  "forwardRef",
  "lazy",
  "memo",
  "startTransition",
  "use",
];

function usage() {
  return `Usage: react-beast-audit [source] [options]

Audit a React application without installing dependencies or executing its scripts.

Options:
  --style <tailwind|css>  Requested Beast styling target (default: tailwind)
  --json <path|->        Write JSON to a file, or to stdout with -
  --max-files <number>   Stop after this many candidate files (default: ${DEFAULT_MAX_FILES})
  --force                Replace an existing --json file
  -h, --help             Show this help
`;
}

function parseArguments(argv) {
  const options = {
    source: ".",
    style: "tailwind",
    json: null,
    force: false,
    maxFiles: DEFAULT_MAX_FILES,
    help: false,
  };
  let sawSource = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "-h" || argument === "--help") {
      options.help = true;
    } else if (argument === "--force") {
      options.force = true;
    } else if (argument === "--style" || argument === "--json" || argument === "--max-files") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--style") options.style = value;
      if (argument === "--json") options.json = value;
      if (argument === "--max-files") options.maxFiles = Number(value);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!sawSource) {
      options.source = argument;
      sawSource = true;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (!new Set(["tailwind", "css"]).has(options.style)) {
    throw new Error("--style must be either tailwind or css");
  }
  if (!Number.isSafeInteger(options.maxFiles) || options.maxFiles < 1) {
    throw new Error("--max-files must be a positive integer");
  }
  return options;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function increment(counter, key, amount = 1) {
  counter[key] = (counter[key] ?? 0) + amount;
}

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

function matchesPackagePattern(name) {
  return (
    name.startsWith("react-") ||
    name.endsWith("-react") ||
    name.includes("/react-") ||
    name.endsWith("/react")
  );
}

async function collectCandidateFiles(root, maxFiles) {
  const files = [];
  const skipped = {
    ignoredDirectories: 0,
    symlinks: 0,
    oversizedFiles: 0,
  };

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        throw new Error(`Candidate file limit reached (${maxFiles}). Increase --max-files after reviewing the source scope.`);
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = toPosix(path.relative(root, absolutePath));

      if (entry.isSymbolicLink()) {
        skipped.symlinks += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          skipped.ignoredDirectories += 1;
          continue;
        }
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || entry.name.startsWith(".env")) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (entry.name !== "package.json" && !SOURCE_EXTENSIONS.has(extension)) continue;

      const info = await lstat(absolutePath);
      if (info.size > MAX_FILE_BYTES) {
        skipped.oversizedFiles += 1;
        continue;
      }
      files.push({ absolutePath, relativePath, extension, size: info.size });
    }
  }

  await visit(root);
  return { files, skipped };
}

function addRouteSignal(routeSignals, id, file, signal) {
  const current = routeSignals.get(id) ?? { files: new Set(), signals: new Set() };
  if (file) current.files.add(file);
  if (signal) current.signals.add(signal);
  routeSignals.set(id, current);
}

function inspectRoutes(file, text, routeSignals) {
  const extensionPattern = "(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)";
  const appSpecial = new RegExp(`^(?:src/)?app/(?:.+/)?(?:page|layout|template|loading|error|not-found|default|route)\\.${extensionPattern}$`);
  const pagesRoute = new RegExp(`^(?:src/)?pages/(?:.+\\.)?${extensionPattern}$`);

  if (appSpecial.test(file)) addRouteSignal(routeSignals, "next-app", file, "app special file");
  if (pagesRoute.test(file)) addRouteSignal(routeSignals, "next-pages", file, "pages route file");

  if (/\b(?:BrowserRouter|HashRouter|MemoryRouter|Routes|Route|useRoutes)\b/.test(text)) {
    addRouteSignal(routeSignals, "react-router-declarative", file, "declarative router API");
  }
  if (/\b(?:createBrowserRouter|createHashRouter|createMemoryRouter|RouterProvider)\b/.test(text)) {
    addRouteSignal(routeSignals, "react-router-data", file, "data router API");
  }
  if (
    /(?:^|\/)react-router\.config\.[^/]+$/.test(file) ||
    /from\s+["']@react-router\/dev\/routes["']/.test(text) ||
    /\b(?:index|layout|prefix|route)\s*\(/.test(text) && file.includes("routes")
  ) {
    addRouteSignal(routeSignals, "react-router-framework", file, "framework route configuration");
  }
  if (/\b(?:createFileRoute|createLazyFileRoute)\b/.test(text) || /(?:^|\/)routeTree\.gen\.[^/]+$/.test(file)) {
    addRouteSignal(routeSignals, "tanstack-file", file, "file route API or generated tree");
  }
  if (/\b(?:createRootRoute|createRoute|createRouter)\b/.test(text) && /@tanstack\/react-router/.test(text)) {
    addRouteSignal(routeSignals, "tanstack-code", file, "code route API");
  }
  if (/^(?:app\/)?routes\//.test(file) && /@remix-run\//.test(text)) {
    addRouteSignal(routeSignals, "remix", file, "Remix route module");
  }
  if (/\b(?:history\.(?:pushState|replaceState)|popstate|location\.pathname)\b/.test(text)) {
    addRouteSignal(routeSignals, "custom-history", file, "browser history API");
  }
}

function inspectStyling(file, text, styling) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".css") {
    styling.cssFiles.push(file);
    if (/\.module\.css$/i.test(file)) styling.cssModuleFiles.push(file);
  }
  if (extension === ".scss" || extension === ".sass") styling.sassFiles.push(file);
  if (extension === ".less") styling.lessFiles.push(file);
  if (/(?:^|\/)tailwind\.config\.[^/]+$/.test(file) || /@import\s+["']tailwindcss["']|@tailwind\s+(?:base|components|utilities)/.test(text)) {
    styling.tailwindSignals.push(file);
  }
  if (/\bstyle\s*=\s*\{/.test(text)) styling.inlineStyleFiles.push(file);
  if (/\b(?:styled|css)\s*(?:\.|\(|`)|<style\s+jsx\b/.test(text)) styling.cssInJsFiles.push(file);
}

function inspectReact(file, text, react) {
  if (/\.(?:jsx|tsx)$/i.test(file)) react.componentFiles.push(file);
  if (/^\s*["']use client["'];?/m.test(text)) react.clientDirectiveFiles.push(file);
  if (/^\s*["']use server["'];?/m.test(text)) react.serverDirectiveFiles.push(file);
  if (/\bclass\s+[A-Za-z_$][\w$]*\s+extends\s+(?:React\.)?(?:PureComponent|Component)\b/.test(text)) {
    react.classComponentFiles.push(file);
  }
  if (/<(?:input|textarea)\b[^>]*\bonChange\s*=/gis.test(text)) react.textInputOnChangeFiles.push(file);

  for (const hook of HOOK_NAMES) {
    const count = countMatches(text, new RegExp(`\\b${hook}\\s*\\(`, "g"));
    if (count > 0) increment(react.hooks, hook, count);
  }
  for (const api of REACT_API_NAMES) {
    const count = countMatches(text, new RegExp(`\\b${api}\\s*\\(`, "g"));
    if (count > 0) increment(react.apis, api, count);
  }

  for (const match of text.matchAll(/from\s+["']next\/([^"']+)["']/g)) {
    react.nextImports.push(`next/${match[1]}`);
  }
}

function makePathSummary(paths) {
  const sorted = uniqueSorted(paths);
  return {
    count: sorted.length,
    paths: sorted.slice(0, MAX_REPORTED_PATHS),
    truncated: sorted.length > MAX_REPORTED_PATHS,
  };
}

function makeCountSummary(counter) {
  return Object.fromEntries(Object.entries(counter).sort(([left], [right]) => left.localeCompare(right)));
}

function calculateRisk({ blockers, warnings, routeIds }) {
  if (blockers.includes("NEXT_RSC_REWRITE") || blockers.includes("SERVER_ACTION_REWRITE")) return "critical";
  if (blockers.length > 0 || routeIds.some((id) => id !== "react-router-declarative" && id !== "custom-history")) return "high";
  if (warnings.length > 0 || routeIds.length > 0) return "medium";
  return "low";
}

export async function auditReactApp(source, options = {}) {
  const requestedStyle = options.style ?? "tailwind";
  if (!new Set(["tailwind", "css"]).has(requestedStyle)) {
    throw new Error("style must be either tailwind or css");
  }
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) throw new Error("maxFiles must be a positive integer");

  const requestedRoot = path.resolve(source);
  const rootInfo = await lstat(requestedRoot);
  if (!rootInfo.isDirectory()) throw new Error(`Source is not a directory: ${requestedRoot}`);
  const root = await realpath(requestedRoot);
  const { files, skipped } = await collectCandidateFiles(root, maxFiles);

  const packages = [];
  const dependencies = new Map();
  const routeSignals = new Map();
  const styling = {
    cssFiles: [],
    cssModuleFiles: [],
    sassFiles: [],
    lessFiles: [],
    tailwindSignals: [],
    inlineStyleFiles: [],
    cssInJsFiles: [],
  };
  const react = {
    componentFiles: [],
    clientDirectiveFiles: [],
    serverDirectiveFiles: [],
    classComponentFiles: [],
    textInputOnChangeFiles: [],
    hooks: {},
    apis: {},
    nextImports: [],
  };
  let customHistoryDetected = false;

  for (const candidate of files) {
    const text = await readFile(candidate.absolutePath, "utf8");

    if (candidate.relativePath.endsWith("package.json")) {
      try {
        const manifest = JSON.parse(text);
        const packageDependencies = {
          ...(manifest.dependencies ?? {}),
          ...(manifest.devDependencies ?? {}),
          ...(manifest.peerDependencies ?? {}),
          ...(manifest.optionalDependencies ?? {}),
        };
        packages.push({
          path: candidate.relativePath,
          name: typeof manifest.name === "string" ? manifest.name : null,
          scripts: Object.keys(manifest.scripts ?? {}).sort(),
        });
        for (const [name, version] of Object.entries(packageDependencies)) {
          if (!dependencies.has(name)) dependencies.set(name, String(version));
        }
      } catch (error) {
        packages.push({ path: candidate.relativePath, name: null, scripts: [], parseError: error.message });
      }
      continue;
    }

    inspectRoutes(candidate.relativePath, text, routeSignals);
    inspectStyling(candidate.relativePath, text, styling);
    inspectReact(candidate.relativePath, text, react);
    if (/\b(?:history\.(?:pushState|replaceState)|popstate|location\.pathname)\b/.test(text)) customHistoryDetected = true;
  }

  const dependencyNames = [...dependencies.keys()].sort();
  const frameworks = [];
  if (dependencies.has("react") || react.componentFiles.length > 0) frameworks.push("react");
  if (dependencies.has("next")) frameworks.push("nextjs");
  if (dependencies.has("vite")) frameworks.push("vite");
  if (dependencies.has("react-scripts")) frameworks.push("create-react-app");
  if (dependencies.has("react-router") || dependencies.has("react-router-dom") || dependencies.has("@react-router/dev")) frameworks.push("react-router");
  if (dependencies.has("@tanstack/react-router")) frameworks.push("tanstack-router");
  if (dependencyNames.some((name) => name.startsWith("@remix-run/"))) frameworks.push("remix");
  if (customHistoryDetected) frameworks.push("custom-history");

  if (dependencies.has("next")) {
    for (const [id, entry] of routeSignals) {
      if (id.startsWith("next-")) entry.signals.add("next dependency");
    }
  }
  if (dependencyNames.some((name) => CSS_IN_JS_PACKAGES.has(name))) {
    styling.cssInJsFiles.push("package.json dependency");
  }
  if (dependencies.has("tailwindcss") || dependencies.has("@tailwindcss/vite")) {
    styling.tailwindSignals.push("package.json dependency");
  }

  const routes = [...routeSignals.entries()]
    .map(([id, entry]) => ({
      id,
      files: uniqueSorted(entry.files).slice(0, MAX_REPORTED_PATHS),
      signals: uniqueSorted(entry.signals),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const routeIds = routes.map((route) => route.id);

  const bindingCandidates = dependencyNames
    .filter((name) => BINDING_CANDIDATES.has(name))
    .map((name) => ({ source: name, candidate: BINDING_CANDIDATES.get(name), status: "review-required" }));
  const unknownReactDependencies = dependencyNames.filter(
    (name) => matchesPackagePattern(name) && !KNOWN_REACT_PACKAGES.has(name) && !CSS_IN_JS_PACKAGES.has(name),
  );

  const blockers = [];
  const warnings = [];
  if (routeIds.includes("next-app")) blockers.push("NEXT_RSC_REWRITE");
  if (react.serverDirectiveFiles.length > 0) blockers.push("SERVER_ACTION_REWRITE");
  if (react.classComponentFiles.length > 0) blockers.push("CLASS_COMPONENT_REWRITE");
  if ((react.apis.createRef ?? 0) > 0 || (react.apis.forwardRef ?? 0) > 0) blockers.push("REACT_API_REWRITE");
  if (routeIds.length > 0) warnings.push("ROUTE_CONTRACT_REQUIRED");
  if (routeIds.length > 1) warnings.push("MULTIPLE_ROUTE_MODELS");
  if (styling.cssInJsFiles.length > 0) warnings.push("CSS_IN_JS_PLAN");
  if (react.textInputOnChangeFiles.length > 0) warnings.push("NATIVE_INPUT_EVENT_REVIEW");
  if (bindingCandidates.length > 0) warnings.push("BINDING_SURFACE_REVIEW");
  if (unknownReactDependencies.length > 0) warnings.push("UNKNOWN_REACT_DEPENDENCIES");

  const recommendedPhases = ["foundation"];
  if (
    Object.keys(react.hooks).length > 0 ||
    react.textInputOnChangeFiles.length > 0 ||
    bindingCandidates.length > 0 ||
    react.classComponentFiles.length > 0
  ) recommendedPhases.push("interactive");
  if (routeIds.length > 0) recommendedPhases.push("routing");
  if (frameworks.includes("nextjs") || frameworks.includes("remix") || react.serverDirectiveFiles.length > 0) {
    recommendedPhases.push("server");
  }

  const requiresServerTargetReview =
    frameworks.includes("nextjs") ||
    frameworks.includes("remix") ||
    react.serverDirectiveFiles.length > 0;

  return {
    schemaVersion: SCHEMA_VERSION,
    source: root,
    requested: {
      styling: requestedStyle,
      destinationName: `${path.basename(root)}-beast`,
    },
    target: {
      candidate: requiresServerTargetReview ? "rsbuild-full-app" : "vite-spa",
      status: requiresServerTargetReview ? "review-required" : "default",
    },
    inventory: {
      candidateFiles: files.length,
      packages: packages.sort((left, right) => left.path.localeCompare(right.path)),
      skipped,
    },
    frameworks: uniqueSorted(frameworks),
    routing: {
      models: routes,
      requiresContractReview: routeIds.length > 0,
    },
    styling: {
      tailwind: makePathSummary(styling.tailwindSignals),
      css: makePathSummary(styling.cssFiles),
      cssModules: makePathSummary(styling.cssModuleFiles),
      sass: makePathSummary(styling.sassFiles),
      less: makePathSummary(styling.lessFiles),
      inlineStyles: makePathSummary(styling.inlineStyleFiles),
      cssInJs: makePathSummary(styling.cssInJsFiles),
    },
    react: {
      components: makePathSummary(react.componentFiles),
      hooks: makeCountSummary(react.hooks),
      apis: makeCountSummary(react.apis),
      classComponents: makePathSummary(react.classComponentFiles),
      clientDirectives: makePathSummary(react.clientDirectiveFiles),
      serverDirectives: makePathSummary(react.serverDirectiveFiles),
      textInputOnChange: makePathSummary(react.textInputOnChangeFiles),
      nextImports: uniqueSorted(react.nextImports),
    },
    dependencies: {
      count: dependencyNames.length,
      bindingCandidates,
      unknownReactDependencies,
    },
    risk: {
      level: calculateRisk({ blockers, warnings, routeIds }),
      blockers: uniqueSorted(blockers),
      warnings: uniqueSorted(warnings),
    },
    recommendedPhases,
  };
}

function printHumanReport(report) {
  const modelNames = report.routing.models.map((model) => model.id).join(", ") || "none";
  const lines = [
    `React to Beast audit: ${report.source}`,
    `Requested styling: ${report.requested.styling}`,
    `Candidate target: ${report.target.candidate} (${report.target.status})`,
    `Frameworks: ${report.frameworks.join(", ") || "none detected"}`,
    `Candidate files: ${report.inventory.candidateFiles}`,
    `React components: ${report.react.components.count}`,
    `Route models: ${modelNames}`,
    `Risk: ${report.risk.level}`,
    `Blockers: ${report.risk.blockers.join(", ") || "none"}`,
    `Warnings: ${report.risk.warnings.join(", ") || "none"}`,
    `Recommended phases: ${report.recommendedPhases.join(" → ")}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const report = await auditReactApp(options.source, options);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (options.json === "-") {
    process.stdout.write(json);
    return;
  }
  if (options.json) {
    const outputPath = path.resolve(options.json);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, { encoding: "utf8", flag: options.force ? "w" : "wx" });
    process.stdout.write(`Wrote audit report to ${outputPath}\n`);
    return;
  }
  printHumanReport(report);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`react-beast-audit: ${error.message}\n`);
    process.exitCode = 1;
  });
}
