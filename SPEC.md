# Soulink — Product Spec (v1)

Owners: Sai Raghava (product, QA, releases) · Nikhil Cheedella (product, growth)
Build: Claude writes most of the code; Sai & Nikhil review, run and test.
Status: Milestones 1–2 built · Milestone 3 next · Last updated 2026-09-23

---

## 1. What Soulink is

A **social network for friends and random connections** (not professional, not strictly dating) where
every account is a verified real person, people are matched by personality ("Soul DNA"),
and conflicts can be settled by an AI referee.

## 2. Decisions locked so far

| Topic | Decision |
|---|---|
| Audience | Social — friends + random connections. Not professional. |
| Platform order | Android first (React Native / Expo), iOS later from the same code |
| Environment | Build and run **locally** first; move to cloud once v1 is complete |
| Database | **Microsoft SQL Server** (Express locally; Azure SQL or SQL Server in the cloud later) |
| Sign-up methods | Phone OTP + Email OTP + Google + Apple (Google/Apple wired at cloud move — they need real OAuth client IDs) |
| Face at sign-up | Required. One face = one account |
| Account privacy | Same as Instagram — public or private; private = follow request must be approved to see posts |
| Social scope v1 | **Full**: posts, feed, likes, comments, stories, 1:1 + group chat, photos, voice notes, block & report |
| Soul DNA traits (8) | Empathy, Ambition, Humor, Loyalty, Creativity, Conflict Style, Mentality, Nature |
| DNA visibility | Free users see only **Match %**. **Premium** users see the full DNA report |
| Face search | **Opt-in only** — only users with "Discoverable by face" ON can be found |
| Argue feature | Can be opened by one person; verdict is **provisional** until the other side submits. Final verdict needs both sides |

## 3. Features

### 3.1 Sign-up & login
1. Enter phone (or email) → receive OTP (local dev: OTP printed in server log and returned in API response in dev mode).
2. Verify OTP → account created (or logged in if phone exists).
3. Choose username, name, date of birth (18+ only), gender (optional), city, bio, profile photo.
4. Face ID scan (built 2026-09-29, first step of profile setup): live coaching (light, distance, centring, blur, one person), liveness (straight + turn both ways), face fingerprint stored, duplicate faces blocked. Works with phone and laptop cameras.
5. Session: JWT access token (7 days in dev).

### 3.2 Profiles & privacy
- Username (unique, lowercase), display name, bio, photo, city, interests.
- `is_private`: if true, only approved followers see posts/stories and follower lists.
- Counts: posts, followers, following.
- Verified badge = face-verified.

### 3.3 Follow requests (Instagram model)
- Public account: follow is instant.
- Private account: creates a pending request → target can accept / decline.
- Unfollow, remove follower, cancel request.
- Blocking removes follows both ways and hides each user from the other everywhere.

### 3.4 Search
- By username / name (prefix + fuzzy). Blocked users excluded.
- Recent searches (logged as behavior events for Soul DNA).

### 3.5 Chat (Milestone 2)
- 1:1 and group conversations, real time (Socket.IO).
- Text, photos, voice notes. Read receipts, typing indicator.
- Private accounts: non-followers land in "Message requests".

### 3.6 Posts, feed, stories (Milestone 3)
- Photo posts with caption; likes; comments.
- Home feed = people you follow, newest first (ranking later).
- Stories expire after 24h; viewers list.

### 3.7 Soul DNA (Milestone 4)
- Daily 1–2 micro questions for 14 days, then weekly.
- In-app behavior events: profile dwell time, searches, likes, comments, chat activity, referee votes, time-of-day.
- Writing-style signal: bio, captions, referee submissions.
- Score 0–100 per trait, recalculated weekly (and on demand in dev).
- **Match %** between two users = similarity across the 8 traits (with Conflict Style scored for compatibility, not sameness).
- Free: Match % only. Premium: full breakdown + explanations.

### 3.8 Discover (Milestone 4)
- Suggested people ranked by Match %, filterable by city / age range.
- Excludes blocked, already-followed, and users who turned off "Show me in Discover".

### 3.9 Argue / Referee (Milestone 5)
- Open a case (title, other party optional — a connected user).
- Each side submits its version (text; voice later).
- AI asks 2–3 clarifying questions per side.
- Verdict: valid points, flaws, resolution.
  - One side only → **Provisional verdict** + invite to the other party.
  - Both sides → **Final verdict**.
- Option to post anonymously to feed; community votes "who was right".

