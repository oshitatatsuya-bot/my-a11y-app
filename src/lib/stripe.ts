import Stripe from "stripe"

import type { Plan } from "@/lib/plans"

let stripeClient: Stripe | null = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }

  return stripeClient
}

export function proPriceId() {
  const id = process.env.STRIPE_PRICE_PRO
  if (!id) {
    throw new Error("Missing STRIPE_PRICE_PRO")
  }
  return id
}

/** Maps a Stripe price to our plan slug. V1 only sells Pro. */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro"
  return null
}

/**
 * Active and past_due keep Pro limits so a failed card has a grace window
 * before `customer.subscription.deleted` drops the account to Free.
 */
export function planFromSubscription(
  subscription: Stripe.Subscription
): { plan: Plan; planStatus: string } {
  const priceId = subscription.items.data[0]?.price.id
  const mapped = planFromPriceId(priceId)
  const status = subscription.status

  if (status === "active" || status === "trialing" || status === "past_due") {
    return {
      plan: mapped ?? "pro",
      planStatus: status === "trialing" ? "trialing" : status === "past_due" ? "past_due" : "active",
    }
  }

  return { plan: "free", planStatus: status === "canceled" ? "canceled" : "none" }
}

export function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return "http://localhost:3000"
}
