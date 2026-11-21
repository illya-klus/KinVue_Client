# KinVue Client

Next.js web app for [KinVue Server](https://github.com/illya-klus/KinVue_Server). HTTP traffic goes **only** through the Gateway (`NEXT_PUBLIC_GATEWAY_URL`, default `http://localhost:4000`).

## Implemented (Sprints 2–5 web scope)

- **Foundation (Sprint 2):** routing shell, Gateway client, auth refresh/logout, protected/admin wrappers, shared UI states, Playwright homepage smoke (`pnpm test:e2e`)
- **Auth UI:** register (12+ char password, 409 handling), login → movie search
- **Social UI:** profile view/edit, user search (min 2 chars), friend requests (incoming/outgoing), friends list
- **Movie UI:** search (300 ms, min 2), detail + watchlist, admin create/edit/publish/schedule with catalog/index status
- **Rooms UI:** public list, create from movie detail, room page (WS sync, chat, invite URL, playback controls gated on `room.state_sync`)
- **Notifications:** in-app bell (`KIN-283`) with friend/room payload labels, no device-push claim
- **Media UI:** `POST …/media-access` before HLS (`hls.js`), admin multipart upload direct to presigned MinIO URLs

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

Run `pnpm test:e2e` for browser checks. Sprint 3 adds eight tests for movie administration, search, watchlist, profile and social flows; these isolate the UI with HTTP fixtures. Ten existing future-stack placeholders remain skipped and do not prove those features.

Sprint 3 uses `GET /api/admin/movies/:id` to load `/admin/movies/:id/edit`, PATCH to save metadata, and POST publish/schedule. A saved catalog entry may still be waiting for asynchronous search indexing. Blank optional duration/poster fields are omitted on create and cleared with null on edit. Watchlist uses the authenticated caller, and anonymous users are sent to login.

The backend's `doc/runbooks/movie-sprint-3.md` describes migrations and `services/movie/test/browser-smoke.cjs`, which also verified this client against real Gateway, Movie, PostgreSQL 16 and Meilisearch with a test Auth/JWKS issuer. S3/FFmpeg playback and Rooms are later backend work. This branch depends on the Sprint 2 client PR #1.
