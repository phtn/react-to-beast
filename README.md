# React to Beast skill

A Codex skill for porting complete React applications to Beast BTSX → TSRX → Octane in verified stages. Tailwind is the default styling target, with pure CSS available as an explicit option.

## Version 0.3

The client/data-routing release provides:

- a bounded, dependency-free React application audit;
- detection for Vite, Create React App, React Router, TanStack Router, Remix, and Next.js conventions;
- route-contract and server-boundary inventory without executing source-project scripts;
- Tailwind-default and pure-CSS migration guidance;
- safe scaffolding and basic presentational JSX-to-BTSX porting guidance;
- source-located interactive findings with no source excerpts or secret values;
- a generated Markdown parity matrix for state, effects, forms, refs, context, portals, boundaries, transitions, and hydration;
- a normalized, source-located route manifest plus a source/target route-contract comparator;
- React Router declarative/data route support and explicit rewrite gates for Framework Mode;
- TanStack code/file route inventories with typed search/loader/generator review gates;
- Remix flat-route/module inventories with explicit client/server target decisions;
- route-by-route checkpoints for direct loads, links, reload, history, params/search, loaders/actions, redirects, errors, not-found, blockers, scroll, and hydration;
- reviewed hook mappings, including React/Octane omitted-dependency semantics;
- native event guidance for text fields, checkables, selects, forms, and React synthetic event types;
- direct-ref, context, portal, Suspense/error-boundary, hydration, and React-hosted Octane-island strategies;
- categorized Octane binding candidates with explicit surface/SSR review gates;
- fixtures covering React Router's three modes, TanStack code/file trees, Remix modules, Next App Router, and executable Beast components.

The test suite compiles client/server and development/production modes, executes interactive and routed behavior in a DOM, compares source and Beast route manifests, transforms fixtures through Vite, and runs production builds. Executable React Router Data and TanStack code-router Beast fixtures prove nested links, params/search, direct entry, back/forward, redirects, loader errors, and not-found state; the React Router fixture also proves actions. React Router Framework Mode, Remix request ownership, Next.js, and broader server conversions are explicitly planned rather than guessed through.

## Install locally

From this repository:

```bash
npx skills add . --skill react-to-beast
```

Then prompt Codex with, for example:

> Use $react-to-beast to audit and port this React app to Beast. Keep the default Tailwind target.

Ask for pure CSS when appropriate:

> Use $react-to-beast to port this app with pure CSS and preserve its CSS Modules.

## Development

Install development dependencies and run the audit/compiler/runtime fixtures:

```bash
npm install
npm test
```

Validate the skill package with the Codex skill validator:

```bash
SKILL_CREATOR_DIR=/path/to/skill-creator
uv run --isolated --with pyyaml python \
  "$SKILL_CREATOR_DIR/scripts/quick_validate.py" \
  skills/react-to-beast
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the staged plan and exit criteria:

1. Next.js: Pages Router and App Router plans, server/client boundaries, actions, API routes, and deployment behavior.
2. Advanced automation: AST-assisted conversion, React-hosted Octane islands, SSR, and browser/visual parity checks.

## License

ISC
