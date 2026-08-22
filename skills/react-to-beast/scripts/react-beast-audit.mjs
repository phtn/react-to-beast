#!/usr/bin/env node

import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 2;
const DEFAULT_MAX_FILES = 20_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_REPORTED_PATHS = 500;
const MAX_REPORTED_FINDINGS = 2_000;
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
  ["@apollo/client", { candidate: "@octanejs/apollo-client", category: "data" }],
  ["@base-ui-components/react", { candidate: "@octanejs/base-ui", category: "ui" }],
  ["@dnd-kit/core", { candidate: "@octanejs/dnd-kit", category: "interaction" }],
  ["@floating-ui/react", { candidate: "@octanejs/floating-ui", category: "ui" }],
  ["@mantine/hooks", { candidate: "@octanejs/mantine-hooks", category: "hooks" }],
  ["@mdx-js/react", { candidate: "@octanejs/mdx", category: "content" }],
  ["@phosphor-icons/react", { candidate: "@octanejs/phosphor-icons", category: "icons" }],
  ["@radix-ui/react", { candidate: "@octanejs/radix", category: "ui" }],
  ["@react-spring/web", { candidate: "@octanejs/spring", category: "animation" }],
  ["@react-three/drei", { candidate: "@octanejs/drei", category: "3d" }],
  ["@react-three/fiber", { candidate: "@octanejs/three", category: "3d" }],
  ["@reduxjs/toolkit", { candidate: "@octanejs/redux-toolkit", category: "state" }],
  ["@tanstack/react-form", { candidate: "@octanejs/tanstack-form", category: "forms" }],
  ["@tanstack/react-query", { candidate: "@octanejs/tanstack-query", category: "data" }],
  ["@tanstack/react-router", { candidate: "@octanejs/tanstack-router", category: "routing" }],
  ["@tanstack/react-store", { candidate: "@octanejs/tanstack-store", category: "state" }],
  ["@tanstack/react-table", { candidate: "@octanejs/tanstack-table", category: "data-view" }],
  ["@tanstack/react-virtual", { candidate: "@octanejs/tanstack-virtual", category: "data-view" }],
  ["@testing-library/react", { candidate: "@octanejs/testing-library", category: "testing" }],
  ["@xstate/react", { candidate: "@octanejs/xstate", category: "state" }],
  ["@zag-js/react", { candidate: "@octanejs/zag", category: "ui" }],
  ["cmdk", { candidate: "@octanejs/cmdk", category: "ui" }],
  ["embla-carousel-react", { candidate: "@octanejs/embla-carousel", category: "interaction" }],
  ["framer-motion", { candidate: "@octanejs/motion", category: "animation" }],
  ["jotai", { candidate: "@octanejs/jotai", category: "state" }],
  ["lucide-react", { candidate: "@octanejs/lucide", category: "icons" }],
  ["mobx-react-lite", { candidate: "@octanejs/mobx", category: "state" }],
  ["motion", { candidate: "@octanejs/motion", category: "animation" }],
  ["react-aria-components", { candidate: "@octanejs/aria", category: "ui" }],
  ["react-colorful", { candidate: "@octanejs/colorful", category: "ui" }],
  ["react-day-picker", { candidate: "@octanejs/day-picker", category: "ui" }],
  ["react-draggable", { candidate: "@octanejs/draggable", category: "interaction" }],
  ["react-dropzone", { candidate: "@octanejs/dropzone", category: "forms" }],
  ["react-error-boundary", { candidate: "@octanejs/react-error-boundary", category: "boundaries" }],
  ["react-hook-form", { candidate: "@octanejs/hook-form", category: "forms" }],
  ["react-i18next", { candidate: "@octanejs/i18next", category: "content" }],
  ["react-map-gl", { candidate: "@octanejs/react-map-gl", category: "data-view" }],
  ["react-popper", { candidate: "@octanejs/popper", category: "ui" }],
  ["react-redux", { candidate: "@octanejs/redux", category: "state" }],
  ["react-resizable-panels", { candidate: "@octanejs/resizable-panels", category: "ui" }],
  ["react-router", { candidate: "@octanejs/remix-router", category: "routing" }],
  ["react-router-dom", { candidate: "@octanejs/remix-router", category: "routing" }],
  ["react-textarea-autosize", { candidate: "@octanejs/textarea-autosize", category: "forms" }],
  ["react-transition-group", { candidate: "@octanejs/transition-group", category: "animation" }],
  ["recharts", { candidate: "@octanejs/recharts", category: "data-view" }],
  ["sonner", { candidate: "@octanejs/sonner", category: "ui" }],
  ["styled-components", { candidate: "@octanejs/styled-components", category: "styling" }],
  ["swr", { candidate: "@octanejs/swr", category: "data" }],
  ["usehooks-ts", { candidate: "@octanejs/usehooks-ts", category: "hooks" }],
  ["valtio", { candidate: "@octanejs/valtio", category: "state" }],
  ["vaul", { candidate: "@octanejs/vaul", category: "ui" }],
  ["zustand", { candidate: "@octanejs/zustand", category: "state" }],
]);

