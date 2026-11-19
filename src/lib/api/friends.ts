import { gatewayFetch } from "@/lib/gateway/client";
import type { FriendRequestRow, FriendRow } from "@/lib/types/domain";

export type Page<T> = { items: T[]; nextCursor: string | null };

function fetchPage<T>(path: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return gatewayFetch<Page<T>>(`${path}?${params}`);
}

export function fetchFriends(cursor?: string) {
  return fetchPage<FriendRow>("/api/friends", cursor);
}

export function fetchIncomingRequests(cursor?: string) {
  return fetchPage<FriendRequestRow>("/api/friend-requests/incoming", cursor);
}

export function fetchOutgoingRequests(cursor?: string) {
  return fetchPage<FriendRequestRow>("/api/friend-requests/outgoing", cursor);
}

export function sendFriendRequest(targetUserId: string) {
  return gatewayFetch("/api/friend-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetUserId }),
  });
}

export function acceptFriendRequest(id: string) {
  return gatewayFetch(`/api/friend-requests/${id}/accept`, { method: "POST" });
}

export function rejectFriendRequest(id: string) {
  return gatewayFetch(`/api/friend-requests/${id}/reject`, { method: "POST" });
}
