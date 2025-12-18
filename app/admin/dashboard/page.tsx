import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GenerateTasksButton } from "@/components/octoroom/generate-tasks-button"
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const today = new Date().toISOString().split("T")[0]

  // Get today's task stats
  const { data: todayTasks } = await supabase.from("octo_tasks").select("status, type").eq("task_date", today)

  const stats = {
    total: todayTasks?.length || 0,
    open: todayTasks?.filter((t) => t.status === "open").length || 0,
    done: todayTasks?.filter((t) => t.status === "done").length || 0,
    skipped: todayTasks?.filter((t) => t.status === "skipped").length || 0,
    depart: todayTasks?.filter((t) => t.type === "depart").length || 0,
    restant: todayTasks?.filter((t) => t.type === "restant").length || 0,
    qc: todayTasks?.filter((t) => t.type === "qc").length || 0,
  }

  // Get room count
  const { count: roomCount } = await supabase.from("octo_rooms").select("*", { count: "exact", head: true })

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <GenerateTasksButton date={today} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.depart} depart, {stats.restant} restant, {stats.qc} QC
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Pending tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Done</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.done}</div>
            <p className="text-xs text-muted-foreground">Completed tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
            <p className="text-xs text-muted-foreground">Skipped tasks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Rooms</p>
              <p className="text-2xl font-bold">{roomCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">
                {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-2xl font-bold">
                {new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" }).format(
                  new Date(),
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
