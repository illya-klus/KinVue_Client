"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestMediaAccess } from "@/lib/api/movies";
import { StatusMessage } from "@/components/ui/status-message";

type Props = {
  movieId: string;
  className?: string;
  roomPlayback?: {
    status: "PLAYING" | "PAUSED";
    position: number;
    updatedAt: string;
    version: number;
  };
  roomSynced?: boolean;
};

export function HlsPlayer({
  movieId,
  className,
  roomPlayback,
  roomSynced,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessRevision, setAccessRevision] = useState(0);
  const resumeRef = useRef<{
    movieId: string;
    position: number;
    playing: boolean;
  } | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const playbackRef = useRef(roomPlayback);
  playbackRef.current = roomPlayback;
  const applyRoomPlayback = useCallback(() => {
    const video = videoRef.current,
      playback = playbackRef.current;
    if (!video || !playback) return;
    if (!roomSynced) {
      video.pause();
      return;
    }
    const position =
      playback.position +
      (playback.status === "PLAYING"
        ? Math.max(0, Date.now() - Date.parse(playback.updatedAt)) / 1000
        : 0);
    if (video.readyState >= 1) video.currentTime = position;
    if (playback.status === "PAUSED") {
      video.pause();
      setNeedsGesture(false);
    } else
      void video
        .play()
        .then(() => setNeedsGesture(false))
        .catch(() => setNeedsGesture(true));
  }, [roomSynced]);
  useEffect(() => {
    applyRoomPlayback();
  }, [
    applyRoomPlayback,
    roomPlayback?.version,
    roomPlayback?.status,
    roomPlayback?.position,
    roomPlayback?.updatedAt,
    roomSynced,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    let destroyed = false;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    let destroyHls: (() => void) | undefined;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const access = await requestMediaAccess(movieId);
        const el = videoRef.current;
        if (!el || destroyed) {
          return;
        }
        if (access.expiresAt) {
          const delay = Date.parse(access.expiresAt) - Date.now() - 30_000;
          if (delay <= 0 || !Number.isFinite(delay))
            throw new Error("Media access has expired. Reopen the player.");
          renewal = setTimeout(
            () => setAccessRevision((value) => value + 1),
            delay,
          );
        }
        if (access.url.includes(".m3u8")) {
          const { default: Hls } = await import("hls.js");
          if (destroyed) return;
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal && !destroyed) {
                clearTimeout(renewal);
                hls.destroy();
                destroyHls = undefined;
                el.pause();
                el.removeAttribute("src");
                el.load();
                setError(
                  "Playback failed. Reopen the player to renew media access.",
                );
              }
            });
            hls.loadSource(access.url);
            hls.attachMedia(el);
            destroyHls = () => hls.destroy();
            return;
          }
        }
        el.src = access.url;
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Could not load media");
        }
      } finally {
        if (!destroyed) {
          setLoading(false);
        }
      }
    })();
    return () => {
      destroyed = true;
      clearTimeout(renewal);
      if (video)
        resumeRef.current = {
          movieId,
          position: video.currentTime,
          playing: !video.paused,
        };
      destroyHls?.();
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [movieId, accessRevision]);

  if (error) {
    return <StatusMessage tone="error" title="Playback" detail={error} />;
  }

  return (
    <div className={className}>
      {loading ? (
        <p className="mb-2 text-sm text-zinc-600">Requesting media access…</p>
      ) : null}
      <video
        ref={videoRef}
        controls={!roomPlayback}
        onLoadedMetadata={() => {
          if (roomPlayback) applyRoomPlayback();
          else if (resumeRef.current?.movieId === movieId) {
            const video = videoRef.current;
            if (video) {
              video.currentTime = resumeRef.current.position;
              if (resumeRef.current.playing)
                void video.play().catch(() => undefined);
            }
          }
        }}
        className="w-full rounded-lg bg-black"
        playsInline
      />
      {needsGesture && roomSynced ? (
        <button
          type="button"
          onClick={applyRoomPlayback}
          className="mt-2 rounded border px-3 py-1"
        >
          Enable playback
        </button>
      ) : null}
    </div>
  );
}
