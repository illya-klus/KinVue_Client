export type UserProfile = {
  userId?: string;
  id?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  preferences?: {
    genres?: string[];
    languages?: string[];
    autoplay?: boolean;
  };
  createdAt?: string;
};

export type UserSearchHit = {
  userId: string;
  username: string;
  displayName: string;
};

export type UserSearchResponse = {
  items: UserSearchHit[];
  nextCursor?: string | null;
};

export type FriendRequestRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  otherUser?: { username?: string; displayName?: string };
};

export type FriendRow = {
  userId: string;
  username?: string;
  displayName?: string;
};

export type MovieSummary = {
  id?: string;
  movieId?: string;
  title: string;
  description?: string;
  genres?: string[];
  status?: string;
  posterKey?: string;
};

export type WatchlistItem = {
  movieId: string;
  title?: string;
  addedAt?: string;
};

export type PublicRoom = {
  id: string;
  movieId: string;
  visibility: string;
  memberCount?: number;
};

export type MediaAccessResponse = {
  url: string;
  expiresAt?: string;
};

export type UploadInitResponse = {
  uploadId: string;
  parts: { partNumber: number; url: string }[];
};
