"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";
import { useAppStore } from "../store/useAppStore";

export function useAccountSync() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [ready, setReady] = useState(false);
  const [tasteComplete, setTasteComplete] = useState<boolean | null>(null);
  const ranFor = useRef<string | null>(null);
  const loadFeedback = useAppStore((s) => s.loadFeedback);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
      if (!u) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
      if (!u) { setReady(true); return; }

      if (ranFor.current === u.id) return;
      ranFor.current = u.id;

      (async () => {
        const localTasteRaw = localStorage.getItem("userTaste");
        const localCreditsRaw = localStorage.getItem("vibesong_credits");

        await fetch("/api/migrate-local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userTaste: localTasteRaw ? JSON.parse(localTasteRaw) : null,
            savedSongs: useAppStore.getState().savedSongs,
            skippedSongs: useAppStore.getState().skippedSongs,
            credits: localCreditsRaw ? parseInt(localCreditsRaw, 10) : null,
          }),
        }).catch(() => {});

        const seedFeedbackRaw = localStorage.getItem("seedFeedback");
        if (seedFeedbackRaw) {
          fetch("/api/seed-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: seedFeedbackRaw,
          })
            .then(() => localStorage.removeItem("seedFeedback"))
            .catch(() => {});
        }

        const tasteRes = await fetch("/api/taste");
        const taste = tasteRes.ok ? await tasteRes.json() : null;
        setTasteComplete(Boolean(taste?.setupComplete));

        await loadFeedback();
        setReady(true);
      })();
    });

    return () => subscription.unsubscribe();
  }, [loadFeedback]);

  return { user, status, ready, tasteComplete };
}
