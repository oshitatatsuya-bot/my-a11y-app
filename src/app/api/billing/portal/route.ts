import { NextResponse } from "next/server"

import { appOrigin, getStripe } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
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
      { error: "Sign in to manage billing", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet. Upgrade to Pro first." },
      { status: 400 }
    )
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appOrigin()}/scan`,
  })

  return NextResponse.json({ url: session.url })
}
