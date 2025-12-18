import { createClient } from "@supabase/supabase-js"

// Service client with admin privileges - bypasses RLS
// ONLY use for server-side operations like webhooks
let serviceClient: ReturnType<typeof createClient> | null = null

export function createServiceClient() {
  if (serviceClient) return serviceClient

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceClient
}
