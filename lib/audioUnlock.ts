// Chrome/WebKit block HTMLMediaElement.play() (and autoplay="1" iframes) unless
// tied to a recent user gesture. The swipe results page's first card autoplays
// from inside a useEffect — never synchronously inside a click — so by the time
// the AI analysis pipeline finishes and that effect fires, any transient
// gesture from the earlier upload tap has long expired and the browser silently
// blocks playback. Playing (and immediately pausing) a real media element
// inside an actual gesture handler grants the page standing permission to
// autoplay for the rest of the session, even from later async code — this call
// primes that permission on the very first tap/click anywhere in the app.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let unlocked = false;
let attemptInFlight = false;

// Returns true once permission is confirmed granted, so the caller can stop
// listening for gestures — false means the caller should try again on the
// next one (e.g. this attempt's gesture didn't count, or one is already in flight).
export function unlockAudioPlayback(): boolean {
  if (unlocked) return true;
  if (typeof window === "undefined" || attemptInFlight) return false;
  attemptInFlight = true;
  const primer = new Audio(SILENT_WAV);
  primer.play().then(
    () => {
      primer.pause();
      unlocked = true;
      attemptInFlight = false;
    },
    () => {
      attemptInFlight = false; // Gesture didn't count (e.g. synthetic event) — next real tap retries.
    }
  );
  return false;
}
