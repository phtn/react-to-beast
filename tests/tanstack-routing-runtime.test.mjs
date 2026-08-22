import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import { compileBeast } from "beast-tsrx";
import { beastOctane } from "beast-tsrx/vite";
import { Window } from "happy-dom";
import { compile } from "octane/compiler";
import { build } from "vite";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const appFixtureDirectory = path.join(testsDirectory, "fixtures", "beast-tanstack-routing-app");
const sourceDirectory = path.join(appFixtureDirectory, "src");
const DOM_GLOBALS = [
  "Comment",
  "Document",
  "DocumentFragment",
  "Element",
  "Event",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLElement",
  "HTMLTemplateElement",
  "MouseEvent",
  "MutationObserver",
  "Node",
  "NodeFilter",
  "PointerEvent",
  "Range",
  "SVGElement",
  "Text",
];

const originalGlobals = new Map();
let browser;
let bundleDirectory;
let routingRuntime;

function installDom() {
  browser = new Window({ url: "https://react-to-beast.test/" });
  for (const name of ["window", "self", "document", "navigator", "history", "location", ...DOM_GLOBALS]) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = name === "window" || name === "self"
      ? browser
      : name === "document"
        ? browser.document
        : browser[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  for (const name of ["requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "scrollTo"]) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: browser[name].bind(browser),
    });
  }
}

function restoreDom() {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor === undefined) delete globalThis[name];
    else Object.defineProperty(globalThis, name, descriptor);
  }
  originalGlobals.clear();
  browser.close();
}

async function collectBtsx(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectBtsx(candidate));
    else if (entry.isFile() && candidate.endsWith(".btsx")) files.push(candidate);
  }
  return files.sort();
}

function requiredElement(root, selector) {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`Expected ${selector} in the TanStack routing fixture. DOM: ${root.innerHTML}`);
  return element;
}

function click(element) {
  element.dispatchEvent(new browser.MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function mount(initialEntry) {
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const mounted = await routingRuntime.mountRoutingApp(container, [initialEntry]);
  return { container, ...mounted };
}

before(async () => {
  installDom();
  bundleDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-tanstack-bundle-"));
  await build({
    root: appFixtureDirectory,
    configFile: false,
    plugins: [beastOctane({ octane: { strong: true } })],
    logLevel: "silent",
    build: {
      outDir: bundleDirectory,
      emptyOutDir: true,
      lib: {
        entry: path.join(sourceDirectory, "test-entry.ts"),
        formats: ["es"],
        fileName: "tanstack-routing-fixture",
      },
    },
  });
  routingRuntime = await import(pathToFileURL(path.join(bundleDirectory, "tanstack-routing-fixture.js")).href);
});

beforeEach(() => {
  browser.document.head.replaceChildren();
  browser.document.body.replaceChildren();
});

after(async () => {
  await rm(bundleDirectory, { recursive: true, force: true });
  restoreDom();
});

test("all TanStack routed BTSX modules compile for client/server and development/production", async () => {
  for (const filename of await collectBtsx(sourceDirectory)) {
    const source = await readFile(filename, "utf8");
    const tsrx = compileBeast(source, { filename });
    for (const mode of ["client", "server"]) {
      for (const dev of [true, false]) {
        const result = compile(tsrx, filename.replace(/\.btsx$/u, ".tsrx"), { mode, dev, hmr: false });
        assert.deepEqual(result.diagnostics, [], `${path.basename(filename)} (${mode}, dev=${dev})`);
      }
    }
  }
});

test("TanStack direct entry, links, typed search, and history preserve the nested route contract", async () => {
  const mounted = await mount("/projects/alpha?tab=activity");
  try {
    assert.equal(requiredElement(mounted.container, "#tanstack-project-title").textContent, "Project alpha");
    assert.equal(requiredElement(mounted.container, "#tanstack-project-tab").textContent, "Tab: activity");

    await mounted.settleNavigation(() => click(requiredElement(mounted.container, "#tanstack-beta-link")));
    assert.equal(mounted.router.state.location.pathname, "/projects/beta");
    assert.equal(requiredElement(mounted.container, "#tanstack-project-title").textContent, "Project beta");

    await mounted.settleNavigation(() => mounted.router.history.back());
    assert.equal(mounted.router.state.location.pathname, "/projects/alpha");

    await mounted.settleNavigation(() => mounted.router.history.forward());
    assert.equal(mounted.router.state.location.pathname, "/projects/beta");

    await mounted.settleNavigation(() => click(requiredElement(mounted.container, "#tanstack-alpha-link")));
    assert.equal(mounted.router.state.location.pathname, "/projects/alpha");
    assert.equal(mounted.router.state.location.search.tab, "activity");
    assert.equal(requiredElement(mounted.container, "#tanstack-project-tab").textContent, "Tab: activity");
  } finally {
    await mounted.unmount();
  }
});

test("TanStack redirects, not-found, and loader errors render at their intended owners", async () => {
  const redirected = await mount("/projects/legacy?tab=summary");
  try {
    assert.equal(redirected.router.state.location.pathname, "/projects/current");
    assert.equal(requiredElement(redirected.container, "#tanstack-project-title").textContent, "Project current");
  } finally {
    await redirected.unmount();
  }

  const missing = await mount("/does-not-exist");
  try {
    assert.equal(requiredElement(missing.container, "#tanstack-not-found").textContent, "Route not found");
  } finally {
    await missing.unmount();
  }

  const broken = await mount("/projects/broken?tab=summary");
  try {
    assert.match(requiredElement(broken.container, "#tanstack-project-error").textContent, /tanstack project loader failed/);
  } finally {
    await broken.unmount();
  }
});

test("the TanStack Beast application completes a normal Vite production build", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-tanstack-app-"));
  try {
    await build({
      root: appFixtureDirectory,
      configFile: path.join(appFixtureDirectory, "vite.config.ts"),
      logLevel: "silent",
      build: { outDir: outputDirectory, emptyOutDir: true },
    });
    assert.match(await readFile(path.join(outputDirectory, "index.html"), "utf8"), /assets\/[^"']+\.js/);
    assert.ok((await readdir(path.join(outputDirectory, "assets"))).some((name) => name.endsWith(".js")));
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
