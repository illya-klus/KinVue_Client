"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { gatewayFetch } from "@/lib/gateway/client";
import { StatusMessage } from "@/components/ui/status-message";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await gatewayFetch<Record<string, unknown>>(
          `/api/movies/${params.id}`,
          {},
          { auth: false },
        );
        setMovie(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load movie");
      }
    })();
  }, [params.id]);

  if (error) {
    return <StatusMessage tone="error" title="Movie" detail={error} />;
  }
  if (!movie) {
    return <StatusMessage title="Loading movie…" />;
  }

  return (
    <article className="space-y-4 rounded-xl border bg-white p-6">
      <h1 className="text-2xl font-semibold">
        {String(movie.title ?? movie.id ?? params.id)}
      </h1>
      {movie.description ? (
        <p className="text-zinc-700">{String(movie.description)}</p>
      ) : null}
      <pre className="overflow-auto rounded-lg bg-zinc-100 p-4 text-xs">
        {JSON.stringify(movie, null, 2)}
      </pre>
    </article>
  );
}
