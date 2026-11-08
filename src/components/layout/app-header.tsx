"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationBell } from "@/components/notifications/notification-bell";

const links = [
  { href: "/movies/search", label: "Movies" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/friends", label: "Friends" },
  { href: "/users/search", label: "People" },
  { href: "/rooms", label: "Rooms" },
  { href: "/profile", label: "Profile" },
];

export function AppHeader() {
  const { accessToken, isAdmin, logout } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KinVue
        </Link>
        <nav className="flex flex-1 flex-wrap gap-3 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-zinc-700 hover:text-zinc-950"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link href="/admin/movies" className="text-zinc-700 hover:text-zinc-950">
              Admin
            </Link>
          ) : null}
        </nav>
        <NotificationBell />
        {accessToken ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          >
            Log out
          </button>
        ) : (
          <Link href="/login" className="text-sm font-medium text-blue-600">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
