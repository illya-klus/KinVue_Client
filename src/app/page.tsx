import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">KinVue</h1>
      <p className="max-w-2xl text-zinc-600">
        Web client for the KinVue MVP. All HTTP calls go through the Gateway (
        {process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000"}).
      </p>
      <HomeLinks />
    </section>
  );
}

function HomeLinks() {
  const base =
    "inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800";
  return (
    <div className="flex flex-wrap gap-3">
      <Link className={base} href="/movies/search">
        Browse movies
      </Link>
      <Link className={base} href="/register">
        Create account
      </Link>
      <Link
        className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
        href="/login"
      >
        Sign in
      </Link>
    </div>
  );
}
