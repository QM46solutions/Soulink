# Soulink build roadmap (updated 2026-09-29 with Sai's answers)

Rules: every build ships at least one youth / safety item, keeps the frozen design (docs/DESIGN.md),
and ends with a test checklist in docs/test-plans/. Everything runs locally until the app is complete.
Swipe gestures are OUT.

| # | Build | What's in it | Status |
|---|---|---|---|
| 1 | Safety net + polish | Version history + automatic local backups - alignment pass on every screen - "Verified Real Soul" badge + glow ring - sign-up funnel analytics (target under 90 s) - haptics | Next |
| 2 | First 60 seconds + Intent | 5-question vibe quiz, instant Soul type reveal - fun prompts instead of plain bio - Connection requests with intent + early Soul Score - Accept / Reject / Hold (with duration, expiry reminder, auto-suspend) - sender notified of every outcome - "Open to" settings | Planned |
| 3 | Posts and feed | Photo posts - reactions - comments - feed - low-data image compression - micro-animations | Planned |
| 4 | Stories + phone build | 24-hour stories - Android development build on Sai's phone | Planned |
| 5 | Chat upgrade + Soulmoji (DONE 2026-09-29: reactions, reply, message menu, Soulmoji v1) | Instagram-like chat: reactions on messages, reply to a message, share posts, notes - Soulmoji v1 (your face, typed feeling, sticker) | Planned |
| 6 | Safety pack | Stranger messages to Requests - one-tap block/report - hide my city - panic "remove from my life" - face search default Nobody - safety centre | Planned |
| 7 | Soul DNA v1 | 8 traits - full Soul Score replaces the early score on requests - Match % (magical) - Premium lock for "why we matched" and editing Soul data - shareable Soul DNA story card - scan a friend's code | Planned |
| 8 | Reels (30 s max) | Record/upload up to 30 s - vertical player - compression for local storage | Planned |
| 9 | Daily habit | Daily Soul question - streak flames - reminder | Planned |
| 10 | Argue / Referee v1 (DONE 2026-09-29: together + invite, Claude or basic judge, verdict screen; share card still to do) | Two-sided case - AI verdict (free local AI first) - shareable verdict card | Planned |
| 11 | Speed and data | Low-data mode - budget-Android tuning - weak-network loading | Planned |
| 12 | Launch kit | Invite-only codes + waitlist - Hyderabad college / company tags - brand-partner spots - Hinglish wording - privacy policy, face-data consent and delete (DPDP Act) | Planned |

## Frontend enhancements (added by Sai, 2026-09-29)

| # | Enhancement | What's in it | Status |
|---|---|---|---|
| 13 | Soulink refine filters (random / Discover search) | Filter bar when finding new people at random: age range, city / area (Hyderabad areas), distance, "Open to" intent (friendship, dating, networking...), Soul type, shared interests, college / company, Face-verified only. Filters shown as tap chips (no swipe), remembered per user. Premium later: advanced filters (Soul Score above X, specific traits). | Planned |
| 14 | Request alerts under the heart | A new connection request pops up as a notification the moment it arrives (in-app banner + sound/haptic, phone push in the phone build). Red count badge on the heart icon. Heart screen gets a "Requests" section pinned on top, showing intent + Soul Score + intro note, with Accept / Hold / Reject right there (no extra screen). | Planned |
| 15 | Soulmoji v2: your real photo, your expression | Instead of a sticker with a feeling, Soulmoji edits the sender's own face photo into the expression (happy, sad, angry, shocked, love, laughing...) and sends that. Free local version first: face landmarks + warping the mouth, eyes and eyebrows of the verified profile photo, plus mood colour/effects. Later (cloud, paid): an AI image model for realistic expressions. Only your own verified face can be used, never someone else's. | Planned |
