import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get events grouped by performer
  const { data: events } = await supabase
    .from("octo_events")
    .select("*")
    .gte("performed_at", thirtyDaysAgo.toISOString())

  // Get skip reasons
  const { data: skippedTasks } = await supabase
    .from("octo_tasks")
    .select("skip_reason, room:octo_rooms(room_number)")
    .eq("status", "skipped")
    .gte("created_at", thirtyDaysAgo.toISOString())

  // Group by performer
  const performerStats: Record<string, { done: number; skipped: number; company: string }> = {}
  events?.forEach((event) => {
    const key = event.performed_by_name
    if (!performerStats[key]) {
      performerStats[key] = { done: 0, skipped: 0, company: event.performed_by_company }
    }
    if (event.action === "done") performerStats[key].done++
    if (event.action === "skipped") performerStats[key].skipped++
  })

  // Group skip reasons
  const skipReasons: Record<string, number> = {}
  skippedTasks?.forEach((task) => {
    const reason = task.skip_reason || "No reason"
    skipReasons[reason] = (skipReasons[reason] || 0) + 1
  })

  const downloadCSV = () => {
    // This would be handled client-side
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reports (Last 30 Days)</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance by User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(performerStats).map(([name, stats]) => (
                <div key={name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground">{stats.company}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {stats.done} done
                    </Badge>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      {stats.skipped} skipped
                    </Badge>
                  </div>
                </div>
              ))}
              {Object.keys(performerStats).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skip Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(skipReasons)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{reason}</p>
                    <Badge variant="outline">{count}x</Badge>
                  </div>
                ))}
              {Object.keys(skipReasons).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No skipped tasks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
