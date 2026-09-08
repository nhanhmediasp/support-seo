import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKeyConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return NextResponse.json({
    ok: true,
    service: "air-sea-seo-command-center",
    timestamp: new Date().toISOString(),
    integrations: {
      supabase: supabaseUrlConfigured && supabaseKeyConfigured,
      searchConsole: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
    configuration: {
      supabaseUrl: supabaseUrlConfigured,
      supabasePublicKey: supabaseKeyConfigured,
    },
  });
}
