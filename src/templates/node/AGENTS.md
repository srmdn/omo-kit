# AGENTS.md — Node.js Project

## Identity
- Set your git identity before first commit: `git config user.name "Your Name" && git config user.email "you@example.com"`
- Bun runtime, TypeScript

## Stack
- Runtime: Bun
- Bundler: Vite (for SPAs)
- Language: TypeScript (strict mode)
- Package manager: bun

## Tooling
- Bun for runtime, package management, and testing
- TypeScript for type safety
- Vite for frontend bundling (when applicable)

## Conventions
- ESM modules (`"type": "module"` in package.json)
- `src/` for source, `dist/` for build output (gitignored)
- Tests: `bun test` with `*_test.ts` naming
- Use `fetch` built-in (Bun), not `node-fetch`
- Environment variables via `Bun.env`

## Commands
- `bun install` — install dependencies
- `bun run dev` — start dev server
- `bun test` — run tests
- `bun run build` — production build
- `bun run typecheck` — type checking only

## Agent Instructions
- Use Bun-native APIs where available
- Do not introduce new dependencies without approval
- Keep TypeScript strict; no `as any` or `@ts-ignore`

## Commit Style
- Small, atomic commits
- Conventional commit prefixes: feat, fix, refactor, docs, chore
