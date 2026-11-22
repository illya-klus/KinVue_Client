"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom, createScheduledRoom } from "@/lib/api/rooms";
import { StatusMessage } from "@/components/ui/status-message";

export function CreateRoomPanel({ movieId }: { movieId: string }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [invitees, setInvitees] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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

  async function onSchedule() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const inviteeIds = invitees
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter(Boolean);
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (inviteeIds.some((id) => !uuidPattern.test(id))) {
        throw new Error("Enter invitee user IDs as UUIDs, separated by spaces or commas.");
      }
      if (!scheduledFor || new Date(scheduledFor).getTime() <= Date.now()) {
        throw new Error("Choose a time in the future.");
      }
      await createScheduledRoom({
        movieId,
        visibility,
        scheduledFor: new Date(scheduledFor).toISOString(),
        inviteeIds: [...new Set(inviteeIds)],
      });
      setNotice("Viewing scheduled. You can manage it on Scheduled views.");
      setScheduledFor("");
      setInvitees("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule viewing");
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
      <div className="border-t pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Schedule a viewing</h3>
        <label className="block space-y-1 text-sm">
          <span>Time</span>
          <input
            aria-label="Viewing time"
            type="datetime-local"
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            className="block rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Invitee user IDs (UUIDs, separated by spaces or commas)</span>
          <textarea
            aria-label="Invitee user IDs"
            value={invitees}
            onChange={(event) => setInvitees(event.target.value)}
            rows={2}
            className="block w-full rounded-lg border px-3 py-2"
          />
        </label>
        {notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}
        <button
          type="button"
          disabled={loading || !scheduledFor}
          onClick={() => void onSchedule()}
          className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Saving…" : "Schedule viewing"}
        </button>
      </div>
    </section>
  );
}
