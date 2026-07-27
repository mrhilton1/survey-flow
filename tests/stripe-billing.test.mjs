import assert from "node:assert/strict"
import test from "node:test"
import Stripe from "stripe"
import {
  isBillingRequestAuthorized,
  resolveAvailablePlanPrice,
  shouldRetryStripeEvent
} from "../lib/platform/billing-logic.ts"

const paidPlan = {
  plan_key: "growth",
  status: "active",
  active: true,
  price_monthly: 29,
  price_yearly: 290,
  stripe_monthly_price_id: "price_monthly",
  stripe_yearly_price_id: "price_yearly"
}

test("billing authorization requires session, workspace, user, and permission", () => {
  assert.equal(isBillingRequestAuthorized({ authenticated: true, hasUser: true, hasWorkspace: true, hasPermission: true }), true)
  assert.equal(isBillingRequestAuthorized({ authenticated: true, hasUser: true, hasWorkspace: true, hasPermission: false }), false)
  assert.equal(isBillingRequestAuthorized({ authenticated: false, hasUser: true, hasWorkspace: true, hasPermission: true }), false)
})

test("checkout resolves only the server-approved interval price", () => {
  assert.deepEqual(resolveAvailablePlanPrice(paidPlan, "monthly"), { amount: 29, priceId: "price_monthly" })
  assert.deepEqual(resolveAvailablePlanPrice(paidPlan, "yearly"), { amount: 290, priceId: "price_yearly" })
})

test("checkout rejects free, inactive, archived, and unavailable plans", () => {
  assert.throws(() => resolveAvailablePlanPrice({ ...paidPlan, plan_key: "free" }, "monthly"), /not available/)
  assert.throws(() => resolveAvailablePlanPrice({ ...paidPlan, active: false }, "monthly"), /not available/)
  assert.throws(() => resolveAvailablePlanPrice({ ...paidPlan, status: "archived" }, "monthly"), /not available/)
  assert.throws(() => resolveAvailablePlanPrice({ ...paidPlan, stripe_yearly_price_id: null }, "yearly"), /does not have/)
})

test("only failed Stripe ledger events are eligible for retry", () => {
  assert.equal(shouldRetryStripeEvent("failed"), true)
  assert.equal(shouldRetryStripeEvent("processing"), false)
  assert.equal(shouldRetryStripeEvent("processed"), false)
})

test("Stripe webhook verification rejects a bad signature", () => {
  const stripe = new Stripe("sk_test_unit", { apiVersion: "2026-06-24.dahlia" })
  const payload = JSON.stringify({ id: "evt_test", object: "event" })
  const secret = "whsec_unit_test"
  const validHeader = stripe.webhooks.generateTestHeaderString({ payload, secret })
  assert.equal(stripe.webhooks.constructEvent(payload, validHeader, secret).id, "evt_test")
  assert.throws(() => stripe.webhooks.constructEvent(payload, validHeader, "whsec_wrong"), /signature/i)
})
