import { NextResponse } from "next/server";

/**
 * Digital Asset Links pre Android appku (TWA). Bez toho by appka
 * zobrazovala hore lištu s adresou. Hodnoty vyplníš v .env.
 */
export function GET() {
  const pkg = process.env.TWA_PACKAGE;
  const fps = (process.env.TWA_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!pkg || !fps.length) return NextResponse.json([]);
  return NextResponse.json([
    { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fps } },
  ]);
}
