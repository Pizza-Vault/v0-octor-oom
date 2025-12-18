"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

interface GenerateTasksButtonProps {
  date: string
}

export function GenerateTasksButton({ date }: GenerateTasksButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleGenerate = async () => {
    setIsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.rpc("generate_tasks_for_date", {
      p_date: date,
    })

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    if (data?.success) {
      alert(`Generated ${data.tasks_created} tasks for ${date}`)
      router.refresh()
    } else {
      alert(data?.error || "Failed to generate tasks")
    }
  }

  return (
    <Button onClick={handleGenerate} disabled={isLoading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Generating..." : "Generate Tasks for Today"}
    </Button>
  )
}
