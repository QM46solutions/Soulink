# Soulink phone app plan (mobile first from Nov 2026)

From now on every feature is built and checked for the phone app (Android + iPhone) first. The web version is kept working but is no longer the main target.

## How Sai tests on his phone
1. **Now, with the laptop on:**
   - install **Expo Go** (free) from the App Store or Play Store
   - run **START-SOULINK-APP.bat**
   - scan the QR code with the iPhone camera
   - The app uses the live cloud server (`app.json` › `extra.apiUrl`), so it's the real account and data. It works on Wi-Fi or mobile data (tunnel).
2. **Soon, with the laptop off:** publish the app to Expo's cloud with EAS Update (needs a free Expo account that Sai creates), then open it in Expo Go from a link.
3. **Real installed app (TestFlight on iPhone, a test track on Android):** needs the Apple Developer Program ($99/year, under QM46 Solutions, needs D-U-N-S) and Google Play Console. Built in the cloud with EAS (no Mac needed).

**Note:** Expo Go supports only the newest SDK. SDK 58 is out, and its Expo Go reaches the stores in a few weeks. When it does, upgrade the project to SDK 58 (or move to the TestFlight build).

## Work list (✅ done · ⏳ next)

**Phase 1: run properly on phones**
- ✅ the phone app talks to the cloud server
- ✅ Spark player and post videos play on phones (expo-video): trim, speed, zoom, fade, timed text, stickers, music, voiceover
- ✅ sound in recorded Sparks on Android (`recordAudioAndroid`)
- ✅ location through the phone's location service
- ✅ phone gallery files are handled as local files
- ✅ phone notifications (Expo push → Apple / Google; the server sends to the app and to web push)
- ✅ share links and group invites can open the app (App Links / Universal Links; the server serves the files once `ANDROID_CERT_SHA256` and `APPLE_TEAM_ID` are set)
- ✅ screenshot / recording protection; the app covers itself when it leaves the screen
- ✅ documents, Download my data, Restore my data and songs from the phone use the phone's file picker and share sheet
- ✅ Sparks stop when scrolled off screen
- ✅ record a Spark with the phone camera (up to 60 s)
- ✅ cloud builds and over-the-air updates (`eas.json`, `.github/workflows/mobile.yml`, `docs/PHONE-APP.md`)
- ✅ test first, then release: a push updates only the test app; Run workflow › release-to-users sends it to the store app
- ⏳ a check of every screen on iPhone 17 Pro Max and Android: keyboard, back button, safe areas, hover-only effects (from Sai's screenshots)

**Phase 2: video creation on phones**
- ⏳ Record in Soulink (expo-camera: clips, timer, prompt on screen)
- ✅ Spark Studio for phones: trim, speed, crop/zoom, timed text, stickers, music, voiceover, fade, cover (colour filters come with the server-built videos)
- ⏳ Spark Clips for phones
- ⏳ a server video worker (ffmpeg, scale-to-zero container) that builds the finished Spark (filters, text, music, joined clips) when it's posted, so every phone and the web play the same file

**Phase 3: store readiness**
- ⏳ Google Play Billing / Apple in-app purchase, or Premium off at first
- ⏳ app icon, splash, store screenshots and text
- ⏳ public Privacy Policy and account-deletion pages
- ⏳ crash reporting (Sentry free tier)
- ⏳ EAS build setup and signing
- ⏳ backend: always-on hosting, permanent media storage, SMS/WhatsApp login codes, legal fixes

**Phase 4: beta**
- ⏳ Play internal testing and TestFlight with 10–20 people for 1–2 weeks, then submit (Android first)
