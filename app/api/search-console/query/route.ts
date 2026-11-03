import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google, searchconsole_v1 } from "googleapis";
import { validPeriod } from "../../../../lib/seo-periods";
import { createClient } from "@supabase/supabase-js";
import { getGoogleOAuthClient, isGoogleConfigured } from "../../../../lib/google-search-console";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth chưa được cấu hình" }, { status: 503 });
  if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_MODE !== "true") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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
  if (!validPeriod({ from: startDate, to: endDate }) || Date.parse(endDate) - Date.parse(startDate) > 366 * 86400000) return NextResponse.json({ error: "Khoảng ngày không hợp lệ hoặc vượt quá 366 ngày" }, { status: 400 });
  try {
    const client = getGoogleOAuthClient();
    if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
    else client.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: client });
    const summary = await searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ["date"], rowLimit: 25000, dataState: "final", type: "web" } });
    const rows: searchconsole_v1.Schema$ApiDataRow[] = [];
    for (let page = 0; page < 8; page += 1) {
      const result = await searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ["query", "page"], rowLimit: 25000, startRow: page * 25000, dataState: "final", type: "web" } });
      const batch = result.data.rows || [];
      rows.push(...batch);
      if (batch.length < 25000) return NextResponse.json({ siteUrl, startDate, endDate, rows, summaryRows: summary.data.rows || [] });
    }
    return NextResponse.json({ error: "Dữ liệu quá lớn để nhập an toàn. Hãy chọn khoảng ngày ngắn hơn." }, { status: 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lấy được dữ liệu Search Console";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
