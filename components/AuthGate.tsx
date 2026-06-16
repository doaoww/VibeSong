"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const checkRes = await fetch(
        `/api/auth/check-email?email=${encodeURIComponent(email)}`
      );
      if (checkRes.ok) {
        const { status } = await checkRes.json();
        if (status === "oauth-only") {
          setSubmitting(false);
          setError(
            "This email is already linked to a Google account — use Continue with Google instead."
          );
          return;
        }
      }
    } catch {
      // If the check fails, fall through and let signIn report the result.
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      setError("Wrong password.");
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-cream rounded-2xl p-6 space-y-5 text-center">
        <h2 className="font-display font-bold text-2xl text-ink">
          One last step
        </h2>
        <p className="text-black/60 text-sm">
          Sign in to save your matches and get better recommendations over
          time.
        </p>

        <button
          onClick={() => signIn("google")}
          className="w-full py-4 rounded-full font-display font-bold text-base bg-ink text-white active:scale-95 transition-opacity"
        >
          Continue with Google
        </button>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
          />
          <p className="text-black/40 text-xs">
            First time? Just pick a password — it creates your account.
          </p>
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white disabled:opacity-30 active:scale-95 transition-opacity glow-pink"
          >
            {submitting ? "Signing in..." : "Continue with email"}
          </button>
        </form>

        {error && <p className="text-error text-sm">{error}</p>}
      </div>
    </div>
  );
}
