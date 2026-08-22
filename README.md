# React to Beast skill

A Codex skill for porting complete React applications to Beast BTSX → TSRX → Octane in verified stages. Tailwind is the default styling target, with pure CSS available as an explicit option.

## Version 0.1

The foundation release provides:

- a bounded, dependency-free React application audit;
- detection for Vite, Create React App, React Router, TanStack Router, Remix, and Next.js conventions;
- route-contract and server-boundary inventory without executing source-project scripts;
- Tailwind-default and pure-CSS migration guidance;
- safe scaffolding and basic presentational JSX-to-BTSX porting guidance;
- risk flags for class components, refs, native input events, CSS-in-JS, bindings, React Server Components, and server actions;
- fixtures covering Vite, React Router data routing, and the Next.js App Router.

Advanced route and server conversions are intentionally identified rather than guessed through in this release.

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

Run the audit fixtures:

```bash
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

1. Interactive semantics: state, effects, forms, refs, context, stores, and library bindings.
2. Routing: React Router modes, TanStack Router, Remix route modules, and contract parity.
3. Next.js: Pages Router and App Router plans, server/client boundaries, actions, API routes, and deployment behavior.
4. Advanced automation: AST-assisted conversion, React islands, SSR, and browser/visual parity checks.

## License

ISC
