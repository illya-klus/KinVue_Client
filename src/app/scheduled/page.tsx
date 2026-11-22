"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { cancelScheduledRoom, listScheduledRooms, type ScheduledRoom } from "@/lib/api/rooms";

export default function ScheduledPage() {
  return (
    <RequireAuth>
      <ScheduledContent />
    </RequireAuth>
  );
}

function ScheduledContent() {
  const [items, setItems] = useState<ScheduledRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listScheduledRooms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load scheduled views");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cancel(scheduleId: string) {
    setBusyId(scheduleId);
    setError(null);
    try {
      await cancelScheduledRoom(scheduleId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel scheduled view");
    } finally {
      setBusyId(null);
    }
  }

  if (error && items === null) {
    return <StatusMessage tone="error" title="Scheduled views" detail={error} />;
  }
  if (items === null) return <StatusMessage title="Loading scheduled views…" />;

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Scheduled views</h1>
        <p className="mt-1 text-sm text-zinc-600">Upcoming rooms you have scheduled.</p>
      </header>
      {error ? <StatusMessage tone="error" title="Scheduled views" detail={error} /> : null}
      {items.length === 0 ? (
        <StatusMessage tone="empty" title="No scheduled views" />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.scheduledRoomId} className="space-y-2 rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Movie {item.movieId}</h2>
                  <p className="text-sm text-zinc-600">
                    {new Date(item.scheduledFor).toLocaleString()} · {item.visibility.toLowerCase()} · {item.status.toLowerCase()}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {item.inviteeIds.length} invitee{item.inviteeIds.length === 1 ? "" : "s"}
                  </p>
                </div>
                {item.status === "SCHEDULED" ? (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void cancel(item.scheduledRoomId)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {busyId === item.scheduledRoomId ? "Cancelling…" : "Cancel"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
