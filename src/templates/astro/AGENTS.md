# AGENTS.md — Astro Project

## Identity
- Set your git identity before first commit: `git config user.name "Your Name" && git config user.email "you@example.com"`
- Astro framework, SSR mode

## Stack
- Framework: Astro
- Runtime: Bun (or Node)
- Content: Markdown / MDX
- Styling: CSS Modules or Tailwind
- Deployment: static or SSR (Node adapter)

## Tooling
- Content collections for Markdown management
- View transitions for SPA-like navigation (optional)

## Conventions
- Pages in `src/pages/`
- Components in `src/components/`
- Layouts in `src/layouts/`
- Content collections in `src/content/`
- Static assets in `public/`

## Commands
- `bun run dev` — start dev server
- `bun run build` — production build
- `bun run preview` — preview production build
- `bunx astro check` — type checking

## Agent Instructions
- Prefer Astro components over framework components when possible
- Use content collections for structured content
- Do not introduce new dependencies without approval

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
