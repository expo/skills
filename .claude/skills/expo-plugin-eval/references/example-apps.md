# Built-in example apps

The default prompts for an `expo-plugin-eval` run. Each is a **multi-screen app**
chosen to exercise navigation (so the route-by-route screenshot capture has work
to do) and a spread of the plugin's skills. Surface these in the up-front
"Prompts" `AskUserQuestion` (pre-selected), alongside the custom-prompt and
upload-a-screenshot options. Each selected example becomes one eval case.

**The prompts are intentionally phrased at user-intent level** — what the app
does and which screens it has, *not* how to build it. Over-specified prompts
("use Expo Router file-based routing", "each screen its own route", "use a
data-fetching approach with loading/error states") hand the model the whole
implementation, so it builds the app directly and **never triggers a skill** —
which makes `with_plugin` collapse toward the baseline and the eval measure
nothing. Keep them natural. Where a skill-specific behavior is the point (Tailwind
styling, live data), name that *domain* the way a real user would, not the
mechanism. See **Phrase prompts at user-intent level** in `SKILL.md`.

Turn an example into an eval case by copying its `prompt`. The `routes`,
`visual_expectations`, and `expected_skills` are **harness/grading metadata** —
they are NOT dictated to the executor. `routes` is only a capture hint (the
executor's emitted `routes.json` or `discover_routes.py` is authoritative, with
sample params filled in for dynamic routes); `expected_skills` is aspirational
coverage (if a skill doesn't trigger, that's a recorded finding, not a failure).

Keep custom prompts deterministic too: an app whose screens render from local
state screenshots more reliably than one waiting on a flaky network (the weather
example is the deliberate exception).

---

## 1. Recipe app (lists + detail + toggle)
**prompt:** "Build a recipe app where I can browse a feed of recipes, tap one to see its full details with the ingredients and steps, keep a list of favorites, and open a settings screen to turn on dark mode."
- **routes (capture hint):** `/` (Home feed), `/recipe/1` (Recipe detail), `/favorites` (Favorites), `/settings` (Settings)
- **visual_expectations:**
  - "Home shows a vertically scrollable list of recipe cards with images and titles"
  - "Recipe detail shows a single recipe with an ingredients/steps layout"
  - "Settings shows a labeled dark-mode toggle control"
- **expected_skills:** `building-native-ui`, `expo-ui`

## 2. Fitness tracker (dashboard + stats)
**prompt:** "Build a fitness tracker app. I want a dashboard showing my daily activity — steps, calories, and active minutes — with a weekly trend, a list of my workouts I can tap into to see the details, and a profile screen with my info and goals."
- **routes (capture hint):** `/` (Dashboard), `/workouts` (Workouts list), `/workout/1` (Workout detail), `/profile` (Profile)
- **visual_expectations:**
  - "Dashboard shows summary stat cards and a simple chart/visualization"
  - "Workouts list shows multiple workout rows"
  - "Profile shows user info laid out cleanly"
- **expected_skills:** `building-native-ui`, `expo-ui`

## 3. Notes app (list + editor)
**prompt:** "Build a notes app where I can see all my notes, open one to read and edit it, and adjust preferences like sort order and theme in settings."
- **routes (capture hint):** `/` (Notes list), `/note/1` (Note editor), `/settings` (Settings)
- **visual_expectations:**
  - "Notes list shows multiple note rows with title and preview text"
  - "Note editor shows an editable text area with the note content"
  - "Settings shows labeled option rows"
- **expected_skills:** `building-native-ui`

## 4. Weather app (data fetching)
**prompt:** "Build a weather app that shows the current conditions and the next few hours for my city, a 7-day forecast, a list of my saved locations, and a settings screen to switch between Celsius and Fahrenheit. Use real weather data from a free source."
- **routes (capture hint):** `/` (Current weather), `/forecast` (7-day forecast), `/locations` (Saved locations), `/settings` (Settings)
- **visual_expectations:**
  - "Home shows current temperature/conditions and an hourly strip"
  - "Forecast shows a multi-day list with per-day high/low"
  - "No error/empty state is shown on Home once data loads"
- **expected_skills:** `native-data-fetching`, `building-native-ui`
- **note:** the only example that hits a live endpoint (the "real weather data" cue should lead it to a free API like Open-Meteo); allow extra settle for the fetch.

## 5. Social profile (NativeWind/Tailwind styling)
**prompt:** "Build a social app with a scrollable feed of posts (avatar, name, text, like and comment counts), a profile screen for a user showing their header, bio, stats, and a grid of their posts, and a settings screen. Give it a clean, modern look using Tailwind styling."
- **routes (capture hint):** `/` (Feed), `/profile/1` (User profile), `/settings` (Settings)
- **visual_expectations:**
  - "Feed shows post cards with avatar, author, and content"
  - "Profile shows a header, avatar, bio, and a posts grid"
  - "Styling is visibly applied (spacing, colors, rounded elements) — not unstyled defaults"
- **expected_skills:** `expo-tailwind-setup`, `building-native-ui`
- **note:** good **web** candidate — NativeWind renders on web too. The "Tailwind styling" cue is the natural user signal that should trigger `expo-tailwind-setup`; if it doesn't, that's a recorded recall finding.
