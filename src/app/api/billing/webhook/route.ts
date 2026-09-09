import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import {
  claimStripeEvent,
  clearSubscriptionOnProfile,
  releaseStripeEvent,
  syncSubscriptionToProfile,
} from "@/lib/billing"
import { getStripe } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const rawBody = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (error) {
    console.error("Stripe signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const claimed = await claimStripeEvent(event.id, event.type)
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription" || !session.subscription) break

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId =
          session.client_reference_id ||
          session.metadata?.supabase_user_id ||
          subscription.metadata.supabase_user_id

        if (userId && session.customer) {
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer.id

          const admin = createSupabaseAdminClient()
          await admin
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("id", userId)

          if (!subscription.metadata.supabase_user_id) {
            await stripe.subscriptions.update(subscriptionId, {
              metadata: { supabase_user_id: userId },
            })
            subscription.metadata.supabase_user_id = userId
          }
        }

        await syncSubscriptionToProfile(subscription)
        break
      }

      case "customer.subscription.updated": {
        await syncSubscriptionToProfile(event.data.object as Stripe.Subscription)
        break
      }

      case "customer.subscription.deleted": {
        await clearSubscriptionOnProfile(event.data.object as Stripe.Subscription)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id

        if (!customerId) break

        const { data } = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 1,
        })
        const subscription = data[0]
        if (subscription) {
          await syncSubscriptionToProfile(subscription)
        }
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error("Stripe webhook handler failed:", error)
    await releaseStripeEvent(event.id)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
