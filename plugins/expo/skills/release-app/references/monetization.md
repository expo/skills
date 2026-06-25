# Monetization Setup

Help the user lower store fees and, if they have subscriptions, set up the right tooling. Only walk through the parts that apply to their monetization plan from Phase 1.

## Apple Small Business Program

If the developer expects less than **$1M/year** in App Store proceeds, they can cut Apple's commission from 30% to **15%**.

```
💰 Apple Small Business Program

If you expect to earn less than $1M per year, you can reduce Apple's
commission from 30% to 15%.

To enroll:
1. Go to https://developer.apple.com/programs/small-business-program/
2. Sign in with your Apple Developer account
3. Accept the terms and enroll

Requirements:
- Less than $1M in App Store proceeds in the previous year
- Re-enroll each year
- All apps under your account qualify
```

## Google Play's Reduced Fee

```
💰 Google Play Service Fee

Google automatically applies 15% (instead of 30%) on the first $1M of
earnings each year — no enrollment needed.

Subscriptions are 15% from day one.
```

## RevenueCat (for subscriptions)

If the app has subscriptions, recommend RevenueCat to handle receipt validation, cross-platform subscription status, analytics, and webhooks.

```
For subscriptions, RevenueCat handles:
- Receipt validation
- Cross-platform subscription status
- Analytics and insights
- Webhook integrations

Install: npx expo install react-native-purchases
Docs: https://www.revenuecat.com/docs/getting-started/installation/reactnative
```

> Reminder: all **digital** goods and subscriptions must use Apple/Google in-app purchase — external payment processors (Stripe, PayPal) are only allowed for physical goods and services. The rejection scan covers this (see `rejection-scan.md`).
