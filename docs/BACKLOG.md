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
- Soul DNA: re-tune the score spread (CALIBRATION in server/src/services/mind/match.js) from real users' answers once there are ~50; learn from outcomes (accepted requests, long chats, ratings after chatting)
- Soul DNA: grow the scenario bank from the typed "Anything else" answers (they are kept in soul_dna.answers)
- YouTube linking for interests (needs Google's app review); Spotify once Soulink is big enough for their API
- Argue referee AI in the cloud (today laptop only; online uses the basic judge). Options: Claude Haiku API, or Llama in a sleeping Azure container

## Done (recently)
- Chat rules: only Chats and Requests tabs; Chats filters (All / Unread / Groups / Anonymous); anonymous messages only to Connections with a chosen hidden time (1 h to 30 days); Requests = a paid message, or a chat while a Connect request is on hold; at the end of a hold the receiver gets 24 h to accept or reject, then it's rejected automatically and the chat is hidden (kept in the database)
- Soul DNA v4: a model of how each person thinks, acts and reacts (64 real-life scenarios in 9 layers, each person gets their own adaptive set, "Anything else" typed answers, gut-reaction timing), a different logic per relation type, the life-partner simulation (24 situations), give and take, "how they think" in words
- Connect asks first: someone I know (family / friend / colleague / other) or someone new (what I hope for), plus 2-3 optional questions for the pair
- What people are into on Soulink (likes, reactions, views, searches → topics), only with the Soul DNA activity switch on
- Voice translator in the cloud: Azure AI Speech free tier (fast transcription + Indian neural voices)
- Soulmoji AI in the cloud: Azure Container Apps, scale to zero (soulmoji-cloud/AZURE-SETUP.md)
- Built-in Soulmoji engine refined (no stickers; lids, wink, gaze, head tilt)
- Production guard on COPY-DATA-TO-CLOUD (reason required, logged; legal records never replaced). SETUP-CLOUD only saves settings and tests the connection, so it needs no guard
- Tests use their own temporary uploads folder (they used to write into, and wipe, server/uploads/soulmoji)
- All server tests passing (m1–m22)
