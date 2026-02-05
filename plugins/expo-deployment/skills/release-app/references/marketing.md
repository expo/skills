# Post-Release Marketing

After the app is approved:

```
📣 Post-Release Marketing Checklist

Your app is live! Now let's get users. Here's where to share:

IMMEDIATE (Day 1):
□ Share on your personal social media
□ Post in relevant subreddits (follow their rules!)
  - r/[relevant topic]
  - r/SideProject
  - r/androidapps or r/iOSapps
□ Tweet/post with relevant hashtags
□ Tell friends and family to download + review

WEEK 1:
□ Product Hunt release
  - Best to release Tuesday-Thursday
  - Prepare assets: logo, screenshots, tagline
  - Have friends ready to upvote + comment
  - https://www.producthunt.com

□ Hacker News "Show HN"
  - Only if your app is technically interesting
  - https://news.ycombinator.com

□ Indie Hackers
  - Great community for solo developers
  - https://www.indiehackers.com

□ BetaList (for new apps)
  - https://betalist.com

ONGOING:
□ Respond to App Store reviews
□ Post updates on social media
□ Create content about your app (blog posts, videos)
□ Reach out to tech bloggers/reviewers
□ Consider App Store Search Ads

COMMUNITIES TO JOIN:
□ Expo Discord - share in #showcase
□ React Native Community
□ Relevant communities for your app's niche

ASO OPTIMIZATION:
□ After 2-4 weeks, review keyword performance
□ Update keywords based on what's working
□ A/B test screenshots if possible (Google Play)
□ Respond to reviews (boosts ranking)
```

## Getting App Store Reviews

```
💬 Getting App Store Reviews

Reviews dramatically impact downloads. Here's how to get them:

1. Use StoreReview API
   import * as StoreReview from 'expo-store-review';

   // Ask at a positive moment (after completing a task, etc.)
   if (await StoreReview.hasAction()) {
     await StoreReview.requestReview();
   }

2. Best times to ask:
   - After a successful action
   - After using the app 3-5 times
   - After a "wow" moment
   - NEVER during onboarding

3. Don't ask too often (once per version max)
```
