# Privacy Policy Generation & Hosting

Every app needs a privacy policy reachable at a public URL. Generate one from the app's actual data practices, then host it (alongside a simple home page) with EAS.

## Gather data practices

```
🔒 To create your privacy policy, I need to know what data your app collects:

1. User accounts / login? Which methods? (Email, Google, Apple, Facebook, Phone)
2. Third-party SDKs (check package.json):
   - Analytics (Firebase, Amplitude, Mixpanel, Segment)
   - Crash reporting (Crashlytics, Sentry)
   - Ads (AdMob, Meta Ads)
   - Payments (RevenueCat, Stripe)
   - Push (Expo Notifications, FCM)
3. Device access: location, camera, photos/media, contacts, calendar, microphone?
4. Do you share data with third parties?
5. Regions: US only, Europe (GDPR), California (CCPA)?
```

## Generate the policy

Produce a complete policy tailored to their answers:

```markdown
# Privacy Policy for [App Name]

**Last Updated: [Date]**

[Developer Name] ("we") operates the [App Name] mobile application.

## Information We Collect
[personal info, usage data, location, etc. — from their answers]

## How We Use Your Information
[purposes tied to their SDKs and features]

## Third-Party Services
[each SDK, what it collects, link to its privacy policy]

## Your Privacy Rights
[GDPR section if EU; CCPA section if US/California]

## Data Retention
[their practices]

## Contact Us
Email: [their email]
```

## Host it on EAS

Stand up a tiny static site with a home page and the policy, then deploy with EAS Hosting.

**Step 1 — create the folder and copy the app icon**

```bash
mkdir dist
cp assets/icon.png dist/icon.png   # icon path is usually set in app.json
```

**Step 2 — `dist/index.html`** (simple home page)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>[App Name]</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
      .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
      .app-icon { width: 128px; height: 128px; border-radius: 28px; margin-bottom: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,.2); }
      h1 { font-size: 3rem; margin-bottom: 1rem; }
      .tagline { font-size: 1.5rem; opacity: .9; margin-bottom: 2rem; }
      .store-buttons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; }
      .store-btn { padding: .75rem 1.5rem; background: #fff; color: #333; text-decoration: none; border-radius: 8px; font-weight: 600; }
      footer a { color: #fff; opacity: .8; }
    </style>
  </head>
  <body>
    <div class="hero">
      <img src="icon.png" alt="[App Name] icon" class="app-icon" />
      <h1>[App Name]</h1>
      <p class="tagline">[Your app's tagline]</p>
      <div class="store-buttons">
        <a href="[App Store URL]" class="store-btn">Download on the App Store</a>
        <a href="[Play Store URL]" class="store-btn">Get it on Google Play</a>
      </div>
      <footer><a href="privacy.html">Privacy Policy</a></footer>
    </div>
  </body>
</html>
```

**Step 3 — `dist/privacy.html`**: the generated policy as HTML (a centered, readable column linking back to `index.html`).

**Step 4 — deploy**

```bash
eas login        # if not already
eas deploy
```

This uploads `dist/` and returns a URL like `https://[project-slug].expo.app`. The policy is then at `https://[project-slug].expo.app/privacy.html`.

**Step 5 — use the URL** in:

- App Store Connect → App Information → Privacy Policy URL
- Google Play Console → Store listing → Privacy Policy
- `app.json` under `expo.ios.privacyPolicyUrl`

> The `expo-deployment` skill covers EAS Hosting in more depth if the user wants custom domains or CI deploys.

## Google Play Data Safety

Help fill out the Data Safety form from the same answers:

- **Data collected** — each data type, whether collected, and the purpose
- **Data shared** — what (if anything) goes to third parties
- **Security** — encrypted in transit? can users request deletion, and how?