const BINDING_PREFIX_CANDIDATES = [
  { prefix: "@radix-ui/react-", candidate: "@octanejs/radix", category: "ui" },
];

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
  "useEffectEvent",
  "useFormStatus",
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

const TEXT_INPUT_TYPES = new Set(["", "email", "number", "password", "search", "tel", "text", "url"]);

const MATRIX_CHECKS = {
  state: {
    id: "state-update",
    scenario: "Trigger each state transition, including repeated and same-value updates.",
    expected: "The intended state commits without resetting unrelated local state.",
  },
  effect: {
    id: "effect-ownership",
    scenario: "Mount, update captured values, unmount, and remount the component.",
    expected: "External resources connect at the intended times and every ownership episode cleans up once.",
  },
  text: {
    id: "text-every-edit",
    scenario: "Type, paste, delete, and perform an IME composition in each text-entry control.",
    expected: "Controlled state follows every native input event without interrupting composition.",
  },
  checkable: {
    id: "checkable-activation",
    scenario: "Toggle with pointer and keyboard, including any rejected/cancelled transition.",
    expected: "Checked state and cancellation follow the browser click → input → change timeline.",
  },
  select: {
    id: "select-change",
    scenario: "Change the selection with keyboard and pointer, then reset the form.",
    expected: "The selected value, change handler, and reset behavior match the source contract.",
  },
  uncontrolled: {
    id: "uncontrolled-reset",
    scenario: "Edit the control, rerender its owner, and reset the form.",
    expected: "Initial defaults do not overwrite user edits and native reset restores the expected value.",
  },
  form: {
    id: "form-submit",
    scenario: "Submit by button and Enter across valid, invalid, pending, success, and failure states.",
    expected: "Validation, prevention, payload, focus, pending UI, errors, and reset behavior remain equivalent.",
  },
  ref: {
    id: "ref-lifecycle",
    scenario: "Mount, focus or measure, replace the host node, and unmount.",
    expected: "Object and callback refs attach to the right node and detach or run cleanup exactly once.",
  },
  context: {
    id: "context-provider-update",
    scenario: "Render without a provider, then update and nest provider values.",
    expected: "Consumers receive the correct default and nearest committed provider value.",
  },
  portal: {
    id: "portal-ownership",
    scenario: "Mount into the target, exercise capture/bubble and stopPropagation, then unmount.",
    expected: "DOM ownership, logical ancestry, event order, focus, and cleanup match the source behavior.",
  },
  boundary: {
    id: "pending-error-retry",
    scenario: "Exercise fulfilled, pending, rejected, fallback, and retry/reset paths.",
    expected: "The nearest boundary owns the same loading/error state and recovery behavior.",
  },
  transition: {
    id: "urgent-transition-work",
    scenario: "Update urgent input state while starting a slower transition and suspension.",
    expected: "Typing stays immediate, useful prior UI remains visible, and pending status is accurate.",
  },
  hydration: {
    id: "hydration-adoption",
    scenario: "Hydrate server HTML, interact before/while activation, and verify node identity.",
    expected: "HTML is adopted as intended, events replay where configured, and effects/refs begin only after activation.",
  },
  memo: {
    id: "memoization-parity",
    scenario: "Rerender with stable and changed captures, including any identity-sensitive consumer.",
    expected: "Recomputation and callback/component identity change at the same semantic boundaries as the source.",
  },
};

