import { supabase } from "../supabase";

const DEFAULT_CREDITS = 3;

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

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("user_id, credits, migrated_local_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return mapRow(existing);

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, credits: DEFAULT_CREDITS })
    .select("user_id, credits, migrated_local_data")
    .single();
  if (insertError) throw insertError;
  return mapRow(created);
}

export async function deductCredit(
  userId: string
): Promise<{ ok: boolean; credits: number }> {
  const profile = await getOrCreateProfile(userId);
  if (profile.credits <= 0) return { ok: false, credits: profile.credits };

  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: profile.credits - 1 })
    .eq("user_id", userId)
    .eq("credits", profile.credits)
    .select("credits")
    .single();
  if (error || !data) return { ok: false, credits: profile.credits };
  return { ok: true, credits: data.credits };
}

export async function addCredits(userId: string, amount: number): Promise<number> {
  const profile = await getOrCreateProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: profile.credits + amount })
    .eq("user_id", userId)
    .select("credits")
    .single();
  if (error) throw error;
  return data.credits;
}

export async function setCredits(userId: string, amount: number): Promise<number> {
  await getOrCreateProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: amount })
    .eq("user_id", userId)
    .select("credits")
    .single();
  if (error) throw error;
  return data.credits;
}

export function mergeMigratedCredits(serverCredits: number, localCredits: number | null): number {
  return typeof localCredits === "number"
    ? Math.max(serverCredits, localCredits)
    : serverCredits;
}

export async function markMigrated(userId: string, credits: number | null): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const { error } = await supabase
    .from("profiles")
    .update({
      migrated_local_data: true,
      credits: mergeMigratedCredits(profile.credits, credits),
    })
    .eq("user_id", userId);
  if (error) throw error;
}
