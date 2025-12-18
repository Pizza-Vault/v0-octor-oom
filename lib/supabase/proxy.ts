import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public paths that don't require auth
  const publicPaths = [
    "/auth/login",
    "/auth/sign-up",
    "/auth/sign-up-success",
    "/auth/error",
    "/setup",
    "/api/create-admin",
  ]
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))

  // If not logged in and trying to access protected routes
  if (!user && !isPublicPath && pathname !== "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  let profile: { role: string } | null = null
  if (user) {
    const { data } = await supabase.from("octo_profiles").select("role").eq("id", user.id).single()
    profile = data
  }

  // If logged in, redirect based on role
  if (user && (pathname === "/" || pathname === "/auth/login")) {
    const url = request.nextUrl.clone()
    if (profile?.role === "admin") {
      url.pathname = "/admin/dashboard"
    } else if (profile?.role === "vendor") {
      url.pathname = "/vendor/today"
    } else {
      url.pathname = "/auth/login"
    }
    return NextResponse.redirect(url)
  }

  // Role-based route protection using cached profile
  if (user && pathname.startsWith("/admin")) {
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/vendor/today"
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname.startsWith("/vendor")) {
    if (!profile || !["admin", "vendor"].includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
