# Soulink API inventory (generated 2026-11-20 from server/src/routes, commit 964cf9dc)

Mount points: see server/src/app.js lines 181-212. Routers with router-level requireAuth: all except auth, appVersion, console (own console auth), copyright/grievances (per-route), dev (laptop-only), music/places/share (public parts), push (/renew public).

| Router | Method | Path | Notable middleware |
|---|---|---|---|
| account | GET | /activity | |
| account | GET | /viewers | |
| account | GET | /status | |
| account | DELETE | /location | |
| account | POST | /phone | |
| account | POST | /phone/verify | |
| account | DELETE | /phone/pending | |
| account | POST | /email/request | |
| account | POST | /email/verify | |
| account | GET | /sessions | |
| account | POST | /sessions/end-others | |
| account | DELETE | /sessions/:id | |
| admin | POST | /users/:username/ban | |
| admin | GET | /bans | |
| admin | POST | /bans/:id/lift | |
| admin | GET | /copyright | |
| admin | POST | /copyright/:id/decide | |
| ads | GET | / | |
| ads | POST | /:id/seen | |
| ads | POST | /:id/click | |
| ads | GET | /has | |
| ads | GET | /mine | |
| ads | GET | /manage | admin |
| ads | POST | / | admin, uploadMemory('post', 40, 2 |
| ads | PATCH | /:id | admin |
| ads | DELETE | /:id | admin |
| anon | GET | /can/:userId | |
| anon | POST | / | requireSoul |
| anon | GET | / | |
| anon | GET | /:id | |
| anon | POST | /:id/messages | |
| anon | POST | /:id/close | |
| anon | POST | /:id/hide | |
| appVersion | GET | /version | |
| argue | POST | / | requireSoul |
| argue | GET | / | |
| argue | GET | /:id | |
| argue | POST | /:id/statement | |
| auth | GET | /options | |
| auth | POST | /google | |
| auth | POST | /apple | |
| backup | POST | /export | |
| backup | GET | /export/:id | |
| backup | GET | /export/:id/download | |
| backup | GET | /history | |
| backup | POST | /restore/validate | |
| backup | POST | /restore/:id/start | |
| backup | GET | /restore/:id | |
| connections | GET | /status/:userId | |
| connections | POST | /requests | requireSoul |
| connections | GET | /requests | |
| connections | POST | /requests/:id/accept | requireSoul |
| connections | POST | /back/:userId | requireSoul |
| connections | DELETE | /with/:userId | |
| connections | POST | /requests/:id/reject | |
| connections | POST | /requests/:id/hold | |
| connections | POST | /requests/:id/withdraw | |
| connections | GET | / | |
| connections | PUT | /open-to | |
| connections | GET | /intents | |
| console | GET | /auth/state | |
| console | POST | /auth/new-secret | |
| console | POST | /auth/setup | |
| console | POST | /auth/accept | |
| console | POST | /auth/login | |
| console | GET | /auth/me | ANY |
| console | GET | /team | OWNER |
| console | POST | /team | OWNER |
| console | POST | /team/:id/disable | OWNER |
| console | GET | /overview | ANY |
| console | GET | /live | ANY |
| console | GET | /users | requireConsole('viewer' |
| console | GET | /activity | requireConsole('viewer' |
| console | GET | /growth | requireConsole('viewer' |
| console | GET | /performance | OWNER |
| console | GET | /issues | requireConsole('support', 'viewer' |
| console | POST | /issues | requireConsole('support' |
| console | PATCH | /issues/:id | requireConsole('support' |
| console | GET | /app-update | requireConsole('viewer', 'support', 'ads' |
| console | PUT | /app-update | OWNER |
| console | GET | /app-health | requireConsole('support', 'viewer' |
| console | GET | /issues/:id/screenshot | requireConsole('support', 'viewer' |
| console | GET | /releases | requireConsole('viewer', 'support', 'ads' |
| console | POST | /releases | OWNER |
| console | PATCH | /releases/:id | OWNER |
| console | GET | /safety | requireConsole('support' |
| console | POST | /safety/reports/:id | requireConsole('support' |
| console | GET | /legal | requireConsole('support' |
| console | PATCH | /legal/complaints/:id | requireConsole('support' |
| console | POST | /legal/orders | requireConsole('support' |
| console | POST | /legal/orders/:id | requireConsole('support' |
| console | POST | /users/set-email | OWNER |
| console | POST | /legal/bans | OWNER |
| console | POST | /legal/bans/:id/lift | OWNER |
| console | GET | /revenue | requireConsole('viewer' |
| console | GET | /ads/settings | requireConsole('ads', 'viewer' |
| console | PUT | /ads/settings | OWNER |
| console | POST | /ads/quote | requireConsole('ads' |
| console | GET | /ads/customers | requireConsole('ads', 'viewer' |
| console | POST | /ads/customers | requireConsole('ads' |
| console | PATCH | /ads/customers/:id | requireConsole('ads' |
| console | GET | /ads/customers/:id | requireConsole('ads', 'viewer' |
| console | POST | /ads/bookings | requireConsole('ads' |
| console | POST | /ads/payments | requireConsole('ads' |
| console | PUT | /ads/bookings/:id/frequency | requireConsole('ads' |
| console | POST | /ads/bookings/:id/:action | requireConsole('ads' |
| conversations | GET | / | |
| conversations | GET | /unread | |
| conversations | POST | /direct | requireSoul |
| conversations | GET | /paid-message | |
| conversations | POST | /paid-message | requireSoul |
| conversations | POST | /group | requireSoul |
| conversations | GET | /translator | |
| conversations | GET | /invite/:code | |
| conversations | POST | /invite/:code/join | requireSoul |
| conversations | GET | /:id | |
| conversations | GET | /:id/messages | |
| conversations | POST | /:id/messages | |
| conversations | POST | /:id/messages/:messageId/translate | |
| conversations | POST | /:id/translate-draft | |
| conversations | POST | /:id/voice-translate | uploadMemory('media', 25 |
| conversations | POST | /:id/messages/:messageId/open | |
| conversations | POST | /:id/messages/:messageId/save | |
| conversations | POST | /:id/messages/:messageId/react | |
| conversations | POST | /:id/media | uploadMemory('media', 25 |
| conversations | POST | /:id/document | uploadMemory('document', 25 |
| conversations | POST | /:id/messages/:messageId/vote | |
| conversations | POST | /:id/messages/:messageId/move | |
| conversations | POST | /:id/private | |
| conversations | POST | /:id/leave | |
| conversations | POST | /:id/read | |
| conversations | DELETE | /:id/messages/:messageId | |
| conversations | POST | /:id/accept | |
| conversations | DELETE | /:id | |
| conversations | PATCH | /:id | |
| conversations | POST | /:id/members | |
| conversations | POST | /:id/invite | |
| conversations | DELETE | /:id/invite | |
| conversations | DELETE | /:id/members/:userId | |
| copyright | POST | /reports | rateLimit({ windowMs: 3600_000, limit: config.env === 'tes |
| copyright | GET | /mine | requireAuth |
| copyright | POST | /:id/appeal | requireAuth |
| dev | POST | /demo | |
| dev | POST | /soulmoji-preview | requireAuth |
| discover | GET | /options | |
| discover | PUT | /filters | |
| discover | POST | /search | |
| face | POST | /check |  |
| face | POST | /enroll |  |
| feed | GET | / | |
| grievances | GET | /categories | |
| grievances | POST | / | rateLimit({ windowMs: 3600_000, limit: config.env === 'tes |
| grievances | GET | /mine | requireAuth |
| moments | POST | / | requireSoul, uploadMemory('image', 10 |
| moments | GET | /feed | |
| moments | GET | /user/:userId | |
| moments | GET | /archive | |
| moments | POST | /:id/view | |
| moments | GET | /:id/viewers | |
| moments | POST | /:id/reply | requireSoul |
| moments | DELETE | /:id | |
| music | GET | /sources | |
| music | GET | /play/:ref | |
| music | GET | /search | requireAuth |
| music | GET | /foryou | requireAuth |
| notifications | GET | / | |
| notifications | GET | /unread | |
| notifications | POST | /read | |
| places | GET | /search | |
| places | GET | /near | |
| posts | POST | / | uploadMemory('post', 40, 11 |
| posts | GET | /user/:userId | |
| posts | GET | /saved | |
| posts | GET | /archived | |
| posts | GET | /spread/plans | |
| posts | GET | /:id/spread | |
| posts | POST | /:id/spread | |
| posts | POST | /:id/spread/stop | |
| posts | GET | /:id | |
| posts | POST | /:id/save | |
| posts | POST | /:id/hide | |
| posts | POST | /:id/archive | |
| posts | POST | /:id/pin | |
| posts | DELETE | /:id | |
| posts | PATCH | /:id | |
| posts | POST | /:id/music | uploadMemory('audio', 15 |
| posts | POST | /:id/music/stream | |
| posts | DELETE | /:id/music | |
| posts | POST | /:id/like | |
| posts | POST | /:id/offense | |
| posts | GET | /:id/offenses | |
| posts | POST | /:id/share | |
| posts | GET | /:id/likes | |
| posts | GET | /:id/comments | |
| posts | POST | /:id/comments | |
| posts | POST | /:id/comments/:cid/like | |
| posts | POST | /:id/comments/:cid/offense | |
| posts | DELETE | /:id/comments/:cid | |
| privacy | GET | / | |
| privacy | PUT | / | |
| privacy | GET | /people/:userId | |
| privacy | PUT | /people/:userId | |
| push | POST | /renew | |
| push | GET | /key | |
| push | POST | /subscribe | |
| push | DELETE | /subscribe | |
| push | POST | /expo | |
| push | DELETE | /expo | |
| push | POST | /test | |
| safety | POST | /blocks/:id | |
| safety | DELETE | /blocks/:id | |
| safety | GET | /blocks | |
| safety | POST | /reports | |
| safety | GET | /reports/reasons | |
| search | GET | /users | |
| share | GET | /post/:id | |
| share | GET | /spark/:id | |
| soul | GET | /dna | |
| soul | POST | /dna/retake | |
| soul | PUT | /dna/answers | |
| soul | POST | /dna/complete | |
| soul | GET | /dna/me | |
| soul | GET | /compat/:userId | |
| soul | GET | /pair/:userId | |
| soul | POST | /pair/:userId | |
| soulmoji | GET | /face | |
| soulmoji | POST | /face | rateLimit({ windowMs: 15 * 60_000, limit: config.env === ' |
| soulmoji | POST | /render | rateLimit({ windowMs: 60_000, limit: config.env === 'test' |
| sparks | GET | / | |
| sparks | GET | /spread/plans | |
| sparks | GET | /user/:userId | |
| sparks | POST | / | requireSoul, oneBigUpload, uploadMemory('spark', SPARK_MAX |
| sparks | GET | /builder | |
| sparks | POST | /uploads | requireSoul |
| sparks | POST | /studio | requireSoul |
| sparks | GET | /builds | |
| sparks | GET | /casting | |
| sparks | POST | /casting | requireSoul |
| sparks | GET | /casting/:id | |
| sparks | POST | /casting/:id/pick | |
| sparks | DELETE | /casting/:id | |
| sparks | GET | /mic | |
| sparks | GET | /stage | |
| sparks | POST | /stage/spots | requireSoul |
| sparks | POST | /stage/spots/:id/rsvp | |
| sparks | DELETE | /stage/spots/:id | |
| sparks | POST | /:id/react | |
| sparks | POST | /:id/tried | |
| sparks | POST | /:id/view | |
| sparks | GET | /:id/spread | |
| sparks | POST | /:id/spread | requireSoul |
| sparks | PATCH | /:id | |
| sparks | POST | /:id/spread/stop | |
| sparks | GET | /:id | |
| sparks | GET | /:id/comments | |
| sparks | POST | /:id/comments | |
| sparks | POST | /:id/comments/:cid/like | |
| sparks | POST | /:id/comments/:cid/offense | |
| sparks | DELETE | /:id/comments/:cid | |
| sparks | POST | /:id/offense | |
| sparks | GET | /:id/offenses | |
| sparks | POST | /:id/share | |
| sparks | DELETE | /:id | |
| telemetry | POST | /screens | |
| telemetry | POST | /api | perUser(120 |
| telemetry | POST | /problem | perUser(10 |
| telemetry | POST | /crash | perUser(60 |
| users | GET | /me | |
| users | PUT | /me/events-notify | |
| users | PATCH | /me | |
| users | PUT | /me/location | |
| users | POST | /me/complete-onboarding | |
| users | POST | /me/accept-terms | |
| users | GET | /me/export | |
| users | POST | /me/pause | |
| users | POST | /me/schedule-deletion | |
| users | DELETE | /me | |
| users | POST | /me/restore | express.json({ limit: '15mb' } |
| users | POST | /me/avatar | uploadMemory('image', 8 |
| users | DELETE | /me/avatar | |
| users | GET | /username-available | |
| users | GET | /me/follow-requests | |
| users | POST | /me/follow-requests/:userId/accept | requireSoul |
| users | POST | /me/follow-requests/:userId/decline | |
| users | GET | /u/:username | |
| users | GET | /:id/followers | ah(|
| users | GET | /:id/following | ah(|
| users | GET | /:id/connections | |
| users | POST | /:id/follow | requireSoul |
| users | DELETE | /:id/follow | |
| users | DELETE | /:id/follower | |

Not captured by the pattern above (defined via multi-line calls): auth POST /otp/request, POST /otp/verify, plus 2 authenticated auth routes; face POST /check, /enroll (body parsers). Total ≈ 295 handlers.
