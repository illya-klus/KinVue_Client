import type { MovieSummary } from "@/lib/types/domain";

export type CreateMoviePayload = {
  title: string;
  description: string;
  genres: string[];
  durationSeconds: number;
  posterKey: string;
};

export type SchedulePublishPayload = {
  publishAt: string;
};

export type MovieSearchResponse = {
  hits: MovieSummary[];
  estimatedTotalHits?: number;
};
