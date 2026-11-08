"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { GatewayError } from "@/lib/gateway/errors";
import { StatusMessage } from "@/components/ui/status-message";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        password: form.password,
      });
      router.push("/login");
    } catch (err) {
      if (err instanceof GatewayError && err.status === 409) {
        const code = err.body?.code?.toUpperCase() ?? "";
        if (code.includes("USERNAME")) {
          setError("That username is already taken.");
        } else if (code.includes("EMAIL")) {
          setError("That email is already registered.");
        } else {
          setError("Email or username is already taken.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Create account</h1>
      {error ? <StatusMessage tone="error" title="Registration error" detail={error} /> : null}
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-6">
        {(
          [
            ["email", "Email", "email"],
            ["username", "Username", "text"],
            ["displayName", "Display name", "text"],
            ["password", "Password (min 12)", "password"],
            ["confirm", "Confirm password", "password"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              type={type}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="text-sm text-zinc-600">
        Already registered?{" "}
        <Link className="text-blue-600 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
