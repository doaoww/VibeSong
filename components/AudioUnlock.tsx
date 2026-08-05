"use client";
import { useEffect } from "react";
import { unlockAudioPlayback } from "../lib/audioUnlock";

// Mounted once in the root layout. Listens for the very first pointerdown
// anywhere in the app (upload tap, nav click, whatever comes first) and uses
// it to prime autoplay permission — see lib/audioUnlock.ts for why this is
// needed before the swipe results page can autoplay its first card.
export default function AudioUnlock() {
  useEffect(() => {
    const onGesture = () => {
      if (unlockAudioPlayback()) {
        window.removeEventListener("pointerdown", onGesture);
      }
    };
    window.addEventListener("pointerdown", onGesture);
    return () => window.removeEventListener("pointerdown", onGesture);
  }, []);

  return null;
}
