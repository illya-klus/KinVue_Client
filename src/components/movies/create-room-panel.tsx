"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom } from "@/lib/api/rooms";
import { StatusMessage } from "@/components/ui/status-message";

export function CreateRoomPanel({ movieId }: { movieId: string }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    setLoading(true);
    setError(null);
    try {
      const room = await createRoom({ movieId, visibility });
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="text-sm font-semibold">Watch room</h2>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={visibility === "PRIVATE"}
          onChange={() => setVisibility("PRIVATE")}
        />
        Private
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={visibility === "PUBLIC"}
          onChange={() => setVisibility("PUBLIC")}
        />
        Public
      </label>
      {error ? <StatusMessage tone="error" title="Room" detail={error} /> : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => void onCreate()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create room"}
      </button>
    </section>
  );
}
