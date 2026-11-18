# Soulink Legal & Compliance Plan

Oct 15, 2026 · @SaiRaghava

## Summary

Soulink is an **intermediary** under India's IT Act and a **data fiduciary** under the DPDP Act, so it needs published terms and a privacy policy, a named grievance officer, real consent (especially for face data), account deletion, AI labels on Soulmoji and the Argue verdict, and clearly labelled ads. Most of these can be built into the app now; I'm adding them today.

Three things need you, not code: a **registered office address** for QM46 Solutions on the legal pages, **licences for music** before public launch (the unofficial JioSaavn source is the biggest legal risk in the app), and a **startup lawyer's review** of the terms and privacy policy.

This plan is a working guide, not legal advice.

## Before public launch

| What | Why | Who | Status |
| --- | --- | --- | --- |
| Terms of Use, Privacy Policy, Community Guidelines in the app and on the login page | IT Rules 2021 (rules and privacy policy must be published); DPDP Act notice | Claude | Building today |
| "I'm 18+ and agree to the Terms and Privacy Policy" at sign-up, with the date saved | DPDP consent; 18+ avoids parental-consent rules for children | Claude | Building today |
| Separate yes for face scanning, explaining what is stored and why | Face data is the most sensitive data Soulink holds; DPDP needs specific, informed consent | Claude | Building today |
| Grievance Officer page: name, email, 24-hour acknowledgement, 7-day resolution | IT Rules 2021 as amended in 2026 | Claude builds; you confirm the name | Building today (Sai named for now) |
| Delete my account, with everything erased, and Download my data | DPDP rights to erasure and access | Claude | Building today |
| "AI-generated" labels on Soulmoji stickers, the Argue verdict and translations | IT Rules amendment on synthetic content (Feb 2026) | Claude | Building today |
| Paid boosts shown as "Promoted", ads as "Sponsored" | ASCI code: paid content must be clearly disclosed | Claude | Ads done; Promoted label today |
| Registered office address of QM46 Solutions on the legal pages | IT Rules and consumer rules need a contact address | You | Needed |
| Music: switch off the unofficial JioSaavn source, or get licences | Copyright Act 1957: streaming songs without a licence is infringement | You decide; Claude adds an off switch | Off switch today |
| Refund and cancellation policy for Premium, paid messages and Spread around | Consumer Protection (E-Commerce) Rules 2020; no dark patterns | Claude drafts; you approve | Building today |
| Lawyer review of all legal pages | These are templates until a lawyer signs off | You | Needed |

## The laws that apply

