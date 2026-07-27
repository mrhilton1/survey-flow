import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { canManageBilling, getApplicationUrl } from "@/lib/platform/billing"
import { createBillingPortalSession } from "@/lib/platform/stripe"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageBilling(session) || !session.workspace) {
      return NextResponse.json({ error: "Billing manager access is required." }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()
    const [{ data: workspace }, { data: workspacePlan }] = await Promise.all([
      supabase
        .from("app_shell_workspaces")
        .select("stripe_customer_id")
        .eq("id", session.workspace.id)
        .eq("application_key", appConfig.product.applicationKey)
        .maybeSingle(),
      supabase
        .from("app_shell_workspace_plans")
        .select("stripe_customer_id")
        .eq("workspace_id", session.workspace.id)
        .eq("application_key", appConfig.product.applicationKey)
        .maybeSingle()
    ])
    const customerId = workspacePlan?.stripe_customer_id || workspace?.stripe_customer_id
    if (!customerId) return NextResponse.json({ error: "This workspace does not have a Stripe customer yet." }, { status: 404 })

    return NextResponse.json(await createBillingPortalSession({
      customerId,
      returnUrl: `${getApplicationUrl(request.url)}/dashboard/billing`
    }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open the billing portal." }, { status: 500 })
  }
}
