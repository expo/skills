# Pre-Submission Rejection Scan

Catch the common App Store / Play rejection reasons before the user submits. Ask for `app.json`/`app.config.js`, `package.json`, a short feature description, and whether the app has auth or in-app purchases — then walk the checks below and report results.

## Critical — will be rejected

```
🔴 CRITICAL

□ Sign in with Apple
  If you offer Google / Facebook / other social login, you MUST also offer
  Sign in with Apple.

□ In-app purchases
  All digital goods/subscriptions MUST use Apple/Google IAP (not Stripe,
  PayPal, etc.). Physical goods can use external payment.

□ Privacy policy
  Required for all apps; must be reachable at a public URL.

□ Account deletion
  If users can create accounts, they must be able to delete them in-app.

□ App completeness
  No placeholder content, "coming soon" features, or broken links.

□ Reviewer access
  If login is required, provide demo credentials for App Review (or allow
  use without login).
```

## High risk

```
🟡 HIGH RISK

□ App Tracking Transparency (iOS)
  If you use advertising identifiers (AdMob, Meta Ads, IDFA analytics), you
  must show the ATT prompt.

□ Permission justifications
  Every iOS permission needs a specific reason string in Info.plist —
  generic reasons get rejected.

□ Metadata accuracy
  Screenshots must show the real app; description must match functionality.

□ Kids category (if applicable)
  No ads, no external links, no data collection, strict parental gate.
```

## Medium risk

```
🟠 MEDIUM RISK

□ Cross-platform references
  Don't mention Android in an iOS app (or vice versa).

□ Pricing claims
  Don't say "free" if there are IAPs — use "free to download".

□ Third-party trademarks
  Don't use trademarked names/brands without permission.
```

## Report results

```
📋 REJECTION SCAN RESULTS

✅ Passed:    [X] checks
⚠️ Warnings:  [X] items to review
❌ Must fix:  [X] blocking issues

MUST FIX BEFORE SUBMITTING:
1. [issue + how to fix]

WARNINGS TO REVIEW:
1. [warning + recommendation]
```

For a deeper, guideline-by-guideline audit, review the app against Apple's full [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) in addition to this quick scan.
