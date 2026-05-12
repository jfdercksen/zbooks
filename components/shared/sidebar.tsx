"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  FileText,
  List,
  BarChart3,
  Users,
  ScrollText,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/organisations", label: "Organisations", icon: Building2, ready: true },
  { href: "/bank-statements", label: "Bank Statements", icon: FileText, ready: true },
  { href: "/transactions", label: "Transactions", icon: List, ready: false },
  { href: "/reports/profit-loss", label: "Reports", icon: BarChart3, ready: false },
  { href: "/payroll", label: "Payroll", icon: Users, ready: false },
  { href: "/audit", label: "Audit Trail", icon: ScrollText, ready: false },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-card">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">Z</span>
          </div>
          <span className="font-semibold text-sm">Z-Books</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, ready }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href)

          if (!ready) {
            return (
              <span
                key={href}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40 cursor-not-allowed"
                title="Coming soon"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </span>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
