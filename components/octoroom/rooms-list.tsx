"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings, Lock, Unlock, UserPlus, UserMinus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Room, RestantPolicy } from "@/lib/types"

interface RoomsListProps {
  rooms: Room[]
}

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export function RoomsList({ rooms }: RoomsListProps) {
  const router = useRouter()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split("T")[0])
  const [policyType, setPolicyType] = useState("")
  const [nDays, setNDays] = useState(3)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [blockedFrom, setBlockedFrom] = useState("")
  const [blockedTo, setBlockedTo] = useState("")
  const [blockedReason, setBlockedReason] = useState("")

  const openEditDialog = (room: Room) => {
    setSelectedRoom(room)
    setPolicyType(room.restant_policy.type)
    setNDays(room.restant_policy.n_days || 3)
    setSelectedDays(room.restant_policy.days_of_week || [])
    setIsEditDialogOpen(true)
  }

  const openBlockDialog = (room: Room) => {
    setSelectedRoom(room)
    setBlockedFrom(room.blocked_from || "")
    setBlockedTo(room.blocked_to || "")
    setBlockedReason(room.blocked_reason || "")
    setIsBlockDialogOpen(true)
  }

  const handleSavePolicy = async () => {
    if (!selectedRoom) return

    setIsLoading(true)
    const supabase = createClient()

    const policy: RestantPolicy =
      policyType === "every_n_days"
        ? { type: "every_n_days", n_days: nDays }
        : { type: "weekly_on_days", days_of_week: selectedDays }

    const { error } = await supabase.from("octo_rooms").update({ restant_policy: policy }).eq("id", selectedRoom.id)

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    setIsEditDialogOpen(false)
    router.refresh()
  }

  const handleSaveBlock = async () => {
    if (!selectedRoom) return

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("octo_rooms")
      .update({
        blocked_for_cleaning: !!(blockedFrom && blockedTo),
        blocked_from: blockedFrom || null,
        blocked_to: blockedTo || null,
        blocked_reason: blockedReason || null,
      })
      .eq("id", selectedRoom.id)

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    setIsBlockDialogOpen(false)
    router.refresh()
  }

  const handleUnblock = async (room: Room) => {
    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("octo_rooms")
      .update({
        blocked_for_cleaning: false,
        blocked_from: null,
        blocked_to: null,
        blocked_reason: null,
      })
      .eq("id", room.id)

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.refresh()
  }

  const handleCheckIn = async () => {
    if (!selectedRoom) return

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.rpc("check_in_room", {
      p_room_id: selectedRoom.id,
      p_check_in_date: checkInDate,
    })

    setIsLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    setIsCheckInDialogOpen(false)
    router.refresh()
  }

  const openCheckInDialog = (room: Room) => {
    setSelectedRoom(room)
    setCheckInDate(new Date().toISOString().split("T")[0])
    setIsCheckInDialogOpen(true)
  }

  const getPolicyDescription = (policy: RestantPolicy) => {
    if (policy.type === "every_n_days") {
      return `Every ${policy.n_days} days`
    }
    const days = policy.days_of_week?.map((d) => WEEKDAYS.find((w) => w.value === d)?.label.slice(0, 3)).join(", ")
    return `Weekly on ${days}`
  }

  const getNextRestantDates = (room: Room): string[] => {
    const dates: string[] = []
    const today = new Date()

    for (let i = 0; i < 30 && dates.length < 4; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + i)

      if (room.restant_policy.type === "weekly_on_days") {
        const dayOfWeek = checkDate.getDay()
        if (room.restant_policy.days_of_week?.includes(dayOfWeek)) {
          dates.push(checkDate.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }))
        }
      } else if (room.restant_policy.type === "every_n_days") {
        const nDays = room.restant_policy.n_days || 3
        const lastRestant = room.last_restant_at ? new Date(room.last_restant_at) : null
        const daysSinceLast = lastRestant
          ? Math.floor((checkDate.getTime() - lastRestant.getTime()) / (1000 * 60 * 60 * 24))
          : i

        if (!lastRestant || daysSinceLast >= nDays) {
          if (dates.length === 0 || i > 0) {
            dates.push(checkDate.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }))
          }
        }
      }
    }

    return dates.slice(0, 4)
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Card
            key={room.id}
            className={
              room.blocked_for_cleaning
                ? "border-red-200 bg-red-50/50"
                : room.occupied === false
                  ? "border-amber-200 bg-amber-50/50"
                  : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Zimmer {room.room_number}
                  {room.name && room.name !== `Zimmer ${room.room_number}` && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">{room.name}</span>
                  )}
                </CardTitle>
                <div className="flex gap-1">
                  {room.occupied === false && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openCheckInDialog(room)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-100"
                      title="Check-In"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(room)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  {room.blocked_for_cleaning ? (
                    <Button variant="ghost" size="icon" onClick={() => handleUnblock(room)} className="text-red-600">
                      <Unlock className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={() => openBlockDialog(room)}>
                      <Lock className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{getPolicyDescription(room.restant_policy)}</Badge>
                {room.blocked_for_cleaning && <Badge variant="destructive">Blocked</Badge>}
                {room.occupied === false ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <UserMinus className="h-3 w-3 mr-1" />
                    Leer
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <UserPlus className="h-3 w-3 mr-1" />
                    Belegt
                  </Badge>
                )}
              </div>

              {room.blocked_for_cleaning && room.blocked_reason && (
                <p className="text-sm text-red-600">
                  {room.blocked_from} - {room.blocked_to}: {room.blocked_reason}
                </p>
              )}

              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Next restant dates:</p>
                <div className="flex flex-wrap gap-1">
                  {getNextRestantDates(room).map((date, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {date}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                <span>D: {room.count_depart}</span>
                <span>R: {room.count_restant}</span>
                <span>QC: {room.count_qc}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Restant Policy</DialogTitle>
            <DialogDescription>Zimmer {selectedRoom?.room_number}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Policy Type</Label>
              <Select value={policyType} onValueChange={(v) => setPolicyType(v as typeof policyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every_n_days">Every N Days</SelectItem>
                  <SelectItem value="weekly_on_days">Weekly on Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {policyType === "every_n_days" && (
              <div className="space-y-2">
                <Label>Days Interval</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={nDays}
                  onChange={(e) => setNDays(Number.parseInt(e.target.value) || 3)}
                />
              </div>
            )}

            {policyType === "weekly_on_days" && (
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDays([...selectedDays, day.value])
                          } else {
                            setSelectedDays(selectedDays.filter((d) => d !== day.value))
                          }
                        }}
                      />
                      <label htmlFor={`day-${day.value}`} className="text-sm">
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePolicy} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Room</DialogTitle>
            <DialogDescription>Zimmer {selectedRoom?.room_number}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Input type="date" value={blockedFrom} onChange={(e) => setBlockedFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input type="date" value={blockedTo} onChange={(e) => setBlockedTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g., Renovation, Maintenance"
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBlock} disabled={isLoading || !blockedFrom || !blockedTo}>
              {isLoading ? "Saving..." : "Block Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gast Check-In</DialogTitle>
            <DialogDescription>Zimmer {selectedRoom?.room_number} - Neuer Gast zieht ein</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Check-In Datum</Label>
              <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Der Restant-Timer wird auf dieses Datum zurückgesetzt. Die nächste Zimmerreinigung wird basierend auf der
              Policy berechnet.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckInDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCheckIn} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
              {isLoading ? "Wird gespeichert..." : "Check-In bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
