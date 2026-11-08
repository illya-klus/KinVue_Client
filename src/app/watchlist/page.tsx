"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { gatewayFetch } from "@/lib/gateway/client";

export default function WatchlistPage() {
  return (
    <RequireAuth>
      <WatchlistContent />
    </RequireAuth>
  );
}

function WatchlistContent() {
  const [items, setItems] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await gatewayFetch<{ items?: unknown[] }>("/api/watchlist");
        setItems(data.items ?? (Array.isArray(data) ? data : []));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load watchlist");
      }
    })();
  }, []);

  if (error) {
    return <StatusMessage tone="error" title="Watchlist" detail={error} />;
  }
  if (!items) {
    return <StatusMessage title="Loading watchlist…" />;
  }
  if (items.length === 0) {
    return <StatusMessage tone="empty" title="Watchlist is empty" />;
  }
  return (
    <pre className="rounded-xl border bg-white p-4 text-xs">
      {JSON.stringify(items, null, 2)}
    </pre>
  );
}
