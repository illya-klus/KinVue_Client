"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { HlsPlayer } from "@/components/media/hls-player";
import { useRoomSocket } from "@/components/rooms/use-room-socket";
import { RoomMembersPanel } from "@/components/rooms/room-members-panel";
import { StatusMessage } from "@/components/ui/status-message";

export default function RoomPage() {
  return (
    <RequireAuth>
      <RoomContent />
    </RequireAuth>
  );
}

function RoomContent() {
  const params = useParams<{ id: string }>();
  const { state, sendChat, sendPlayback, reconnect } = useRoomSocket(params.id);
  const [chatText, setChatText] = useState("");

  function onChatSubmit(event: FormEvent) {
    event.preventDefault();
    if (!chatText.trim()) {
      return;
    }
    sendChat(chatText);
    setChatText("");
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Room {params.id}</h1>
        {state.reconnecting || !state.connected ? (
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => reconnect()}
          >
            Reconnect
          </button>
        ) : null}
      </header>
      {!state.synced ? (
        <StatusMessage
          title="Waiting for room.state_sync"
          detail="Playback controls unlock after the server sends authoritative state."
        />
      ) : null}
      {state.connected && !state.synced ? (
        <p className="text-sm text-amber-700">Reconnecting — do not use local controls yet.</p>
      ) : null}
      {state.movieId ? <HlsPlayer movieId={state.movieId} /> : null}
      <PlaybackControls
        synced={state.synced}
        status={state.playbackStatus}
        position={state.positionSeconds ?? 0}
        onPlay={(pos) => sendPlayback("room.play", pos)}
        onPause={(pos) => sendPlayback("room.pause", pos)}
      />
      <ChatLog messages={state.chat} />
      <form onSubmit={onChatSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          maxLength={1000}
          placeholder="Chat message"
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          disabled={!state.connected}
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={!state.connected}
        >
          Send
        </button>
      </form>
      <RoomMembersPanel roomId={params.id} />
    </section>
  );
}

function PlaybackControls({
  synced,
  status,
  position,
  onPlay,
  onPause,
}: {
  synced: boolean;
  status?: string;
  position: number;
  onPlay: (pos: number) => void;
  onPause: (pos: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
      <span className="text-zinc-600">
        {status ?? "UNKNOWN"} @ {Math.round(position)}s
      </span>
      <button
        type="button"
        disabled={!synced}
        className="rounded-lg border px-3 py-1 disabled:opacity-40"
        onClick={() => onPlay(position)}
      >
        Play
      </button>
      <button
        type="button"
        disabled={!synced}
        className="rounded-lg border px-3 py-1 disabled:opacity-40"
        onClick={() => onPause(position)}
      >
        Pause
      </button>
      {["like", "laugh", "wow", "sad", "fire"].map((emoji) => (
        <button key={emoji} type="button" disabled={!synced} className="text-lg disabled:opacity-40">
          {emoji === "like" ? "👍" : emoji === "laugh" ? "😂" : emoji === "wow" ? "😮" : emoji === "sad" ? "😢" : "🔥"}
        </button>
      ))}
    </div>
  );
}

function ChatLog({ messages }: { messages: { messageId: string; text: string }[] }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border bg-zinc-50 p-3 text-sm">
      {messages.length === 0 ? <p className="text-zinc-500">No chat yet.</p> : null}
      <ul className="space-y-1">
        {messages.map((m) => (
          <li key={m.messageId}>{m.text}</li>
        ))}
      </ul>
    </div>
  );
}
