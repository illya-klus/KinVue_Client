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
} from "@/lib/api/friends";
import type { FriendRequestRow, FriendRow } from "@/lib/types/domain";

type Tab = "friends" | "incoming" | "outgoing";

export default function FriendsPage() {
  return (
    <RequireAuth>
      <FriendsContent />
    </RequireAuth>
  );
}

function FriendsContent() {
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [f, inc, out] = await Promise.all([
        fetchFriends(),
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load friends data");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onAccept(id: string) {
    await acceptFriendRequest(id);
    void reload();
  }

  async function onReject(id: string) {
    await rejectFriendRequest(id);
    void reload();
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "Friends", count: friends.length },
    { id: "incoming", label: "Incoming", count: incoming.length },
    { id: "outgoing", label: "Outgoing", count: outgoing.length },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Friends</h1>
        <Link href="/users/search" className="text-sm font-medium text-blue-600">
          Find people
        </Link>
      </div>
      {error ? <StatusMessage tone="error" title="Friends" detail={error} /> : null}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-zinc-900 font-medium" : "border-transparent text-zinc-600"
            }`}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>
      {tab === "friends" ? (
        <FriendsList items={friends} />
      ) : tab === "incoming" ? (
        <RequestList items={incoming} onAccept={onAccept} onReject={onReject} />
      ) : (
        <RequestList items={outgoing} />
      )}
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
          {f.username ? <p className="text-sm text-zinc-600">@{f.username}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function RequestList({
  items,
  onAccept,
  onReject,
}: {
  items: FriendRequestRow[];
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
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
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => void onReject(row.id)}
              >
                Reject
              </button>
              <button
                type="button"
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
