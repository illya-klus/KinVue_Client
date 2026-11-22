import { gatewayFetch } from "@/lib/gateway/client";
import type { PublicRoom } from "@/lib/types/domain";

export type CreateRoomPayload = {
  movieId: string;
  visibility: "PRIVATE" | "PUBLIC";
};

export type ScheduledRoom = {
  scheduledRoomId: string;
  roomId: string;
  ownerId: string;
  movieId: string;
  visibility: "PRIVATE" | "PUBLIC";
  scheduledFor: string;
  status: "SCHEDULED" | "OPENED" | "CANCELLED";
  inviteeIds: string[];
};

export type ScheduleRoomPayload = {
  movieId: string;
  visibility: "PRIVATE" | "PUBLIC";
  scheduledFor: string;
  inviteeIds: string[];
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

export function createScheduledRoom(body: ScheduleRoomPayload) {
  return gatewayFetch<ScheduledRoom>("/api/scheduled-rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listScheduledRooms() {
  return gatewayFetch<{ items?: ScheduledRoom[] } | ScheduledRoom[]>("/api/scheduled-rooms").then(
    (data) => (Array.isArray(data) ? data : (data.items ?? [])),
  );
}

export function cancelScheduledRoom(scheduleId: string) {
  return gatewayFetch<ScheduledRoom>(`/api/scheduled-rooms/${scheduleId}/cancel`, {
    method: "POST",
  });
}

export function inviteToRoom(roomId: string, targetUserId: string) {
  return gatewayFetch(`/api/rooms/${roomId}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetUserId, role: "VIEWER" }),
  });
}
