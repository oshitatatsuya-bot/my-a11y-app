import { NextResponse } from "next/server"

import { createAnonClient } from "@/lib/supabase/anon"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email: unknown }).email).trim().toLowerCase()
      : ""

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid work email address." },
      { status: 400 }
    )
  }

  try {
    const supabase = createAnonClient()
    const { error } = await supabase.from("waitlist").insert({ email })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This email is already on the waitlist." },
          { status: 409 }
        )
      }

      console.error("Waitlist insert failed:", error.message)
      return NextResponse.json(
        { error: "Unable to save your email. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Waitlist handler failed:", error)
    return NextResponse.json(
      { error: "Unable to save your email. Please try again." },
      { status: 500 }
    )
  }
}
