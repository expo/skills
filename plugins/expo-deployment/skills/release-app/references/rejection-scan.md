# App Store Rejection Scan

Review the app for common rejection reasons:

```
⚠️ App Store Rejection Scanner

Let me check your app for common rejection reasons.

Please share:
1. Your app.json or app.config.js
2. Your package.json (to check SDKs)
3. Brief description of your app's main features
4. Do you have any login/authentication?
5. Do you have in-app purchases?
```

## Critical Checks (Will be rejected)

```
🔴 CRITICAL CHECKS

□ Sign in with Apple
  - If you have Google, Facebook, or other social login, you MUST also offer Sign in with Apple
  - Check: Does your app have social login? → Must add Apple

□ In-App Purchase Issues
  - All digital goods MUST use Apple/Google IAP (not Stripe, PayPal, etc.)
  - Physical goods CAN use external payment
  - Check: Are you selling digital content? → Must use IAP

□ Privacy Policy
  - Required for ALL apps
  - Must be accessible via URL
  - Check: Do you have a privacy policy URL?

□ Account Deletion
  - If users can create accounts, they MUST be able to delete them
  - Check: Can users delete their accounts?

□ App Completeness
  - No placeholder content
  - No "coming soon" features
  - No broken links
  - Check: Is every feature fully functional?

□ Login Required
  - If login is required, you must provide demo credentials for App Review
  - Or allow app use without login
  - Check: Can reviewers access all features?
```

## High Risk Checks

```
🟡 HIGH RISK CHECKS

□ App Tracking Transparency (iOS)
  - If you use advertising identifiers, you MUST show ATT prompt
  - Required for: AdMob, Facebook Ads, analytics with IDFA
  - Check: Do you use ad SDKs? → Must implement ATT

□ Permissions Justification
  - Every permission must have a clear reason in Info.plist
  - Generic reasons get rejected
  - Check: Are your permission descriptions specific?

□ Metadata Accuracy
  - Screenshots must show actual app (no mockups)
  - Description must match app functionality
  - Check: Do screenshots match current app?

□ Kids Category (if applicable)
  - No ads
  - No external links
  - No data collection
  - Strict parental gate requirements
```

## Medium Risk Checks

```
🟠 MEDIUM RISK CHECKS

□ Cross-Platform References
  - Don't mention Android in iOS app or vice versa
  - Check: Does your description mention other platforms?

□ Pricing Claims
  - Can't say "free" if you have IAP
  - Use "free to download" instead
  - Check: Do you mention pricing in metadata?

□ Third-Party Trademarks
  - Can't use trademarked names without permission
  - Check: Do you reference other brands?
```

## Output Scan Results

```
📋 REJECTION SCAN RESULTS

✅ Passed: [X] checks
⚠️ Warnings: [X] items to review
❌ Must Fix: [X] blocking issues

MUST FIX BEFORE SUBMITTING:
1. [Issue description and how to fix]
2. ...

WARNINGS TO REVIEW:
1. [Warning and recommendation]
2. ...

Your app [is ready / needs these fixes] before submission.
```
