"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SetupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/admin/dashboard`,
        data: {
          role: "admin",
          company: "Hotel",
          display_name: displayName || "Admin",
        },
      },
    })

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else if (data.user) {
      setMessage({
        type: "success",
        text: `Admin erstellt! Bitte bestätige deine Email (${email}) und logge dich dann ein.`,
      })
    }

    setLoading(false)
  }

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/vendor/today`,
        data: {
          role: "vendor",
          company: "AAAB",
          display_name: displayName || "Vendor",
        },
      },
    })

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else if (data.user) {
      setMessage({
        type: "success",
        text: `Vendor erstellt! Bitte bestätige deine Email (${email}) und logge dich dann ein.`,
      })
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Octoroom Setup</CardTitle>
          <CardDescription>Erstelle Admin- oder Vendor-Benutzer für das System</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hotel.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Anzeigename</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" onClick={handleCreateAdmin} disabled={loading} className="flex-1">
                {loading ? "..." : "Admin erstellen"}
              </Button>
              <Button
                type="button"
                onClick={handleCreateVendor}
                disabled={loading}
                variant="outline"
                className="flex-1 bg-transparent"
              >
                {loading ? "..." : "Vendor erstellen"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
