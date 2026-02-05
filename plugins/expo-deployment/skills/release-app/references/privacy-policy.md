# Privacy Policy Generation

## Gather Data Practices

Ask these questions:

```
🔒 Privacy Policy Generator

To create your privacy policy, I need to know what data your app collects:

1. Does your app have user accounts/login?
   - If yes, what sign-in methods? (Email, Google, Apple, Facebook, Phone)

2. What third-party SDKs do you use? (Check your package.json)
   - Analytics (Firebase Analytics, Amplitude, Mixpanel, Segment)
   - Crash reporting (Crashlytics, Sentry)
   - Ads (AdMob, Facebook Ads)
   - Payments (RevenueCat, Stripe)
   - Push notifications (Expo Notifications, FCM)

3. Does your app access:
   - Location?
   - Camera?
   - Photos/Media?
   - Contacts?
   - Calendar?
   - Microphone?

4. Do you share data with any third parties?

5. What regions will your app be available in?
   - US only
   - Including Europe (GDPR required)
   - Including California (CCPA required)
```

## Generate Privacy Policy

Based on answers, generate a complete privacy policy:

```markdown
# Privacy Policy for [App Name]

**Last Updated: [Date]**

[Company/Developer Name] ("we," "us," or "our") operates the [App Name] mobile application (the "App").

## Information We Collect

[Generate based on their answers - personal info, usage data, location, etc.]

## How We Use Your Information

[List purposes based on their SDKs and features]

## Third-Party Services

[List each SDK with what it collects and link to their privacy policy]

## Your Privacy Rights

[Include GDPR section if EU]
[Include CCPA section if US/California]

## Data Retention

[Based on their practices]

## Contact Us

Email: [their email]
```

## Hosting with EAS Deploy

Help the user create and deploy their privacy policy and app home page using EAS hosting:

```
🌐 Hosting Your Privacy Policy & Home Page with EAS

EAS Deploy is the easiest way to host your privacy policy and app home page. Let me help you set this up!

STEP 1: Create the dist folder
mkdir dist

STEP 2: Create your home page (dist/index.html)
```

Generate a simple, professional home page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[App Name]</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .tagline { font-size: 1.5rem; opacity: 0.9; margin-bottom: 2rem; }
        .store-buttons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; }
        .store-btn { display: inline-block; padding: 0.75rem 1.5rem; background: white; color: #333; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s; }
        .store-btn:hover { transform: scale(1.05); }
        footer { padding: 1rem; text-align: center; }
        footer a { color: white; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>[App Name]</h1>
        <p class="tagline">[Your app's tagline]</p>
        <div class="store-buttons">
            <a href="[App Store URL]" class="store-btn">Download on App Store</a>
            <a href="[Play Store URL]" class="store-btn">Get it on Google Play</a>
        </div>
        <footer>
            <a href="privacy.html">Privacy Policy</a>
        </footer>
    </div>
</body>
</html>
```

```
STEP 3: Create your privacy policy page (dist/privacy.html)
```

Generate a privacy policy page using the policy content from above:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy - [App Name]</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
      h1 { margin-bottom: 0.5rem; }
      .updated { color: #666; margin-bottom: 2rem; }
      h2 { margin-top: 2rem; margin-bottom: 1rem; color: #444; }
      p, ul { margin-bottom: 1rem; }
      ul { padding-left: 1.5rem; }
      a { color: #667eea; }
    </style>
  </head>
  <body>
    <h1>Privacy Policy</h1>
    <p class="updated">Last Updated: [Date]</p>

    [Insert generated privacy policy content here as HTML]

    <p><a href="index.html">← Back to Home</a></p>
  </body>
</html>
```

```
STEP 4: Deploy with EAS

# Login to EAS (if not already)
eas login

# Deploy your dist folder
eas deploy

This will:
- Upload your dist folder to EAS hosting
- Give you a URL like: https://[project-slug].expo.app

STEP 5: Use your URLs

After deployment, you'll have:
- Home page: https://[project-slug].expo.app
- Privacy policy: https://[project-slug].expo.app/privacy.html

Use the privacy policy URL in:
- App Store Connect → App Information → Privacy Policy URL
- Google Play Console → Store Listing → Privacy Policy
- Your app.json under "expo.ios.privacyPolicyUrl"
```

## Google Play Data Safety

```
📊 Google Play Data Safety Answers

Based on your app, here's how to fill out the Data Safety section:

Data collection:
- [Data type]: [Collected/Not collected] - [Purpose]
- ...

Data sharing:
- [What's shared with third parties]

Security practices:
- Data encrypted in transit: [Yes/No]
- Data can be deleted: [Yes/No - explain how]
```
