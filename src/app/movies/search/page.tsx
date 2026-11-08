"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { gatewayFetch } from "@/lib/gateway/client";
import { StatusMessage } from "@/components/ui/status-message";

type SearchHit = {
  id?: string;
  title?: string;
  description?: string;
};

type SearchResponse = {
  hits: SearchHit[];
  estimatedTotalHits?: number;
};

export default function MovieSearchPage() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (genre.trim()) params.set("genre", genre.trim());
      const data = await gatewayFetch<SearchResponse>(
        `/api/movies/search?${params.toString()}`,
        {},
        { auth: false },
      );
      setHits(data.hits ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Movie search</h1>
      <form onSubmit={onSearch} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="w-40 rounded-lg border px-3 py-2 text-sm"
          placeholder="Genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <StatusMessage tone="error" title="Search error" detail={error} /> : null}
      {!error && !loading && hits.length === 0 ? (
        <StatusMessage tone="empty" title="No results yet" detail="Try another query." />
      ) : null}
      <ul className="space-y-3">
        {hits.map((hit) => (
          <li key={hit.id ?? hit.title} className="rounded-xl border bg-white p-4">
            <Link
              href={hit.id ? `/movies/${hit.id}` : "#"}
              className="font-medium text-blue-700 hover:underline"
            >
              {hit.title ?? hit.id ?? "Untitled"}
            </Link>
            {hit.description ? (
              <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{hit.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
