import { gatewayFetch } from "@/lib/gateway/client";
import type { FriendRequestRow, FriendRow } from "@/lib/types/domain";

export function fetchFriends() {
  return gatewayFetch<{ items?: FriendRow[] } | FriendRow[]>("/api/friends").then(
    (data) => (Array.isArray(data) ? data : (data.items ?? [])),
  );
}

export function fetchIncomingRequests() {
  return gatewayFetch<{ items?: FriendRequestRow[] } | FriendRequestRow[]>(
    "/api/friend-requests/incoming",
  ).then((data) => (Array.isArray(data) ? data : (data.items ?? [])));
}

export function fetchOutgoingRequests() {
  return gatewayFetch<{ items?: FriendRequestRow[] } | FriendRequestRow[]>(
    "/api/friend-requests/outgoing",
  ).then((data) => (Array.isArray(data) ? data : (data.items ?? [])));
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
