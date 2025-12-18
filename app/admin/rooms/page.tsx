import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RoomsList } from "@/components/octoroom/rooms-list"
import type { Room } from "@/lib/types"

export default async function AdminRoomsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: rooms } = await supabase.from("octo_rooms").select("*").order("room_number")

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Rooms</h2>
      <RoomsList rooms={(rooms as Room[]) || []} />
    </div>
  )
}
