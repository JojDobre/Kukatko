import { redirect } from "next/navigation";
import { page, type LangParams } from "@/lib/page";

/** Odkaz z QR kódu: /transfer?code=XXXX → profil s predvyplneným kódom. */
export default async function TransferPage({ params, searchParams }: { params: LangParams; searchParams: Promise<{ code?: string }> }) {
  const { h } = await page(params);
  const code = ((await searchParams).code ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  redirect(h(`/profile${code ? `?code=${code}` : ""}#transfer`));
}
