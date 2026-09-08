import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "air-sea-seo-command-center",
    timestamp: new Date().toISOString(),
    integrations: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      searchConsole: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
  });
}
