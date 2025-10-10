import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/database/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect authenticated users away from login/register pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/login') ||
     request.nextUrl.pathname.startsWith('/register'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/back'
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users to login when accessing protected routes
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    request.nextUrl.pathname.startsWith('/back')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Protect admin-only routes
  if (user) {
    const pathname = request.nextUrl.pathname

    // Check if accessing admin-only routes
    const adminRoutePatterns = [
      /^\/agent\/[^\/]+\/board/,  // /agent/[agentId]/board
      /^\/agent\/[^\/]+\/edit/,   // /agent/[agentId]/edit
      /^\/back\/users/,            // /back/users
    ]

    const isAdminRoute = adminRoutePatterns.some(pattern => pattern.test(pathname))

    if (isAdminRoute) {
      // Extract agentId if present
      const agentMatch = pathname.match(/^\/agent\/([^\/]+)\/(board|edit)/)
      
      if (agentMatch) {
        const agentId = agentMatch[1]
        
        // Get agent's organization
        const { data: agent } = await supabase
          .from('agents')
          .select('organization_id')
          .eq('id', agentId)
          .single()

        if (agent && agent.organization_id) {
          // Check user role in organization
          const { data: userOrg } = await supabase
            .from('link_organization_user')
            .select('role')
            .eq('user_id', user.id)
            .eq('organization_id', agent.organization_id)
            .single()

          if (!userOrg || userOrg.role !== 'admin') {
            // Not admin, redirect to back
            const url = request.nextUrl.clone()
            url.pathname = '/back'
            return NextResponse.redirect(url)
          }
        } else if (agent && !agent.organization_id) {
          // Agent without organization, redirect to back
          const url = request.nextUrl.clone()
          url.pathname = '/back'
          return NextResponse.redirect(url)
        }
      } else if (pathname.startsWith('/back/users')) {
        // For /back/users, check if user is admin of any organization
        const { data: userOrgs } = await supabase
          .from('link_organization_user')
          .select('role')
          .eq('user_id', user.id)

        const isAdminOfAny = userOrgs?.some(org => org.role === 'admin')

        if (!isAdminOfAny) {
          // Not admin, redirect to back
          const url = request.nextUrl.clone()
          url.pathname = '/back'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}


