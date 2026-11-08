# KinVue Client

Next.js web app for [KinVue Server](https://github.com/illya-klus/KinVue_Server). HTTP traffic goes **only** through the Gateway (`NEXT_PUBLIC_GATEWAY_URL`, default `http://localhost:4000`).

## Implemented (Sprints 2–5 web scope)

- **Foundation (Sprint 2):** routing shell, Gateway client, auth refresh/logout, protected/admin wrappers, shared UI states, Playwright homepage smoke (`pnpm test:e2e`)
- **Auth UI:** register (12+ char password, 409 handling), login → movie search
- **Social UI:** profile view/edit, user search (min 2 chars), friend requests (incoming/outgoing), friends list
- **Movie UI:** debounced search (300 ms), detail + watchlist, watchlist page, admin create/publish/schedule
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

Playwright smoke can be added under `e2e/` when CI is wired.
