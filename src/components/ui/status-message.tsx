export function StatusMessage({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail?: string;
  tone?: "neutral" | "error" | "empty";
}) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "empty"
        ? "border-zinc-200 bg-zinc-50 text-zinc-700"
        : "border-zinc-200 bg-white text-zinc-900";

  return (
    <div className={`rounded-xl border p-6 ${toneClass}`}>
      <p className="font-medium">{title}</p>
      {detail ? <p className="mt-2 text-sm opacity-80">{detail}</p> : null}
    </div>
  );
}
