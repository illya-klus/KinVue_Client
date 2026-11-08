"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { gatewayFetch } from "@/lib/gateway/client";

export default function FriendsPage() {
  return (
    <RequireAuth>
      <FriendsContent />
    </RequireAuth>
  );
}

function FriendsContent() {
  const [friends, setFriends] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await gatewayFetch("/api/friends");
        setFriends(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load friends");
      }
    })();
  }, []);

  if (error) {
    return <StatusMessage tone="error" title="Friends" detail={error} />;
  }
  if (!friends) {
    return <StatusMessage title="Loading friends…" />;
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Friends</h1>
      <pre className="rounded-xl border bg-white p-4 text-xs">
        {JSON.stringify(friends, null, 2)}
      </pre>
    </section>
  );
}
