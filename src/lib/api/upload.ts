import { gatewayFetch } from "@/lib/gateway/client";
import type { UploadInitResponse } from "@/lib/types/domain";

export type UploadInitBody = {
  fileName: string;
  contentType: "video/mp4" | "video/quicktime" | "video/x-matroska";
  fileSizeBytes: number;
  partCount: number;
};

export function initMultipartUpload(movieId: string, body: UploadInitBody) {
  return gatewayFetch<UploadInitResponse>(
    `/api/admin/movies/${movieId}/upload/init`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function refreshUploadParts(movieId: string, uploadId: string) {
  return gatewayFetch<UploadInitResponse>(
    `/api/admin/movies/${movieId}/upload/${uploadId}/parts`,
    { method: "POST" },
  );
}

export function completeMultipartUpload(
  movieId: string,
  body: { uploadId: string; parts: { partNumber: number; etag: string }[] },
) {
  return gatewayFetch(`/api/admin/movies/${movieId}/upload/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PART_SIZE = 8 * 1024 * 1024;

export function suggestPartCount(fileSizeBytes: number): number {
  return Math.max(1, Math.ceil(fileSizeBytes / PART_SIZE));
}

export async function uploadFileParts(
  file: File,
  parts: UploadInitResponse["parts"],
  onPartError?: (partNumber: number, error: unknown) => void,
  completed: { partNumber: number; etag: string }[] = [],
): Promise<{ partNumber: number; etag: string }[]> {
  for (const part of parts) {
    if (completed.some((done) => done.partNumber === part.partNumber)) continue;
    const start = (part.partNumber - 1) * PART_SIZE;
    const end = Math.min(file.size, start + PART_SIZE);
    const chunk = file.slice(start, end);
    try {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(part.url, { method: "PUT", body: chunk });
          if (response.ok) break;
          if (response.status === 403)
            throw new Error(
              "Upload URL expired. Retry to renew URLs for unfinished parts.",
            );
          throw new Error(
            `Part ${part.partNumber} failed (${response.status})`,
          );
        } catch (error) {
          if (attempt === 2 || response?.status === 403) throw error;
          onPartError?.(part.partNumber, error);
        }
      }
      const etag = response?.headers.get("etag");
      if (!etag)
        throw new Error(
          "Storage did not expose an ETag. Check storage CORS and retry this part.",
        );
      completed.push({ partNumber: part.partNumber, etag });
    } catch (error) {
      onPartError?.(part.partNumber, error);
      throw error;
    }
  }
  return completed;
}
