import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_PASSWORD, SESSION_SECRET } from "./config";

const COOKIE_NAME = "album_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export function verifyAdminPassword(password: string): boolean {
  const left = Buffer.from(password);
  const right = Buffer.from(ADMIN_PASSWORD);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createAdminSession() {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `admin:${exp}`;
  const value = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const [, expRaw] = payload.split(":");
  const exp = Number(expRaw);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("UNAUTHORIZED");
  }
}
