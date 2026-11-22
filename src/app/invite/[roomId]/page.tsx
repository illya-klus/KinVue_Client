"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusMessage } from "@/components/ui/status-message";
import { acceptRoomInvite } from "@/lib/api/rooms";
import { useAuth } from "@/lib/auth/auth-context";

export default function AcceptRoomInvitePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { accessToken, isReady } = useAuth();
  const [message, setMessage] = useState("Checking invite…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setError("This invite link is missing its token.");
      return;
    }
    if (!accessToken) {
      const returnTo = `/invite/${encodeURIComponent(roomId)}#token=${encodeURIComponent(token)}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    void acceptRoomInvite(roomId, token)
      .then(() => {
        setMessage("Invite accepted. Opening room…");
        router.replace(`/rooms/${roomId}`);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not accept invite"));
  }, [accessToken, isReady, roomId, router]);

  return error ? (
    <StatusMessage tone="error" title="Room invite" detail={error} />
  ) : (
    <StatusMessage title={message} />
  );
}
