import { cookies } from "next/headers";
import { getRuntimeBindings } from "./runtime-env";

const COOKIE_NAME = "bgdrop_admin_session";
const encoder = new TextEncoder();

function runtimeEnv() {
  return getRuntimeBindings() as Record<string, string | undefined>;
}

function fromHex(value: string) {
  const pairs = value.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function toHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function verifyAdminPassword(password: string) {
  const stored = runtimeEnv().ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  const [saltHex, iterationsRaw, expected] = stored.split(":");
  const iterations = Number.parseInt(iterationsRaw || "", 10);
  if (!saltHex || !expected || !Number.isFinite(iterations)) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" }, key, 256);
  return safeEqual(toHex(derived), expected);
}

async function sign(value: string) {
  const secret = runtimeEnv().ADMIN_SESSION_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createAdminSession() {
  const expires = Date.now() + 1000 * 60 * 60 * 8;
  const signature = await sign(String(expires));
  if (!signature) throw new Error("Sessão administrativa não configurada.");
  const store = await cookies();
  store.set(COOKIE_NAME, `${expires}.${signature}`, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 8 });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await sign(expiresRaw);
  return Boolean(expected && safeEqual(expected, signature));
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  return null;
}
