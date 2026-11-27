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

Run `pnpm test:e2e` for browser checks. Sprint 3 adds eight tests for movie administration, search, watchlist, profile and social flows; these isolate the UI with HTTP fixtures. Seven future-stack placeholders remain skipped and do not prove those features. Two live Auth journeys run in the dedicated disposable-stack CI job.

`pnpm test:e2e:full` sets `E2E_STACK=1` and runs the same Playwright suite against a running local stack. For disposable live Auth coverage, the `live-auth` GitHub Actions job starts KinVue_Server `dev`, creates a one-run signing key and database, then runs `e2e/registration.live.spec.ts` and `e2e/login.live.spec.ts` through Gateway. Its Compose volumes are removed at job end; no GitHub secrets or paid services are used.

Sprint 3 uses `GET /api/admin/movies/:id` to load `/admin/movies/:id/edit`, PATCH to save metadata, and POST publish/schedule. A saved catalog entry may still be waiting for asynchronous search indexing. Blank optional duration/poster fields are omitted on create and cleared with null on edit. Watchlist uses the authenticated caller, and anonymous users are sent to login.

The backend's `doc/runbooks/movie-sprint-3.md` describes migrations and `services/movie/test/browser-smoke.cjs`, which also verified this client against real Gateway, Movie, PostgreSQL 16 and Meilisearch with a test Auth/JWKS issuer. S3/FFmpeg playback and Rooms are later backend work. This branch depends on the Sprint 2 client PR #1.

The client now follows the merged Auth cookie contract: access tokens stay in memory, refresh uses the HttpOnly cookie with credentials, and reload restores the session. Concurrent 401 responses share a refresh. The cookie-session browser test covers reload, expired access and logout; legacy browser-storage tokens are discarded.

## Sprint 4 realtime

The room page now authenticates directly with Rooms WebSocket, waits for room.state_sync, gates play/pause/seek by OWNER or CONTROLLER, ignores older versions, and reconnects with a fresh cookie-backed session. Chat uses message IDs and 1–1000 characters; the five reactions are like/laugh/wow/sad/fire. Heartbeat is 30 seconds, leave stops participation. Room media follows the server anchor with native controls disabled; solo playback sends no room events.

Four Playwright realtime cases complement the existing room/member tests. The backend runbook doc/runbooks/rooms-sprint-4.md documents a real browser + two Rooms instances + Redis 7 smoke, including restart/resync. HTTP Auth/metadata are fixtures in that smoke; signed media delivery remains separate work.

### Sprint 5 media

Multipart parts go directly to private storage. Successful ETags stay in memory for this page; retry renews URLs for unfinished parts within the 24-hour upload session. No synthetic ETags are accepted. HLS requests media-access first and renews before expiry; leaving destroys the player and cancels renewal. Room roles and authoritative playback remain enforced. Run `pnpm exec playwright test e2e/media-sprint-5.spec.ts e2e/solo-playback.spec.ts e2e/rooms-realtime.spec.ts`. Storage must allow the web origin and expose ETag.
