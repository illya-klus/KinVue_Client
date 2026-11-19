"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import {
  acceptFriendRequest,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  rejectFriendRequest,
  type Page,
} from "@/lib/api/friends";
import type { FriendRequestRow, FriendRow } from "@/lib/types/domain";

type Tab = "friends" | "incoming" | "outgoing";
type FriendPages = {
  friends: Page<FriendRow>;
  incoming: Page<FriendRequestRow>;
  outgoing: Page<FriendRequestRow>;
};

export default function FriendsPage() {
  return (
    <RequireAuth>
      <FriendsContent />
    </RequireAuth>
  );
}

function FriendsContent() {
  const [tab, setTab] = useState<Tab>("friends");
  const [pages, setPages] = useState<FriendPages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [friends, incoming, outgoing] = await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
      fetchOutgoingRequests(),
    ]);
    setPages({ friends, incoming, outgoing });
  }, []);

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(
        err instanceof Error ? err.message : "Could not load friends data",
      );
    });
  }, [reload]);

  async function resolveRequest(id: string, accepted: boolean) {
    setBusy(true);
    setError(null);
    try {
      await (accepted ? acceptFriendRequest(id) : rejectFriendRequest(id));
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update friend request",
      );
    } finally {
      setBusy(false);
    }
  }

  const cursor = pages?.[tab].nextCursor;
  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      switch (tab) {
        case "friends": {
          const next = await fetchFriends(cursor);
          setPages(
            (current) =>
              current && {
                ...current,
                friends: {
                  items: [...current.friends.items, ...next.items],
                  nextCursor: next.nextCursor,
                },
              },
          );
          break;
        }
        case "incoming":
        case "outgoing": {
          const next = await (tab === "incoming"
            ? fetchIncomingRequests(cursor)
            : fetchOutgoingRequests(cursor));
          setPages(
            (current) =>
              current && {
                ...current,
                [tab]: {
                  items: [...current[tab].items, ...next.items],
                  nextCursor: next.nextCursor,
                },
              },
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load more friends data",
      );
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "friends", label: "Friends" },
    { id: "incoming", label: "Incoming" },
    { id: "outgoing", label: "Outgoing" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Friends</h1>
        <Link
          href="/users/search"
          className="text-sm font-medium text-blue-600"
        >
          Find people
        </Link>
      </div>
      {error ? (
        <StatusMessage tone="error" title="Friends" detail={error} />
      ) : null}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t.id
                ? "border-zinc-900 font-medium"
                : "border-transparent text-zinc-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!pages ? (
        error ? null : (
          <StatusMessage title="Loading friends…" />
        )
      ) : tab === "friends" ? (
        <FriendsList items={pages.friends.items} />
      ) : tab === "incoming" ? (
        <RequestList
          items={pages.incoming.items}
          busy={busy}
          onAccept={(id) => void resolveRequest(id, true)}
          onReject={(id) => void resolveRequest(id, false)}
        />
      ) : (
        <RequestList items={pages.outgoing.items} />
      )}
      {cursor ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadMore()}
          className="rounded-lg border px-3 py-1 text-sm"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}

function FriendsList({ items }: { items: FriendRow[] }) {
  if (items.length === 0) {
    return <StatusMessage tone="empty" title="No friends yet" />;
  }
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f.userId} className="rounded-xl border bg-white px-4 py-3">
          <p className="font-medium">{f.displayName ?? f.userId}</p>
          {f.username ? (
            <p className="text-sm text-zinc-600">@{f.username}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function RequestList({
  items,
  onAccept,
  onReject,
  busy,
}: {
  items: FriendRequestRow[];
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  busy?: boolean;
}) {
  if (items.length === 0) {
    return <StatusMessage tone="empty" title="Nothing here" />;
  }
  return (
    <ul className="space-y-2">
      {items.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3"
        >
          <div className="text-sm">
            <p className="font-medium">
              {row.otherUser?.displayName ?? row.fromUserId} → {row.toUserId}
            </p>
            <p className="text-zinc-500">{row.status}</p>
          </div>
          {onAccept && onReject ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => void onReject(row.id)}
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-zinc-900 px-3 py-1 text-sm text-white"
                onClick={() => void onAccept(row.id)}
              >
                Accept
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
