# Soul DNA v7

Approved by Nikhil on 21 Nov 2026. Full question bank and review notes: "Soul DNA v7 — Question Bank for Review" (claude.ai doc).

## What changed from v6
- Removed: "What are you looking for on Soulink?" (intent comes from each Connect request) and both photo grids titled "Which of these are you?".
- Lifestyle habits are plain quick taps (no photos). "What do you need in a partner?" has new choices: how they treat you, and life together (Must / Nice to have / Never; Never only for life together).
- 8 fixed categories: social style, communication, conflict, trust and boundaries, values, lifestyle, interests, relationship expectations.
- Each category has a bank of activities in several formats (choose, reaction, conversation cards, pick what matters more, put in order, slider, build your ideal day, pick 3 tiles, quick taps, partner needs). "It depends" and Skip are allowed except on quick taps, kids and partner needs.

## How it works
- First session: 11 activities (`planFor(userId)` in `server/src/services/mind/scenarios.js`): every category, plus the 4 anchors everyone gets (cf1, tb1, va0, li1). Which activity fills a varied slot comes from a hash of the user id.
- Every answer moves only the traits listed for it. Anchors count 1.2×, picture tiles 0.6× and they only feed interests. Skips add nothing.
- Check-ins: `GET /soul/dna/checkin` → 3 unseen activities from the least-sure categories; `?category=key` → that category's activities (answered ones first) for "Not quite" / Update answers. Updates are free; starting over is Premium.
- Results: `selfView(dna).categories` → per category a tendency line, a level (early read / fairly sure / sure) and `earlier` when it still comes from a v6 Soul DNA.
- Life stage and kids (re2, re3) are asked first in the request-time questions of a dating / life-partner Connect.

## v6 Soul DNA
Keeps working and matching. Its owner sees an optional "Refresh your Soul DNA" invite (`user.soulRefresh`). Any new answer rebuilds the Soul DNA as v7 with the v6 one kept as `base`: its traits count as earlier evidence (much less in a category with newer answers), and its kids / lifestyle / trust-line / value-card answers stay until replaced.
