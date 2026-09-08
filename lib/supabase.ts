import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);
export const localModeAllowed = process.env.NEXT_PUBLIC_ALLOW_LOCAL_MODE === "true";
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export type Project = { id: string; name: string; domain: string; timezone: string; created_at?: string };
