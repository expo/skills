# Audit design-system consistency

Use for a requested audit or the relevant part of an authorized consistency fix.
An audit-only request ends with findings; an implementation request can continue
through fixes and verification without a separate review gate.

## Establish the baseline

Find the actual source directories, theme entry points, styling library, and shared
components. Do not assume `src/`. Read representative affected screens and the
existing design rules before interpreting literals as drift. A library config and
a re-export file can be parts of one system, not competing systems.

## Find candidates, then verify them

Use `rg` within the actual source directories, excluding generated code, vendored
files, assets, and the token definitions themselves. Useful search terms include
hex colors, `fontSize`, `fontFamily`, `borderRadius`, spacing literals, and arbitrary
utility classes. Search component call sites for color/style overrides that bypass
an existing variant. Adapt patterns to the project's styling syntax.

A hit is a candidate, not a defect. Check its semantic role, whether it references
a valid token, whether an exception is deliberate, and whether the rendered UI
actually suffers. Do not flag legacy shadow syntax if the app's supported runtime
requires it. For visual patterns, use [native review prompts](./native-slop.md).

## Prioritize by effect

Report evidence: the screen/component, the mismatch with the established system,
the visible or behavioral consequence, and a focused fix. Prioritize unreachable
actions, unreadable text, inconsistent shared controls, then local visual drift.
Raw grep counts or arbitrary violations-per-line thresholds are not a design score.
If tracking adoption, state the inspected scope and count verified instances using
the same method; do not compare different app scopes as though they were equivalent.

## Implement within scope

Reuse or extend the existing token/component when it expresses the same role.
Change representative callers, verify the rendered result and interactions, then
apply the pattern to other requested callers. Avoid speculative variants, blanket
spacing normalization, and automatic replacement of brand typography.

Document a shared component's role, supported states, important accessibility
behavior, and meaningful usage exceptions when future callers need them. Use an
existing documentation format; no separate props table is needed when maintained
types and examples already explain the contract.

Completion means the requested inconsistencies are fixed and affected states are
checked, or the audit findings identify unverified areas and required follow-up.
