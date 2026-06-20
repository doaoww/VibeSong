"use client";
import { useCallback, useEffect, useState } from "react";

const LS_KEY = "vibesong_credits";
const FREE_CREDITS = 3;

function lsGet(): number {
  if (typeof window === "undefined") return FREE_CREDITS;
  const v = localStorage.getItem(LS_KEY);
  return v !== null ? parseInt(v, 10) : FREE_CREDITS;
}

function lsSet(n: number) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, String(n));
}

async function fetchCredits(): Promise<number | null> {
  try {
    const res = await fetch("/api/credits");
    if (res.ok) {
      const data = await res.json();
      lsSet(data.credits);
      return data.credits;
    }
  } catch {}
  return null; // not signed in or offline → fall back to localStorage
}

export function useCredits() {
  const [credits, setCredits] = useState<number>(() => lsGet());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Initialize from localStorage immediately (works for anon users too)
    setCredits(lsGet());

    fetchCredits().then((value) => {
      if (value !== null) {
        setCredits(value);
      }
      setLoaded(true);
    });
  }, []);

  const deduct = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/credits/deduct", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCredits(data.credits);
      lsSet(data.credits);
      return Boolean(data.ok);
    }
    // Fallback: localStorage (anonymous user)
    const current = lsGet();
    if (current <= 0) return false;
    const next = current - 1;
    lsSet(next);
    setCredits(next);
    return true;
  }, []);

  const add = useCallback(async (amount: number): Promise<void> => {
    const res = await fetch("/api/credits/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      const data = await res.json();
      setCredits(data.credits);
      lsSet(data.credits);
      return;
    }
    // Fallback: localStorage (anonymous user or Stripe not set up yet)
    const next = lsGet() + amount;
    lsSet(next);
    setCredits(next);
  }, []);

  const refresh = useCallback(async () => {
    const value = await fetchCredits();
    if (value !== null) setCredits(value);
  }, []);

  return { credits, loaded, refresh, deduct, add };
}
