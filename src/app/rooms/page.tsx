"use client";

import { StatusMessage } from "@/components/ui/status-message";
import { RequireAuth } from "@/components/auth/require-auth";

export default function RoomsPage() {
  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <StatusMessage
          tone="empty"
          title="Room UI is scaffolded"
          detail="Public room list and watch room player land with Sprint 4 rooms epic (KIN-441+)."
        />
      </section>
    </RequireAuth>
  );
}
