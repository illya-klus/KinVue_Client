"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readTokens } from "@/lib/auth/token-storage";
import { refreshAccessToken } from "@/lib/gateway/client";
const wsBase =
  process.env.NEXT_PUBLIC_ROOMS_WS_URL ?? "ws://localhost:4014/rooms";
export type RoomSyncState = {
  connected: boolean;
  synced: boolean;
  reconnecting: boolean;
  left: boolean;
  role?: "OWNER" | "CONTROLLER" | "VIEWER";
  userId?: string;
  movieId?: string;
  playbackStatus?: "PLAYING" | "PAUSED";
  positionSeconds?: number;
  updatedAt?: string;
  version: number;
  chat: { messageId: string; userId: string; text: string }[];
  reactions: { reactionId: string; emoji: string; userId: string }[];
  memberRevision: number;
  error?: string;
};
const initial: RoomSyncState = {
  connected: false,
  synced: false,
  reconnecting: false,
  left: false,
  version: -1,
  chat: [],
  reactions: [],
  memberRevision: 0,
};
export function useRoomSocket(roomId: string | null) {
  const [state, setState] = useState<RoomSyncState>(initial);
  const current = useRef(state);
  const socket = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<() => void>(() => {});
  const left = useRef(false);
  const seen = useRef(new Set<string>());
  const update = useCallback((fn: (s: RoomSyncState) => RoomSyncState) => {
    current.current = fn(current.current);
    setState(current.current);
  }, []);
  useEffect(() => {
    let stopped = false,
      retries = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined,
      generation = 0;
    left.current = false;
    seen.current.clear();
    current.current = initial;
    setState(initial);
    function clearTimers() {
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
    }
    async function open(renew = false) {
      clearTimers();
      const attempt = ++generation;
      socket.current?.close();
      update((s) => ({
        ...s,
        connected: false,
        synced: false,
        reconnecting: true,
        error: undefined,
      }));
      if (renew) await refreshAccessToken();
      if (stopped || attempt !== generation) return;
      const token = readTokens().accessToken;
      if (!roomId || !token) {
        update((s) => ({
          ...s,
          reconnecting: false,
          error: "Sign in to connect.",
        }));
        return;
      }
      const url = new URL(wsBase);
      url.searchParams.set("roomId", roomId);
      url.searchParams.set("token", token);
      const ws = new WebSocket(url);
      socket.current = ws;
      const active = () =>
        !stopped && attempt === generation && socket.current === ws;
      ws.onopen = () => {
        if (active()) update((s) => ({ ...s, connected: true }));
      };
      ws.onmessage = (event) => {
        if (!active()) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!msg || msg.roomId !== roomId) return;
        if (
          msg.type === "room.state_sync" ||
          msg.type === "room.playback_state_changed"
        ) {
          if (
            !Number.isSafeInteger(msg.version) ||
            Number(msg.version) < 0 ||
            Number(msg.version) < current.current.version ||
            !["PLAYING", "PAUSED"].includes(String(msg.playbackStatus)) ||
            !Number.isFinite(msg.positionSeconds) ||
            Number(msg.positionSeconds) < 0 ||
            typeof msg.updatedAt !== "string" ||
            !Number.isFinite(Date.parse(msg.updatedAt))
          )
            return;
          if (msg.type === "room.state_sync") {
            if (!["OWNER", "CONTROLLER", "VIEWER"].includes(String(msg.role)))
              return;
            retries = 0;
            update((s) => ({
              ...s,
              connected: true,
              synced: true,
              reconnecting: false,
              error: undefined,
              role: msg.role as RoomSyncState["role"],
              userId: String(msg.userId ?? ""),
              movieId: String(msg.movieId ?? ""),
              playbackStatus:
                msg.playbackStatus as RoomSyncState["playbackStatus"],
              positionSeconds: Number(msg.positionSeconds),
              updatedAt: String(msg.updatedAt),
              version: Number(msg.version),
              memberRevision: s.memberRevision + 1,
            }));
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = setInterval(() => {
              if (
                active() &&
                ws.readyState === WebSocket.OPEN &&
                current.current.synced
              )
                ws.send(JSON.stringify({ type: "room.heartbeat", roomId }));
            }, 30000);
          } else if (
            current.current.synced &&
            Number(msg.version) > current.current.version
          ) {
            update((s) => ({
              ...s,
              playbackStatus:
                msg.playbackStatus as RoomSyncState["playbackStatus"],
              positionSeconds: Number(msg.positionSeconds),
              updatedAt: String(msg.updatedAt),
              version: Number(msg.version),
            }));
          }
        } else if (
          msg.type === "chat.message_created" &&
          current.current.synced
        ) {
          if (
            typeof msg.messageId !== "string" ||
            typeof msg.userId !== "string" ||
            typeof msg.text !== "string"
          )
            return;
          const identity = msg.userId + ":" + msg.messageId;
          if (seen.current.has(identity)) return;
          seen.current.add(identity);
          update((s) => ({
            ...s,
            chat: [
              ...s.chat,
              {
                messageId: String(msg.messageId),
                userId: String(msg.userId),
                text: String(msg.text),
              },
            ],
          }));
        } else if (
          msg.type === "chat.reaction_created" &&
          current.current.synced
        ) {
          if (
            !["like", "laugh", "wow", "sad", "fire"].includes(
              String(msg.emoji),
            ) ||
            typeof msg.reactionId !== "string"
          )
            return;
          update((s) => ({
            ...s,
            reactions: [
              ...s.reactions.slice(-19),
              {
                reactionId: String(msg.reactionId),
                emoji: String(msg.emoji),
                userId: String(msg.userId),
              },
            ],
          }));
        } else if (msg.type === "room.role_changed") {
          update((s) => ({
            ...s,
            role:
              msg.userId === s.userId
                ? (msg.role as RoomSyncState["role"])
                : s.role,
            memberRevision: s.memberRevision + 1,
          }));
        } else if (msg.type === "room.presence_changed") {
          if (
            msg.userId === current.current.userId &&
            msg.presence === "LEFT"
          ) {
            left.current = true;
            update((s) => ({ ...s, left: true, synced: false }));
          }
          update((s) => ({ ...s, memberRevision: s.memberRevision + 1 }));
        } else if (msg.type === "room.closed") {
          left.current = true;
          update((s) => ({
            ...s,
            synced: false,
            error: "This room is closed.",
          }));
          ws.close();
        } else if (msg.type === "room.error")
          update((s) => ({ ...s, error: "The room rejected this action." }));
      };
      ws.onerror = () => {};
      ws.onclose = (event) => {
        if (!active()) return;
        clearTimers();
        const retry =
          !left.current && event.code !== 1008 && event.code !== 1000;
        update((s) => ({
          ...s,
          connected: false,
          synced: false,
          reconnecting: retry,
          error: retry
            ? undefined
            : (s.error ??
              (left.current ? "You left this room." : "Room access denied.")),
        }));
        if (retry)
          timer = setTimeout(
            () => void open(true),
            Math.min(5000, 500 * 2 ** retries++),
          );
      };
    }
    reconnectRef.current = () => {
      left.current = false;
      void open(true);
    };
    queueMicrotask(() => {
      if (!stopped) void open();
    });
    return () => {
      stopped = true;
      generation++;
      clearTimers();
      socket.current?.close();
      socket.current = null;
    };
  }, [roomId, update]);
  const send = useCallback(
    (event: Record<string, unknown>) => {
      if (
        !roomId ||
        !current.current.synced ||
        left.current ||
        socket.current?.readyState !== WebSocket.OPEN
      )
        return false;
      socket.current.send(JSON.stringify({ ...event, roomId }));
      return true;
    },
    [roomId],
  );
  const sendChat = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || value.length > 1000) {
        update((s) => ({
          ...s,
          error: "Messages must contain 1–1000 characters.",
        }));
        return false;
      }
      return send({
        type: "chat.message",
        messageId: crypto.randomUUID(),
        text: value,
      });
    },
    [send, update],
  );
  const sendPlayback = useCallback(
    (
      type: "room.play" | "room.pause" | "room.seek",
      positionSeconds: number,
    ) => {
      if (
        !["OWNER", "CONTROLLER"].includes(current.current.role ?? "") ||
        !Number.isFinite(positionSeconds) ||
        positionSeconds < 0
      )
        return false;
      return send({
        type,
        eventId: crypto.randomUUID(),
        positionSeconds,
        clientSentAt: new Date().toISOString(),
      });
    },
    [send],
  );
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!["like", "laugh", "wow", "sad", "fire"].includes(emoji))
        return false;
      return send({
        type: "chat.reaction",
        reactionId: crypto.randomUUID(),
        emoji,
      });
    },
    [send],
  );
  const leave = useCallback(() => {
    if (send({ type: "room.leave" })) {
      left.current = true;
      update((s) => ({ ...s, left: true, synced: false }));
    }
  }, [send, update]);
  return {
    state,
    sendChat,
    sendPlayback,
    sendReaction,
    leave,
    reconnect: () => reconnectRef.current(),
  };
}
