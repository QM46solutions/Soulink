# Releasing Soulink safely, and what to do when a release goes wrong

_Added 19 Nov 2026 with Settings › Update App, the update policy and app health in the console._

## Two kinds of update

| | Over-the-air (Expo Updates) | Store version (Google Play / App Store) |
|---|---|---|
| What changes | Screens, logic, text (JavaScript) | Anything native: new permissions, new native modules, icon, app name |
| How it ships | Push to `main` → **test app only** (channel `preview`). Real users only after GitHub Actions › Run workflow › `release-to-users` | GitHub Actions › `android-play-store` / `iphone-testflight`, then Play Console / App Store Connect review |
| How phones get it | Downloaded on opening the app, or Settings › Update App › Update Now → Restart now (`Updates.reloadAsync`) | Settings › Update App opens the official store listing; the store installs it |
| Login and data | Kept (they live outside the app bundle) | Kept (store updates keep app data) |

The app never downloads or installs an APK or any other file itself.

## Before a release

1. Run `UPDATE-SOULINK.bat` (all automated tests must pass).
2. Push; check the change on the **test app** (preview channel) on a real phone.
3. Database changes must be additive (new tables / nullable columns). Never rename or drop in the same release that
   stops using something: old app versions keep running against the new server.
4. Store version: use Play Console's **staged rollout** (start at 10–20 %).
5. After it's live for everyone, set **Releases › Update policy › Android latest** to the new version, so
   Settings › Update App tells people about it.

## Watching a release (console)

- **Speed & server › Crashes by app version**: crashes, non-fatal errors and people affected per version, next to
  how often that version is used. A new version with far more crashes than the previous one is a bad release.
- **Speed & server › Slow or failed requests / Screen times by app version**: slowdowns after a release.
- **Issues**: every crash and every Report a problem, with version, app code, phone model, OS and screen.

## When a release goes wrong

An installed store version **can't be rolled back** on people's phones (Google and Apple don't allow downgrades),
and Update App never promises that. Instead:

1. **Stop it spreading**
   - Store version: Play Console › Release › **Halt rollout** (App Store: pause the phased release).
   - Over-the-air: republish the previous good update to the `production` channel
     (`eas update:republish` from the previous update group, or push a revert and run `release-to-users`).
2. **Switch the broken part off** where it has a switch (server settings / flags), so the app keeps working.
3. **Ship the fix**: an over-the-air update if it's JavaScript only (minutes), otherwise a corrected store version.
4. **Move people to the fixed version**: set **Update policy › latest** to it. Only if the old version is
   dangerous or can't work any more, raise **oldest still allowed** (or tick Mandatory): those phones then see a
   full-screen "Please update" page that opens the store. If the check can't run (offline), nobody is blocked.

User data stays on the server and in the phone's storage, which updates never replace, so a bad release never
loses accounts, logins or settings.

## Still to do (needs a new store build)

- Google Play **in-app updates** (flexible download inside the app, immediate update for critical versions): needs
  a native module, so it can only arrive with the next Play build (1.0.1). Until then Update App opens Play.
- iPhone: set `APP_STORE_ID` in Render once the app is on the App Store; Update App then opens its listing.
