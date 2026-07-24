"use client"

import React, { useState } from "react"
import { 
  CreditCard, 
  Check, 
  Zap, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  Sparkles, 
  HelpCircle,
  Building2,
  ArrowRight,
  AlertCircle
} from "lucide-react"

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null)

  const plans = [
    {
      id: "free",
      name: "Starter",
      description: "Essential survey creation for personal projects.",
      priceMonthly: 0,
      priceYearly: 0,
      priceIdMonthly: "price_free",
      priceIdYearly: "price_free",
      current: false,
      features: [
        "Up to 3 Active Surveys",
        "100 Responses per month",
        "Standard Analytics",
        "Community Support"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      description: "Advanced logic, AI reports, and unlimited surveys for growing teams.",
      priceMonthly: 29,
      priceYearly: 290,
      priceIdMonthly: "price_pro_monthly",
      priceIdYearly: "price_pro_yearly",
      popular: true,
      current: true,
      features: [
        "Unlimited Active Surveys",
        "10,000 Responses per month",
        "AI Report Generation",
        "Custom Branding & Themes",
        "Survey Webhooks & Export",
        "Priority Email Support"
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Dedicated infrastructure, custom SLAs, and multi-workspace security.",
      priceMonthly: 99,
      priceYearly: 990,
      priceIdMonthly: "price_enterprise_monthly",
      priceIdYearly: "price_enterprise_yearly",
      current: false,
      features: [
        "Unlimited Responses",
        "Dedicated Database Isolation",
        "Custom SSO & Domain Routing",
        "Advanced RBAC & Audit Logs",
        "24/7 Dedicated Account Manager",
        "Custom Stripe Invoice Billing"
      ]
    }
  ]

  async function handleCheckout(priceId: string) {
    if (priceId === "price_free") {
      setStatusMessage({ type: "info", text: "You are already on the Starter plan." })
      return
    }

    setLoadingPriceId(priceId)
    setStatusMessage(null)

    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId })
      })

      const data = await res.json()

      if (data.url) {
        if (data.mode === "stub") {
          setStatusMessage({
            type: "info",
            text: data.message || "Stripe test checkout triggered in stub mode."
          })
          window.location.href = data.url
        } else {
          window.location.href = data.url
        }
      } else if (data.error) {
        setStatusMessage({ type: "error", text: data.error })
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to initiate Stripe checkout." })
    } finally {
      setLoadingPriceId(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setStatusMessage(null)

    try {
      const res = await fetch("/api/platform/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "cus_demo_workspace" })
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        setStatusMessage({ type: "error", text: data.error })
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: "Failed to open Stripe customer portal." })
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Billing & Subscriptions
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">Active</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Manage workspace subscription plans, Stripe Checkout, and billing settings.</p>
        </div>

        <button
          onClick={handlePortal}
          disabled={portalLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Stripe Billing Portal
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-3 border ${
          statusMessage.type === "error" 
            ? "bg-red-50 text-red-800 border-red-200" 
            : statusMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-indigo-50 text-indigo-800 border-indigo-200"
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{statusMessage.text}</div>
        </div>
      )}

      {/* Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              billingCycle === "monthly" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              billingCycle === "yearly" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Annual Billing
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const price = billingCycle === "monthly" ? p.priceMonthly : p.priceYearly
          const priceId = billingCycle === "monthly" ? p.priceIdMonthly : p.priceIdYearly
          const isLoading = loadingPriceId === priceId

          return (
            <div
              key={p.id}
              className={`rounded-2xl p-6 border flex flex-col justify-between transition-all bg-white relative ${
                p.popular 
                  ? "border-indigo-500 shadow-xl ring-1 ring-indigo-500/20" 
                  : "border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{p.description}</p>
                  </div>
                  {p.current && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Current Plan
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-3xl font-extrabold text-slate-900">${price}</span>
                  <span className="text-xs text-slate-500">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  onClick={() => handleCheckout(priceId)}
                  disabled={isLoading || p.current}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    p.current
                      ? "bg-slate-100 text-slate-400 cursor-default"
                      : p.popular
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {p.current ? "Current Subscription" : `Upgrade to ${p.name}`}
                  {!p.current && !isLoading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stripe Setup Guide Card */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Stripe Integration Details</h3>
            <p className="text-xs text-slate-500">Configured via environment variables for real-time Stripe payment handling.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-mono text-[11px] text-slate-500">STRIPE_SECRET_KEY</span>
            <p className="font-medium text-slate-800">Server API Authentication</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-mono text-[11px] text-slate-500">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span>
            <p className="font-medium text-slate-800">Client Elements SDK</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-mono text-[11px] text-slate-500">STRIPE_WEBHOOK_SECRET</span>
            <p className="font-medium text-slate-800">Signature Event Verification</p>
          </div>
        </div>
      </div>
    </div>
  )
}

