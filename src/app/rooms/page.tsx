"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { listPublicRooms } from "@/lib/api/rooms";
import type { PublicRoom } from "@/lib/types/domain";

export default function RoomsPage() {
  return (
    <RequireAuth>
      <RoomsContent />
    </RequireAuth>
  );
}

function RoomsContent() {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setRooms(await listPublicRooms());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load public rooms");
      }
    })();
  }, []);

  if (error) {
    return <StatusMessage tone="error" title="Rooms" detail={error} />;
  }
  if (!rooms) {
    return <StatusMessage title="Loading rooms…" />;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Public rooms</h1>
      <p className="text-sm text-zinc-600">
        Create a room from any{" "}
        <Link href="/movies/search" className="text-blue-600">
          movie detail
        </Link>{" "}
        page.
      </p>
      {rooms.length === 0 ? (
        <StatusMessage tone="empty" title="No public rooms" />
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id} className="flex justify-between rounded-xl border bg-white px-4 py-3">
              <div>
                <p className="font-medium">Room {room.id}</p>
                <p className="text-sm text-zinc-600">Movie {room.movieId}</p>
              </div>
              <Link
                href={`/rooms/${room.id}`}
                className="text-sm font-medium text-blue-600"
              >
                Join
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
