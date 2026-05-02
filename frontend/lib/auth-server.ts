import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY ?? "change-me-in-production"
);
const ALG = "HS256";
const EXPIRES_IN = "15m";          // access token
const REFRESH_EXPIRES_IN = "30d";  // refresh token
export const REFRESH_COOKIE = "fd_refresh_token";

export interface JWTPayload {
  sub: string; // user UUID
  email: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET);
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "refresh" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRES_IN)
    .sign(SECRET);
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  if (payload["typ"] !== "refresh") throw new Error("Not a refresh token");
  return { sub: payload.sub as string, email: payload["email"] as string };
}

export async function signResetToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "reset" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

export async function verifyResetToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  if (payload["typ"] !== "reset") throw new Error("Not a reset token");
  return { sub: payload.sub as string, email: payload["email"] as string };
}

export function makeRefreshCookieHeader(token: string): string {
  const maxAge = 30 * 24 * 60 * 60;
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${maxAge}`;
}

export function clearRefreshCookieHeader(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0`;
}

export function getRefreshToken(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? null;
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return { sub: payload.sub as string, email: payload["email"] as string };
}

export async function getAuthUser(
  req: NextRequest
): Promise<JWTPayload | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json(
    { data: null, error: "Not authenticated" },
    { status: 401 }
  );
}