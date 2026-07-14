import { NextResponse } from "next/server"
import { createBillingPortalSession } from "@/lib/platform/stripe"

export async function POST(request: Request) {
  const body = await request.json()
  const origin = new URL(request.url).origin
  return NextResponse.json(await createBillingPortalSession({
    customerId: body.customerId,
    returnUrl: `${origin}/dashboard/billing`
  }))
}
