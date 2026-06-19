"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "../store/useAppStore";

export function useAccountSync() {
  const { data: session, status } = useSession();
  const [ready, setReady] = useState(false);
  const [tasteComplete, setTasteComplete] = useState<boolean | null>(null);
  const ranFor = useRef<string | null>(null);
  const loadFeedback = useAppStore((s) => s.loadFeedback);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (ranFor.current === session.user.id) return;
    ranFor.current = session.user.id;

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

      // Migrate song swipe onboarding results if present
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
  }, [status, session?.user?.id, loadFeedback]);

  return { session, status, ready, tasteComplete };
}
