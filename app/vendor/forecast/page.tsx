import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ForecastDay } from "@/lib/types"

export default async function VendorForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const days = Number.parseInt(params.days || "7")
  const today = new Date().toISOString().split("T")[0]

  const { data: result } = await supabase.rpc("forecast_tasks", {
    p_from_date: today,
    p_days: days,
  })

  const forecast: ForecastDay[] = result?.success ? result.forecast : []

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" }).format(date)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Forecast</h2>
      </div>

      <Tabs defaultValue="7" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="7" asChild>
            <a href="/vendor/forecast?days=7">7 Days</a>
          </TabsTrigger>
          <TabsTrigger value="14" asChild>
            <a href="/vendor/forecast?days=14">14 Days</a>
          </TabsTrigger>
          <TabsTrigger value="30" asChild>
            <a href="/vendor/forecast?days=30">30 Days</a>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={days.toString()} className="mt-4 space-y-3">
          {forecast.map((day) => (
            <Card key={day.date}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base font-medium flex items-center justify-between">
                  <span>{formatDate(day.date)}</span>
                  <div className="flex gap-2">
                    {day.restant_count > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {day.restant_count} Restant
                      </Badge>
                    )}
                    {day.depart_count > 0 && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        {day.depart_count} Depart
                      </Badge>
                    )}
                    {day.qc_count > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {day.qc_count} QC
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              {day.rooms.length > 0 && (
                <CardContent className="py-2 px-4">
                  <div className="flex flex-wrap gap-2">
                    {day.rooms.map((room, idx) => (
                      <Badge key={`${room.room_number}-${room.type}-${idx}`} variant="outline" className="text-xs">
                        Zimmer {room.room_number} ({room.type})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
