"use client";

import { RequireAdmin } from "@/components/auth/require-admin";
import { StatusMessage } from "@/components/ui/status-message";

export default function AdminMoviesPage() {
  return (
    <RequireAdmin>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin · Movies</h1>
        <StatusMessage
          title="Admin upload UI"
          detail="Multipart upload to MinIO and publish controls will use /api/admin/movies when the media upload epic is wired."
        />
      </section>
    </RequireAdmin>
  );
}
