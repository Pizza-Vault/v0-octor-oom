import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Event, Room } from "@/lib/types"

export default async function VendorHistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: events } = await supabase
    .from("octo_events")
    .select("*, room:octo_rooms(*)")
    .gte("performed_at", thirtyDaysAgo.toISOString())
    .order("performed_at", { ascending: false })
    .limit(100)

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getStatusColor = (action: string) => {
    switch (action) {
      case "done":
        return "bg-green-100 text-green-800"
      case "skipped":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "depart":
        return "bg-orange-100 text-orange-800"
      case "restant":
        return "bg-blue-100 text-blue-800"
      case "qc":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">History (Last 30 Days)</h2>

      <div className="space-y-2">
        {(events as (Event & { room: Room })[])?.map((event) => (
          <Card key={event.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-medium">Zimmer {event.room?.room_number}</div>
                  <Badge variant="secondary" className={getTypeColor(event.type)}>
                    {event.type}
                  </Badge>
                  <Badge variant="secondary" className={getStatusColor(event.action)}>
                    {event.action}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{formatDateTime(event.performed_at)}</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                by {event.performed_by_name} ({event.performed_by_company})
                {event.note && <span className="ml-2">- {event.note}</span>}
              </div>
            </CardContent>
          </Card>
        )) || <p className="text-muted-foreground">No events found.</p>}
      </div>
    </div>
  )
}
