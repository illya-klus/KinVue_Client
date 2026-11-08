"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { RequireAdmin } from "@/components/auth/require-admin";
import { StatusMessage } from "@/components/ui/status-message";
import {
  completeMultipartUpload,
  initMultipartUpload,
  suggestPartCount,
  uploadFileParts,
} from "@/lib/api/upload";

const ALLOWED = ["video/mp4", "video/quicktime", "video/x-matroska"] as const;

export default function AdminUploadPage() {
  return (
    <RequireAdmin>
      <UploadContent />
    </RequireAdmin>
  );
}

function UploadContent() {
  const params = useParams<{ id: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      return;
    }
    const contentType = file.type as (typeof ALLOWED)[number];
    if (!ALLOWED.includes(contentType)) {
      setError("Use MP4, QuickTime, or Matroska.");
      return;
    }
    setError(null);
    setProgress("Initializing upload…");
    try {
      const partCount = suggestPartCount(file.size);
      const init = await initMultipartUpload(params.id, {
        fileName: file.name,
        contentType,
        fileSizeBytes: file.size,
        partCount,
      });
      setProgress(`Uploading ${init.parts.length} parts to object storage…`);
      const parts = await uploadFileParts(file, init.parts, (partNumber) => {
        setProgress(`Retrying part ${partNumber}…`);
      });
      setProgress("Completing multipart upload…");
      await completeMultipartUpload(params.id, {
        uploadId: init.uploadId,
        parts,
      });
      setProgress("Upload complete — transcoding will start on the server.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Upload media</h1>
      <p className="text-sm text-zinc-600">Movie {params.id} · parts go directly to MinIO presigned URLs.</p>
      {error ? <StatusMessage tone="error" title="Upload" detail={error} /> : null}
      {progress ? <StatusMessage title={progress} /> : null}
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-6">
        <input
          type="file"
          accept={ALLOWED.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={!file}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Start multipart upload
        </button>
      </form>
    </section>
  );
}
