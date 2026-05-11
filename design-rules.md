# Z-Books — Design Rules and Brand Standards
**Agency:** Ai Dynamic Advisory
**Reference App:** FreshBooks (https://www.freshbooks.com)
**Approach:** Mobile-first. Clean. Professional. Financial-grade trust.
**Updated:** May 2026

---

## Brand Tokens

Z-Books does not have an existing brand — the following tokens are chosen by Ai Dynamic Advisory to match the FreshBooks-inspired, professional bookkeeping aesthetic.

### Colour Palette

```css
/* globals.css — CSS Variables */
:root {
  /* Primary — Deep Teal (trust, finance, professionalism) */
  --color-primary:        #0F766E;   /* teal-700 */
  --color-primary-light:  #14B8A6;   /* teal-500 */
  --color-primary-dark:   #0D5E57;   /* teal-800 */

  /* Accent — Warm Amber (action, highlight, CTA) */
  --color-accent:         #F59E0B;   /* amber-500 */
  --color-accent-light:   #FCD34D;   /* amber-300 */
  --color-accent-dark:    #B45309;   /* amber-700 */

  /* Semantic — Financial */
  --color-income:         #16A34A;   /* green-600 — money in */
  --color-expense:        #DC2626;   /* red-600 — money out */
  --color-pending:        #D97706;   /* amber-600 — unreviewed */
  --color-neutral:        #6B7280;   /* gray-500 — neutral transactions */

  /* Surface */
  --color-bg:             #F9FAFB;   /* gray-50 — page background */
  --color-surface:        #FFFFFF;   /* white — cards, panels */
  --color-surface-raised: #F3F4F6;   /* gray-100 — hover states, zebra rows */
  --color-border:         #E5E7EB;   /* gray-200 — dividers */

  /* Text */
  --color-text-primary:   #111827;   /* gray-900 — headings */
  --color-text-secondary: #6B7280;   /* gray-500 — labels, metadata */
  --color-text-inverse:   #FFFFFF;   /* white — on dark backgrounds */
}
```

### Typography

```css
/* Import in app/layout.tsx */
/* Google Fonts: Inter (clean, financial-grade readability) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --font-sans:   'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:   'JetBrains Mono', 'Courier New', monospace; /* for amounts */
}

/* Financial amounts always use mono — prevents digit-width jitter */
.amount { font-family: var(--font-mono); }
```

### Spacing Scale

Follow Tailwind's default 4px base scale. Do not invent custom spacing values.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tight gaps between related items |
| `space-2` | 8px | Icon padding, small gaps |
| `space-4` | 16px | Component internal padding |
| `space-6` | 24px | Between sections |
| `space-8` | 32px | Page section gaps |
| `space-12` | 48px | Major section breaks |

---

## Mobile-First Rules

- **Default = mobile (320px–767px).** Design the mobile layout first.
- Tablet breakpoint: `md:` (768px+)
- Desktop breakpoint: `lg:` (1024px+)
- Sidebar navigation: hidden on mobile (hamburger menu), visible at `lg:`.
- Tables: on mobile, convert to card-stack layout or enable horizontal scroll with sticky first column.
- Financial amounts: always right-aligned. On mobile, amounts go below the description.
- Touch targets: minimum 44px height on all interactive elements (WCAG AA).
- No hover-only interactions — everything must work with touch.

---

## Component Design Rules

### Page Layout
```
┌─────────────────────────────────────────┐
│ Sidebar (hidden mobile, visible lg:)    │
├─────────────────────────────────────────┤
│ Page Header — title + action button     │
│ Breadcrumb (org > section > page)       │
├─────────────────────────────────────────┤
│ Content area                            │
│ (cards, tables, forms)                  │
└─────────────────────────────────────────┘
```

### Cards
- White background, 1px `--color-border` border, `rounded-lg`, `shadow-sm`.
- Card header: bold title + optional action (e.g. "Export").
- Never nest cards inside cards.

### Data Tables
- Use `components/shared/data-table.tsx` (TanStack Table wrapper) for all tabular data.
- Alternating row background: `--color-surface-raised` on even rows.
- Amounts: right-aligned, monospace font, colour-coded (green = credit, red = debit).
- Sticky header on scroll.
- Pagination at bottom — 25 rows default.
- Empty state: centred icon + helpful message (not just "No results").

### Forms
- All forms use React Hook Form + Zod.
- Labels above inputs (not floating — confuses non-technical users).
- Error messages in red directly below the input field.
- Submit button: primary colour, full width on mobile, right-aligned on desktop.
- Loading state: button shows spinner, is disabled during submit.

### Status Indicators
- Unreviewed transactions: amber pill badge ("Pending")
- Reviewed and committed: green pill badge ("Posted")
- Flagged/error: red pill badge ("Error")
- Draft payroll run: amber badge ("Draft")
- Finalised payroll: green badge ("Finalised")

---

## Financial Display Rules

### Amounts
- Always show 2 decimal places: `R 1,234.56` — not `R1234.6`
- Thousand separator: comma (`1,000`)
- Decimal separator: period (`1,234.56`)
- Negative amounts: red colour + parentheses `(R 500.00)` in reports — never just a minus sign
- Positive income: green colour in reports
- Zero: display as `R 0.00` — never blank

### Dates
- Display format: `15 Jan 2025` — not ISO 8601, not `01/15/25`
- Financial year display: `2024/25` (SA convention)
- Date ranges: `1 Mar 2025 – 28 Feb 2026`

### Reports Layout
- Report header: company name (bold), report title, date range, VAT number if applicable
- Column headers: right-aligned for amount columns
- Subtotals: bold, slight background tint
- Grand totals: bold, full border top and bottom (accountant style)
- Footer: "Generated by Z-Books — Ai Dynamic Advisory" + date/time

---

## Accessibility Standards

- WCAG AA minimum — colour contrast ratio ≥ 4.5:1 for text
- All images need `alt` text
- All form inputs need associated `<label>` elements
- Keyboard navigation must work end-to-end
- Screen reader: use `aria-label` on icon-only buttons
- Focus ring: visible on all interactive elements (Tailwind `focus:ring-2`)

---

## Reference Design

Study these screens from FreshBooks for inspiration:
- Dashboard overview: clean summary cards with key metrics
- Invoice list: clean table with status badges and action buttons
- Report view: professional header, clean column layout, export button prominent

Do not clone FreshBooks. Be inspired by its clarity and trust signals.

Z-Books should feel like: **"FreshBooks built for South African bookkeepers, powered by AI."**

---

## Anti-Patterns — Never Do These

- ❌ Never use more than 3 font weights on one page
- ❌ Never use pure black (`#000000`) for text — use `--color-text-primary` (`#111827`)
- ❌ Never use pure white (`#FFFFFF`) for page backgrounds — use `--color-bg` (`#F9FAFB`)
- ❌ Never show raw database UUIDs to users — always show human-readable names/references
- ❌ Never show raw ISO timestamps — always format with date-fns
- ❌ Never use red for anything other than errors/debits — it causes anxiety in financial contexts
- ❌ Never auto-dismiss error messages — user must acknowledge them
- ❌ Never place two primary CTA buttons on the same screen
