import { NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildOpenApi(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
