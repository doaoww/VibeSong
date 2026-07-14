/**
 * True only for actual mobile Safari on iOS — not Chrome/Firefox/Edge on
 * iOS, which all still report "Safari" in their UA string but use WebKit
 * under a different app wrapper that doesn't expose the same pasteboard
 * behavior the Instagram Stories trick relies on.
 */
export function isIOSSafari(userAgent: string): boolean {
  const isIOS = /iP(hone|od|ad)/.test(userAgent);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const isSafari = /Safari/.test(userAgent);
  return isIOS && isSafari && !isOtherBrowser;
}

export interface ShareCapableNavigator {
  canShare?: (data?: { files?: File[] }) => boolean;
}

export function canUseWebShareFiles(nav: ShareCapableNavigator, file: File): boolean {
  return typeof nav.canShare === "function" && nav.canShare({ files: [file] });
}

/**
 * Reads the Meta/Facebook App ID used for the Stories share deep link's
 * `source_application` parameter. A v1 of this feature shipped with a
 * placeholder ID and the shared photo silently failed to appear in
 * Instagram on real devices — this must be a real, registered Meta App ID
 * (see docs/superpowers/specs/2026-07-14-instagram-story-share-design.md).
 * Takes the raw env value as a parameter rather than reading
 * `process.env` directly so this stays testable without mocking globals.
 */
export function getFacebookAppId(envValue: string | undefined): string | null {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

// Instagram-documented pasteboard type for the Stories composer's background
// image — works from mobile Safari with no OAuth/API, provided
// source_application is a real registered Meta App ID (see
// getFacebookAppId's doc comment above for why this matters).
const INSTAGRAM_STORIES_PASTEBOARD_TYPE = "com.instagram.sharedSticker.backgroundImage";

export type ShareOutcome = "ios-deep-link" | "web-share" | "unsupported";

export async function shareToInstagramStory(
  imageBlob: Blob,
  facebookAppId: string
): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "unsupported";

  if (isIOSSafari(navigator.userAgent) && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [INSTAGRAM_STORIES_PASTEBOARD_TYPE]: imageBlob }),
      ]);
      window.location.href = `instagram-stories://share?source_application=${facebookAppId}`;
      return "ios-deep-link";
    } catch {
      // Clipboard write can fail on some WebKit versions outside a direct
      // user-gesture call stack — fall through to Web Share API below.
    }
  }

  const file = new File([imageBlob], "vibesong-story.png", { type: "image/png" });
  if (canUseWebShareFiles(navigator, file)) {
    await navigator.share({ files: [file] });
    return "web-share";
  }

  return "unsupported";
}
