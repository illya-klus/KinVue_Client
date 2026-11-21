"use client";
import { useParams } from "next/navigation";
import { MovieEditor } from "@/components/movies/movie-editor";
export default function EditMoviePage() {
  const { id } = useParams<{ id: string }>();
  return <MovieEditor movieId={id} />;
}
