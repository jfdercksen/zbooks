---
name: restore-session
description: Recover full context from the previous Claude Code session. Fire when the user says "where were we", "what were we working on", "continue from last time", "restore context", or "pick up where we left off".
allowed-tools: Read, Bash, Glob
---

# /restore-session — Z-Books Session Recovery

Recover complete context from the previous session so work can continue immediately.

## Live Context — Read Now

Build status:
!`cat BUILD_STATUS.md`

Known issues:
!`cat KNOWN_ISSUES.md`

Recent decisions:
!`tail -50 DECISIONS.md`

Git log:
!`git log --oneline -20`

Current branch:
!`git branch --show-current`

Modified files not committed:
!`git status`

Recent TODOs in code:
!`grep -rn "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | head -15`

## Recovery Process

1. Read BUILD_STATUS.md → identify current phase and task
2. Read KNOWN_ISSUES.md → identify active blockers
3. Read recent DECISIONS.md entries → confirm architectural context
4. Read git log → understand what was shipped recently
5. Check git status → identify any work in progress
6. Grep for TODOs → find what was left incomplete

## Output Format

```
## Session Restored — Z-Books

### What We Were Working On
Phase: [N] — [Phase Name]
Task: [N.N] — [Task description]
Branch: [branch name]

### Completed in Last Session
- [x] [Task that was finished]
- [x] [Task that was finished]

### In Progress (Unfinished)
- [ ] [Task that was started but not committed]
- [ ] [Task that was committed but not reviewed]

### Active Blockers
[From KNOWN_ISSUES.md active issues]

### Files With Uncommitted Changes
[From git status]

### Recommended Next Action
[Specific next step: "Continue with Task N.N — [description]"]

### Command to Resume
[Exact instruction to tell Claude to continue]
```
