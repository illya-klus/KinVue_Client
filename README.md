# KinVue Client

Next.js web app for [KinVue Server](https://github.com/illya-klus/KinVue_Server). HTTP traffic goes **only** through the Gateway (`NEXT_PUBLIC_GATEWAY_URL`, default `http://localhost:4000`).

## Implemented (MVP slices)

- Gateway API client with Bearer token + refresh on 401
- Register / login / logout (Phase 11–12 plan)
- Public movie search and detail (`/movies/search`, `/movies/:id`)
- Protected stubs: profile, friends, watchlist, rooms, admin movies
- **Notification bell** (`GET /api/notifications`, mark read) — KIN-283
- Shared loading / empty / error states

## Dev

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

App: http://localhost:3000

Ensure Gateway and required services are up (see KinVue_Server runbooks).

## Tests

```bash
pnpm build
```

Playwright smoke can be added under `e2e/` when CI is wired.
