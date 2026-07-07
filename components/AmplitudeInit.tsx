"use client";
import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

let initialized = false;

export default function AmplitudeInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    amplitude.initAll("aae00fd26f3adf40dafe014353e44eb0", {
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });
  }, []);

  return null;
}
