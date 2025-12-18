"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"

interface PlanningDateSelectorProps {
  fromDate: string
  toDate: string
}

export function PlanningDateSelector({ fromDate, toDate }: PlanningDateSelectorProps) {
  const router = useRouter()
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(fromDate),
    to: new Date(toDate),
  })
  const [open, setOpen] = useState(false)

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) {
      setDateRange({
        from: range.from,
        to: range.to || range.from,
      })
    }
  }

  const applyDateRange = () => {
    const from = dateRange.from.toISOString().split("T")[0]
    const to = dateRange.to.toISOString().split("T")[0]
    router.push(`/admin/planning?from=${from}&to=${to}`)
    setOpen(false)
  }

  const quickSelect = (days: number) => {
    const from = new Date()
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
    router.push(`/admin/planning?from=${from.toISOString().split("T")[0]}&to=${to.toISOString().split("T")[0]}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => quickSelect(7)}>
        7 Tage
      </Button>
      <Button variant="outline" size="sm" onClick={() => quickSelect(14)}>
        14 Tage
      </Button>
      <Button variant="outline" size="sm" onClick={() => quickSelect(30)}>
        30 Tage
      </Button>
      <Button variant="outline" size="sm" onClick={() => quickSelect(90)}>
        3 Monate
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <CalendarIcon className="h-4 w-4" />
            Zeitraum wählen
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={de}
            defaultMonth={dateRange.from}
          />
          <div className="p-3 border-t flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {format(dateRange.from, "dd.MM.yyyy", { locale: de })} -{" "}
              {format(dateRange.to, "dd.MM.yyyy", { locale: de })}
            </div>
            <Button size="sm" onClick={applyDateRange}>
              Anwenden
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
