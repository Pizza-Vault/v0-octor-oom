"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Room } from "@/lib/types"

interface CreateDepartButtonProps {
  rooms: Room[]
  date: string
}

export function CreateDepartButton({ rooms, date }: CreateDepartButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!selectedRoomId) return

    setIsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.rpc("create_depart_task", {
      p_room_id: selectedRoomId,
      p_task_date: date,
    })

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    if (data?.success) {
      setIsOpen(false)
      setSelectedRoomId("")
      router.refresh()
    } else {
      alert(data?.error || "Failed to create depart task")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Depart
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Depart Task</DialogTitle>
          <DialogDescription>Add a checkout cleaning task for {date}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Room</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    Zimmer {room.room_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selectedRoomId || isLoading}>
            {isLoading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
