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
