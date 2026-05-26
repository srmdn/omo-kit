# CLAUDE.md — Svelte Project

## Identity
- Use `git config user.name "srmdn" && git config user.email "mail@saidwp.com"` before first commit

## Stack
- Framework: SvelteKit
- Styling: Tailwind CSS
- Language: TypeScript (strict mode)
- Package manager: bun

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

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
