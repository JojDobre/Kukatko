import { handler } from "@/lib/api";

/** Krajina je v cookie „region“; ensureDevice (v handleri) ju zapíše aj k zariadeniu. */
export const POST = handler(async () => ({ ok: true }), { limit: [30, 60] });
