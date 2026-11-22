"use client";

import { useCallback, useEffect, useState } from "react";
import {
  changeRoomMemberRole,
  createRoomInviteLink,
  getRoomMembers,
  inviteToRoom,
  type RoomMembersResponse,
} from "@/lib/api/rooms";
import { StatusMessage } from "@/components/ui/status-message";

export function RoomMembersPanel({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<RoomMembersResponse | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRoom(await getRoomMembers(roomId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load room members");
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function sendInvite() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await inviteToRoom(roomId, targetUserId.trim());
      setTargetUserId("");
      setNotice("Invite sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const invite = await createRoomInviteLink(roomId);
      const url = `${window.location.origin}/invite/${invite.roomId}#token=${encodeURIComponent(invite.inviteToken)}`;
      await navigator.clipboard.writeText(url);
      setNotice("Private invite link copied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite link");
    } finally {
      setBusy(false);
    }
  }

  async function setRole(userId: string, role: "CONTROLLER" | "VIEWER") {
    setBusy(true);
    setError(null);
    try {
      await changeRoomMemberRole(roomId, userId, role);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change member role");
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return error ? <StatusMessage tone="error" title="Room members" detail={error} /> : <StatusMessage title="Loading room members…" />;
  }
  const isOwner = room.currentUserRole === "OWNER";

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">Members ({room.members.length})</h2>
      {error ? <StatusMessage tone="error" title="Room members" detail={error} /> : null}
      <ul className="space-y-2">
        {room.members.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="min-w-0 break-all">
              {member.userId} · {member.role} · {member.presence.toLowerCase()}
            </span>
            {isOwner && member.role !== "OWNER" ? (
              <label className="flex items-center gap-2">
                <span className="sr-only">Role for {member.userId}</span>
                <select
                  aria-label={`Role for ${member.userId}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(event) => void setRole(member.userId, event.target.value as "CONTROLLER" | "VIEWER")}
                  className="rounded-lg border px-2 py-1"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="CONTROLLER">Controller</option>
                </select>
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <div className="space-y-3 border-t pt-3">
          <h3 className="text-sm font-semibold">Invite friend</h3>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Target user UUID"
              className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm"
              placeholder="Target user UUID"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
            />
            <button type="button" disabled={busy || !targetUserId.trim()} className="rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => void sendInvite()}>
              Invite
            </button>
            {room.visibility === "PRIVATE" ? (
              <button type="button" disabled={busy} className="rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => void copyInviteLink()}>
                Create and copy invite link
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}
    </section>
  );
}
