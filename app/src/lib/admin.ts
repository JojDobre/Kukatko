import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Prihlásenie do administrácie heslom ADMIN_TOKEN (v cookie je len jeho odtlačok). */
export const adminSig = (token: string) => createHmac("sha256", token).update("kukatko-admin").digest("hex");

export async function isAdmin() {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 12) return false;
  const v = (await cookies()).get("adm")?.value ?? "";
  const exp = adminSig(token);
  return v.length === exp.length && timingSafeEqual(Buffer.from(v), Buffer.from(exp));
}
