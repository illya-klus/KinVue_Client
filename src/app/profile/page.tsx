"use client";

import { FormEvent, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { fetchProfile, updateProfile } from "@/lib/api/users";
import type { UserProfile } from "@/lib/types/domain";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    avatarUrl: "",
    genres: "",
    languages: "",
    autoplay: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchProfile();
        setProfile(data);
        setForm({
          displayName: data.displayName ?? "",
          avatarUrl: data.avatarUrl ?? "",
          genres: (data.preferences?.genres ?? []).join(", "),
          languages: (data.preferences?.languages ?? []).join(", "),
          autoplay: data.preferences?.autoplay ?? false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load profile");
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateProfile({
        displayName: form.displayName.trim(),
        avatarUrl: form.avatarUrl.trim() || null,
        preferences: {
          genres: form.genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
          languages: form.languages
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
          autoplay: form.autoplay,
        },
      });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (error && !profile) {
    return <StatusMessage tone="error" title="Profile" detail={error} />;
  }
  if (!profile) {
    return <StatusMessage title="Loading profile…" />;
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-zinc-600">
          @{profile.username}
          {profile.createdAt ? ` · joined ${new Date(profile.createdAt).toLocaleDateString()}` : ""}
        </p>
      </div>
      {saved ? <StatusMessage title="Profile saved" /> : null}
      {error ? <StatusMessage tone="error" title="Error" detail={error} /> : null}
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm">
          Display name
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            required
          />
        </label>
        <label className="block text-sm">
          Avatar URL
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Preferred genres (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.genres}
            onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Languages
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={form.languages}
            onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.autoplay}
            onChange={(e) => setForm((f) => ({ ...f, autoplay: e.target.checked }))}
          />
          Autoplay trailers
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}
