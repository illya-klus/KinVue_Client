"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateRoomPanel } from "@/components/movies/create-room-panel";
import { HlsPlayer } from "@/components/media/hls-player";
import { StatusMessage } from "@/components/ui/status-message";
import {
  addToWatchlist,
  fetchMovie,
  fetchWatchlist,
  removeFromWatchlist,
} from "@/lib/api/movies";
import { useAuth } from "@/lib/auth/auth-context";
import type { MovieSummary } from "@/lib/types/domain";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onWatchlist, setOnWatchlist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    let active = true;
    setMovie(null);
    setError(null);
    void (async () => {
      try {
        const data = await fetchMovie(params.id);
        if (active) setMovie(data);
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load movie");
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    let active = true;
    setOnWatchlist(false);
    setWatchlistLoading(Boolean(accessToken));
    if (accessToken)
      fetchWatchlist()
        .then((items) => {
          if (active)
            setOnWatchlist(items.some((item) => item.movieId === params.id));
        })
        .catch((err) => {
          if (active)
            setError(
              err instanceof Error ? err.message : "Could not load watchlist",
            );
        })
        .finally(() => {
          if (active) setWatchlistLoading(false);
        });
    return () => {
      active = false;
    };
  }, [params.id, accessToken]);

  async function toggleWatchlist() {
    setSaving(true);
    setError(null);
    try {
      if (onWatchlist) {
        await removeFromWatchlist(params.id);
        setOnWatchlist(false);
      } else {
        await addToWatchlist(params.id);
        setOnWatchlist(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watchlist update failed");
    } finally {
      setSaving(false);
    }
  }

  if (error && !movie) {
    return <StatusMessage tone="error" title="Movie" detail={error} />;
  }
  if (!movie) {
    return <StatusMessage title="Loading movie…" />;
  }

  const title = movie.title ?? params.id;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {movie.description ? (
          <p className="text-zinc-700">{movie.description}</p>
        ) : null}
        {movie.genres?.length ? (
          <p className="text-sm text-zinc-500">{movie.genres.join(" · ")}</p>
        ) : null}
      </header>
      {accessToken ? (
        <button
          type="button"
          disabled={saving || watchlistLoading}
          onClick={() => void toggleWatchlist()}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          {onWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        </button>
      ) : (
        <Link href="/login" className="text-blue-700">
          Sign in to add to watchlist
        </Link>
      )}
      <h2 className="text-lg font-semibold">Watch solo</h2>
      {accessToken ? (
        <HlsPlayer movieId={params.id} />
      ) : (
        <StatusMessage
          title="Sign in to play"
          detail="Media access requires authentication."
        />
      )}
      {accessToken ? (
        <CreateRoomPanel movieId={params.id} />
      ) : (
        <StatusMessage
          title="Private or public room"
          detail="Sign in to watch together."
        />
      )}
      {error ? (
        <StatusMessage tone="error" title="Error" detail={error} />
      ) : null}
    </article>
  );
}
