export type TaskType = "depart" | "restant" | "qc"
export type TaskStatus = "open" | "done" | "skipped" | "failed"
export type UserRole = "admin" | "vendor"

export interface Profile {
  id: string
  role: UserRole
  company: string
  display_name: string
  created_at: string
}

export interface Room {
  id: string
  room_number: number
  name: string | null
  restant_policy: RestantPolicy
  last_restant_at: string | null
  last_depart_at: string | null
  last_qc_at: string | null
  blocked_for_cleaning: boolean
  blocked_from: string | null
  blocked_to: string | null
  blocked_reason: string | null
  count_depart: number
  count_restant: number
  count_qc: number
  created_at: string
  occupied: boolean
}

export interface RestantPolicy {
  type: "weekly_on_days" | "every_n_days"
  days_of_week?: number[]
  n_days?: number
}

export interface Task {
  id: string
  task_date: string
  room_id: string
  type: TaskType
  status: TaskStatus
  skip_reason: string | null
  note: string | null
  done_at: string | null
  done_by: string | null
  created_by: string | null
  created_at: string
  room?: Room
}

export interface Event {
  id: string
  task_id: string | null
  room_id: string
  task_date: string
  type: TaskType
  action: TaskStatus
  performed_at: string
  performed_by: string
  performed_by_name: string
  performed_by_company: string
  note: string | null
  meta: Record<string, unknown> | null
  room?: Room
}

export interface ForecastDay {
  date: string
  restant_count: number
  depart_count: number
  qc_count: number
  rooms: { room_number: number; type: TaskType }[]
}
