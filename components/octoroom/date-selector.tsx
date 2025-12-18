"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { format, addDays, subDays } from "date-fns"
import { de } from "date-fns/locale"

interface DateSelectorProps {
  currentDate: string
  basePath: string
}

export function DateSelector({ currentDate, basePath }: DateSelectorProps) {
  const router = useRouter()
  const date = new Date(currentDate)

  const goToDate = (newDate: Date) => {
    router.push(`${basePath}?date=${newDate.toISOString().split("T")[0]}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => goToDate(subDays(date, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[140px] bg-transparent">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, "dd. MMM yyyy", { locale: de })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={date} onSelect={(d) => d && goToDate(d)} locale={de} />
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="icon" onClick={() => goToDate(addDays(date, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
