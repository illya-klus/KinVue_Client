import { gatewayFetch } from "@/lib/gateway/client";
import type {
  UpdateProfilePayload,
  UserProfile,
  UserSearchResponse,
} from "./users.types";

export type { UpdateProfilePayload } from "./users.types";

export function fetchProfile() {
  return gatewayFetch<UserProfile>("/api/users/me");
}

export function updateProfile(body: UpdateProfilePayload) {
  return gatewayFetch<UserProfile>("/api/users/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function searchUsers(query: string, cursor?: string) {
  const params = new URLSearchParams({ query, limit: "20" });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return gatewayFetch<UserSearchResponse>(`/api/users/search?${params}`);
}
