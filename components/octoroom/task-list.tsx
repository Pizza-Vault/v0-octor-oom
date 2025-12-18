"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Task, Room } from "@/lib/types"

interface TaskListProps {
  tasks: (Task & { room: Room })[]
  showActions?: boolean
}

export function TaskList({ tasks, showActions = false }: TaskListProps) {
  const router = useRouter()
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [skipReason, setSkipReason] = useState("")
  const [note, setNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)

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

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const handleMarkDone = async (task: Task) => {
    setIsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.rpc("mark_task", {
      p_task_id: task.id,
      p_new_status: "done",
      p_skip_reason: null,
      p_note: null,
    })

    setIsLoading(false)

    if (error || !data?.success) {
      alert(error?.message || data?.error || "Failed to mark task as done")
      return
    }

    router.refresh()
  }

  const openSkipDialog = (task: Task) => {
    setSelectedTask(task)
    setSkipReason("")
    setNote("")
    setIsSkipDialogOpen(true)
  }

  const handleSkip = async () => {
    if (!selectedTask || !skipReason.trim()) return

    setIsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.rpc("mark_task", {
      p_task_id: selectedTask.id,
      p_new_status: "skipped",
      p_skip_reason: skipReason.trim(),
      p_note: note.trim() || null,
    })

    setIsLoading(false)

    if (error || !data?.success) {
      alert(error?.message || data?.error || "Failed to skip task")
      return
    }

    setIsSkipDialogOpen(false)
    router.refresh()
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">No tasks for this date.</CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((task) => (
          <Card key={task.id} className={task.status !== "open" ? "opacity-60" : ""}>
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold">Zimmer {task.room?.room_number}</div>
                  <Badge variant="secondary" className={getTypeColor(task.type)}>
                    {task.type}
                  </Badge>
                  {task.status !== "open" && (
                    <Badge variant="secondary" className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  )}
                </div>

                {showActions && task.status === "open" && (
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 px-4 border-red-200 text-red-700 hover:bg-red-50 bg-transparent"
                      onClick={() => openSkipDialog(task)}
                      disabled={isLoading}
                    >
                      <X className="h-5 w-5 mr-1" />
                      Skip
                    </Button>
                    <Button
                      size="lg"
                      className="h-12 px-6 bg-green-600 hover:bg-green-700"
                      onClick={() => handleMarkDone(task)}
                      disabled={isLoading}
                    >
                      <Check className="h-5 w-5 mr-1" />
                      Done
                    </Button>
                  </div>
                )}
              </div>

              {task.status === "skipped" && task.skip_reason && (
                <p className="mt-2 text-sm text-muted-foreground">Reason: {task.skip_reason}</p>
              )}
              {task.note && <p className="mt-1 text-sm text-muted-foreground">Note: {task.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isSkipDialogOpen} onOpenChange={setIsSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Task</DialogTitle>
            <DialogDescription>
              {selectedTask && `Zimmer ${selectedTask.room_id} - ${selectedTask.type}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason (required)</Label>
              <Textarea
                id="skip-reason"
                placeholder="Why is this task being skipped?"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Additional Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Any additional notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSkip}
              disabled={!skipReason.trim() || isLoading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isLoading ? "Skipping..." : "Skip Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
