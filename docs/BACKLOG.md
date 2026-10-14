# Soulink backlog

Internal work list. Not for pitch decks.

## Launch
- Public launch with Premium on Azure (switch the database to paid)
- Razorpay payments at go-live (KYC, GST)
- DPIIT startup recognition
- Lawyer review of Terms, Privacy, Guidelines, Refunds
- Add the full registered office address to `mobile/src/lib/legal.js`

## Growth
- Campus pilot in Hyderabad (300–500 students)
- Android app on the Play Store
- First brand partners for ads

## Product
- Admin screen for bans (the server part is done: POST /admin/users/:username/ban, GET /admin/bans, POST /admin/bans/:id/lift)
- Restore photos and posts too: include media files in Download my data (a ZIP), then restore them
- Restore on the phone apps (file picker); today restore works in the browser
- DLT templates for SMS notices: MSG91_DELETION_SCHEDULED_TEMPLATE_ID, MSG91_ACCOUNT_DELETED_TEMPLATE_ID
- Run `npm test` in server (m20 covers pause, 30-day deletion, restore, bans)
- Face search (find someone by photo or live camera): ON HOLD — revisit once the app is stable; needs a legal review first. Switched off in app and server (FACE_SEARCH=false)
- Admin scripts COPY-DATA-TO-CLOUD and SETUP-CLOUD: add the same production guard when the Azure move happens
- Run `npm test` in server (m19 covers sessions, deletion, audit, face encryption)
- Anonymous messages: decide gating
- Hugging Face Space for the AI features
- Run the server tests for the latest features (m17, m18)
- Music licences before turning JioSaavn back on
