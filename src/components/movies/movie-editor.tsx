"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RequireAdmin } from "@/components/auth/require-admin";
import { StatusMessage } from "@/components/ui/status-message";
import {
  createMovie,
  fetchAdminMovie,
  updateMovie,
  publishMovie,
  scheduleMovie,
} from "@/lib/api/movies";
import type { MovieSummary } from "@/lib/types/domain";

export function MovieEditor({ movieId }: { movieId?: string }) {
  return (
    <RequireAdmin>
      <Editor key={movieId ?? "new"} movieId={movieId} />
    </RequireAdmin>
  );
}
function Editor({ movieId }: { movieId?: string }) {
  const [id, setId] = useState(movieId);
  const [form, setForm] = useState({
    title: "",
    description: "",
    genres: "",
    duration: "",
    poster: "",
  });
  const [movie, setMovie] = useState<MovieSummary | null>(null);
  const [loaded, setLoaded] = useState(!movieId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  useEffect(() => {
    if (!movieId) return;
    let active = true;
    fetchAdminMovie(movieId)
      .then((data) => {
        if (!active) return;
        setMovie(data);
        setForm({
          title: data.title,
          description: data.description ?? "",
          genres: (data.genres ?? []).join(", "),
          duration: data.durationSeconds?.toString() ?? "",
          poster: data.posterKey ?? "",
        });
        setLoaded(true);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Could not load draft");
      });
    return () => {
      active = false;
    };
  }, [movieId]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        genres: form.genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        ...(form.duration
          ? { durationSeconds: Number(form.duration) }
          : id
            ? { durationSeconds: null }
            : {}),
        ...(form.poster.trim()
          ? { posterKey: form.poster.trim() }
          : id
            ? { posterKey: null }
            : {}),
      };
      const data = id ? await updateMovie(id, body) : await createMovie(body);
      const savedId = data.movieId ?? data.id;
      if (!savedId) throw new Error("Movie id missing in response");
      setId(savedId);
      setMovie(data);
      setMessage(id ? "Movie saved" : "Draft created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await publishMovie(id);
      setMovie(data);
      setMessage(
        data.message ?? "Catalog saved. Search may take a moment to update.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }
  async function schedule() {
    if (!id) return;
    const at = new Date(scheduleAt);
    if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) {
      setError("Choose a publication time in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMovie(await scheduleMovie(id, { publishAt: at.toISOString() }));
      setMessage("Publication scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <StatusMessage
        tone={error ? "error" : undefined}
        title={error ? "Movie" : "Loading draft…"}
        detail={error ?? undefined}
      />
    );
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {id ? "Edit movie" : "Admin · Movies"}
      </h1>
      {message ? <StatusMessage title={message} /> : null}
      {error ? (
        <StatusMessage tone="error" title="Movie" detail={error} />
      ) : null}
      <form
        onSubmit={save}
        className="space-y-3 rounded-xl border bg-white p-6"
      >
        <label className="block text-sm">
          Title
          <input
            required
            maxLength={300}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            required
            rows={4}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm">
          Genres (comma-separated)
          <input
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.genres}
            onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Duration (seconds, optional)
          <input
            type="number"
            min={1}
            step={1}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.duration}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm">
          Poster key (optional)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.poster}
            onChange={(e) => setForm((f) => ({ ...f, poster: e.target.value }))}
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white"
        >
          {busy ? "Saving…" : id ? "Save movie" : "Create draft"}
        </button>
      </form>
      {id ? (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <p>
            Publication: {movie?.publicationStatus ?? movie?.status ?? "DRAFT"}{" "}
            · Media: {movie?.mediaStatus ?? "NONE"}
          </p>
          {movie?.publishAt ? (
            <p>Scheduled for {new Date(movie.publishAt).toLocaleString()}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy || movie?.publicationStatus === "PUBLISHED"}
              onClick={() => void publish()}
              className="rounded-lg border px-4 py-2"
            >
              Publish now
            </button>
            <label className="text-sm">
              Publication time
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="block rounded-lg border px-2 py-2"
              />
            </label>
            <button
              disabled={busy || movie?.publicationStatus === "PUBLISHED"}
              onClick={() => void schedule()}
              className="rounded-lg border px-4 py-2"
            >
              Schedule publish
            </button>
            <Link href={`/admin/movies/${id}/edit`} className="text-blue-700">
              Edit permalink
            </Link>
            <Link href={`/admin/movies/${id}/upload`} className="text-blue-700">
              Upload video
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
