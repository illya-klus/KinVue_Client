import { gatewayFetch } from "@/lib/gateway/client";
import type { PublicRoom } from "@/lib/types/domain";

export type CreateRoomPayload = {
  movieId: string;
  visibility: "PRIVATE" | "PUBLIC";
};

export function listPublicRooms() {
  return gatewayFetch<{ items?: PublicRoom[] } | PublicRoom[]>("/api/rooms/public").then(
    (data) => (Array.isArray(data) ? data : (data.items ?? [])),
  );
}

export function createRoom(body: CreateRoomPayload) {
  return gatewayFetch<{ id: string }>("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function inviteToRoom(roomId: string, targetUserId: string) {
  return gatewayFetch(`/api/rooms/${roomId}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetUserId, role: "VIEWER" }),
  });
}
