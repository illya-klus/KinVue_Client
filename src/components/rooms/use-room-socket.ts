"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readTokens } from "@/lib/auth/token-storage";

const wsBase =
  process.env.NEXT_PUBLIC_ROOMS_WS_URL ?? "ws://localhost:4014/rooms";

export type RoomSyncState = {
  connected: boolean;
  synced: boolean;
  reconnecting: boolean;
  movieId?: string;
  playbackStatus?: "PLAYING" | "PAUSED";
  positionSeconds?: number;
  version?: number;
  chat: { messageId: string; text: string }[];
};

export function useRoomSocket(roomId: string | null) {
  const [state, setState] = useState<RoomSyncState>({
    connected: false,
    synced: false,
    reconnecting: false,
    chat: [],
  });
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!roomId) {
      return;
    }
    const token = readTokens().accessToken;
    if (!token) {
      return;
    }
    setState((s) => ({ ...s, reconnecting: true, synced: false }));
    const url = `${wsBase}?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;
    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true, reconnecting: false }));
    };
    ws.onclose = () => {
      setState((s) => ({
        ...s,
        connected: false,
        synced: false,
        reconnecting: false,
      }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (msg.type === "room.state_sync") {
          setState((s) => ({
            ...s,
            synced: true,
            movieId: (msg.movieId as string | undefined) ?? s.movieId,
            playbackStatus: msg.playbackStatus as RoomSyncState["playbackStatus"],
            positionSeconds: msg.positionSeconds as number | undefined,
            version: msg.version as number | undefined,
          }));
        }
        if (msg.type === "room.playback_state_changed") {
          setState((s) => ({
            ...s,
            playbackStatus: msg.playbackStatus as RoomSyncState["playbackStatus"],
            positionSeconds: msg.positionSeconds as number | undefined,
            version: msg.version as number | undefined,
          }));
        }
        if (msg.type === "chat.message_created") {
          const messageId = String(msg.messageId ?? "");
          const text = String(msg.text ?? "");
          setState((s) => ({
            ...s,
            chat: [...s.chat, { messageId, text }],
          }));
        }
      } catch {
        // ignore malformed frames in MVP
      }
    };
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [connect]);

  const sendChat = useCallback(
    (text: string) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !roomId) {
        return;
      }
      ws.send(
        JSON.stringify({
          type: "chat.message",
          messageId: crypto.randomUUID(),
          roomId,
          text: text.trim().slice(0, 1000),
        }),
      );
    },
    [roomId],
  );

  const sendPlayback = useCallback(
    (type: "room.play" | "room.pause" | "room.seek", positionSeconds: number) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !roomId || !state.synced) {
        return;
      }
      ws.send(
        JSON.stringify({
          type,
          eventId: crypto.randomUUID(),
          roomId,
          positionSeconds,
          clientSentAt: new Date().toISOString(),
        }),
      );
    },
    [roomId, state.synced],
  );

  return { state, sendChat, sendPlayback, reconnect: connect };
}
