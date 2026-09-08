import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient, isGoogleConfigured } from "../../../../lib/google-search-console";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/rankings?gsc=not-configured", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gsc_oauth_state")?.value;
  const storedReturnTo = request.cookies.get("gsc_return_to")?.value;
  const returnTo = storedReturnTo === "/rankings" ? storedReturnTo : "/rankings";
  const redirect = (status: string) => {
    const response = NextResponse.redirect(new URL(`${returnTo}?gsc=${status}`, request.url));
    response.cookies.set("gsc_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    response.cookies.set("gsc_return_to", "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  };
  if (!state || !expectedState || state !== expectedState) return redirect("invalid-state");
  if (!code) return redirect("cancelled");
  try {
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
    const response = NextResponse.redirect(new URL(`${returnTo}?gsc=connected`, request.url));
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set("gsc_oauth_state", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
    response.cookies.set("gsc_return_to", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
    if (tokens.refresh_token) response.cookies.set("gsc_refresh_token", tokens.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, priority: "high" });
    if (tokens.access_token) response.cookies.set("gsc_access_token", tokens.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 3600, priority: "high" });
    return response;
  } catch {
    return redirect("error");
  }
}
