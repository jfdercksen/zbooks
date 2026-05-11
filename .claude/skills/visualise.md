---
name: visualise
description: Generate an interactive HTML codebase map for Z-Books. Fire when the user says "visualise", "show me the structure", "map the codebase", "overview", or "where is". Creates a collapsible tree saved to ./codebase-map.html.
allowed-tools: Read, Glob, Bash, Write
---

# /visualise — Z-Books Codebase Map

Generate an interactive HTML visualisation of the Z-Books project structure.

## Live Context

Current structure:
!`find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.sql" \) | grep -v node_modules | grep -v .next | grep -v .git | sort`

File sizes:
!`find . -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v .next | xargs wc -l 2>/dev/null | sort -rn | head -20`

## Instructions

1. Parse the directory tree above
2. Generate an interactive HTML file at `./codebase-map.html` with:
   - Collapsible directory tree (click to expand/collapse)
   - File size indicators (line count as badge)
   - Colour coding by type:
     - 🔵 Blue — API routes (`app/api/`)
     - 🟣 Purple — Page components (`app/(dashboard)/`)
     - 🟢 Green — Library/utility (`lib/`)
     - 🟡 Yellow — Components (`components/`)
     - 🔴 Red — Migration files (`supabase/migrations/`)
     - ⚪ Grey — Config and docs
   - Search/filter box to find files quickly
   - Click file to show: path, type, line count
   - Agent/skill reference: which agent owns which directory

3. Open in browser: `start codebase-map.html` (Windows) or `open codebase-map.html` (Mac)

## Output

```
## Codebase Map Generated

File: ./codebase-map.html
Total files mapped: [N]
Total lines of code: [N]

Largest files (potential complexity):
[File | Lines]

Key directories:
app/api/ — [N] route handlers
lib/financial/ — [N] calculation modules  
supabase/migrations/ — [N] migrations
.claude/agents/ — [N] agents
.claude/skills/ — [N] skills

Open: start codebase-map.html
```
