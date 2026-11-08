"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatusMessage } from "@/components/ui/status-message";
import { gatewayFetch } from "@/lib/gateway/client";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const [profile, setProfile] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await gatewayFetch("/api/users/me");
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load profile");
      }
    })();
  }, []);

  if (error) {
    return <StatusMessage tone="error" title="Profile" detail={error} />;
  }
  if (!profile) {
    return <StatusMessage title="Loading profile…" />;
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <pre className="rounded-xl border bg-white p-4 text-xs">
        {JSON.stringify(profile, null, 2)}
      </pre>
    </section>
  );
}
