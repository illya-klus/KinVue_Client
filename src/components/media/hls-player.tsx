"use client";

import { useEffect, useRef, useState } from "react";
import { requestMediaAccess } from "@/lib/api/movies";
import { StatusMessage } from "@/components/ui/status-message";

type Props = {
  movieId: string;
  className?: string;
};

export function HlsPlayer({ movieId, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let destroyed = false;
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
        if (access.url.includes(".m3u8")) {
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const hls = new Hls();
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
      destroyHls?.();
    };
  }, [movieId]);

  if (error) {
    return <StatusMessage tone="error" title="Playback" detail={error} />;
  }

  return (
    <div className={className}>
      {loading ? <p className="mb-2 text-sm text-zinc-600">Requesting media access…</p> : null}
      <video ref={videoRef} controls className="w-full rounded-lg bg-black" playsInline />
    </div>
  );
}
