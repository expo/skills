# Optional migration goal loop

Use this reference when the user requests a goal loop and the harness supports
one. Ordinary migration work can proceed directly from `migration-progress.md`.
Do not start a persistent loop solely because a migration has several screens.

Fill the template with the requested scope and the installed skill's actual path.
Start it through the harness's supported goal mechanism within the user's
specified budget. If a loop cannot be started, continue the authorized migration
directly; write a handoff objective only when the user wants one.

## Objective template

```text
Migrate <APP NAME / SELECTED ROUTES> to Expo using the skill at <SKILL PATH>.

Use migration-progress.md to track prerequisites, selected routes, data/auth/storage
integration, and verification. Read the skill if it is not already in context;
load only references relevant to the current work. Recover missing context from
the worklist when resuming.

1. Assess the requested routes and record a worklist if none exists. Reuse any
   existing native shell; otherwise scaffold it. Add DOM components only for
   routes assigned that approach. Continue into implementation once prerequisites
   are ready.
2. Implement the next actionable item using the agreed native or hybrid approach.
   Preserve the source content and behavior while adapting native interactions.
   Wire required API, auth, and storage changes before considering a route done.
3. Run the affected route and compare with the web original using available
   browser/device tools. Fix failures caused by the migration and verify again.
4. Record done only after the required checks pass. For external blockers, record
   the missing dependency and what would unblock it; leave the item incomplete
   and continue other actionable work. Revisit it when new evidence or access
   resolves the blocker, not repeatedly while the condition is unchanged.

Completion: all requested routes and prerequisites are implemented and verified.
Do not expand into deferred routes or publish/build remotely unless requested.
If only externally blocked items remain, report partial completion and the exact
blockers, following the harness's stopping rules. Do not call blocked items done.
Base API URL reachable from native: <EXPO_PUBLIC_API_URL>
```
