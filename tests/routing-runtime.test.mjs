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
const appFixtureDirectory = path.join(testsDirectory, "fixtures", "beast-routing-app");
const sourceDirectory = path.join(appFixtureDirectory, "src");
const DOM_GLOBALS = [
  "Comment",
  "Document",
  "DocumentFragment",
  "Element",
  "Event",
  "FocusEvent",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLTemplateElement",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "Node",
  "NodeFilter",
  "PointerEvent",
  "Range",
  "SubmitEvent",
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
  for (const name of ["requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"]) {
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
  if (element === null) throw new Error(`Expected ${selector} in the routing fixture.`);
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
  bundleDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-routing-bundle-"));
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
        fileName: "routing-fixture",
      },
    },
  });
  routingRuntime = await import(pathToFileURL(path.join(bundleDirectory, "routing-fixture.js")).href);
});

beforeEach(() => {
  browser.document.head.replaceChildren();
  browser.document.body.replaceChildren();
});

after(async () => {
  await rm(bundleDirectory, { recursive: true, force: true });
  restoreDom();
});

test("all routed BTSX modules compile for client/server and development/production", async () => {
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

test("direct navigation preserves params and search, then links and history move through nested routes", async () => {
  const mounted = await mount("/projects/alpha?tab=activity");
  try {
    assert.equal(requiredElement(mounted.container, "#project-title").textContent, "Project alpha");
    assert.equal(requiredElement(mounted.container, "#project-tab").textContent, "Tab: activity");

    await mounted.settle(async () => {
      click(requiredElement(mounted.container, "#beta-link"));
      await routingRuntime.waitForRouterIdle(mounted.router);
    });
    assert.equal(mounted.router.state.location.pathname, "/projects/beta");
    assert.equal(requiredElement(mounted.container, "#project-title").textContent, "Project beta");

    await mounted.settle(async () => {
      await mounted.router.navigate(-1);
    });
    assert.equal(mounted.router.state.location.pathname, "/projects/alpha");

    await mounted.settle(async () => {
      await mounted.router.navigate(1);
    });
    assert.equal(mounted.router.state.location.pathname, "/projects/beta");

    await mounted.settle(async () => {
      click(requiredElement(mounted.container, "#activity-tab"));
      await routingRuntime.waitForRouterIdle(mounted.router);
    });
    assert.equal(mounted.router.state.location.search, "?tab=activity");
    assert.equal(requiredElement(mounted.container, "#project-tab").textContent, "Tab: activity");
  } finally {
    await mounted.unmount();
  }
});

test("redirect, not-found, and loader-error ownership render the expected route states", async () => {
  const redirected = await mount("/legacy");
  try {
    assert.equal(redirected.router.state.location.pathname, "/projects/current");
    assert.equal(requiredElement(redirected.container, "#project-title").textContent, "Project current");
  } finally {
    await redirected.unmount();
  }

  const missing = await mount("/does-not-exist");
  try {
    assert.equal(requiredElement(missing.container, "#not-found").textContent, "Route not found");
  } finally {
    await missing.unmount();
  }

  const broken = await mount("/projects/broken");
  try {
    assert.match(requiredElement(broken.container, "#project-error").textContent, /project loader failed/);
  } finally {
    await broken.unmount();
  }
});

test("route actions publish mutation data and a recreated router preserves direct-load behavior", async () => {
  const mounted = await mount("/projects/alpha?tab=summary");
  try {
    const formData = new FormData();
    formData.set("name", "renamed");
    await mounted.settle(async () => {
      await mounted.router.navigate("/projects/alpha?tab=summary", {
        formMethod: "post",
        formData,
      });
    });
    assert.equal(requiredElement(mounted.container, "#saved-project").textContent, "Saved renamed");
  } finally {
    await mounted.unmount();
  }

  const reloaded = await mount("/projects/alpha?tab=summary");
  try {
    assert.equal(requiredElement(reloaded.container, "#project-title").textContent, "Project alpha");
    assert.equal(requiredElement(reloaded.container, "#project-tab").textContent, "Tab: summary");
  } finally {
    await reloaded.unmount();
  }
});

test("the routed Beast application completes a normal Vite production build", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-routing-app-"));
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
