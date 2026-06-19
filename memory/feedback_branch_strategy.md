---
name: feedback-branch-strategy
description: User works directly on dev-social, not separate feature branches. Don't create new branches automatically.
metadata:
  type: feedback
---

Work directly on the `dev-social` branch. Do NOT auto-create feature branches (feat/*, etc.) — the user merges work into dev-social themselves.

**Why:** The user manages branch lifecycle manually; separate branches just add friction.

**How to apply:** When starting new work, stay on the current branch unless the user explicitly asks for a new one. Never run `git checkout -b` proactively.
