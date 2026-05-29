# AGENTS.md — Svelte Project

## Identity
- Set your git identity before first commit: `git config user.name "Your Name" && git config user.email "you@example.com"`

## Stack
- Framework: SvelteKit
- Styling: Tailwind CSS
- Language: TypeScript (strict mode)
- Package manager: bun

## Tooling
- SvelteKit for routing and SSR
- Tailwind CSS for styling
- TypeScript for type safety

## Conventions
- `src/lib/` for shared components
- `src/routes/` for page routes
- `$lib` alias for imports from `src/lib/`
- Use `+page.svelte`, `+layout.svelte` conventions
- Runes mode (`$state`, `$derived`, `$effect`) preferred

## Commands
- `bun install` — install dependencies
- `bun run dev` — start dev server
- `bun run build` — production build
- `bun run check` — type check + lint

## Agent Instructions
- Follow SvelteKit file-based routing conventions
- Do not introduce new dependencies without approval

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
