#!/bin/bash
# Skill Evaluator v1.0 — Ai Dynamic Advisory — Z-Books
# Runs on every UserPromptSubmit
# Reads the prompt and suggests relevant skills/agents before Claude starts working

PROMPT=$(cat 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('prompt', ''))
except:
    pass
" 2>/dev/null)

if [ -z "$PROMPT" ]; then exit 0; fi

suggestions=()

# Audit and health check
if echo "$PROMPT" | grep -qi "audit\|review all\|check everything\|analyse\|analyze\|health check\|codebase check"; then
  suggestions+=("/audit — 9-category parallel Z-Books health check")
fi

# Adversarial review
if echo "$PROMPT" | grep -qi "what's wrong\|find bugs\|review\|critique\|check my\|is this correct"; then
  suggestions+=("@code-auditor — adversarial review that assumes code is wrong (model: opus)")
fi

# Security — extra important for financial app
if echo "$PROMPT" | grep -qi "security\|vulnerabilit\|auth\|token\|password\|secret\|RLS\|access control\|POPIA\|data breach"; then
  suggestions+=("/security-check — scan for vulnerabilities, missing RLS, exposed keys")
  suggestions+=("@security-auditor — deep security review (model: opus)")
fi

# Database / schema
if echo "$PROMPT" | grep -qi "table\|schema\|migration\|database\|RLS\|policy\|supabase\|column\|index"; then
  suggestions+=("/add-supabase-table — creates table with migration and RLS")
  suggestions+=("/add-rls-policy — adds Row Level Security policy")
  suggestions+=("@db-expert — Supabase schema and RLS specialist")
fi

# PDF bank statement processing
if echo "$PROMPT" | grep -qi "bank statement\|pdf\|extract\|process statement\|upload statement\|fnb\|absa\|nedbank\|standard bank\|capitec"; then
  suggestions+=("/process-bank-statement — Claude API PDF extraction workflow")
  suggestions+=("@pdf-processor-agent — PDF extraction and transaction parsing specialist")
fi

# Excel import
if echo "$PROMPT" | grep -qi "excel\|import\|historical\|spreadsheet\|xlsx\|sheetjs"; then
  suggestions+=("/import-excel-history — Excel historical data import workflow")
fi

# Financial reports
if echo "$PROMPT" | grep -qi "profit.loss\|p&l\|income statement\|revenue\|expense report\|cash flow\|financial report"; then
  suggestions+=("/generate-financial-report — generates P&L or Cash Flow for a period")
fi

# VAT
if echo "$PROMPT" | grep -qi "vat\|vat201\|tax\|input vat\|output vat\|zero.rated\|exempt"; then
  suggestions+=("/generate-vat-report — VAT201 report for a date range")
fi

# Payroll
if echo "$PROMPT" | grep -qi "payroll\|paye\|uif\|sdl\|salary\|employee\|payslip\|tax table"; then
  suggestions+=("@payroll-agent — SA PAYE/UIF/SDL calculation specialist")
fi

# Components and routes
if echo "$PROMPT" | grep -qi "component\|button\|form\|modal\|card\|table\|UI\|layout\|widget"; then
  suggestions+=("/add-component — creates typed React component with shadcn/ui")
fi

if echo "$PROMPT" | grep -qi "page\|route\|navigation\|URL\|path\|link\|new screen"; then
  suggestions+=("/add-route — adds App Router page with metadata and loading state")
fi

# API endpoints
if echo "$PROMPT" | grep -qi "api\|endpoint\|route handler\|backend\|server action"; then
  suggestions+=("/add-api-route — adds validated Next.js API route handler")
fi

# Codebase exploration
if echo "$PROMPT" | grep -qi "structure\|visualis\|map\|overview\|explore\|codebase\|architecture\|where is"; then
  suggestions+=("/visualise — generates interactive Z-Books codebase tree in browser")
fi

# Session restore
if echo "$PROMPT" | grep -qi "where were we\|last session\|continue\|pick up\|restore\|context\|what was I doing"; then
  suggestions+=("/restore-session — recovers full context from previous session")
fi

# Research
if echo "$PROMPT" | grep -qi "how do I\|what is\|documentation\|docs\|best practice\|how to\|should I use"; then
  suggestions+=("@research — fetches official docs before implementing unfamiliar patterns")
fi

# Output suggestions
if [ ${#suggestions[@]} -gt 0 ]; then
  echo ""
  echo "💡 Z-Books: Suggested skills/agents for this task:"
  for s in "${suggestions[@]}"; do
    echo "   $s"
  done
  echo ""
fi

exit 0