| Law | What it means for Soulink |
| --- | --- |
| [Digital Personal Data Protection Act 2023 and DPDP Rules 2025](https://legismith.com/dpdp-rules-2025-timeline/) | Clear notice and consent before collecting data; collect only what's needed; reasonable security; report a data breach to the Data Protection Board within 72 hours; erase data when the purpose is over or the user asks; answer user requests within 90 days; publish a contact for data questions. Users under 18 need verifiable parental consent, so Soulink stays 18+. Main duties apply from 13 May 2027, but building them now is cheaper than retrofitting. |
| [IT Act 2000 and IT Intermediary Rules 2021](https://blog.ipleaders.in/information-technology-guidelines-intermediaries-digital-media-ethics-code-rules-2021/) | Publish rules, privacy policy and user agreement; tell users what content is banned; name a Grievance Officer; act on court or government takedown orders; keep registration data for 180 days after an account is deleted. Extra duties (Chief Compliance Officer, monthly reports) start only above 50 lakh users. |
| [IT Rules amendment on synthetic content (from 20 Feb 2026)](https://anmglobal.net/articles/regulating-synthetic-content-key-implications-of-the-it-rules-amendment-2026) | AI-made content needs a visible label and metadata users can't remove; warn users about misuse of AI tools. Takedowns: 3 hours for lawful orders, 2 hours for intimate or impersonation content. User grievances: resolve in 7 days. This covers Soulmoji. |
| [CERT-In Directions 2022](https://treelife.in/compliance/navigating-the-cert-in-directions-implications-and-challenges-for-indian-businesses) | Report serious cyber incidents (hacks, data leaks) to CERT-In within 6 hours; keep system logs for 180 days; sync server clocks; name a point of contact. |
| Copyright Act 1957 | Songs, film clips and dialogue are copyrighted. Music in posts, Moments and Sparks needs licences (labels, IPRS / PPL or a licensed music API). Users must not upload others' content; take it down when asked. |
| Consumer Protection Act 2019, E-Commerce Rules 2020, Dark Patterns Guidelines 2023 | For Premium, paid messages, Spread around and the Soul Shop: show the company name, address, prices with GST, refund and cancellation terms; no hidden charges, false urgency or hard-to-cancel subscriptions. |
| ASCI Code and influencer guidelines | Every paid placement is labelled (Sponsored, Promoted). Creators paid by brands must mark their Sparks as ads. |
| Bharatiya Nyaya Sanhita 2023, POCSO Act 2012 | Remove and report child sexual abuse material, threats, harassment and intimate images shared without consent; keep evidence when police ask. |

## Company, tax and payments

- [ ] **Founders' agreement** between Nikhil and Sai: equity split, roles (Founder & Product Owner; Co-founder & Technology), 4-year vesting with a 1-year cliff, IP assigned to QM46 Solutions.
- [ ] **IP assignment**: both founders sign that all Soulink code, designs and the name belong to QM46 Solutions. Investors check this first.
- [ ] **Employment check**: confirm your current employment contracts allow a side company and don't claim IP you build outside work.
- [ ] **DPIIT startup recognition** for QM46 Solutions (free; unlocks the Seed Fund grant and tax benefits).
- [ ] **Trademark** "Soulink" in classes 9 and 45 (app and social networking).
- [ ] **GST registration** before charging for Premium; prices shown to users include 18% GST.
- [ ] **Razorpay** with company KYC when you go live; card data stays with Razorpay, never on our servers.
- [ ] **Azure billing**: switching the database to "Continue using database for additional charges" can't be undone; set a monthly budget alert in Azure Cost Management.
- [ ] **Data location**: the database and server now run outside India (Render in Singapore). DPDP allows this unless the government restricts a country; say so in the Privacy Policy, and consider an India region when you scale.

## Upcoming deadlines

| When | What |
| --- | --- |
| Before opening to the public | Everything in "Before public launch" above, plus the lawyer review |
| Before taking money | GST registration, Razorpay KYC, refund policy live |
| 13 Nov 2026 | DPDP Consent Manager rules start (only matters if we use one) |
| 13 May 2027 | DPDP main duties enforceable: notices, consent, security, breach reporting, erasure, 90-day grievances |
| At 50 lakh users | Significant social media intermediary duties: Chief Compliance Officer, nodal contact, resident grievance officer, monthly reports |

## What a lawyer should review

Ask a startup lawyer for a fixed-fee package covering these; it typically takes one or two meetings.

- Terms of Use, Privacy Policy, Community Guidelines and Refund Policy built into the app
- Face verification and face search: consent wording, how long scans are kept, and the risk of the camera-search feature
- Music licensing plan for posts, Moments and Sparks
- The founders' agreement, IP assignment and the investor term sheet
- Whether Argue Referee verdicts need a stronger "not legal advice" notice

## Sources

- [DPDP Rules 2025 timeline — Legismith](https://legismith.com/dpdp-rules-2025-timeline/)
- [IT Rules amendment on synthetic content — ANM Global](https://anmglobal.net/articles/regulating-synthetic-content-key-implications-of-the-it-rules-amendment-2026)
- [IT Intermediary Guidelines 2021 explained — iPleaders](https://blog.ipleaders.in/information-technology-guidelines-intermediaries-digital-media-ethics-code-rules-2021/)
- [CERT-In Directions 2022 — Treelife](https://treelife.in/compliance/navigating-the-cert-in-directions-implications-and-challenges-for-indian-businesses)
- [Azure SQL Database free offer — Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer)
