import { NextResponse } from "next/server"

import { appOrigin, getStripe, proPriceId } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_PRO) {
    return NextResponse.json(
      { error: "Billing is not configured yet" },
      { status: 503 }
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to upgrade", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.plan === "pro" || profile?.plan === "agency") {
    return NextResponse.json(
      { error: "You are already on a paid plan. Use Manage billing to change it." },
      { status: 409 }
    )
  }

  const stripe = getStripe()
  const origin = appOrigin()

  let customerId = profile?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    const { error } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)

    if (error) {
      console.error("Failed to store stripe_customer_id:", error.message)
      return NextResponse.json(
        { error: "Could not prepare billing for this account" },
        { status: 500 }
      )
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    line_items: [{ price: proPriceId(), quantity: 1 }],
    success_url: `${origin}/scan?upgraded=1`,
    cancel_url: `${origin}/#pricing`,
    allow_promotion_codes: true,
  })

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: session.url })
}