### 3.10 Face recognition (Milestone 6)
- Local: open-source face model (runs on the laptop, no cost). Cloud: AWS Rekognition (switch via config).
- Sign-up duplicate check.
- Visual search: camera photo → matches only among users with `face_discoverable = true`.
- Raw face images are not kept after embedding is computed (privacy).

### 3.11 Safety
- Block, report (user / post / comment / message / case), with reasons.
- 18+ only.
- Explicit consent screens for face data and behavior tracking (DPDP Act).

### 3.12 Monetization (later)
- Free / Soulink Plus ₹299 per month / Premium Verdict ₹99 per case. Local build has an `is_premium` flag to test gating.

## 4. Architecture

```
mobile/  (Expo React Native)  ──HTTP/JSON + Socket.IO──►  server/ (Node + Express)
                                                             ├── Microsoft SQL Server
                                                             ├── uploads/ (local disk → S3 later)
                                                             ├── AI provider: Claude API or local fallback
                                                             └── Face provider: local model or AWS Rekognition
```

Config switches (server/.env): `SMS_PROVIDER=console|msg91|firebase`, `STORAGE=local|s3`,
`AI_PROVIDER=claude|local`, `FACE_PROVIDER=local|rekognition`.

## 5. Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Foundation: auth, profiles, privacy, follow requests, search, block/report | ✅ Done |
| 2 | Chat: 1:1, groups, media, voice notes | ✅ Built (tests run on your laptop) |
| 3 | Posts, feed, likes, comments, stories | |
| 4 | Soul DNA + Discover + Premium gating | |
| 5 | Argue / Referee | |
| 6 | Face sign-up check + opt-in face search | |
| 7 | QA hardening, Google/Apple sign-in, cloud move | |

## 6. QA approach (owner: Sai)
- API integration tests run against a real local SQL Server test database, `soulink_test` (`npm test` in server/).
- Each milestone ships with a manual test checklist in `docs/test-plans/`.
- Bugs tracked as GitHub issues once the repo is set up.

## 6. Founder decisions (Sai, 2026-09-29)

| Topic | Decision |
|---|---|
| Relationship scope | No limits: friendship, dating, situationship, study/work buddy, networking, any trending relation |
| Connection intent | When someone searches, finds a suggestion, or opens a profile, Soulink asks: "Someone you know, or someone new?" then "What are you hoping for with them?" (Friendship, Dating, Situationship, Study/Work buddy, Networking, Just vibing, Not sure yet). The intent is TRANSPARENT: it travels with the request. Everyone sets "Open to" (which intents they accept receiving) |
| Soul Score on requests | Every registered person has a virtual Soul DNA. Every request carries the Soul Score (match %) between sender and receiver, next to the intent: "Rahul wants to connect for Friendship - Soul Score 82%". Score is free to see; the "why" stays Premium. Until full Soul DNA ships (build 7) the score comes from the vibe quiz, prompts and interests and is labelled "early" |
| Request answers | Receiver has 3 choices: ACCEPT (optionally "as something else", e.g. Friendship instead of Dating), REJECT, HOLD. The sender is ALWAYS notified: "Accepted", "Rejected", or "On hold for 3 days". Rejected: the same person cannot send again for 30 days (anti-harassment). |
| Hold (new, Soulink-only) | Receiver picks how long: 1 day, 3 days, 1 week, 2 weeks, 1 month. Before the hold ends (24 h before; 3 h before for 1-day holds) the receiver gets "Your hold on Rahul's request ends soon. Changed your mind?" with Accept / Reject / Extend once. If nothing happens by the end, the request is automatically SUSPENDED and the sender is told "Request suspended - no answer". Sender can withdraw a request on hold, and can send again 7 days after a suspension |
| Launch audience | College students + young professionals, Hyderabad first |
| Money | Premium: full Soul DNA, why-we-matched explanations, editing your Soul data. Main revenue: brand partnerships |
| Environment | Everything local until the whole app works; cloud and paid services come after |
| Roles | Sai = founder (ideas, decisions, testing). Claude = builds everything |
| Brand | Pitch-site look frozen for now; may change later |
| Content | Photos + short reels up to 30 seconds. No long video |
| Soul DNA | Matching stays "magical"; explanations only for Premium |
| Chat | Instagram-like feel (requests, reactions, replies, seen/typing, share posts), not a copy |
| Soulmoji (new) | Type a feeling ("so done with Monday") → a sticker of YOUR face with that expression → send it in chat. Only from your own verified face |
