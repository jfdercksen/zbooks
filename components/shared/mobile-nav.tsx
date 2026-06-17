"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, List, BarChart3, Menu, X, Building2, BotMessageSquare, Briefcase, Receipt, TrendingUp, Users, ScrollText, FileSpreadsheet } from "lucide-react"
import { useState } from "react"

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bank-statements", label: "Statements", icon: FileText },
  { href: "/transactions", label: "Ledger", icon: List },
  { href: "/reports/profit-loss", label: "P&L", icon: BarChart3 },
]

const ALL_NAV = [
  { href: "/organisations", label: "Organisations", icon: Building2 },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/ai-agent", label: "AI Agent", icon: BotMessageSquare },
  { href: "/reports/cash-flow", label: "Cash Flow", icon: TrendingUp },
  { href: "/reports/vat", label: "VAT Report", icon: Receipt },
  { href: "/payroll", label: "Payroll", icon: Users },
  { href: "/import/excel", label: "Import Excel", icon: FileSpreadsheet },
  { href: "/audit", label: "Audit Trail", icon: ScrollText },
]

export function MobileNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-stretch">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${
              isActive(href)
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive(href) ? "stroke-[2.5]" : ""}`} />
            {label}
          </Link>
        ))}
        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-card rounded-t-2xl p-4 pb-8 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">Menu</span>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-[11px] transition-colors ${
                    isActive(href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
