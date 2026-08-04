# Plugin Grader Instructions

Grading instructions for an `expo-plugin-eval` run: a whole-app build, captured
**route by route**, produced by loading the entire `expo` plugin. You receive the
eval prompt, its `expectations` / `visual_expectations` / `routes` / `expected_skills`,
and the run's outputs, and you write `grading.json` next to the outputs in the
shape defined by the skill's **Grade** step.

Grade every expectation **PASS/FAIL on cited, concrete evidence** — never on what
the executor's transcript *claims* it built, only on the actual outputs (the
screenshots and the diff). Quote or name the evidence for each verdict. When the
evidence is ambiguous or absent, fail the expectation: the burden of proof is on
the run.

## Inputs (per config — with_plugin, and without_plugin if present)

- `outputs/<platform>/<slug>.png` — one screenshot **per route per platform**.
  Slugs: `/`→`index`, `/recipe/1`→`recipe-1`, `/settings`→`settings`.
- `outputs/<platform>/metro.log` — the Metro/dev-server log for that platform (shared across routes).
- `routes.json` — the routes that were captured (executor-emitted or discovered).
- `static.json` — the static-gate result (`exit_code` + captured output).
- `skill_usage.json` — `{skills, mcp_tools, mcp_available}` parsed from the build stream.
- Image-prompt cases also get `reference_image`, `references/design-rubric.md`, and the fixture's `git diff`.

## Process

1. **Read every route screenshot with the Read tool.** Never grade a visual expectation from the transcript — only from the pixels. A multi-screen app is judged across all its captured routes.

2. **Check failure signatures on every screenshot**, regardless of the listed expectations:
   - A red error screen / redbox, or "Something went wrong" page
   - The Expo Go home/project-list screen (the app never opened)
   - A blank white/black screen (bundle loaded but nothing rendered)
   - The wrong screen (a deep link that didn't navigate — e.g. `/settings` still shows the home feed)
   - A system permission dialog or first-launch prompt covering the app
   If any appear, every visual expectation that depends on that route fails, with the signature as evidence. A covering dialog is grounds to flag the run for re-capture (`user_notes_summary.needs_review`) rather than failing outright.

3. **Map each `visual_expectation` to the route that should satisfy it**, then grade it on that route's screenshot(s). E.g. "Settings shows a dark-mode toggle" is graded on `outputs/<platform>/settings.png`, not the home screen. If a needed route's screenshot is missing, fail the expectation and cite the gap.

4. **Grade each expectation per platform.** If `runtime.platforms` lists ios and android, a per-route expectation must hold on **both** that route's screenshots to pass. Evidence names the file and what is visible, e.g. `with_plugin/outputs/ios/recipe-1.png: recipe detail with an ingredients list and step-by-step instructions`.

5. **Cross-check the Metro log.** Scan for `ERROR`, `Unable to resolve`, missing-module warnings, unhandled rejections. A clean-looking screenshot with runtime errors in the log is suspect — fail expectations the errors plausibly affect and cite the line.

6. **Static gate is upstream of visuals.** If `static.json` failed and the device stage was skipped, mark all visual expectations failed with evidence pointing at the gate, and don't speculate about what would have rendered.

7. **Use `skill_usage.json` as context, not as a pass/fail gate.** It records which plugin skills the build actually used and whether the Expo MCP was reachable. Don't fail a build merely because an `expected_skill` wasn't triggered — grade the *output*. But when the output is weak in an area a relevant skill covers (e.g. unstyled UI while `building-native-ui` never triggered, or a wrong `@expo/ui` import while `expo-ui` wasn't used), note that link in `user_notes_summary.notes`. If `mcp_available` is false, note it (the run couldn't reach the Expo MCP) so a low score isn't misread. **If `forced` is true**, the listed skills were *instructed*, not naturally recalled — don't read their presence as a recall win, and don't note "expected skill not used" coverage gaps (they were forced); a forced run is testing skill *content*, so weak output despite a forced skill is the more interesting note.

## Judgment calibration

- Platform-appropriate rendering differences (status bar, fonts, safe areas, scroll-bar styling) are not failures.
- Be strict about substance: "a list of recipe cards" means several visible cards, not one placeholder row.
- When a screenshot is ambiguous (mid-animation, partially loaded), say so and fail the expectation — the harness can re-capture with a longer settle.

## Output: `grading.json`

```json
{
  "score": 8.5,
  "max_score": 9,
  "expectations": [
    {"text": "Home shows a scrollable list of recipe cards", "passed": true, "evidence": "with_plugin/outputs/ios/index.png: 6 recipe cards with images/titles in a scroll view"}
  ],
  "reference_match": { "score": 7, "max": 10, "evidence": "..." },
  "quality": {
    "dimensions": [{"name": "Layout & hierarchy", "score": 2, "max": 3, "evidence": "..."}],
    "subtotal": 17, "max": 24, "summary": "..."
  },
  "user_notes_summary": {"needs_review": false, "notes": ""}
}
```

- Put **all** expectations (the case's `expectations` plus each `visual_expectation`) into the `expectations` array with cited evidence. `score` is the count/severity-weighted pass total; `max_score` is the number graded.
- Emit `reference_match` (0–10, generated vs the target screenshot) and `quality` (the `references/design-rubric.md` dimensions, incl. the code-quality dimension from `git diff`) **only for image-prompt cases** (`reference_image` present) or when a quality grade is explicitly requested. For image-prompt cases, take the **worst** route/platform per quality dimension and let a failure signature cap that dimension at 0. Omit both blocks for plain text-prompt runs.
- `quality.subtotal` is the sum of dimension scores; `quality.max` is the sum of their maxes (24 for the built-ins, +3 per extra `visual_expectation` graded as a quality dimension).
