# App Store Metadata Generation

This is the most interactive phase: generate drafts for **every** required field on both stores. Always show the character count next to each generated option and respect the limits exactly.

## Gather context first

Ask before drafting:

1. List 3–5 key features
2. What makes it different from competitors?
3. What problem does it solve?
4. Any awards, press, or testimonials?
5. Best-fit category? (Games, Productivity, Health & Fitness, …)

## Apple App Store

### App Name — 30 characters max

Include a keyword for discoverability. Offer 2–3 options with counts.

```
1. [App Name] – [Keyword]   (X/30)
2. [Variation]              (X/30)
```

### Subtitle — 30 characters max

Secondary keywords; do **not** repeat words from the name.

### Keywords — exactly 100 characters

Apple gives you exactly 100 characters — use all of them.

- Comma-separated, **no spaces after commas** (spaces waste characters)
- Don't repeat words already in the name or subtitle
- Don't include both singular and plural of a word

```
keyword1,keyword2,keyword3,keyword4,...   (100/100)
```

### Description — 4,000 characters max

- The first ~170 characters show before "Read More" — lead with the main benefit, not a feature list
- Then features-as-benefits, social proof if any, and a closing call to action

### Promotional Text — 170 characters

The only field you can update **without** submitting a new build — use it for seasonal content, new features, or promos.

### What's New

- First release: `Initial release! [what makes the app great]`
- Updates: bullet `New: …`, `Improved: …`, `Fixed: …`

## Google Play

### Short Description — 80 characters

The elevator pitch. Offer 2 options with counts.

### Full Description — 4,000 characters

Unlike Apple, Google **indexes the description for search** — weave keywords in naturally throughout.

## Screenshots

```
Apple App Store:
- 6.7" iPhone (required): 1290 x 2796
- 6.5" iPhone (required): 1284 x 2778
- iPad Pro 12.9" (if universal): 2048 x 2732
- 1–10 screenshots per size

Google Play:
- Phone: 16:9, min 320px / max 3840px
- 2–8 screenshots per device type
```

Propose a 5-screenshot story and a caption for each:

1. Main value proposition
2. Key feature 1
3. Key feature 2
4. Social proof / differentiator
5. Call to action / extra feature

Screenshots must show the **real** app (no mockups) — mismatches get rejected.

## Categories

Recommend a primary (and optional secondary) Apple category, plus a Google Play category and up to 5 tags, with a one-line rationale.

> Offer to save the finished metadata to a file (e.g. `store-metadata.md`) the user can copy into App Store Connect and Play Console.
