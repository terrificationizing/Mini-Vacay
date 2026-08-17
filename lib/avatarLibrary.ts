import type { AvatarGeometry } from "@/data/avatarGeometry";
import { AVATAR_PROFILES } from "@/data/avatarProfiles";

// Personal avatar library: up to 9 user-created avatars, persisted in localStorage
// (following the HIGH_SCORE_KEY pattern already used in GameRoot.tsx). This array is a
// FIFO queue (oldest at index 0, newest at the end); the grid (see PhotoSelectScreen's
// buildGridSlots) puts the newest entry FIRST (top-left of the grid), then the rest of the
// created avatars newest-to-oldest, then fills whatever slots remain with preloaded
// characters in their own original order -- so it's always the TAIL of the preloaded list
// (MJ, then Nichole, then Matt...) that gets displaced as more are created, never the
// front ones. Creating a 10th evicts the oldest overall. Preloaded avatars are never
// deletable -- they're always the fallback underneath, restored automatically once enough
// created avatars are removed that they fit in the grid again.

const AVATAR_LIBRARY_KEY = "miniVacayAvatarLibrary";
export const AVATAR_LIBRARY_MAX = AVATAR_PROFILES.length;

export type CreatedAvatarEntry = {
  id: string;
  createdAt: number;
  geometry: AvatarGeometry;
  smileDataUrl: string;
  frownDataUrl: string;
  /** User-chosen display name -- absent/empty on older entries and freshly created ones
   *  until renamed, in which case the grid falls back to "Your Mini Me". */
  name?: string;
};

export function loadAvatarLibrary(): CreatedAvatarEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AVATAR_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: CreatedAvatarEntry[]) {
  // Quota is a real risk here (each entry carries two base64 720x1100 PNGs) -- if it's
  // exceeded, drop the oldest entry and retry once, rather than losing the newest avatar
  // the user just made. Non-fatal either way: the in-memory list still updates via the
  // caller's own state regardless of whether persistence succeeds.
  try {
    window.localStorage.setItem(AVATAR_LIBRARY_KEY, JSON.stringify(entries));
  } catch {
    if (entries.length > 1) {
      try {
        window.localStorage.setItem(AVATAR_LIBRARY_KEY, JSON.stringify(entries.slice(1)));
      } catch {
        // Give up silently -- persistence is a nice-to-have, not required for the
        // current session to keep working.
      }
    }
  }
}

export function addCreatedAvatar(entries: CreatedAvatarEntry[], entry: CreatedAvatarEntry): CreatedAvatarEntry[] {
  const next = [...entries, entry].slice(-AVATAR_LIBRARY_MAX);
  persist(next);
  return next;
}

export function removeCreatedAvatar(entries: CreatedAvatarEntry[], id: string): CreatedAvatarEntry[] {
  const next = entries.filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function renameCreatedAvatar(entries: CreatedAvatarEntry[], id: string, name: string): CreatedAvatarEntry[] {
  const next = entries.map((e) => (e.id === id ? { ...e, name } : e));
  persist(next);
  return next;
}
