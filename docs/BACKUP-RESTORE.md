# Account Data & Backup (Download My Data / Restore My Data)

_Added 20 Nov 2026. Settings › Legal & your data › **Account Data & Backup**._

## What was decided

| Question | Decision |
|---|---|
| Whose likes/comments count as "still connected" | **Connections only** (accepted Connect), not Follow |
| What is restored | **Posts and Sparks** (photos, videos, captions, dates, place, settings), empty profile fields, profile photo, Soul DNA. Moments are in the download only (they expire after 24 h) |
| Other people's data in the file | **None.** Other people's likes and comments are not written into the backup (only counts). Your own likes and comments are in it, for your records |

## How it works

**Download My Data**
1. "Request My Data" → `POST /account/backup/export` creates a job (`account_backups`). Limited to 3 a day.
2. In the background the server lists your posts, Sparks, Moments, profile photo, checks every file and records its
   size and SHA-256 in `backup_manifest.json`, which is signed (HMAC, `EXPORT_KEY`). Stage and % show in the app.
3. When ready: in-app message, size and counts shown. The download link works only with your login and stops after
   **7 days** (`410 backup_expired`).
4. Download (`GET /account/backup/export/:id/download`): the ZIP is built while it streams (nothing is stored on the
   server), with `Content-Length` so the phone shows %. Android: you pick the folder (system folder picker);
   iPhone: share sheet → "Save to Files"; web: Downloads. A cut-off download says so and can simply be retried.

```
Soulink_Backup/
  backup_manifest.json          format version 2, app version, account, counts, every file + size + sha256, signature
  account/profile.json          account/account_metadata.json (email, phone, Soul DNA answers)
  posts/posts.json              sparks/sparks.json   moments/moments.json
  media/images/  media/videos/  media/moments/       original files
  interactions/likes.json       comments.json  replies.json   (yours only)
  metadata/relationships.json   (counts only)  export_information.json
```

**Restore My Data**
1. Choose the ZIP (Android/iPhone file picker, browser). Old `.json` downloads still restore profile + Soul DNA.
2. Upload with progress → `POST /account/backup/restore/validate`. Checked before anything changes:
   ZIP is readable; no `..`, absolute or drive paths; max 5000 files, 150 MB per file, ~360 MB unpacked, compression
   ratio ≤ 200 (zip bombs); manifest present and signature valid; format version supported; **every file's size and
   SHA-256 match**; ownership = same account id, or the same **verified** email, or the same phone.
3. Summary (to add, already here, brought back, likes/comments kept and left out). Nothing changes until
   "Restore My Data". Unconfirmed uploads are deleted after 2 hours.
4. Restore runs in the background with stages: Validating backup → Verifying account ownership → Restoring profile
   information → Restoring posts / Sparks (n of N) → Recalculating interaction counts → Finalizing restoration.
5. Completion summary and "Go to My Profile". Every step is in the audit log.

**Per post / Spark (always decided from the database now, never from the file, people by id never by username)**

| Found on Soulink | What happens |
|---|---|
| Exists, yours, not deleted | Skipped (duplicate). Nothing is overwritten |
| Exists, yours, deleted by you | Brought back. Likes kept only from: you, or someone whose account exists, is active (not paused/deleting), is your Connection now, and neither of you has blocked the other. Other likes are removed and other comments hidden (with their replies). Counts are therefore recalculated |
| Removed by moderation | Never restored |
| Gone (e.g. account deleted and re-created) | Recreated with its **original id**, photos/videos, caption, date. No likes or comments (the file has none) |
| Id belongs to someone else's content | Recreated with a new id (shown as a conflict) |

Profile: only empty fields are filled; profile photo only if you have none; Soul DNA only if you have none.
Re-running the same restore is safe (matched by id); a second tap on "Restore" does nothing.

## Testing

Automated: `server/test/m64.test.js` (runs with `UPDATE-SOULINK.bat`).

| # | Scenario | Expected | How checked |
|---|---|---|---|
| 1 | Download My Data | ZIP with manifest, profile, posts, original photo; size header matches | m64 |
| 2 | Other people's data | No other person's id, username or comment text anywhere in the ZIP | m64 |
| 3 | Someone else's download link | 404 | m64 |
| 4 | Expired link | 410 "expired" | m64 |
| 5 | Restore when everything is still there | 0 added, duplicates skipped, still 1 post | m64 |
| 6 | Deleted post restored | Comes back; likes/comments only from Connections who are active and not blocked | m64 |
| 7 | Liker unfollowed / never connected | Like removed, comment hidden | m64 |
| 8 | Liker blocked you | Excluded | m64 |
| 9 | Liker's account paused/deleting | Excluded | m64 |
| 10 | Double tap Restore | Second tap harmless | m64 |
| 11 | Post gone completely | Recreated, original id and photo, no interactions | m64 |
| 12 | Someone else's backup | 403 "different account" | m64 |
| 13 | One byte changed | Refused (checksum) | m64 |
| 14 | `../` path inside the ZIP | Refused | m64 |
| 15 | Not a ZIP / old JSON | Refused with the right message | m64 |
| 16 | History | Shows the export and the restore | m64 |
| 17 | Big backup (100 MB+), Android folder picker, iPhone Save to Files | Progress, saved where chosen | Test phone (to do) |
| 18 | Wi-Fi off mid-download / mid-upload | Clear message, retry works | Test phone (to do) |
| 19 | Server restart mid-job | Job shows "Interrupted"; request / choose again | Code path (`recoverBackupJobs`); test phone (to do) |

## Limits to know

- **Hosting**: Render free plan has 512 MB memory and a disk that is wiped on restart, and it can sleep. Backups are
  capped at **300 MB** for now; a restart mid-job marks it "Interrupted" (nothing half-done is lost: re-running the
  restore skips what's already back). For bigger accounts: a paid instance and Azure Blob (`STORAGE=blob`).
- **Account deleted and re-created**: posts come back without likes or comments, because erasing an account erases
  them and the backup (by decision) doesn't copy other people's data.
- **Phone builds**: the folder picker and download/upload progress use expo-file-system 57, which is in the current
  build. If an older build lacks them, the app falls back to the share sheet and an upload without %.
- Not a push notification yet: "your data is ready" shows in the app (and in Backup History).
- Chats are not in the ZIP (they involve other people). The older JSON download (`GET /users/me/export`) still exists.
