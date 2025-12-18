import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

/*
 * OCTORoom Webhook: Checkout/Depart
 *
 * Creates a depart task when a guest checks out.
 * Called by external PMS/booking system.
 *
 * Test with curl:
 *
 * curl -X POST https://YOUR_DOMAIN/api/webhook/checkout \
 *   -H "Content-Type: application/json" \
 *   -H "x-webhook-secret: YOUR_SECRET" \
 *   -d '{"room_number":5,"checkout_date":"2025-12-18"}'
 *
 * Success response:
 * {"ok":true,"action":"depart_task_created","room_number":5,"checkout_date":"2025-12-18"}
 *
 * Idempotent response (task already exists):
 * {"ok":true,"action":"depart_task_exists","room_number":5,"checkout_date":"2025-12-18"}
 */

// Date format validation: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

interface CheckoutPayload {
  room_number: number
  checkout_date: string
}

export async function POST(request: NextRequest) {
  // Set cache headers
  const headers = {
    "Cache-Control": "no-store",
  }

  try {
    // 1. Validate webhook secret
    const webhookSecret = request.headers.get("x-webhook-secret")
    const expectedSecret = process.env.OCTO_WEBHOOK_SECRET

    if (!expectedSecret) {
      console.error("[Webhook] OCTO_WEBHOOK_SECRET not configured")
      return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 500, headers })
    }

    if (!webhookSecret || webhookSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers })
    }

    // 2. Parse and validate body
    let payload: CheckoutPayload
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers })
    }

    const { room_number, checkout_date } = payload

    // Validate room_number
    if (typeof room_number !== "number" || !Number.isInteger(room_number) || room_number < 1 || room_number > 100) {
      return NextResponse.json(
        { ok: false, error: "Invalid room_number: must be integer 1-100" },
        { status: 400, headers },
      )
    }

    // Validate checkout_date format
    if (!checkout_date || typeof checkout_date !== "string" || !DATE_REGEX.test(checkout_date)) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout_date: must be YYYY-MM-DD format" },
        { status: 400, headers },
      )
    }

    // Validate date is parseable
    const parsedDate = new Date(checkout_date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout_date: not a valid date" },
        { status: 400, headers },
      )
    }

    // 3. Get Supabase service client (bypasses RLS)
    const supabase = createServiceClient()

    // 4. Find room by room_number
    const { data: room, error: roomError } = await supabase
      .from("octo_rooms")
      .select("id")
      .eq("room_number", room_number)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ ok: false, error: `Room ${room_number} not found` }, { status: 400, headers })
    }

    // 5. Check if depart task already exists (idempotency)
    const { data: existingTask } = await supabase
      .from("octo_tasks")
      .select("id")
      .eq("room_id", room.id)
      .eq("task_date", checkout_date)
      .eq("type", "depart")
      .single()

    if (existingTask) {
      // Task already exists - return success (idempotent)
      console.log(`[Webhook] Depart task already exists: room ${room_number}, date ${checkout_date}`)
      return NextResponse.json(
        {
          ok: true,
          action: "depart_task_exists",
          room_number,
          checkout_date,
        },
        { status: 200, headers },
      )
    }

    // 6. Create depart task
    const { error: insertError } = await supabase.from("octo_tasks").insert({
      room_id: room.id,
      task_date: checkout_date,
      type: "depart",
      status: "open",
    })

    if (insertError) {
      // Handle unique constraint violation (race condition - task was just created)
      if (insertError.code === "23505") {
        console.log(`[Webhook] Depart task created by concurrent request: room ${room_number}, date ${checkout_date}`)
        return NextResponse.json(
          {
            ok: true,
            action: "depart_task_exists",
            room_number,
            checkout_date,
          },
          { status: 200, headers },
        )
      }

      console.error("[Webhook] Failed to create depart task:", insertError.message)
      return NextResponse.json({ ok: false, error: "Failed to create task" }, { status: 500, headers })
    }

    // 7. Update room's last_depart_at
    await supabase.from("octo_rooms").update({ last_depart_at: checkout_date }).eq("id", room.id)

    console.log(`[Webhook] Depart task created: room ${room_number}, date ${checkout_date}`)

    return NextResponse.json(
      {
        ok: true,
        action: "depart_task_created",
        room_number,
        checkout_date,
      },
      { status: 200, headers },
    )
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500, headers })
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/webhook/checkout",
      method_allowed: "POST",
      status: "ready",
    },
    { status: 200 },
  )
}