function usage() {
  return `Usage: react-beast-audit [source] [options]

Audit a React application without installing dependencies or executing its scripts.

Options:
  --style <tailwind|css>  Requested Beast styling target (default: tailwind)
  --json <path|->        Write JSON to a file, or to stdout with -
  --matrix <path|->      Write the interactive parity matrix as Markdown
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
    matrix: null,
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
    } else if (argument === "--style" || argument === "--json" || argument === "--matrix" || argument === "--max-files") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--style") options.style = value;
      if (argument === "--json") options.json = value;
      if (argument === "--matrix") options.matrix = value;
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
  if (options.json !== null && options.matrix !== null) {
    throw new Error("--json and --matrix are separate output modes; choose one");
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

function findCallSites(text, name) {
  const sites = [];
  const expression = new RegExp(`\\b${name}\\b`, "g");
  for (const match of text.matchAll(expression)) {
    let cursor = match.index + name.length;
    while (/\s/.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] === "<") {
      let depth = 0;
      let quote = null;
      for (; cursor < text.length; cursor += 1) {
        const character = text[cursor];
        const previous = text[cursor - 1];
        if (quote !== null) {
          if (character === quote && previous !== "\\") quote = null;
          continue;
        }
        if (character === '"' || character === "'" || character === "`") {
          quote = character;
          continue;
        }
        if (character === "<") depth += 1;
        if (character === ">") {
          depth -= 1;
          if (depth === 0) {
            cursor += 1;
            break;
          }
        }
      }
      while (/\s/.test(text[cursor] ?? "")) cursor += 1;
    }
    if (text[cursor] === "(") sites.push({ offset: match.index, openParen: cursor });
  }
  return sites;
}

function findCallOffsets(text, name) {
  return findCallSites(text, name).map((site) => site.offset);
}

function countTopLevelArguments(text, openParen) {
  let parentheses = 1;
  let braces = 0;
  let brackets = 0;
  let quote = null;
  let commas = 0;
  let hasContent = false;

  for (let cursor = openParen + 1; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    const previous = text[cursor - 1];
    if (quote !== null) {
      if (character === quote && previous !== "\\") quote = null;
      if (parentheses === 1 && braces === 0 && brackets === 0 && !/\s/.test(character)) hasContent = true;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      if (parentheses === 1 && braces === 0 && brackets === 0) hasContent = true;
      continue;
    }
    if (character === "{") braces += 1;
    else if (character === "}") braces = Math.max(0, braces - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (character === "(") parentheses += 1;
    else if (character === ")") {
      parentheses -= 1;
      if (parentheses === 0) break;
    } else if (character === "," && parentheses === 1 && braces === 0 && brackets === 0) {
      commas += 1;
      continue;
    }
    if (parentheses === 1 && braces === 0 && brackets === 0 && !/\s/.test(character)) hasContent = true;
  }
  return hasContent ? commas + 1 : 0;
}

function makeLineLocator(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  }

  return (offset) => {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (starts[middle] <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  };
}

function createFindingCollector() {
  return { count: 0, items: [], keys: new Set(), codes: new Set(), severities: new Set() };
}

function addFinding(collector, finding) {
  const key = `${finding.code}\0${finding.file}\0${finding.line}`;
  if (collector.keys.has(key)) return;
  collector.keys.add(key);
  collector.codes.add(finding.code);
  collector.severities.add(finding.severity);
  collector.count += 1;
  if (collector.items.length < MAX_REPORTED_FINDINGS) collector.items.push(finding);
}

function addInteractiveSignal(interactive, file, signal) {
  const signals = interactive.signalsByFile.get(file) ?? new Set();
  signals.add(signal);
  interactive.signalsByFile.set(file, signals);
}

function addLocation(locations, file, line, kind) {
  locations.push({ file, line, kind });
}

function scanOpeningTags(text) {
  const tags = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf("<", cursor);
    if (start === -1) break;
    const first = text[start + 1];
    if (!first || first === "/" || first === ">" || first === "!" || first === "?") {
      cursor = start + 1;
      continue;
    }

    const nameMatch = text.slice(start + 1).match(/^[A-Za-z][A-Za-z0-9:._-]*/);
    if (!nameMatch) {
      cursor = start + 1;
      continue;
    }

    let quote = null;
    let braceDepth = 0;
    let end = start + 1 + nameMatch[0].length;
    for (; end < text.length; end += 1) {
      const character = text[end];
      const previous = text[end - 1];
      if (quote !== null) {
        if (character === quote && previous !== "\\") quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        continue;
      }
      if (character === "{") {
        braceDepth += 1;
        continue;
      }
      if (character === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (character === ">" && braceDepth === 0) break;
    }

    if (end < text.length) {
      tags.push({ name: nameMatch[0], offset: start, source: text.slice(start, end + 1) });
      cursor = end + 1;
    } else {
      cursor = start + 1;
    }
  }
  return tags;
}

function hasAttribute(tag, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|/?>)`, "i").test(tag);
}

function hasStaticTrueAttribute(tag, name) {
  const match = new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(\\{[^}]*\\}|["'][^"']*["']))?(?=\\s|/?>)`, "i").exec(tag);
  if (!match) return false;
  if (match[1] === undefined) return true;
  return !/^\{\s*(?:false|null|undefined)\s*\}$/i.test(match[1]);
}

