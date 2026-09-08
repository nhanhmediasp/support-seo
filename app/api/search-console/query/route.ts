import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { getGoogleOAuthClient, isGoogleConfigured } from "../../../../lib/google-search-console";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth chưa được cấu hình" }, { status: 503 });
  if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_MODE !== "true") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !anonKey) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: authError } = await authClient.auth.getUser(token);
    if (authError) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  const accessToken = cookieStore.get("gsc_access_token")?.value;
  if (!refreshToken && !accessToken) return NextResponse.json({ error: "Chưa kết nối Google Search Console" }, { status: 401 });
  const siteUrl = request.nextUrl.searchParams.get("siteUrl") || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");
  if (!siteUrl || !startDate || !endDate) return NextResponse.json({ error: "Thiếu siteUrl, startDate hoặc endDate" }, { status: 400 });
  try {
    const client = getGoogleOAuthClient();
    if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
    else client.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: client });
    const result = await searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ["query", "page"], rowLimit: 25000, dataState: "final" } });
    return NextResponse.json({ siteUrl, startDate, endDate, rows: result.data.rows || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lấy được dữ liệu Search Console";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
