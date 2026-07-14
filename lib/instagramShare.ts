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
