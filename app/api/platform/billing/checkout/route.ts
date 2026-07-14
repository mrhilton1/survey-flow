import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"
import { createCheckoutSession } from "@/lib/platform/stripe"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.user || !session.workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const origin = new URL(request.url).origin
  const checkout = await createCheckoutSession({
    customerEmail: session.user.email,
    workspaceId: session.workspace.id,
    priceId: body.priceId,
    successUrl: `${origin}/dashboard/billing?checkout=success`,
    cancelUrl: `${origin}/dashboard/billing?checkout=cancelled`
  })

  return NextResponse.json(checkout)
}
