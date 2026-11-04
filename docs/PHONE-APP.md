# Soulink phone app: built and updated in the cloud

Once set up, nothing runs on the laptop.
- **Code changes:** you push with GitHub Desktop. GitHub sends the new code to every installed Soulink app as an over-the-air update. Phones get it the next time Soulink opens, with no reinstall.
- **New installable app:** for the stores, or after big changes, you tap **Run workflow** on GitHub (it works from your phone too). Expo builds it in its cloud.

## What you need (accounts)

| | Cost | Why |
|---|---|---|
| Expo account (expo.dev) | Free | Cloud builds and over-the-air updates |
| Apple Developer Program | $99 a year | The only way to install your own app on an iPhone (TestFlight) and publish to the App Store. As QM46 Solutions it needs the D-U-N-S number. |
| Google Play Console | $25 once | Android test track and the Play Store (organization account, needs the D-U-N-S number) |

## One-time setup

1. **Laptop, once:**
   - run **UPDATE-SOULINK.bat** (installs the new phone packages and updates the package list)
   - run **RUN-TESTS.bat**
   - push with GitHub Desktop
2. **Expo account:**
   - create a free account at https://expo.dev/signup (use the Soulink / QM46 email)
   - run **SETUP-PHONE-APP.bat** and log in when asked
   - push the changed `mobile/app.json` with GitHub Desktop
3. **Connect GitHub to Expo:**
   1. On expo.dev: Account › Settings › **Access tokens** › Create → copy the token.
   2. On GitHub, in the Soulink repo: Settings › Secrets and variables › Actions › **New repository secret**.
   3. Name it `EXPO_TOKEN` and paste the token as the value.

## Getting the app on a phone

- **iPhone (TestFlight):**
  1. Join the Apple Developer Program.
  2. Run **FIRST-IPHONE-BUILD.bat** once. It asks for your Apple ID, makes the signing keys and sends the build to TestFlight (about 30 minutes).
  3. Install **TestFlight** from the App Store, and Soulink appears in it.
  - After that, new iPhone builds come from GitHub: Actions › *Soulink phone app* › Run workflow › `iphone-testflight`.
- **Android (test app link, before the Play Store):**
  1. GitHub › Actions › *Soulink phone app* › Run workflow › `android-test-apk`.
  2. About 20 minutes later the build page on expo.dev has an **Install** link and a QR code.
  3. Open it on the Android phone and allow "install from this source".
- **Until the Apple account is ready:** run START-SOULINK-APP.bat on the laptop and use Expo Go on the iPhone. The laptop has to stay on for this.

## Store launch
- **Play Store:**
  1. Create the app in Play Console.
  2. Upload the first bundle by hand. Google requires the first upload to be manual: Run workflow `android-play-store`, then download the `.aab` from expo.dev.
  3. Fill in the store forms (store listing, data safety, content rating 18+, app access test login).
  4. Add a Google service-account key to Expo so later builds go to the internal test track by themselves.
- **App Store:** Run workflow `iphone-testflight`. In App Store Connect, fill in the listing, privacy labels, age rating 18+ and the reviewer test login, then submit for review.
- **App links** (share links open the app): after the first builds, put these in Render's environment settings:
  - `ANDROID_CERT_SHA256`: from expo.dev › Credentials › Android › SHA-256 fingerprint
  - `APPLE_TEAM_ID`: from developer.apple.com › Membership

## How updates reach phones
- **Every push to `main`:** sends an update to the test app (channel `preview`) and the store app (channel `production`).
- **Changes that add a new phone permission or native package:** these need a new build (Run workflow) and a version bump. Claude says when this is needed.
