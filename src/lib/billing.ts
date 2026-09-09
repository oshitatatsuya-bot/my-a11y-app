import type Stripe from "stripe"

import { planFromSubscription } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * Applies a subscription snapshot to the owning profile. Lookup is by
 * Stripe customer id first, then by the user id stored in subscription metadata.
 */
export async function syncSubscriptionToProfile(subscription: Stripe.Subscription) {
  const admin = createSupabaseAdminClient()
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const { plan, planStatus } = planFromSubscription(subscription)
  const priceId = subscription.items.data[0]?.price.id ?? null
  const userId = subscription.metadata.supabase_user_id || null

  const patch = {
    plan,
    plan_status: planStatus,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
  }

  if (userId) {
    const { error } = await admin.from("profiles").update(patch).eq("id", userId)
    if (error) throw error
    return
  }

  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("stripe_customer_id", customerId)

  if (error) throw error
}

export async function clearSubscriptionOnProfile(subscription: Stripe.Subscription) {
  const admin = createSupabaseAdminClient()
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const { error } = await admin
    .from("profiles")
    .update({
      plan: "free",
      plan_status: "canceled",
      stripe_subscription_id: null,
      stripe_price_id: null,
    })
    .eq("stripe_customer_id", customerId)

  if (error) throw error
}

/** Claims an event id. Returns false when Stripe is retrying a handled delivery. */
export async function claimStripeEvent(eventId: string, type: string) {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from("stripe_events").insert({ id: eventId, type })

  if (!error) return true
  if (error.code === "23505") return false
  throw error
}

export async function releaseStripeEvent(eventId: string) {
  const admin = createSupabaseAdminClient()
  await admin.from("stripe_events").delete().eq("id", eventId)
}
