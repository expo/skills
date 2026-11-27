# Name every session

Pass `--name "<description>"` on every `simulator:start`. The name appears in `simulator:list`, `simulator:get`, and on the **Simulator sessions** page on expo.dev, where it replaces the generic title on each row. Unnamed, every row reads "Simulator session" over a random id — a wall of identical entries nobody can navigate. Write the name for a **human scanning that list days later**, not for yourself during this run.

Write what the session is *for*, in a few plain words:

```bash
--name "Checkout flow screenshots"     # what you did
--name "Dev build — dark mode fix"     # what you were testing
--name "Login repro for issue 412"     # why it exists
```

Rules:
- Derive it from the user's request, not from the mode or the tooling. `Mode C session`, `agent-device ios`, and `test` say nothing.
- **Length: aim for 3–6 words, ~40 characters, and treat 50 as the practical limit.** It renders as a single-line title in a narrow table column, so a long name clips. The API accepts up to **255 characters** and rejects an empty/whitespace-only name, but 255 is a ceiling you never approach, not a target. One noun phrase, no sentences.
- Be specific within that budget. Include a ticket or PR number when there is one.
- **Sentence case:** capitalize the first word only, and leave identifiers in their real casing (`Dev build for expo-router v4`, `Repro for EXPO-1234`). It's a row title, so no Title Case, no all-lowercase, and no trailing period.
- **Don't repeat what the table already shows.** Every row already displays the session id, platform, start time, duration, and who created it — so no ids, no `iOS`, no dates, no your-own-name. Spend the whole budget on what those columns can't say: the purpose.
- If the user names it, use their name as-is.
- Sessions are per-run, so name each new one for that run. Don't reuse an old name for different work.

`--name` is newer than `simulator:start` itself, so an older installed `eas-cli` can reject it. If that happens, run via `npx --yes eas-cli@latest` or upgrade; as a last resort, retry once without `--name` (the session starts unnamed). See [troubleshooting.md](./troubleshooting.md).
