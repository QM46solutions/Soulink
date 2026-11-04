# Admin portal: plan (PARKED until Sai says "build the admin portal")

Status: agreed idea, on hold. Sai will give 4 decisions (bottom of this file). Then build a clickable preview first, then the real thing.

## What Sai asked for
A separate admin website: its own address and its own login, used in a laptop browser. It is not part of the Soulink app, and only the Soulink team can sign in.

1. **Ads control:** post, edit, pause, delete and top up ads. This replaces the Ads Manager inside the app.
2. **Ad dashboards**, per ad and for all ads:
   - performance and spend
   - how many people are viewing
   - which gender, which area and which age group views more
   - share count, like count and reach count
3. **"Reach out" on ads:** an option on an ad that lets users contact the ad owner (for example a real-estate listing). The enquiry data goes to the admins, with related dashboards.
4. **Server monitoring:**
   - number of users, active users and non-active users
   - what time users are most active
   - storage used
   - server load and response time

## Today vs missing (checked Nov 2026)
- **Exists:**
  - ad create/edit/pause, budgets, price per 1,000 views
  - views, reach (unique people), clicks, spent, day-by-day (`ad_campaigns`, `ad_daily`, `ad_viewers`)
  - users' last-active time
  - `user_sessions` and `audit_log`
- **Missing:**
  - Like and Share on ads
  - Reach out (enquiries)
  - gender/age/area breakdowns (computable from `ad_viewers` joined to users)
  - hourly activity log
  - request timing / server load recorder
  - storage measurement. Check where uploads live: Render's free disk is wiped on each deploy.
- **Naming:** "reach" already means unique people who saw an ad. Call Sai's feature **"Reach out"** on the button and **"Enquiries"** in the dashboard.

## How to build
- **Frontend:** a new `admin/` folder in the repo, as a React + Vite website with a free charts library, desktop-first. Deployed as its own free Render static site (for example `soulink-admin.onrender.com`, later `admin.soulink.app`).
- **Backend:** the same server and database, with new endpoints under `/api/admin/...`. CORS allows only the admin site.
- **Login:** separate admin accounts (not app users).
  - email + password + a 6-digit Google Authenticator code (free, no SMS)
  - roles: Owner / Ads manager / Viewer
  - 8-hour httpOnly cookie, lockout after 5 wrong tries, every action written to `audit_log`
- **Pages:**
  - **Overview**
  - **Ads:** list, editor with a live preview, pause/resume, top-up
  - **Ad report:** views, reach, clicks, click rate, likes, shares, enquiries, spend, daily chart, gender, age groups (18–24, 25–34…), top areas
  - **Enquiries:** table, new/contacted status, CSV export
  - **Users & activity:** total, active 24h/7d/30d, inactive, new sign-ups, hour × weekday heatmap
  - **Server health:** response time (typical and slowest), errors, requests/min, memory and load, uptime, database size, file storage
  - **Later:** bans, copyright and moderation tools move here
- **App changes:**
  - Like and Share buttons on ads
  - a Reach out button: the user sees what will be sent (name, phone, optional message) and confirms
- **Privacy:** breakdowns are groups only; any group under 10 people is hidden. Personal details exist only in enquiries the user chose to send.
- **Order of work:**
  1. Portal + login + Overview + Ads list and editor
  2. Ad reports, Like/Share, Reach out and Enquiries
  3. Server monitoring
  4. Moderation tools and email alerts
- **Cost:** everything stays on free services.

## Decisions Sai still has to give
1. Admin login: email + password + Google Authenticator (recommended), or something else?
2. What Reach out does:
   - (a) send name, phone and an optional message (recommended)
   - (b) open a chat with the advertiser
   - (c) a call or WhatsApp link to the advertiser
3. Who sees enquiries: only the Soulink team, or also the ad owner in "My ads" in the app?
4. Remove the in-app Ads Manager once the portal is ready (recommended), or keep both?
