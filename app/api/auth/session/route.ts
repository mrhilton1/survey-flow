import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"

export async function GET() {
  return NextResponse.json(await getCurrentSession())
}
