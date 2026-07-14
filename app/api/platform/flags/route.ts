import { NextResponse } from "next/server"
import { defaultFeatureMap } from "@/lib/platform/feature-flags"

export async function GET() {
  return NextResponse.json({ flags: defaultFeatureMap() })
}
