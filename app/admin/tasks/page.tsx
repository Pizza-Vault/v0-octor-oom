import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TaskList } from "@/components/octoroom/task-list"
import { DateSelector } from "@/components/octoroom/date-selector"
import { CreateDepartButton } from "@/components/octoroom/create-depart-button"
import type { Task, Room } from "@/lib/types"

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const selectedDate = params.date || new Date().toISOString().split("T")[0]

  const { data: tasks } = await supabase
    .from("octo_tasks")
    .select("*, room:octo_rooms(*)")
    .eq("task_date", selectedDate)
    .order("type")
    .order("room_id")

  const { data: rooms } = await supabase.from("octo_rooms").select("*").order("room_number")

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <div className="flex items-center gap-2">
          <CreateDepartButton rooms={(rooms as Room[]) || []} date={selectedDate} />
          <DateSelector currentDate={selectedDate} basePath="/admin/tasks" />
        </div>
      </div>

      <TaskList tasks={(tasks as (Task & { room: Room })[]) || []} showActions />
    </div>
  )
}
