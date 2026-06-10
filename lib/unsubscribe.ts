import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.UNSUBSCRIBE_SECRET ?? "dev-secret-change-me";

function generateToken(userId: string, key: string): string {
  return createHmac("sha256", SECRET).update(`${userId}:${key}`).digest("hex");
}

export function generateUnsubscribeUrl(userId: string, key: string): string {
  const sig = generateToken(userId, key);
  return `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?uid=${userId}&key=${key}&sig=${sig}`;
}

export function verifyUnsubscribeToken(userId: string, key: string, sig: string): boolean {
  const expected = Buffer.from(generateToken(userId, key));
  const received = Buffer.from(sig);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
