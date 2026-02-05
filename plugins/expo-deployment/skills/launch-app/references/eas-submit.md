# Submit with EAS

```
🚀 Submitting with EAS

PREREQUISITES:
□ Build completed successfully
□ App Store Connect app created (iOS)
□ Google Play Console app created (Android)
□ All metadata filled in stores
□ Screenshots uploaded
□ Privacy policy URL added

STEP 1: Configure credentials

iOS (App Store Connect):
eas credentials
- Select iOS
- Set up App Store Connect API Key
- Or use manual Apple ID login

Android (Google Play):
- Create service account in Google Cloud Console
- Download JSON key
- Add to Play Console > API Access
- Configure in eas.json:
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}

STEP 2: Submit to iOS
eas submit --platform ios --latest

STEP 3: Submit to Android
eas submit --platform android --latest

Or submit to both:
eas submit --platform all --latest

📬 After submission:
- iOS: Goes to App Store Connect for review (1-3 days typically)
- Android: Goes to Google Play Console (review usually faster)
```

## First-Time Submission Checklist

```
📝 First-Time Submission Checklist

iOS (App Store Connect):
□ App created in App Store Connect
□ Bundle ID matches your app
□ All metadata filled (name, description, keywords, etc.)
□ Screenshots uploaded for required device sizes
□ Privacy policy URL added
□ Age rating questionnaire completed
□ Pricing and availability set

Android (Google Play):
□ App created in Google Play Console
□ Package name matches your app
□ Store listing completed
□ Screenshots uploaded
□ Privacy policy URL added
□ Data Safety questionnaire completed
□ Content rating questionnaire completed
□ 12 testers for 14 days (new requirement!)
□ Target audience and content settings configured
```

## Google Play 12-Tester Requirement

```
⚠️ Google Play Testing Requirement

New personal developer accounts must have:
- 12 testers
- Testing for at least 14 days
- Testers must ACTUALLY USE the app (not just install)

How to set up:
1. Go to Play Console > Testing > Closed testing
2. Create a track
3. Add tester emails (or create a Google Group)
4. Share the opt-in link with testers
5. Wait 14 days with active usage

Tips:
- Ask friends, family, or fellow developers
- Join Expo Discord cohorts for tester swaps
- Testers need to opt-in AND install AND use the app
```
