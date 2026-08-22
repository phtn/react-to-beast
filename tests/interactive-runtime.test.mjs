import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import { compileBeast } from "beast-tsrx";
import { Window } from "happy-dom";
import { compile } from "octane/compiler";
import { renderToString } from "octane/server";
import { build, createServer } from "vite";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(testsDirectory);
const beastFixtureDirectory = path.join(testsDirectory, "fixtures", "beast-interactive");
const appFixtureDirectory = path.join(testsDirectory, "fixtures", "beast-interactive-app");
const DOM_GLOBALS = [
  "CharacterData",
  "Comment",
  "CompositionEvent",
  "CustomEvent",
  "Document",
  "DocumentFragment",
  "Element",
  "Event",
  "FocusEvent",
  "HTMLButtonElement",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLOptionElement",
  "HTMLOutputElement",
  "HTMLSelectElement",
  "HTMLTemplateElement",
  "HTMLTextAreaElement",
  "InputEvent",
  "KeyboardEvent",
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

function installDom() {
  browser = new Window({ url: "https://react-to-beast.test/" });
  for (const name of ["window", "self", "document", "navigator", ...DOM_GLOBALS]) {
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

function requiredElement(root, selector) {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`Expected ${selector} in the test DOM.`);
  return element;
}

function dispatch(element, event) {
  element.dispatchEvent(event);
}

function click(element) {
  dispatch(element, new browser.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function rewriteRuntimeImports(code) {
  const specifiers = new Set(
    [...code.matchAll(/from\s+["'](octane(?:\/[^"']+)*)["']/g)].map((match) => match[1]),
  );
  let executable = code;
  for (const specifier of specifiers) {
    const resolved = JSON.stringify(import.meta.resolve(specifier));
    executable = executable
      .replaceAll(JSON.stringify(specifier), resolved)
      .replaceAll(`'${specifier}'`, resolved);
  }
  return executable;
}

async function compileFixture(name, mode, dev = true) {
  const filename = path.join(beastFixtureDirectory, name);
  const source = await readFile(filename, "utf8");
  const tsrx = compileBeast(source, { filename });
  const result = compile(tsrx, filename.replace(/\.btsx$/u, ".tsrx"), {
    mode,
    hmr: false,
    dev,
  });
  assert.deepEqual(result.diagnostics, [], `${name} (${mode}, dev=${dev})`);
  assert.ok(result.code.length > 0);
  return result.code;
}

async function loadClientFixture(name) {
  const executable = rewriteRuntimeImports(await compileFixture(name, "client", true));
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-runtime-"));
  const modulePath = path.join(temporaryDirectory, `${path.basename(name, ".btsx")}.mjs`);
  try {
    await writeFile(modulePath, executable, "utf8");
    return (await import(pathToFileURL(modulePath).href)).default;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function loadServerFixture(name) {
  const executable = rewriteRuntimeImports(await compileFixture(name, "server", true));
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-server-"));
  const modulePath = path.join(temporaryDirectory, `${path.basename(name, ".btsx")}.mjs`);
  try {
    await writeFile(modulePath, executable, "utf8");
    return (await import(pathToFileURL(modulePath).href)).default;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

before(installDom);

beforeEach(() => {
  browser.document.head.replaceChildren();
  browser.document.body.replaceChildren();
});

after(restoreDom);

test("all interactive BTSX fixtures compile for client/server and development/production", async () => {
  const names = (await readdir(beastFixtureDirectory)).filter((name) => name.endsWith(".btsx")).sort();
  for (const name of names) {
    for (const mode of ["client", "server"]) {
      await compileFixture(name, mode, true);
      await compileFixture(name, mode, false);
    }
  }
});

test("state, native form events, refs, context, focus, and effect cleanup execute", async () => {
  const InteractiveProfile = await loadClientFixture("InteractiveProfile.btsx");
  const { act, createRoot } = await import("octane");
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const lifecycle = [];
  const refs = [];
  const submissions = [];
  const root = createRoot(container);

  await act(() => root.render(InteractiveProfile, {
    initialName: "Ada",
    onConnect: () => lifecycle.push("connect"),
    onDisconnect: () => lifecycle.push("disconnect"),
    onRefAttach: (attached) => refs.push(attached),
    onSubmit: (submission) => submissions.push(submission),
  }));

  const nameInput = requiredElement(container, "#profile-name");
  const checkbox = requiredElement(container, "#profile-subscribe");
  const select = requiredElement(container, "#profile-role");
  const form = requiredElement(container, "#profile-form");
  assert.deepEqual(lifecycle, ["connect"]);
  assert.deepEqual(refs, [true]);

  nameInput.value = "Grace";
  await act(() => dispatch(nameInput, new browser.InputEvent("input", {
    bubbles: true,
    composed: true,
    data: "Grace",
    inputType: "insertText",
  })));
  assert.match(requiredElement(container, "#profile-summary").textContent, /Grace/);

  checkbox.checked = true;
  await act(() => dispatch(checkbox, new browser.Event("change", { bubbles: true })));
  assert.match(requiredElement(container, "#profile-summary").textContent, /subscribed/);

  select.value = "editor";
  await act(() => dispatch(select, new browser.Event("change", { bubbles: true })));
  assert.match(requiredElement(container, "#profile-summary").textContent, /editor/);

  await act(() => click(requiredElement(container, "#toggle-theme")));
  assert.equal(requiredElement(container, "#theme-label").textContent, "Theme: dark");

  await act(() => click(requiredElement(container, "#focus-name")));
  assert.equal(browser.document.activeElement, nameInput);
  nameInput.blur();
  await act(() => dispatch(browser, new browser.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true })));
  assert.equal(browser.document.activeElement, nameInput);

  await act(() => dispatch(form, new browser.Event("submit", { bubbles: true, cancelable: true })));
  assert.deepEqual(submissions, [{ name: "Grace", subscribed: true, role: "editor" }]);

  await act(() => root.unmount());
  assert.deepEqual(lifecycle, ["connect", "disconnect"]);
  assert.deepEqual(refs, [true, false]);
  assert.equal(container.childNodes.length, 0);
});

test("portals preserve logical bubbling and release their target", async () => {
  const PortalPanel = await loadClientFixture("PortalPanel.btsx");
  const { act, createRoot } = await import("octane");
  const container = browser.document.createElement("div");
  const portalTarget = browser.document.createElement("div");
  browser.document.body.append(container, portalTarget);
  let dismissals = 0;
  let bubbles = 0;
  const root = createRoot(container);

  await act(() => root.render(PortalPanel, {
    target: portalTarget,
    onDismiss: () => dismissals += 1,
    onBubble: () => bubbles += 1,
  }));
  await act(() => click(requiredElement(portalTarget, "button")));
  assert.equal(dismissals, 1);
  assert.equal(bubbles, 1);

  await act(() => root.unmount());
  assert.equal(container.childNodes.length, 0);
  assert.equal(portalTarget.childNodes.length, 0);
});

test("hydration adopts the interactive form and starts refs/effects on the client", async () => {
  const ServerProfile = await loadServerFixture("InteractiveProfile.btsx");
  const ClientProfile = await loadClientFixture("InteractiveProfile.btsx");
  const { act, hydrateRoot } = await import("octane");
  const server = renderToString(ServerProfile, {
    initialName: "Ada",
    onConnect() {},
    onDisconnect() {},
    onRefAttach() {},
    onSubmit() {},
  });
  const container = browser.document.createElement("div");
  container.innerHTML = server.html;
  browser.document.body.append(container);
  const serverForm = requiredElement(container, "#profile-form");
  const serverInput = requiredElement(container, "#profile-name");
  const lifecycle = [];
  const refs = [];
  let root;

  await act(() => {
    root = hydrateRoot(container, ClientProfile, {
      initialName: "Ada",
      onConnect: () => lifecycle.push("connect"),
      onDisconnect: () => lifecycle.push("disconnect"),
      onRefAttach: (attached) => refs.push(attached),
      onSubmit() {},
    });
  });

  assert.equal(requiredElement(container, "#profile-form"), serverForm);
  assert.equal(requiredElement(container, "#profile-name"), serverInput);
  assert.deepEqual(lifecycle, ["connect"]);
  assert.deepEqual(refs, [true]);

  serverInput.value = "Hydrated";
  await act(() => dispatch(serverInput, new browser.InputEvent("input", { bubbles: true, data: "Hydrated" })));
  assert.match(requiredElement(container, "#profile-summary").textContent, /Hydrated/);

  await act(() => root.unmount());
  assert.deepEqual(lifecycle, ["connect", "disconnect"]);
  assert.deepEqual(refs, [true, false]);
});

test("the interactive fixture transforms in Vite development and builds for production", async () => {
  const configFile = path.join(appFixtureDirectory, "vite.config.ts");
  const interactiveFixture = path.join(beastFixtureDirectory, "InteractiveProfile.btsx");
  const server = await createServer({
    root: appFixtureDirectory,
    configFile,
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  try {
    const transformed = await server.transformRequest(`/@fs/${interactiveFixture}`);
    assert.ok(transformed?.code.includes("profile-form"));
  } finally {
    await server.close();
  }

  const outputDirectory = await mkdtemp(path.join(tmpdir(), "react-to-beast-vite-"));
  try {
    await build({
      root: appFixtureDirectory,
      configFile,
      logLevel: "silent",
      build: { outDir: outputDirectory, emptyOutDir: true },
    });
    assert.match(await readFile(path.join(outputDirectory, "index.html"), "utf8"), /assets\/[^"']+\.js/);
    assert.ok((await readdir(path.join(outputDirectory, "assets"))).some((name) => name.endsWith(".js")));
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
