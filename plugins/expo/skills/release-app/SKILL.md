---
name: release-app
description: Step-by-step guide for first-time developers to release an Expo app on the iOS App Store and Google Play. Walks through monetization, App Store metadata and ASO, privacy policy generation and hosting, a pre-submission rejection scan, EAS Build, EAS Submit, and post-launch marketing. Use when the user wants to launch, release, publish, ship, or submit their app to the app stores, or asks about app store metadata, screenshots, privacy policies, or store rejection reasons.
version: 1.0.0
license: MIT
---

# Expo App Release Checklist

A guided, end-to-end checklist that walks a first-time developer from a finished Expo app to a live listing on the **Apple App Store** and **Google Play**. Be encouraging and specific — first-time submitters are often overwhelmed, so give exact commands, character counts, and examples, and celebrate each completed phase.

For the underlying EAS mechanics (build profiles, `eas.json`, credentials, web hosting), the `expo-deployment` skill is the command reference. This skill is the guided launch journey that wraps those mechanics with the non-technical steps — metadata, privacy, rejection scan, and marketing.

## The Journey

Introduce the journey when the skill activates, then work through the phases in order (let the user skip ahead if they ask):

1. **Understand the app** — gather the basics (below)
2. **Monetization** — Small Business Program, Play fees, RevenueCat → `references/monetization.md`
3. **App Store metadata** — name, subtitle, keywords, description, screenshots, categories → `references/app-store-metadata.md`
4. **Privacy policy** — generate a policy and host it (with a home page) on EAS → `references/privacy-policy.md`
5. **Rejection scan** — catch common App Store / Play rejections before submitting → `references/rejection-scan.md`
6. **Build with EAS** — production builds and version-number strategy → `references/eas-build.md`
7. **Submit with EAS** — submit to both stores, first-time checklists, automation → `references/eas-submit.md`
8. **Marketing** — launch-day and week-one promotion, getting reviews → `references/marketing.md`

Opening message:

```
📱 Expo App Release Checklist

I'll guide you through everything to get your Expo app on the App Store and Google Play:

1. 💰 Monetization — Small Business Program, RevenueCat, etc.
2. 📝 App Store Metadata — drafts for every required field
3. 🔒 Privacy Policy — generated from your app's data practices, hosted on EAS
4. ⚠️ Rejection Scan — catch common rejection reasons early
5. 🔨 Build with EAS — exact build commands
6. 🚀 Submit with EAS — submit to both stores
7. 📣 Marketing — where to share your launch

Let's start! What's your app called and what does it do?
```

## Phase 1: Understand the App

Gather the essentials before generating anything, and reuse them throughout the checklist:

- **App basics** — name, one-sentence pitch, target audience
- **Status** — is it built and working? tested on real devices?
- **Accounts** — Apple Developer account ($99/yr)? Google Play account ($25 one-time)?
- **Monetization** — free or paid? in-app purchases / subscriptions? ads?

The answers drive metadata (Phase 3), the privacy policy (Phase 4), and the rejection scan (Phase 5).

## References

Consult these as each phase comes up:

- ./references/monetization.md — Apple Small Business Program, Google Play's reduced fee, RevenueCat for subscriptions
- ./references/app-store-metadata.md — Apple + Google Play metadata fields, ASO keyword strategy, screenshots, categories
- ./references/privacy-policy.md — data-practice questions, policy generation, hosting policy + home page on EAS, Play Data Safety
- ./references/rejection-scan.md — critical / high / medium rejection checks and how to fix them
- ./references/eas-build.md — production builds and version-number strategy
- ./references/eas-submit.md — store submission, first-time checklists, the 12-tester rule, EAS Workflows automation
- ./references/marketing.md — launch-day and week-one marketing, requesting reviews

## Summary Output

When the journey is complete, recap what was prepared:

```
✅ RELEASE CHECKLIST COMPLETE!

MONETIZATION:   [program enrolled / payment method]
METADATA:       app name, subtitle, keywords (100 chars), description, screenshots, category
PRIVACY POLICY: generated + hosted at [URL]
REJECTION SCAN: [X] passed, [X] fixed
BUILDS:         eas build --platform ios|android --profile production
SUBMISSIONS:    eas submit --platform ios|android --latest
MARKETING:      launch-day checklist ready

Good luck with your launch! 🚀
```

## Working Style

- **Be encouraging** — first-time developers are often overwhelmed.
- **Be specific** — exact commands, character counts, concrete examples.
- **Be proactive** — anticipate the next step.
- **Save their work** — offer to write generated metadata and policies to files they can copy.
- If they're stuck, offer to skip to a phase or link the relevant Expo docs.
- If they lack developer accounts, explain the cost and process, and note that Google Play's 12-tester rule means starting ASAP.

## Additional Resources

- Expo docs: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play policies: https://play.google.com/about/developer-content-policy/
