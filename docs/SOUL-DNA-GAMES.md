# Soul DNA v5: the games

Soul DNA is 7 short tap games plus 3 taps about what you want: about 38 screens' worth of taps in roughly 6 minutes, no typing. They replace the long scenario quiz (v4).

Each game measures a construct from published psychology research. Where an instrument is public domain (IPIP) its ideas and short phrases are used directly. Where it is copyrighted, only the theory is used and the scenarios are our own wording.

| Step | What it measures | Based on | Use |
|---|---|---|---|
| Before we start (3 picks) | Relationship goal, timeline, kids | Relationship deal-breakers research (Jonason et al., 2015) | Ideas only |
| 1 · Which one is you? (5 screens, Most me / Least me) | Big Five: extraversion, agreeableness, conscientiousness, openness, emotional stability | IPIP / Mini-IPIP (Donnellan et al., 2006), forced-choice | Public domain |
| 2 · React (5 scenes, timed) | Attachment anxiety and avoidance; reappraisal vs suppression | ECR-R / ECR-RS (Fraley et al.); Emotion Regulation Questionnaire (Gross & John, 2003) | Ideas only |
| 3 · Which matters more? (6 cards + 1 check, firmness dial) | Values on opposite poles, and how firmly held | Schwartz theory of basic human values | Ideas only |
| 4 · Loyalty & commitment (7 + 1 check, firmness dial; partner or friend version) | Boundaries, openness, jealousy, commitment, standing up for each other, honesty | Investment Model (Rusbult, Martz & Agnew, 1998); Multidimensional Jealousy Scale (Pfeiffer & Wong, 1989) | Ideas only |
| 5 · Three boxes (2 screens) | What you are vs what you need: Must / Never / Flexible | Relationship deal-breakers research | Ideas only |
| 6 · Build my day (5 slots) | Chronotype, work style, social energy | Morningness–Eveningness (Horne & Östberg; rMEQ) | Ideas only |
| 7 · Your move (3 scenes) | Criticism, defensiveness, stonewalling, repair | Gottman's couples research; dual-concern model (Pruitt & Rubin) | Ideas only |

Left out: "love languages" (weak research support).

## How two profiles become a match score

1. **Gate.** Hard deal-breakers cap the score at 40 for dating, life partner and business:
   - different intent (marriage or serious vs exploring)
   - kids vs no kids (life partner)
   - a crossed "Never" chip
   - two or more crossed non-negotiables
2. **Soft cap.** A single crossed non-negotiable, or an unmet "Must", caps the score at 60. A crossed non-negotiable means one person marked it Non-negotiable and the other holds the opposite at least Firmly. If the other person is Flexible, that's give and take: it's shown as worth talking about, not a cap.
3. **The v4 model still runs on the traits:**
   - vibe (now including daily rhythm)
   - values (now including shared answers weighted by rarity)
   - intention, decisions
   - reactions (anxious + avoidant pairs flagged)
   - making up (now including Big Five stability and agreeableness)
   - give and take (fed by the firmness dial)
   - loyalty (now including how close two people's loyalty lines are)
   - the life-partner simulation
4. **Rarity.** Shared answers on value cards and loyalty questions count more when few people pick them. It needs 20+ players and is refreshed hourly (`refreshRarity`).
5. **Confidence.** Gut-reaction timing and two consistency checks set how sure Soul DNA is. A contradicted check lowers the weight of both answers.
6. **Old Soul DNA.** A v4 Soul DNA keeps matching until its owner plays the games, which they can do free, once. `users.soul_version` tracks which one a person has, and Home shows a nudge.

## Before launch

- A licensed psychologist (in India, RCI-registered clinical or counselling psychologist) should review the games.
- Pilot with about 50 users who play the games and also take the free 20-item Mini-IPIP, to check the two agree.
- Re-check the score calibration (`CALIBRATION` in `services/mind/match.js`) once about 100 real people have played.
- The app says Soul DNA is a matching aid, not a psychological assessment.
