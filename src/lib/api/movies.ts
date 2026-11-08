import { gatewayFetch } from "@/lib/gateway/client";
import type {
  CreateMoviePayload,
  MovieSearchResponse,
  SchedulePublishPayload,
} from "./movies.types";
import type { MediaAccessResponse, MovieSummary, WatchlistItem } from "@/lib/types/domain";

export type { CreateMoviePayload, SchedulePublishPayload } from "./movies.types";

export function searchMovies(q: string, genre?: string, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (genre) {
    params.set("genre", genre);
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return gatewayFetch<MovieSearchResponse>(
    `/api/movies/search?${params.toString()}`,
    {},
    { auth: false },
  );
}

export function fetchMovie(movieId: string) {
  return gatewayFetch<MovieSummary>(`/api/movies/${movieId}`, {}, { auth: false });
}

export function fetchWatchlist() {
  return gatewayFetch<{ items?: WatchlistItem[] } | WatchlistItem[]>("/api/watchlist").then(
    (data) => (Array.isArray(data) ? data : (data.items ?? [])),
  );
}

export function addToWatchlist(movieId: string) {
  return gatewayFetch(`/api/movies/${movieId}/watchlist`, { method: "POST" });
}

export function removeFromWatchlist(movieId: string) {
  return gatewayFetch(`/api/movies/${movieId}/watchlist`, { method: "DELETE" });
}

export function createMovie(body: CreateMoviePayload) {
  return gatewayFetch<MovieSummary>("/api/admin/movies", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateMovie(movieId: string, body: Partial<CreateMoviePayload>) {
  return gatewayFetch<MovieSummary>(`/api/admin/movies/${movieId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function publishMovie(movieId: string) {
  return gatewayFetch(`/api/admin/movies/${movieId}/publish`, { method: "POST" });
}

export function scheduleMovie(movieId: string, body: SchedulePublishPayload) {
  return gatewayFetch(`/api/admin/movies/${movieId}/schedule`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function requestMediaAccess(movieId: string) {
  return gatewayFetch<MediaAccessResponse>(`/api/movies/${movieId}/media-access`, {
    method: "POST",
  });
}
