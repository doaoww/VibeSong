"use client";
import { useCallback, useEffect, useState } from "react";

async function fetchCredits(): Promise<number | null> {
  const res = await fetch("/api/credits");
  if (!res.ok) return null;
  const data = await res.json();
  return data.credits;
}

export function useCredits() {
  const [credits, setCredits] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const value = await fetchCredits();
    if (value !== null) {
      setCredits(value);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const value = await fetchCredits();
      if (value !== null) {
        setCredits(value);
        setLoaded(true);
      }
    })();
  }, []);

  const deduct = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/credits/deduct", { method: "POST" });
    if (!res.ok) return false;
    const data = await res.json();
    setCredits(data.credits);
    return Boolean(data.ok);
  }, []);

  const add = useCallback(async (amount: number): Promise<void> => {
    const res = await fetch("/api/credits/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setCredits(data.credits);
  }, []);

  return { credits, loaded, refresh, deduct, add };
}
