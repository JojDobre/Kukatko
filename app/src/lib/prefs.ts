import { cookies } from "next/headers";

/** Platformy, ktoré si užívateľ vybral pre región (cookie "plats_SK", napr. "8.337"). */
export async function selectedPlats(region: string): Promise<number[]> {
  const v = (await cookies()).get(`plats_${region}`)?.value ?? "";
  return v.split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 30);
}
