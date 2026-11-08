"use client";

import { useCallback, useEffect, useState } from "react";
import { gatewayFetch } from "@/lib/gateway/client";
import type { NotificationItem, NotificationList } from "@/lib/notifications/types";
import { useAuth } from "@/lib/auth/auth-context";

function formatNotification(item: NotificationItem): string {
  const payload = item.payload;
  switch (item.type) {
    case "ROOM_INVITED": {
      const roomId =
        (payload.roomId as string | undefined) ??
        (payload.payload as { roomId?: string } | undefined)?.roomId;
      return roomId ? `Room invite · ${roomId}` : "Room invite";
    }
    case "FRIEND_REQUEST_CREATED":
      return "New friend request";
    case "FRIEND_REQUEST_ACCEPTED":
      return "Friend request accepted";
    default:
      return item.type;
  }
}

export function NotificationBell() {
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await gatewayFetch<NotificationList>("/api/notifications");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  if (!accessToken) {
    return null;
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        aria-label="Notifications"
      >
        Notifications
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">
            In-app notifications
          </div>
          <p className="px-4 py-2 text-xs text-zinc-500">
            Device push is not sent; these are stored in KinVue only.
          </p>
          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-600">Loading…</p>
          ) : null}
          {error ? (
            <p className="px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 && !loading ? (
              <li className="px-4 py-3 text-sm text-zinc-500">No notifications yet</li>
            ) : null}
            {items.map((item) => (
              <li
                key={item.id}
                className={`border-t border-zinc-100 px-4 py-3 text-sm ${
                  item.readAt ? "opacity-70" : ""
                }`}
              >
                <p className="font-medium">{formatNotification(item)}</p>
                <p className="text-xs text-zinc-500">{item.type}</p>
                {!item.readAt ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                    onClick={async () => {
                      await gatewayFetch(`/api/notifications/${item.id}/read`, {
                        method: "POST",
                      });
                      void load();
                    }}
                  >
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
