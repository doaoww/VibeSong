"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type State = "idle" | "sending" | "sent" | "error";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    setErrorMsg(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMsg("Couldn't send the link. Try again.");
      setState("error");
    } else {
      setState("sent");
    }
  };

  const handleGoogle = () => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-cream rounded-2xl p-6 space-y-5 text-center">

        {state === "sent" ? (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-hot-pink/15 flex items-center justify-center mx-auto">
              <span className="text-hot-pink text-2xl font-bold">✉</span>
            </div>
            <h2 className="font-display font-bold text-2xl text-ink">Check your inbox</h2>
            <p className="text-black/60 text-sm leading-relaxed">
              We sent a sign-in link to <span className="font-semibold text-ink">{email}</span>.
              Click it to continue — no password needed.
            </p>
            <p className="text-black/40 text-xs">
              Didn&apos;t get it?{" "}
              <button
                onClick={() => { setState("idle"); setEmail(""); }}
                className="text-hot-pink underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h2 className="font-display font-bold text-2xl text-ink">One last step</h2>
              <p className="text-black/60 text-sm">
                Sign in to save your matches and get better recommendations over time.
              </p>
            </div>

            <button
              onClick={handleGoogle}
              className="w-full py-4 rounded-full font-display font-bold text-base bg-ink text-white active:scale-95 transition-transform"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-black/10" />
              <span className="text-black/30 text-xs font-semibold">or</span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={state === "sending" || !email}
                className="w-full py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white disabled:opacity-40 active:scale-95 transition-all glow-pink"
              >
                {state === "sending" ? "Sending link..." : "Send magic link"}
              </button>
              <p className="text-black/35 text-xs">
                We&apos;ll email you a link — no password needed.
              </p>
            </form>

            {state === "error" && errorMsg && (
              <p className="text-red-500 text-sm">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
