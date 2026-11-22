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

export type RoomMember = {
  userId: string;
  role: "OWNER" | "CONTROLLER" | "VIEWER";
  presence: "ONLINE" | "DISCONNECTED" | "LEFT" | "OFFLINE";
};

export type RoomMembersResponse = {
  roomId: string;
  movieId: string;
  visibility: "PRIVATE" | "PUBLIC";
  ownerId: string;
  currentUserRole: RoomMember["role"];
  members: RoomMember[];
};

export function listPublicRooms() {
  return gatewayFetch<{ items?: PublicRoom[] } | PublicRoom[]>(
    "/api/rooms/public",
  ).then((data) => (Array.isArray(data) ? data : (data.items ?? [])));
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
  return gatewayFetch<{ items?: ScheduledRoom[] } | ScheduledRoom[]>(
    "/api/scheduled-rooms",
  ).then((data) => (Array.isArray(data) ? data : (data.items ?? [])));
}

export function cancelScheduledRoom(scheduleId: string) {
  return gatewayFetch<ScheduledRoom>(
    `/api/scheduled-rooms/${scheduleId}/cancel`,
    {
      method: "POST",
    },
  );
}

export function inviteToRoom(roomId: string, targetUserId: string) {
  return gatewayFetch(`/api/rooms/${roomId}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetUserId, role: "VIEWER" }),
  });
}

export function createRoomInviteLink(roomId: string) {
  return gatewayFetch<{
    roomId: string;
    inviteToken: string;
    expiresAt: string;
  }>(`/api/rooms/${roomId}/invites/link`, { method: "POST" });
}

export function acceptRoomInvite(roomId: string, token: string) {
  return gatewayFetch(`/api/rooms/${roomId}/invites/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function getRoomMembers(roomId: string) {
  return gatewayFetch<RoomMembersResponse>(`/api/rooms/${roomId}/members`);
}

export function changeRoomMemberRole(
  roomId: string,
  userId: string,
  role: "CONTROLLER" | "VIEWER",
) {
  return gatewayFetch(`/api/rooms/${roomId}/permissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, role }),
  });
}
