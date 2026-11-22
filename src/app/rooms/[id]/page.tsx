"use client";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { HlsPlayer } from "@/components/media/hls-player";
import { useRoomSocket } from "@/components/rooms/use-room-socket";
import { RoomMembersPanel } from "@/components/rooms/room-members-panel";
import { StatusMessage } from "@/components/ui/status-message";
const emojis = { like: "👍", laugh: "😂", wow: "😮", sad: "😢", fire: "🔥" };
export default function RoomPage() {
  return (
    <RequireAuth>
      <RoomContent />
    </RequireAuth>
  );
}
function RoomContent() {
  const { id } = useParams<{ id: string }>();
  const { state, sendChat, sendPlayback, sendReaction, leave, reconnect } =
    useRoomSocket(id);
  const [text, setText] = useState("");
  const [seek, setSeek] = useState("");
  const canControl =
    state.synced && ["OWNER", "CONTROLLER"].includes(state.role ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (sendChat(text)) setText("");
  }
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Room {id}</h1>
        {!state.connected && !state.left ? (
          <button
            type="button"
            onClick={reconnect}
            className="text-sm text-blue-600"
          >
            Reconnect
          </button>
        ) : null}
        <button
          type="button"
          onClick={leave}
          disabled={!state.synced}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          Leave room
        </button>
        {state.left ? (
          <Link href="/rooms" className="text-blue-700">
            Back to rooms
          </Link>
        ) : null}
      </header>
      {!state.synced && !state.left ? (
        <StatusMessage
          title={
            state.reconnecting
              ? "Connecting to room…"
              : "Waiting for room connection"
          }
          detail="Controls are available after the room has synchronized."
        />
      ) : null}
      {state.error ? (
        <StatusMessage tone="error" title="Room" detail={state.error} />
      ) : null}
      {state.synced ? (
        <p role="status">
          Your role: {state.role} · {state.playbackStatus} @{" "}
          {Math.round(state.positionSeconds ?? 0)}s · version {state.version}
        </p>
      ) : null}
      {state.movieId && state.playbackStatus && state.updatedAt ? (
        <HlsPlayer
          movieId={state.movieId}
          roomPlayback={{
            status: state.playbackStatus,
            position: state.positionSeconds ?? 0,
            updatedAt: state.updatedAt,
            version: state.version,
          }}
          roomSynced={state.synced}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
        <button
          type="button"
          disabled={!canControl}
          onClick={() => sendPlayback("room.play", state.positionSeconds ?? 0)}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          Play
        </button>
        <button
          type="button"
          disabled={!canControl}
          onClick={() => sendPlayback("room.pause", state.positionSeconds ?? 0)}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          Pause
        </button>
        <label>
          Seek position (seconds)
          <input
            aria-label="Seek position (seconds)"
            type="number"
            min={0}
            step="any"
            disabled={!canControl}
            value={seek}
            onChange={(e) => setSeek(e.target.value)}
            className="ml-2 w-24 rounded border px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled={
            !canControl ||
            seek === "" ||
            !Number.isFinite(Number(seek)) ||
            Number(seek) < 0
          }
          onClick={() => sendPlayback("room.seek", Number(seek))}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          Seek
        </button>
        {state.role === "VIEWER" ? (
          <p>Only the owner and controllers can change playback.</p>
        ) : null}
      </div>
      <div
        className="max-h-48 overflow-y-auto rounded-xl border bg-zinc-50 p-3 text-sm"
        aria-label="Room chat"
        aria-live="polite"
      >
        {state.chat.length === 0 ? <p>No chat yet.</p> : null}
        <ul>
          {state.chat.map((message) => (
            <li key={message.userId + ":" + message.messageId}>
              {message.text}
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Chat message"
          placeholder="Chat message"
          maxLength={1000}
          disabled={!state.synced}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!state.synced || !text.trim() || text.trim().length > 1000}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
      <div className="flex gap-3" aria-label="Room reactions">
        {Object.entries(emojis).map(([name, icon]) => (
          <button
            key={name}
            type="button"
            aria-label={`React ${name}`}
            disabled={!state.synced}
            onClick={() => sendReaction(name)}
            className="text-2xl disabled:opacity-40"
          >
            {icon}
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-label="Recent reactions">
        {state.reactions.map((reaction, i) => (
          <span key={reaction.reactionId + ":" + i} className="mr-2">
            {emojis[reaction.emoji as keyof typeof emojis]}
          </span>
        ))}
      </div>
      <RoomMembersPanel roomId={id} refreshVersion={state.memberRevision} />
    </section>
  );
}
