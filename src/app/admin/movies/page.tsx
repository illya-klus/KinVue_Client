"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { RequireAdmin } from "@/components/auth/require-admin";
import { StatusMessage } from "@/components/ui/status-message";
import {
  createMovie,
  publishMovie,
  scheduleMovie,
} from "@/lib/api/movies";
import type { CreateMoviePayload } from "@/lib/api/movies.types";

const emptyForm: CreateMoviePayload = {
  title: "",
  description: "",
  genres: [],
  durationSeconds: 6000,
  posterKey: "posters/placeholder.jpg",
};

export default function AdminMoviesPage() {
  return (
    <RequireAdmin>
      <AdminMoviesContent />
    </RequireAdmin>
  );
}

function AdminMoviesContent() {
  const [form, setForm] = useState(emptyForm);
  const [genresText, setGenresText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const body: CreateMoviePayload = {
        ...form,
        genres: genresText
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
      };
      const movie = await createMovie(body);
      const id = movie.id ?? movie.movieId;
      if (!id) {
        throw new Error("Movie id missing in response");
      }
      setCreatedId(id);
      setMessage(`Created draft ${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function onPublish() {
    if (!createdId) {
      return;
    }
    setError(null);
    try {
      await publishMovie(createdId);
      setMessage(`Published ${createdId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    }
  }

  async function onSchedule() {
    if (!createdId || !scheduleAt) {
      return;
    }
    setError(null);
    try {
      await scheduleMovie(createdId, { publishAt: new Date(scheduleAt).toISOString() });
      setMessage(`Scheduled ${createdId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Admin · Movies</h1>
      {message ? <StatusMessage title={message} /> : null}
      {error ? <StatusMessage tone="error" title="Admin" detail={error} /> : null}
      <form onSubmit={onCreate} className="space-y-3 rounded-xl border bg-white p-6">
        <label className="block text-sm">
          Title
          <input
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Genres (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={genresText}
            onChange={(e) => setGenresText(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Duration (seconds)
          <input
            type="number"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.durationSeconds}
            onChange={(e) =>
              setForm((f) => ({ ...f, durationSeconds: Number(e.target.value) }))
            }
          />
        </label>
        <label className="block text-sm">
          Poster key
          <input
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.posterKey}
            onChange={(e) => setForm((f) => ({ ...f, posterKey: e.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white"
        >
          {loading ? "Creating…" : "Create draft"}
        </button>
      </form>
      {createdId ? (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <p className="text-sm">
            Working on <span className="font-mono">{createdId}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onPublish()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              Publish now
            </button>
            <input
              type="datetime-local"
              className="rounded-lg border px-2 py-2 text-sm"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void onSchedule()}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Schedule publish
            </button>
            <Link
              href={`/admin/movies/${createdId}/upload`}
              className="rounded-lg border px-4 py-2 text-sm text-blue-700"
            >
              Upload video
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
