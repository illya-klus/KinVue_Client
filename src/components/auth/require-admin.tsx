"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "./require-auth";
import { StatusMessage } from "@/components/ui/status-message";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return (
    <RequireAuth>
      {isAdmin ? (
        children
      ) : (
        <StatusMessage
          tone="error"
          title="Forbidden"
          detail="Admin scope is required for this page."
        />
      )}
    </RequireAuth>
  );
}
