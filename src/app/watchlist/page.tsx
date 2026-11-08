"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { fetchWatchlist, removeFromWatchlist } from "@/lib/api/movies";
import type { WatchlistItem } from "@/lib/types/domain";

export default function WatchlistPage() {
  return (
    <RequireAuth>
      <WatchlistContent />
    </RequireAuth>
  );
}

function WatchlistContent() {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await fetchWatchlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load watchlist");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return <StatusMessage tone="error" title="Watchlist" detail={error} />;
  }
  if (!items) {
    return <StatusMessage title="Loading watchlist…" />;
  }
  if (items.length === 0) {
    return (
      <StatusMessage
        tone="empty"
        title="Watchlist is empty"
        detail="Search movies and save titles from the detail page."
      />
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.movieId}
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
          >
            <Link href={`/movies/${item.movieId}`} className="font-medium text-blue-700">
              {item.title ?? item.movieId}
            </Link>
            <button
              type="button"
              className="text-sm text-red-700"
              onClick={async () => {
                await removeFromWatchlist(item.movieId);
                void load();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
