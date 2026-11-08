"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { searchMovies } from "@/lib/api/movies";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { StatusMessage } from "@/components/ui/status-message";
import type { MovieSummary } from "@/lib/types/domain";

export default function MovieSearchPage() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [hits, setHits] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = debouncedQ.trim();
    if (query.length > 0 && query.length < 2) {
      setHits([]);
      setError(null);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchMovies(query, genre.trim() || undefined);
        setHits(data.hits ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setHits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedQ, genre]);

  const queryTooShort = q.trim().length === 1;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Movie search</h1>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Search (min 2 chars)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="w-40 rounded-lg border px-3 py-2 text-sm"
          placeholder="Genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        />
      </div>
      {queryTooShort ? (
        <StatusMessage title="Keep typing" detail="Search needs at least 2 characters." />
      ) : null}
      {error ? <StatusMessage tone="error" title="Search error" detail={error} /> : null}
      {loading ? <p className="text-sm text-zinc-600">Searching…</p> : null}
      {!loading && !error && hits.length === 0 && debouncedQ.trim().length >= 2 ? (
        <StatusMessage tone="empty" title="No results" />
      ) : null}
      <ul className="space-y-3">
        {hits.map((hit) => {
          const id = hit.id ?? hit.movieId ?? hit.title;
          return (
            <li key={id} className="rounded-xl border bg-white p-4">
              <Link
                href={`/movies/${hit.id ?? hit.movieId}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {hit.title}
              </Link>
              {hit.description ? (
                <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{hit.description}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
