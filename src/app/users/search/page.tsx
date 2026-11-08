"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { searchUsers } from "@/lib/api/users";
import { sendFriendRequest } from "@/lib/api/friends";
import type { UserSearchHit } from "@/lib/types/domain";

export default function UserSearchPage() {
  return (
    <RequireAuth>
      <UserSearchContent />
    </RequireAuth>
  );
}

function UserSearchContent() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [hits, setHits] = useState<UserSearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    setSubmitted(q);
    setLoading(true);
    setError(null);
    try {
      const data = await searchUsers(q);
      setHits(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  async function onSend(targetUserId: string) {
    try {
      await sendFriendRequest(targetUserId);
      setSent((s) => ({ ...s, [targetUserId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Find people</h1>
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Username or display name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          disabled={loading}
        >
          Search
        </button>
      </form>
      {error ? <StatusMessage tone="error" title="Search" detail={error} /> : null}
      {submitted && hits.length === 0 && !loading ? (
        <StatusMessage tone="empty" title="No users" detail={`No matches for “${submitted}”.`} />
      ) : null}
      <ul className="space-y-2">
        {hits.map((hit) => (
          <li
            key={hit.userId}
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium">{hit.displayName}</p>
              <p className="text-sm text-zinc-600">@{hit.username}</p>
            </div>
            {sent[hit.userId] ? (
              <span className="text-sm text-zinc-500">Request sent</span>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-blue-600"
                onClick={() => void onSend(hit.userId)}
              >
                Add friend
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-600">
        Manage requests on{" "}
        <Link className="text-blue-600 hover:underline" href="/friends">
          Friends
        </Link>
        .
      </p>
    </section>
  );
}
