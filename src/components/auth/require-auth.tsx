"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { StatusMessage } from "@/components/ui/status-message";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !accessToken) {
      router.replace("/login");
    }
  }, [accessToken, isReady, router]);

  if (!isReady) {
    return <StatusMessage title="Loading session…" />;
  }
  if (!accessToken) {
    return <StatusMessage title="Redirecting to sign in…" />;
  }
  return <>{children}</>;
}
