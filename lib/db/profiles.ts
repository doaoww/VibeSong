import { supabase } from "../supabase";

const DEFAULT_CREDITS = 3;
const AUTH_CREDITS_KEY = "vibesong_credits";
const AUTH_MIGRATED_KEY = "vibesong_migrated_local_data";

export interface Profile {
  userId: string;
  credits: number;
  migratedLocalData: boolean;
}

interface ProfileRow {
  user_id: string;
  credits: number;
  migrated_local_data: boolean;
}

function mapRow(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    credits: row.credits,
    migratedLocalData: row.migrated_local_data,
  };
}

function isPostgrestUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST002" ||
    err.message?.includes("schema cache") === true
  );
}

function readCreditValue(value: unknown, fallback = DEFAULT_CREDITS): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

async function getAuthUser(userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase auth user not found: ${userId}`);
  return data.user;
}

function mapAuthUserToProfile(userId: string, user: Awaited<ReturnType<typeof getAuthUser>>): Profile {
  const metadata = user.app_metadata ?? {};
  return {
    userId,
    credits: readCreditValue(metadata[AUTH_CREDITS_KEY]),
    migratedLocalData: metadata[AUTH_MIGRATED_KEY] === true,
  };
}

async function getAuthProfile(userId: string): Promise<Profile> {
  const user = await getAuthUser(userId);
  return mapAuthUserToProfile(userId, user);
}

async function writeAuthProfile(
  userId: string,
  patch: { credits?: number; migratedLocalData?: boolean }
): Promise<Profile> {
  const user = await getAuthUser(userId);
  const metadata = {
    ...(user.app_metadata ?? {}),
    ...(typeof patch.credits === "number"
      ? { [AUTH_CREDITS_KEY]: readCreditValue(patch.credits) }
      : {}),
    ...(typeof patch.migratedLocalData === "boolean"
      ? { [AUTH_MIGRATED_KEY]: patch.migratedLocalData }
      : {}),
  };

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: metadata,
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase auth user not updated: ${userId}`);
  return mapAuthUserToProfile(userId, data.user);
}

async function mergeWithAuthCredits(profile: Profile): Promise<Profile> {
  try {
    const authProfile = await getAuthProfile(profile.userId);
    if (authProfile.credits <= profile.credits) return profile;

    const { error } = await supabase
      .from("profiles")
      .update({ credits: authProfile.credits })
      .eq("user_id", profile.userId);
    if (error && !isPostgrestUnavailable(error)) {
      console.warn("[credits] failed to sync higher auth credits to profile", error);
    }
    return { ...profile, credits: authProfile.credits };
  } catch (error) {
    console.warn("[credits] failed to read auth credit fallback", error);
    return profile;
  }
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("user_id, credits, migrated_local_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectError) {
    if (isPostgrestUnavailable(selectError)) return getAuthProfile(userId);
    throw selectError;
  }
  if (existing) return mergeWithAuthCredits(mapRow(existing));

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, credits: DEFAULT_CREDITS })
    .select("user_id, credits, migrated_local_data")
    .single();
  if (insertError) {
    if (isPostgrestUnavailable(insertError)) return getAuthProfile(userId);
    throw insertError;
  }
  return mergeWithAuthCredits(mapRow(created));
}

export async function deductCredit(
  userId: string
): Promise<{ ok: boolean; credits: number }> {
  try {
    const profile = await getOrCreateProfile(userId);
    if (profile.credits <= 0) return { ok: false, credits: profile.credits };

    const { data, error } = await supabase
      .from("profiles")
      .update({ credits: profile.credits - 1 })
      .eq("user_id", userId)
      .eq("credits", profile.credits)
      .select("credits")
      .single();
    if (error || !data) {
      if (isPostgrestUnavailable(error)) throw error;
      return { ok: false, credits: profile.credits };
    }
    void writeAuthProfile(userId, { credits: data.credits }).catch((error) =>
      console.warn("[credits] failed to sync deducted credits to auth metadata", error)
    );
    return { ok: true, credits: data.credits };
  } catch (error) {
    if (!isPostgrestUnavailable(error)) throw error;
    const profile = await getAuthProfile(userId);
    if (profile.credits <= 0) return { ok: false, credits: profile.credits };
    const updated = await writeAuthProfile(userId, { credits: profile.credits - 1 });
    return { ok: true, credits: updated.credits };
  }
}

export async function addCredits(userId: string, amount: number): Promise<number> {
  try {
    const profile = await getOrCreateProfile(userId);
    const { data, error } = await supabase
      .from("profiles")
      .update({ credits: profile.credits + amount })
      .eq("user_id", userId)
      .select("credits")
      .single();
    if (error) throw error;
    void writeAuthProfile(userId, { credits: data.credits }).catch((error) =>
      console.warn("[credits] failed to sync added credits to auth metadata", error)
    );
    return data.credits;
  } catch (error) {
    if (!isPostgrestUnavailable(error)) throw error;
    const profile = await getAuthProfile(userId);
    const updated = await writeAuthProfile(userId, { credits: profile.credits + amount });
    return updated.credits;
  }
}

export async function setCredits(userId: string, amount: number): Promise<number> {
  try {
    await getOrCreateProfile(userId);
    const { data, error } = await supabase
      .from("profiles")
      .update({ credits: amount })
      .eq("user_id", userId)
      .select("credits")
      .single();
    if (error) throw error;
    void writeAuthProfile(userId, { credits: data.credits }).catch((error) =>
      console.warn("[credits] failed to sync set credits to auth metadata", error)
    );
    return data.credits;
  } catch (error) {
    if (!isPostgrestUnavailable(error)) throw error;
    const updated = await writeAuthProfile(userId, { credits: amount });
    return updated.credits;
  }
}

export function mergeMigratedCredits(serverCredits: number, localCredits: number | null): number {
  return typeof localCredits === "number"
    ? Math.max(serverCredits, localCredits)
    : serverCredits;
}

export async function markMigrated(userId: string, credits: number | null): Promise<void> {
  try {
    const profile = await getOrCreateProfile(userId);
    const migratedCredits = mergeMigratedCredits(profile.credits, credits);
    const { error } = await supabase
      .from("profiles")
      .update({
        migrated_local_data: true,
        credits: migratedCredits,
      })
      .eq("user_id", userId);
    if (error) throw error;
    void writeAuthProfile(userId, {
      credits: migratedCredits,
      migratedLocalData: true,
    }).catch((error) =>
      console.warn("[credits] failed to sync migration credits to auth metadata", error)
    );
  } catch (error) {
    if (!isPostgrestUnavailable(error)) throw error;
    const profile = await getAuthProfile(userId);
    await writeAuthProfile(userId, {
      credits: mergeMigratedCredits(profile.credits, credits),
      migratedLocalData: true,
    });
  }
}