function staticStringAttribute(tag, name) {
  return new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? null;
}

function bindingCandidateFor(name) {
  const exact = BINDING_CANDIDATES.get(name);
  if (exact) return exact;
  return BINDING_PREFIX_CANDIDATES.find((entry) => name.startsWith(entry.prefix)) ?? null;
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
  if (/\b(?:function\s+use[A-Z][\w$]*|(?:const|let|var)\s+use[A-Z][\w$]*\s*=)/.test(text)) {
    react.customHookFiles.push(file);
  }

  for (const hook of HOOK_NAMES) {
    const count = findCallOffsets(text, hook).length;
    if (count > 0) increment(react.hooks, hook, count);
  }
  for (const api of REACT_API_NAMES) {
    const count = findCallOffsets(text, api).length;
    if (count > 0) increment(react.apis, api, count);
  }

  for (const match of text.matchAll(/from\s+["']next\/([^"']+)["']/g)) {
    react.nextImports.push(`next/${match[1]}`);
  }
}

function inspectInteractive(file, text, react, interactive) {
  const lineFor = makeLineLocator(text);
  const tags = scanOpeningTags(text);

  for (const tag of tags) {
    const lowerName = tag.name.toLowerCase();
    const isHost = tag.name === lowerName;
    const line = lineFor(tag.offset);

    if (isHost && (lowerName === "input" || lowerName === "textarea" || lowerName === "select")) {
      const hasType = hasAttribute(tag.source, "type");
      const staticType = lowerName === "input" ? staticStringAttribute(tag.source, "type") : null;
      const inputType = staticType?.toLowerCase() ?? "";
      const dynamicInputType = lowerName === "input" && hasType && staticType === null;
      const isTextEntry = lowerName === "textarea" || (lowerName === "input" && !dynamicInputType && TEXT_INPUT_TYPES.has(inputType));
      const isCheckable = lowerName === "input" && (inputType === "checkbox" || inputType === "radio");
      const isDisabledOrReadOnly = hasStaticTrueAttribute(tag.source, "disabled") || hasStaticTrueAttribute(tag.source, "readOnly");

      if (dynamicInputType) {
        addFinding(interactive.findings, {
          code: "INTERACTIVE_DYNAMIC_INPUT_TYPE_REVIEW",
          severity: "review",
          category: "events",
          file,
          line,
          reason: "A dynamic input type prevents static text/checkable event classification; verify the final props for every type branch.",
        });
      }

      if (isTextEntry) {
        addInteractiveSignal(interactive, file, "text");
        addLocation(interactive.locations.text, file, line, lowerName === "textarea" ? "textarea" : inputType || "text");
        const suppressesWarning = hasAttribute(tag.source, "suppressNativeChangeWarning");
        if (
          hasAttribute(tag.source, "onChange") &&
          !hasAttribute(tag.source, "onInput") &&
          !suppressesWarning &&
          !isDisabledOrReadOnly
        ) {
          react.textInputOnChangeFiles.push(file);
          addFinding(interactive.findings, {
            code: "INTERACTIVE_NATIVE_TEXT_ONCHANGE",
            severity: "warning",
            category: "events",
            file,
            line,
            reason: "React text onChange is per-edit synthetic behavior; Octane uses native onInput for each edit.",
          });
        }
        if (
          hasAttribute(tag.source, "onChangeCapture") &&
          !hasAttribute(tag.source, "onInputCapture") &&
          !suppressesWarning &&
          !isDisabledOrReadOnly
        ) {
          react.textInputOnChangeFiles.push(file);
          addFinding(interactive.findings, {
            code: "INTERACTIVE_NATIVE_TEXT_ONCHANGE_CAPTURE",
            severity: "warning",
            category: "events",
            file,
            line,
            reason: "Preserve the capture phase while moving per-edit text handling from onChangeCapture to onInputCapture.",
          });
        }
      }

      if (isCheckable) {
        addInteractiveSignal(interactive, file, "checkable");
        addLocation(interactive.locations.checkable, file, line, inputType);
      }
      if (lowerName === "select") {
        addInteractiveSignal(interactive, file, "select");
        addLocation(interactive.locations.select, file, line, "select");
      }
      if (hasAttribute(tag.source, "defaultValue") || hasAttribute(tag.source, "defaultChecked")) {
        addInteractiveSignal(interactive, file, "uncontrolled");
        addLocation(interactive.locations.uncontrolled, file, line, lowerName);
      }
    }

    if (isHost && lowerName === "form") {
      addInteractiveSignal(interactive, file, "form");
      addLocation(interactive.locations.forms, file, line, "form");
    }

    if (isHost && (hasAttribute(tag.source, "onBeforeInput") || hasAttribute(tag.source, "onSelect"))) {
      addFinding(interactive.findings, {
        code: "INTERACTIVE_SYNTHETIC_EVENT_REVIEW",
        severity: "warning",
        category: "events",
        file,
        line,
        reason: "Octane delivers native browser events and does not provide React's synthetic onBeforeInput or onSelect polyfills.",
      });
    }

    if (hasAttribute(tag.source, "ref")) addInteractiveSignal(interactive, file, "ref");
    if (hasAttribute(tag.source, "ref") && /\bref\s*=\s*["'][^"']+["']/.test(tag.source)) {
      addInteractiveSignal(interactive, file, "ref");
      addFinding(interactive.findings, {
        code: "INTERACTIVE_STRING_REF_REWRITE",
        severity: "blocker",
        category: "refs",
        file,
        line,
        reason: "String refs are legacy React behavior; replace the ownership contract with an object or callback ref.",
      });
    }

    if (tag.name === "Suspense" || tag.name === "ErrorBoundary") addInteractiveSignal(interactive, file, "boundary");
    if (tag.name === "StrictMode") {
      addFinding(interactive.findings, {
        code: "INTERACTIVE_STRICT_MODE_REVIEW",
        severity: "warning",
        category: "lifecycle",
        file,
        line,
        reason: "Octane has no StrictMode double-invocation contract; remove the wrapper only after cleanup and idempotence tests pass.",
      });
    }
    if (tag.name === "Profiler" || tag.name === "SuspenseList") {
      addFinding(interactive.findings, {
        code: "INTERACTIVE_UNSUPPORTED_BOUNDARY_API",
        severity: "blocker",
        category: "boundaries",
        file,
        line,
        reason: `${tag.name} has no Octane equivalent; preserve its user-visible or measurement contract with a reviewed replacement.`,
      });
    }
  }

  const hookSignals = new Map([
    ["useState", "state"],
    ["useReducer", "state"],
    ["useActionState", "form"],
    ["useOptimistic", "form"],
    ["useFormStatus", "form"],
    ["useEffect", "effect"],
    ["useEffectEvent", "effect"],
    ["useLayoutEffect", "effect"],
    ["useInsertionEffect", "effect"],
    ["useSyncExternalStore", "effect"],
    ["useRef", "ref"],
    ["useImperativeHandle", "ref"],
    ["useContext", "context"],
    ["useTransition", "transition"],
    ["useDeferredValue", "transition"],
    ["useMemo", "memo"],
    ["useCallback", "memo"],
  ]);
  for (const [hook, signal] of hookSignals) {
    if (findCallOffsets(text, hook).length > 0) addInteractiveSignal(interactive, file, signal);
  }
  if (findCallOffsets(text, "createContext").length > 0) addInteractiveSignal(interactive, file, "context");
  if (/\b(?:Suspense|ErrorBoundary)\b/.test(text) || findCallOffsets(text, "lazy").length > 0) addInteractiveSignal(interactive, file, "boundary");
  if (findCallOffsets(text, "memo").length > 0) addInteractiveSignal(interactive, file, "memo");
  if (["startTransition", "useTransition", "useDeferredValue"].some((name) => findCallOffsets(text, name).length > 0)) {
    addInteractiveSignal(interactive, file, "transition");
  }
  if (["hydrateRoot", "hydrate"].some((name) => findCallOffsets(text, name).length > 0)) {
    addInteractiveSignal(interactive, file, "hydration");
  }

  for (const offset of findCallOffsets(text, "createPortal")) {
    addInteractiveSignal(interactive, file, "portal");
    addFinding(interactive.findings, {
      code: "INTERACTIVE_PORTAL_OWNERSHIP_REVIEW",
      severity: "review",
      category: "portals",
      file,
      line: lineFor(offset),
      reason: "Verify target lifetime, focus, cleanup, and native event order while preserving logical bubbling through the portal.",
    });
  }

  const unsupportedCalls = [
    {
      name: "forwardRef",
      code: "INTERACTIVE_FORWARD_REF_REWRITE",
      reason: "Octane accepts ref as an ordinary component prop and does not provide forwardRef.",
    },
    {
      name: "createRef",
      code: "INTERACTIVE_CREATE_REF_REWRITE",
      reason: "Octane does not provide createRef; use a stable useRef in a function component or accept a ref prop.",
    },
  ];
  for (const api of unsupportedCalls) {
    for (const offset of findCallOffsets(text, api.name)) {
      addInteractiveSignal(interactive, file, "ref");
      addFinding(interactive.findings, {
        code: api.code,
        severity: "blocker",
        category: "refs",
        file,
        line: lineFor(offset),
        reason: api.reason,
      });
    }
  }

  const dependencySensitiveHooks = [
    { name: "useEffect", minimumArguments: 2, signal: "effect" },
    { name: "useLayoutEffect", minimumArguments: 2, signal: "effect" },
    { name: "useInsertionEffect", minimumArguments: 2, signal: "effect" },
    { name: "useMemo", minimumArguments: 2, signal: "memo" },
    { name: "useCallback", minimumArguments: 2, signal: "memo" },
    { name: "useImperativeHandle", minimumArguments: 3, signal: "ref" },
  ];
  for (const hook of dependencySensitiveHooks) {
    for (const site of findCallSites(text, hook.name)) {
      if (countTopLevelArguments(text, site.openParen) >= hook.minimumArguments) continue;
      addInteractiveSignal(interactive, file, hook.signal);
      addFinding(interactive.findings, {
        code: "INTERACTIVE_OMITTED_DEPENDENCY_SEMANTICS",
        severity: "warning",
        category: "hooks",
        file,
        line: lineFor(site.offset),
        reason: `React ${hook.name} without a dependency argument runs or recreates every render, while Octane infers captures; use null for every-render parity or choose dependencies deliberately.`,
      });
    }
  }

  for (const match of text.matchAll(/\bReactDOM\.(?:render|hydrate|unmountComponentAtNode)\s*\(/g)) {
    addFinding(interactive.findings, {
      code: "INTERACTIVE_LEGACY_ROOT_REWRITE",
      severity: "blocker",
      category: "roots",
      file,
      line: lineFor(match.index),
      reason: "Legacy React roots are not available; select createRoot, hydrateRoot, or an explicit Octane compatibility boundary.",
    });
  }

  for (const match of text.matchAll(/\bReact\.(?:SyntheticEvent|ChangeEvent|FormEvent|MouseEvent|KeyboardEvent|FocusEvent|PointerEvent)\b|\b(?:SyntheticEvent|ChangeEvent|FormEvent|FocusEvent)\s*</g)) {
    addFinding(interactive.findings, {
      code: "INTERACTIVE_SYNTHETIC_EVENT_TYPE_REWRITE",
      severity: "warning",
      category: "events",
      file,
      line: lineFor(match.index),
      reason: "React synthetic event types do not describe Octane's real browser Event objects; retype named handlers against the native event and currentTarget contract.",
    });
  }

  for (const match of text.matchAll(/\bclass\s+[A-Za-z_$][\w$]*\s+extends\s+(?:React\.)?(?:PureComponent|Component)\b/g)) {
    addInteractiveSignal(interactive, file, "state");
    addInteractiveSignal(interactive, file, "effect");
    addFinding(interactive.findings, {
      code: "INTERACTIVE_CLASS_COMPONENT_REWRITE",
      severity: "blocker",
      category: "lifecycle",
      file,
      line: lineFor(match.index),
      reason: "Octane has no class components; map state, lifecycle ownership, refs, context, and error behavior into reviewed function-component contracts.",
    });
  }

  for (const match of text.matchAll(/\b(?:contextTypes|childContextTypes|getChildContext)\b/g)) {
    addInteractiveSignal(interactive, file, "context");
    addFinding(interactive.findings, {
      code: "INTERACTIVE_LEGACY_CONTEXT_REWRITE",
      severity: "blocker",
      category: "context",
      file,
      line: lineFor(match.index),
      reason: "Legacy React context is unavailable; define a typed createContext provider/consumer ownership boundary.",
    });
  }

  if (/\bclass\s+[A-Za-z_$][\w$]*\s+extends\s+(?:React\.)?(?:PureComponent|Component)\b/.test(text) && /\b(?:componentDidCatch|getDerivedStateFromError)\b/.test(text)) {
    const match = /\b(?:componentDidCatch|getDerivedStateFromError)\b/.exec(text);
    addInteractiveSignal(interactive, file, "boundary");
    addFinding(interactive.findings, {
      code: "INTERACTIVE_CLASS_ERROR_BOUNDARY_REWRITE",
      severity: "blocker",
      category: "boundaries",
      file,
      line: lineFor(match.index),
      reason: "Octane has no class error-boundary lifecycle; use a native try/catch block or function ErrorBoundary contract.",
    });
  }

  const cleanupPairs = [
    { setup: /\baddEventListener\s*\(/g, cleanup: /\bremoveEventListener\s*\(/, resource: "event listener" },
    { setup: /\bsetInterval\s*\(/g, cleanup: /\bclearInterval\s*\(/, resource: "interval" },
    { setup: /\brequestAnimationFrame\s*\(/g, cleanup: /\bcancelAnimationFrame\s*\(/, resource: "animation frame" },
    { setup: /\bnew\s+(?:IntersectionObserver|MutationObserver|ResizeObserver)\s*\(/g, cleanup: /\.(?:disconnect|unobserve)\s*\(/, resource: "observer" },
  ];
  if (["useEffect", "useLayoutEffect", "useInsertionEffect"].some((name) => findCallOffsets(text, name).length > 0)) {
    for (const resource of cleanupPairs) {
      const setups = [...text.matchAll(resource.setup)];
      if (setups.length > 0 && !resource.cleanup.test(text)) {
        for (const match of setups) {
          addFinding(interactive.findings, {
            code: "INTERACTIVE_EFFECT_CLEANUP_REVIEW",
            severity: "warning",
            category: "effects",
            file,
            line: lineFor(match.index),
            reason: `An effect appears to acquire an ${resource.resource} without a matching release in this module; verify ownership and cleanup.`,
          });
        }
      }
    }
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

function makeLocationSummary(locations) {
  const unique = new Map();
  for (const location of locations) {
    unique.set(`${location.file}\0${location.line}\0${location.kind}`, location);
  }
  const sorted = [...unique.values()].sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.kind.localeCompare(right.kind),
  );
  return {
    count: sorted.length,
    locations: sorted.slice(0, MAX_REPORTED_PATHS),
    truncated: sorted.length > MAX_REPORTED_PATHS,
  };
}

function makeInteractiveReport(interactive) {
  const signalCounts = {};
  const entries = [...interactive.signalsByFile.entries()]
    .map(([file, signalSet]) => {
      const signals = [...signalSet].sort();
      for (const signal of signals) increment(signalCounts, signal);
      const checks = signals
        .map((signal) => MATRIX_CHECKS[signal])
        .filter(Boolean)
        .sort((left, right) => left.id.localeCompare(right.id));
      return { file, signals, checks };
    })
    .sort((left, right) => left.file.localeCompare(right.file));
  const checkCount = entries.reduce((total, entry) => total + entry.checks.length, 0);
  const findingItems = [...interactive.findings.items].sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.code.localeCompare(right.code),
  );

  return {
    summary: {
      files: entries.length,
      signals: makeCountSummary(signalCounts),
    },
    controls: {
      textEntry: makeLocationSummary(interactive.locations.text),
      checkable: makeLocationSummary(interactive.locations.checkable),
      select: makeLocationSummary(interactive.locations.select),
      uncontrolled: makeLocationSummary(interactive.locations.uncontrolled),
      forms: makeLocationSummary(interactive.locations.forms),
    },
    findings: {
      count: interactive.findings.count,
      items: findingItems,
      truncated: interactive.findings.count > findingItems.length,
    },
    stateMatrix: {
      files: entries.length,
      checks: checkCount,
      entries: entries.slice(0, MAX_REPORTED_PATHS),
      truncated: entries.length > MAX_REPORTED_PATHS,
    },
  };
}

function makeCountSummary(counter) {
  return Object.fromEntries(Object.entries(counter).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeMarkdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function formatStateMatrix(report) {
  const lines = [
    "# Interactive parity matrix",
    "",
    `Source: \`${report.source}\``,
    "",
    "Generated from static signals. Confirm each row against the source behavior before porting.",
    "",
    "| File | Signal | Scenario | Expected parity |",
    "|---|---|---|---|",
  ];

  for (const entry of report.interactive.stateMatrix.entries) {
    for (const check of entry.checks) {
      lines.push(
        `| ${escapeMarkdownCell(entry.file)} | ${escapeMarkdownCell(check.id)} | ${escapeMarkdownCell(check.scenario)} | ${escapeMarkdownCell(check.expected)} |`,
      );
    }
  }
  if (report.interactive.stateMatrix.checks === 0) {
    lines.push("| — | — | No interactive signals detected. | Confirm the audit scope. |");
  }
  if (report.interactive.stateMatrix.truncated) {
    lines.push("", `Matrix output truncated after ${MAX_REPORTED_PATHS} files.`);
  }
  return `${lines.join("\n")}\n`;
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
  const dependencySources = new Map();
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
    customHookFiles: [],
    textInputOnChangeFiles: [],
    hooks: {},
    apis: {},
    nextImports: [],
  };
  const interactive = {
    signalsByFile: new Map(),
    findings: createFindingCollector(),
    locations: {
      text: [],
      checkable: [],
      select: [],
      uncontrolled: [],
      forms: [],
    },
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
          const sources = dependencySources.get(name) ?? new Set();
          sources.add(candidate.relativePath);
          dependencySources.set(name, sources);
        }
      } catch {
        packages.push({ path: candidate.relativePath, name: null, scripts: [], parseError: "invalid-json" });
      }
      continue;
    }

    inspectRoutes(candidate.relativePath, text, routeSignals);
    inspectStyling(candidate.relativePath, text, styling);
    inspectReact(candidate.relativePath, text, react);
    inspectInteractive(candidate.relativePath, text, react, interactive);
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
    .map((name) => ({ name, binding: bindingCandidateFor(name) }))
    .filter((entry) => entry.binding !== null)
    .map(({ name, binding }) => ({
      source: name,
      candidate: binding.candidate,
      category: binding.category,
      status: "review-required",
      declaredIn: uniqueSorted(dependencySources.get(name) ?? []),
    }));
  const unknownReactDependencies = dependencyNames.filter(
    (name) => matchesPackagePattern(name) && !KNOWN_REACT_PACKAGES.has(name) && !bindingCandidateFor(name) && !CSS_IN_JS_PACKAGES.has(name),
  );

  const interactiveReport = makeInteractiveReport(interactive);

  const blockers = [];
  const warnings = [];
  if (routeIds.includes("next-app")) blockers.push("NEXT_RSC_REWRITE");
  if (react.serverDirectiveFiles.length > 0) blockers.push("SERVER_ACTION_REWRITE");
  if (react.classComponentFiles.length > 0) blockers.push("CLASS_COMPONENT_REWRITE");
  if ((react.apis.createRef ?? 0) > 0 || (react.apis.forwardRef ?? 0) > 0) blockers.push("REACT_API_REWRITE");
  if (interactive.findings.severities.has("blocker")) blockers.push("INTERACTIVE_API_REWRITE");
  if (routeIds.length > 0) warnings.push("ROUTE_CONTRACT_REQUIRED");
  if (routeIds.length > 1) warnings.push("MULTIPLE_ROUTE_MODELS");
  if (styling.cssInJsFiles.length > 0) warnings.push("CSS_IN_JS_PLAN");
  if (react.textInputOnChangeFiles.length > 0) warnings.push("NATIVE_INPUT_EVENT_REVIEW");
  if (interactive.findings.codes.has("INTERACTIVE_EFFECT_CLEANUP_REVIEW")) warnings.push("EFFECT_CLEANUP_REVIEW");
  if (interactive.findings.count > 0) warnings.push("INTERACTIVE_PARITY_REVIEW");
  if (bindingCandidates.length > 0) warnings.push("BINDING_SURFACE_REVIEW");
  if (unknownReactDependencies.length > 0) warnings.push("UNKNOWN_REACT_DEPENDENCIES");

  const recommendedPhases = ["foundation"];
  if (
    interactiveReport.summary.files > 0 ||
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
      customHooks: makePathSummary(react.customHookFiles),
      clientDirectives: makePathSummary(react.clientDirectiveFiles),
      serverDirectives: makePathSummary(react.serverDirectiveFiles),
      textInputOnChange: makePathSummary(react.textInputOnChangeFiles),
      nextImports: uniqueSorted(react.nextImports),
    },
    interactive: interactiveReport,
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
    `Interactive files: ${report.interactive.summary.files}`,
    `Interactive findings: ${report.interactive.findings.count}`,
    `Parity checks: ${report.interactive.stateMatrix.checks}`,
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
  const matrix = formatStateMatrix(report);

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
  if (options.matrix === "-") {
    process.stdout.write(matrix);
    return;
  }
  if (options.matrix) {
    const outputPath = path.resolve(options.matrix);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, matrix, { encoding: "utf8", flag: options.force ? "w" : "wx" });
    process.stdout.write(`Wrote interactive parity matrix to ${outputPath}\n`);
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
