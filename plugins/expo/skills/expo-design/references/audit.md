# Design System Audit

Measure how far an existing Expo app has drifted from a single visual source of truth, then document or extend components with a consistent template.

Run the audit **before** proposing changes. Report findings first; apply fixes only when asked.

## 1. Token coverage checks

Run from the repo root. Each hit outside `src/theme/` is a candidate for tokenization - not automatically a violation (check for the "one-off, with a comment" exemption in `SKILL.md`).

```bash
# Hardcoded hex colors outside the theme
grep -rEn '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' | grep -v 'src/theme'

# Raw fontSize (should come from the type ramp / ThemedText)
grep -rn 'fontSize:' src --include='*.tsx' | grep -v 'src/theme'

# Arbitrary spacing values (off the 4-point grid)
grep -rEn '(padding|margin|gap)[A-Za-z]*:\s*[0-9]+' src --include='*.tsx' \
  | grep -vE ':\s*(0|4|8|16|24|32|48)\b' | grep -v 'src/theme'

# Raw borderRadius (should use radius tokens)
grep -rn 'borderRadius:' src --include='*.tsx' | grep -v 'src/theme'

# Legacy shadows (banned by expo-native-ui - must be boxShadow)
grep -rEn 'shadow(Color|Offset|Opacity|Radius)|elevation:' src --include='*.tsx'

# Multiple theme entry points (there must be exactly one)
ls src/theme.ts src/theme/index.ts 2>/dev/null
```

For a Tailwind project (`expo-tailwind-setup`), also check for values that bypass `global.css` variables: arbitrary-value classes like `p-[13px]` or `text-[#5B21B6]`.

```bash
grep -rEn 'className="[^"]*\[[^"]*\]' src --include='*.tsx'
```

## 2. Component completeness

For each component in `src/components/`, check it against the contract in `SKILL.md`:

| Check | Pass condition |
|---|---|
| Variants | Visual intent is a `variant` prop, not boolean soup (`isPrimary`, `isGhost`) |
| Sizes | Sizes map to spacing/typography tokens |
| Pressed state | Tappable components give pressed feedback via a `Pressable` style function |
| Disabled / loading | Handled, and disabled blocks `onPress` |
| Style override | Accepts `style`, merged last |
| Accessibility | `accessibilityRole` set; touch target ≥ 44pt |
| Tokens only | No literals that duplicate a theme value |

## 3. Report format

```markdown
## Design System Audit

### Summary
Screens reviewed: [X] | Components reviewed: [X] | Issues: [X]

### Token coverage
| Category | Tokens defined | Escapes found | Worst offenders |
|---|---|---|---|
| Colors | [X] | [X] hardcoded hex | [files] |
| Spacing | [X] | [X] off-grid values | [files] |
| Typography | [X] | [X] raw fontSize | [files] |
| Radius / shadows / motion | [X] | [X] | [files] |

### Component completeness
| Component | Variants | States | Overrides | Tokens | Notes |
|---|---|---|---|---|---|
| Button | OK | missing pressed | OK | OK | ... |

### Extraction candidates
Views repeated across ≥2 screens that are still colocated or duplicated:
1. [view] - appears in [screens] - suggested name: [Component]

### Priority actions
1. [Highest-leverage fix - usually the most-duplicated escaped value]
2. ...
```

## 4. Documenting an existing component

```markdown
## Component: [Name]

[What it is and when to use it - one paragraph.]

### Variants
| Variant | Use when |
|---|---|
| primary | The screen's single main action |

### Props
| Prop | Type | Default | Notes |
|---|---|---|---|

### States
default / pressed / disabled / loading - visual + behavior for each.

### Accessibility
Role, touch target, screen reader label.

### Do / Don't
| Do | Don't |
|---|---|
| [best practice] | [anti-pattern seen in this repo] |
```

## 5. Proposing a new component

Before designing a new primitive, prove the existing set can't cover it:

```markdown
## Proposed: [Name]

### Problem
[The repeated need, and the ≥2 screens that have it.]

### Why existing components aren't enough
| Closest component | What's shared | What's missing |
|---|---|---|

### API
Props table (variant / size / state / style only - content via children).

### Tokens used
Colors: [...] Spacing: [...] Typography: [...] Radius: [...]

### Open questions
[Decisions that need a human, e.g. does this need a destructive variant?]
```

If the "what's missing" column is empty for any row, extend that component's variants instead of adding a new one.
