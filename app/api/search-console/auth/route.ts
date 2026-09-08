import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient, isGoogleConfigured, searchConsoleScope } from "../../../../lib/google-search-console";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth chưa được cấu hình" }, { status: 503 });
  const client = getGoogleOAuthClient();
  const requestedReturnTo = request.nextUrl.searchParams.get("returnTo");
  const returnTo = requestedReturnTo === "/rankings" ? requestedReturnTo : "/rankings";
  const state = crypto.randomUUID();
  const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: [searchConsoleScope], state });
  const response = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("gsc_oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  response.cookies.set("gsc_return_to", returnTo, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
