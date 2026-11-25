"use client";

import { useParams } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { RequireAdmin } from "@/components/auth/require-admin";
import { StatusMessage } from "@/components/ui/status-message";
import {
  completeMultipartUpload,
  initMultipartUpload,
  refreshUploadParts,
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
  const session = useRef<{
    uploadId: string;
    parts: { partNumber: number; url: string }[];
    completed: { partNumber: number; etag: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
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
    if (busy || processing) return;
    if (file.size <= 1_000_000 || file.size > 25_000_000_000) {
      setError("File size must be greater than 1 MB and at most 25 GB.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress("Initializing upload…");
    try {
      const partCount = suggestPartCount(file.size);
      const init = session.current
        ? session.current.completed.length === session.current.parts.length
          ? session.current
          : await refreshUploadParts(params.id, session.current.uploadId)
        : await initMultipartUpload(params.id, {
            fileName: file.name,
            contentType,
            fileSizeBytes: file.size,
            partCount,
          });
      session.current ??= { ...init, completed: [] };
      setProgress(`Uploading ${init.parts.length} parts to object storage…`);
      const parts = await uploadFileParts(
        file,
        init.parts,
        (partNumber) => {
          setProgress(`Retrying part ${partNumber}…`);
        },
        session.current.completed,
      );
      setProgress("Completing multipart upload…");
      await completeMultipartUpload(params.id, {
        uploadId: init.uploadId,
        parts,
      });
      setProcessing(true);
      setProgress("Processing — upload complete, waiting for transcoding.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Upload media</h1>
      <p className="text-sm text-zinc-600">
        Choose a video larger than 1 MB and up to 25 GB.
      </p>
      {error ? (
        <StatusMessage tone="error" title="Upload" detail={error} />
      ) : null}
      {progress ? <StatusMessage title={progress} /> : null}
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border bg-white p-6"
      >
        <input
          type="file"
          accept={ALLOWED.join(",")}
          disabled={busy || processing || !!session.current}
          aria-label="Video file"
          onChange={(e) => {
            session.current = null;
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        <button
          type="submit"
          disabled={!file || busy || processing}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {processing
            ? "Processing"
            : busy
              ? "Uploading…"
              : session.current
                ? "Retry unfinished parts"
                : "Start multipart upload"}
        </button>
      </form>
    </section>
  );
}
