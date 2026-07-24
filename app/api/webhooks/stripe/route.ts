import { NextResponse } from "next/server"
import { verifyAndConstructStripeEvent } from "@/lib/platform/stripe"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("stripe-signature")

    const { event, verified, error } = await verifyAndConstructStripeEvent(rawBody, signature)

    if (error && verified === false && signature) {
      return NextResponse.json({ error }, { status: 400 })
    }

    if (!event) {
      return NextResponse.json({ error: "Invalid event data" }, { status: 400 })
    }

    // Handle key Stripe subscription events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object
        console.log(`[Stripe Webhook] Checkout Session completed for workspace: ${session?.metadata?.workspace_id}`)
        break
      }
      case "customer.subscription.updated": {
        const subscription = event.data?.object
        console.log(`[Stripe Webhook] Subscription updated: ${subscription?.id}`)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data?.object
        console.log(`[Stripe Webhook] Subscription canceled: ${subscription?.id}`)
        break
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ 
      received: true, 
      type: event.type || "unknown",
      verified
    })
  } catch (err: any) {
    console.error("Stripe webhook handler failed:", err)
    return NextResponse.json({ error: err.message || "Webhook processing error" }, { status: 500 })
  }
}

