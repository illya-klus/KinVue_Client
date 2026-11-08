import type { UserProfile, UserSearchResponse } from "@/lib/types/domain";

export type UpdateProfilePayload = {
  displayName?: string;
  avatarUrl?: string | null;
  preferences?: {
    genres?: string[];
    languages?: string[];
    autoplay?: boolean;
  };
};

export type { UserProfile, UserSearchResponse };
