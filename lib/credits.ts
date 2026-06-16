const KEY = "vibesong_credits";
const DEFAULT_CREDITS = 3;

export function getCredits(): number {
  if (typeof window === "undefined") return DEFAULT_CREDITS;
  const stored = localStorage.getItem(KEY);
  if (stored === null) {
    localStorage.setItem(KEY, String(DEFAULT_CREDITS));
    return DEFAULT_CREDITS;
  }
  return parseInt(stored, 10);
}

export function deductCredit(): boolean {
  const current = getCredits();
  if (current <= 0) return false;
  localStorage.setItem(KEY, String(current - 1));
  return true;
}

export function addCredits(amount: number): void {
  const current = getCredits();
  localStorage.setItem(KEY, String(current + amount));
}

export function hasCredits(): boolean {
  return getCredits() > 0;
}
