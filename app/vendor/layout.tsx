import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/octoroom/header"
import type { Profile } from "@/lib/types"

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("octo_profiles").select("*").eq("id", user.id).single()

  if (!profile) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-svh flex flex-col bg-muted/30">
      <Header profile={profile as Profile} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
