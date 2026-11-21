import { cookies } from "next/headers";

/** Platformy, ktoré si užívateľ vybral (cookie "plats", napr. "8.337"). */
export async function selectedPlats(): Promise<number[]> {
  const v = (await cookies()).get("plats")?.value ?? "";
  return v.split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 30);
}
