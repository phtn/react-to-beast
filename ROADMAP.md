# React to Beast roadmap

The skill grows by capability gates, not by claiming broader migrations from more pattern matching. Each milestone must keep earlier fixtures passing and add compile, runtime, and parity evidence for the new surface.

## Principles

- Preserve behavior and contracts before simplifying architecture.
- Audit the entire source, but migrate in dependency-safe vertical slices.
- Keep source code intact and make destination mutations reviewable.
- Use Tailwind by default while supporting pure CSS without treating it as a fallback.
- Prefer an explicit unsupported boundary over an unverified conversion.
- Keep router and server protocols distinct even when their file names look similar.

## v0.1 — Foundation (implemented)

Capabilities:

- bounded, non-executing React project inventory;
- Vite, Create React App, React Router, TanStack Router, Remix, Next.js, and custom-history signals;
- Tailwind/CSS/CSS Modules/Sass/Less/inline/CSS-in-JS inventory;
- dependency and candidate Octane-binding review list;
- migration contract, safe Beast scaffolding, and presentational JSX-to-BTSX guidance;
- blockers for class/ref APIs, input event semantics, route contracts, RSC/server actions, and runtime styling systems.

Exit evidence:

- fixtures for a Vite component, React Router data app, and Next App Router app;
- deterministic JSON and overwrite protection;
- every BTSX documentation example compiles through Beast and Octane;
- Codex skill validation and publisher dry-run pass.

## v0.2 — Interactive semantics (implemented)

Capabilities:

- reviewed mappings for supported hooks and lifecycle behavior;
- controlled/uncontrolled forms and a React-to-Octane event semantics table;
- context/provider, portal, ref callback, error-boundary, and suspense strategies;
- state-store, query, form, animation, icon, and component-library binding checks;
- a component state-matrix generator and runtime harness.

Exit criteria:

- representative fixtures cover state, effects with cleanup, text/checkbox/select inputs, refs, context, portals, boundaries, and omitted hook dependencies;
- converted fixtures compile for client/server and development/production, transform in Vite development, and complete a Vite production build;
- unsupported API reports identify a file, line, category, severity, and reason without exposing source content;
- behavior tests cover native form events, keyboard input, cleanup, focus, context, portals, and hydration adoption;
- the audit emits a source-safe Markdown state matrix and categorized binding candidates.

## v0.3 — Client and data routers (implemented)

Capabilities:

- normalized route manifest with source locations, parent/path/param contracts, capabilities, targets, and checkpoints;
- deterministic source/target route comparison for paths, route roles, nesting, params, search keys/modes, redirect targets, and owned capabilities;
- React Router declarative and data targets, with a hard rewrite gate for Framework Mode;
- TanStack code-based targets and file-based generator plans;
- Remix flat-route/module inventories with hard client/server target gates;
- nested layouts/outlets, params, typed search state, links, redirects, errors, blockers, scroll restoration, loaders, actions, and revalidation;
- route-by-route migration checkpoints and hybrid handoff contracts.

Exit evidence:

- realistic nested fixtures cover React Router declarative/data/framework modes, TanStack code/file trees, and Remix route modules;
- the React Router data source/Beast manifests match across five nested/index/dynamic/redirect/wildcard routes, and the TanStack code source/Beast manifests match across four root/index/nested/dynamic routes;
- loader/action and framework-mode findings require explicit targets rather than package-name matches;
- both routed Beast fixtures compile client/server in development/production, build with Vite, and execute direct entry, links, search/params, back/forward, redirects, not-found, and loader errors in a DOM; the React Router fixture also covers reload-equivalent recreation and action data.

## v0.4 — Next.js and server boundaries

Treat the Pages Router and App Router as separate protocols.

Add:

- Pages Router analysis for `_app`, `_document`, data methods, API routes, rewrites, redirects, and headers;
- App Router analysis for layouts, route groups, dynamic/catch-all segments, parallel/intercepting routes, and special files;
- server/client graphing for React Server Components, server-only imports, cache behavior, streaming, and server actions;
- explicit mappings for route handlers, middleware, metadata, images, fonts, cookies, and headers;
- a target decision record for Vite SPA, Rsbuild full app, or a documented retained service boundary.

Exit criteria:

- Pages and App fixtures each include dynamic routes, data, errors, metadata, and server endpoints;
- no transformation can move secrets or server-only dependencies into client output;
- server actions retain transport, validation, authentication, mutation, and error semantics;
- SSR/hydration and direct-navigation tests pass in the selected Beast target.

## v0.5 — Whole-app automation and parity

Add:

- AST-assisted component conversion with source-located diagnostics;
- dependency graph ordering, resumable checkpoints, dry-run plans, and conflict-aware writes;
- supported React-hosted Octane islands or explicit retained React boundaries for intentionally deferred dependencies;
- asset/import rewriting and dead-source cleanup only after verification;
- automated accessibility, browser, screenshot, and production-build parity reports.

Exit criteria:

- a multi-route reference application ports from a clean checkout without editing the source tree;
- every mutation appears in a previewable plan and can resume after an interrupted slice;
- compile, type, unit, browser, accessibility, visual, SSR, and production-build gates are green;
- the final report distinguishes fully migrated code, React-hosted Octane islands, retained React/services boundaries, and accepted differences.

## v1.0 — Stable migration contract

Stabilize the audit/report schemas, compatibility declarations, upgrade policy, and regression corpus. Publish v1 only after at least one non-fixture Vite application and one non-fixture routed/server application have been ported end to end with documented parity evidence.
