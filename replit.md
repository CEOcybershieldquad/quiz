# XADON CBT SaaS

XADON is a secure CBT learning workspace with exams, teacher-reviewed question tools, AI study assistance, public question discovery, and defensive security utilities.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/xadon-cbt-saas/` — Vite frontend; `index.html` is the Vercel build entry point.
- `artifacts/api-server/src/routes/xadon.ts` — authenticated learning routes and public integrations.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts.
- `artifacts/xadon-cbt-saas/src/App.tsx` — routes, app shell, auth screens, and product UI.
- `artifacts/xadon-cbt-saas/src/index.css` — XADON visual tokens and typography.

## Architecture decisions

- Clerk owns browser authentication and secure cookie sessions; the app does not implement local password storage.
- AI requests run only on the server and require `OPENAI_API_KEY`; keys never enter the browser bundle.
- Public question discovery uses Open Trivia DB; CVE discovery uses the NVD 2.0 API.
- Header checks are read-only and reject localhost/private network targets to reduce SSRF risk.
- `vercel.json` in the frontend artifact builds and serves the Vite `index.html` output.

## Product

The app provides a public landing page, Clerk sign-in/sign-up, a learner dashboard, exam creation and discovery, question-bank search and authoring, public question import, a teacher-reviewed AI tutor and question-draft generator, CVE watchlist search, and a permission-gated security-header audit.

## User preferences

- Use defensive, authorized security tooling only. Never add credential theft, exploit execution, stealth, or unauthorized scanning.

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The shared generated API client needs `dom.iterable` in its TypeScript `lib` list because Orval uses `Headers.entries()`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
