# Post-Launch Marketing

Once the app is approved, help the user get users. Tailor the channels to the app's niche.

## Launch day

```
□ Share on your personal social media
□ Post in relevant subreddits (follow each one's self-promo rules):
  r/[your topic], r/SideProject, r/iOSapps or r/androidapps
□ Post with relevant hashtags
□ Ask friends and family to download + leave a review
```

## Week 1

```
□ Product Hunt — launch Tue–Thu; prep logo, screenshots, tagline; line up
  friends to upvote and comment. https://www.producthunt.com
□ Hacker News "Show HN" — only if technically interesting.
  https://news.ycombinator.com
□ Indie Hackers — great for solo devs. https://www.indiehackers.com
□ BetaList — for new apps. https://betalist.com
```

## Ongoing

```
□ Respond to App Store / Play reviews (boosts ranking)
□ Post updates and content (blog posts, short videos)
□ Reach out to relevant bloggers / reviewers
□ Consider App Store Search Ads
```

## Communities

```
□ Expo Discord — share in #showcase
□ React Native community
□ Niche communities for your app's topic
```

## ASO over time

```
□ After 2–4 weeks, review keyword performance
□ Update keywords based on what's ranking
□ A/B test screenshots where supported (Google Play)
```

## Ask for reviews in-app

Reviews strongly affect downloads. Prompt at a positive moment with the native review sheet:

```ts
import * as StoreReview from "expo-store-review";

// After a "win" — completing a task, finishing a session, etc.
if (await StoreReview.hasAction()) {
  await StoreReview.requestReview();
}
```

Best practices:

- Ask **after** a success or "wow" moment, never during onboarding
- Ask after the app has been used a few times
- At most once per version
