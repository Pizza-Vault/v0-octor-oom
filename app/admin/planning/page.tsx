import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, TrendingUp } from "lucide-react"
import { PlanningDateSelector } from "@/components/octoroom/planning-date-selector"
import type { ForecastDay } from "@/lib/types"

export default async function AdminPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Default: next 14 days
  const today = new Date()
  const defaultFrom = today.toISOString().split("T")[0]
  const defaultTo = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const fromDate = params.from || defaultFrom
  const toDate = params.to || defaultTo

  // Calculate days between dates
  const daysDiff = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1

  const { data: result } = await supabase.rpc("forecast_tasks", {
    p_from_date: fromDate,
    p_days: daysDiff,
  })

  const forecast: ForecastDay[] = result?.success ? result.forecast : []

  // Calculate summary stats
  const totalTasks = forecast.reduce((sum, day) => sum + day.restant_count + day.depart_count + day.qc_count, 0)
  const totalRestant = forecast.reduce((sum, day) => sum + day.restant_count, 0)
  const totalDepart = forecast.reduce((sum, day) => sum + day.depart_count, 0)
  const avgTasksPerDay = forecast.length > 0 ? Math.round(totalTasks / forecast.length) : 0
  const peakDay = forecast.reduce(
    (max, day) => {
      const dayTotal = day.restant_count + day.depart_count + day.qc_count
      return dayTotal > max.count ? { date: day.date, count: dayTotal } : max
    },
    { date: "", count: 0 },
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date)
  }

  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date)
  }

  // Group by week for better overview
  const weeklyData: { week: string; days: ForecastDay[]; total: number }[] = []
  let currentWeek: ForecastDay[] = []
  let weekStart = ""

  forecast.forEach((day, index) => {
    const date = new Date(day.date)
    const dayOfWeek = date.getDay()

    if (dayOfWeek === 1 || index === 0) {
      if (currentWeek.length > 0) {
        const weekTotal = currentWeek.reduce((sum, d) => sum + d.restant_count + d.depart_count + d.qc_count, 0)
        weeklyData.push({ week: weekStart, days: currentWeek, total: weekTotal })
      }
      currentWeek = [day]
      weekStart = day.date
    } else {
      currentWeek.push(day)
    }

    if (index === forecast.length - 1 && currentWeek.length > 0) {
      const weekTotal = currentWeek.reduce((sum, d) => sum + d.restant_count + d.depart_count + d.qc_count, 0)
      weeklyData.push({ week: weekStart, days: currentWeek, total: weekTotal })
    }
  })

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Personalplanung</h2>
          <p className="text-muted-foreground">
            Forecast für {formatDateLong(fromDate)} bis {formatDateLong(toDate)}
          </p>
        </div>
        <PlanningDateSelector fromDate={fromDate} toDate={toDate} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamte Tasks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">in {forecast.length} Tagen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Durchschnitt/Tag</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTasksPerDay}</div>
            <p className="text-xs text-muted-foreground">Tasks pro Tag</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restant Tasks</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalRestant}</div>
            <p className="text-xs text-muted-foreground">Zimmerreinigungen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spitzentag</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{peakDay.count}</div>
            <p className="text-xs text-muted-foreground">{peakDay.date ? formatDate(peakDay.date) : "-"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Personnel Recommendation */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Personalempfehlung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Min. Personal/Tag</p>
              <p className="text-3xl font-bold">{Math.ceil(avgTasksPerDay / 8)}</p>
              <p className="text-xs text-muted-foreground">bei 8 Tasks/Person</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Am Spitzentag</p>
              <p className="text-3xl font-bold">{Math.ceil(peakDay.count / 8)}</p>
              <p className="text-xs text-muted-foreground">Personen benötigt</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamtstunden</p>
              <p className="text-3xl font-bold">{Math.round(totalTasks * 0.5)}</p>
              <p className="text-xs text-muted-foreground">ca. 30 Min/Task</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Wochenübersicht</h3>
        {weeklyData.map((week) => (
          <Card key={week.week}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base font-medium flex items-center justify-between">
                <span>KW {getWeekNumber(new Date(week.week))}</span>
                <Badge variant="secondary" className="text-sm">
                  {week.total} Tasks
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid gap-2">
                {week.days.map((day) => {
                  const dayTotal = day.restant_count + day.depart_count + day.qc_count
                  return (
                    <div key={day.date} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="font-medium">{formatDate(day.date)}</span>
                      <div className="flex items-center gap-4">
                        {/* Visual bar */}
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${Math.min((dayTotal / (peakDay.count || 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex gap-2 min-w-[180px] justify-end">
                          {day.restant_count > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {day.restant_count} R
                            </Badge>
                          )}
                          {day.depart_count > 0 && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              {day.depart_count} D
                            </Badge>
                          )}
                          {day.qc_count > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {day.qc_count} Q
                            </Badge>
                          )}
                          {dayTotal === 0 && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Keine
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Detail */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tagesdetails</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {forecast.map((day) => {
            const dayTotal = day.restant_count + day.depart_count + day.qc_count
            return (
              <Card key={day.date} className={dayTotal === peakDay.count ? "border-orange-300 bg-orange-50/50" : ""}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{formatDate(day.date)}</span>
                    {dayTotal === peakDay.count && dayTotal > 0 && <Badge className="bg-orange-500">Spitze</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold">{dayTotal}</span>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>~{Math.ceil(dayTotal / 8)} Person(en)</div>
                      <div>~{Math.round(dayTotal * 0.5)}h Arbeit</div>
                    </div>
                  </div>
                  {day.rooms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {day.rooms.slice(0, 6).map((room, idx) => (
                        <Badge key={`${room.room_number}-${room.type}-${idx}`} variant="outline" className="text-xs">
                          {room.room_number}
                        </Badge>
                      ))}
                      {day.rooms.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{day.rooms.length - 6}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
