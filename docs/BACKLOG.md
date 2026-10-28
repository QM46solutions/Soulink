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
- Music licences (IPRS/PPL, or a licensed music API) before turning on film/label songs, JioSaavn, Deezer or phone song uploads in production (MUSIC_DEEZER, MUSIC_PHONE)
- Copyright: a "Copy link" option on every Spark and post if missing, so owners can paste the link in the report form
- Admin screen for bans (the server part is done: POST /admin/users/:username/ban, GET /admin/bans, POST /admin/bans/:id/lift)
- Restore photos and posts too: include media files in Download my data (a ZIP), then restore them
- Restore on the phone apps (file picker); today restore works in the browser
- DLT templates for SMS notices: MSG91_DELETION_SCHEDULED_TEMPLATE_ID, MSG91_ACCOUNT_DELETED_TEMPLATE_ID
- Face search (find someone by photo or live camera): ON HOLD — revisit once the app is stable; needs a legal review first. Switched off in app and server (FACE_SEARCH=false)
- Anonymous messages: decide gating
- Argue referee AI in the cloud (today laptop only; online uses the basic judge). Options: Claude Haiku API, or Llama in a sleeping Azure container

## Done (recently)
- Voice translator in the cloud: Azure AI Speech free tier (fast transcription + Indian neural voices)
- Soulmoji AI in the cloud: Azure Container Apps, scale to zero (soulmoji-cloud/AZURE-SETUP.md)
- Built-in Soulmoji engine refined (no stickers; lids, wink, gaze, head tilt)
- Production guard on COPY-DATA-TO-CLOUD (reason required, logged; legal records never replaced). SETUP-CLOUD only saves settings and tests the connection, so it needs no guard
- Tests use their own temporary uploads folder (they used to write into, and wipe, server/uploads/soulmoji)
- All server tests passing (m1–m22)
