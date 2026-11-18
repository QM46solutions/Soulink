# Soulink Information Security Policy

Oct 15, 2026 · @SaiRaghava

QM46 Solutions protects Soulink data with the controls below, written to meet the IT Act's reasonable-security rule, the DPDP Act, CERT-In's directions and the IT Rules in one place; section 16 lists every control with the evidence that proves it.

## 1. Purpose and scope

This policy is how QM46 Solutions Private Limited keeps Soulink's users and their data safe, and the written proof of the "reasonable security practices" Indian law asks for. It follows the structure of ISO/IEC 27001:2022 so it can later grow into a certification if investors or partners ask for one.

**Applies to:** the Soulink app (web, iPhone, Android), its server and database, the AI services it calls, the admin tools and scripts in the repository, every laptop and phone used to work on Soulink, and everyone who touches it: founders, employees, interns and contractors.

**Written to satisfy:**

| Law or rule | What it asks of security |
| --- | --- |
| IT Act 2000, s.43A + SPDI Rules 2011 (until the DPDP Act fully replaces them) | A written security policy for sensitive personal data (face data counts); reasonable security practices such as ISO 27001 |
| DPDP Act 2023 + DPDP Rules 2025 (main duties from 13 May 2027) | Reasonable safeguards: encryption, access control, logs kept 1 year, backups; breach notice to the Board within 72 hours and to users without delay |
| CERT-In Directions, April 2022 | Report listed incidents within 6 hours; keep ICT logs for 180 days within India; sync clocks to NIC or NPL time; name a point of contact |
| IT (Intermediary) Rules 2021, as amended to Feb 2026 | Keep registration data 180 days after deletion; act on lawful orders and takedowns within set hours; label AI content; Grievance Officer |
| Consumer Protection (E-Commerce) Rules 2020 | Secure handling of payment and order data; grievance handling for Soul Shop |
| RBI rules (through Razorpay) | Card and bank data never touches Soulink's servers |

Where two rules ask for different things, Soulink follows the stricter one.

## 2. Roles

With two founders, each person holds several roles; every role has one named owner and one backup so nothing waits on one person.

| Role | Owner | Backup | Main duties |
| --- | --- | --- | --- |
| Policy owner | Nikhil Cheedella (Founder) | Sai Raghava Ragishetty | Approves this policy, accepts risks, signs off exceptions |
| Security lead | Sai Raghava Ragishetty (Co-founder) | Nikhil Cheedella | Runs the controls in this policy, access reviews, incident response |
| Grievance Officer (IT Rules, DPDP) | Sai Raghava Ragishetty, quantum46solutions@gmail.com | Nikhil Cheedella | Acknowledge complaints in 24 hours, resolve in 7 days; takedowns |
| CERT-In point of contact | Sai Raghava Ragishetty | Nikhil Cheedella | Registered with CERT-In; reports incidents within 6 hours |
| Data protection contact | Sai Raghava Ragishetty | Nikhil Cheedella | User rights requests, breach notices to the Data Protection Board |

**Growth triggers:** at 50 lakh users in India, Soulink appoints a Chief Compliance Officer, a 24×7 Nodal Contact Person and a Resident Grievance Officer, all Indian residents and employees. If the government names Soulink a Significant Data Fiduciary, it appoints an India-based Data Protection Officer and an independent data auditor.

Everyone who works on Soulink must follow this policy and report any suspected incident to the Security lead at once.

## 3. Data classification

Every piece of Soulink data falls into one of four classes, and the class decides who may see it, where it may go and how it is protected.

| Class | Soulink data in it | Rules |
| --- | --- | --- |
| Restricted | Face fingerprints (embeddings) and face scan frames, Soulmoji selfies, private chats and voice notes, anonymous-message sender identity, Argue sides before the verdict, exact date of birth, phone and email, OTP codes, secrets and keys | Never exported, emailed, pasted into chat tools or AI tools, or copied to laptops. Read only by the server; a person reads it only for a logged incident or lawful order. Encrypted in transit and at rest. |
| Confidential | Soul DNA answers and scores, location (rounded), who viewed whom, connections and requests, reports and offense marks, payment references, admin and audit logs, deleted\_accounts records | Founders only, through admin screens, never raw database dumps. Not shared with vendors except as listed in section 10. |
| Internal | Source code, financial model, investor list, this policy, test data | Founders and contractors under NDA. Private GitHub repository only. |
| Public | Public profiles and posts, legal pages, pitch site, app store text | Anyone. |

**Handling rules for every class above Public:**

- No real user data in tests, demos, screenshots or the pitch deck. Use the seed accounts or made-up data.
- No user data in personal WhatsApp, email or notes. Share a user's problem by username only.
- Anything printed or downloaded for an incident is deleted when the incident is closed, and the deletion is logged.
- Face data is used only to prove a person is real and unique, and for face search when the person turned it on. It is never sold, used for ads, or used to train AI models.

## 4. Access control

Nobody gets more access than their work needs, and every access to Restricted data leaves a record.

**Accounts**

- Every person has their own login to Azure, GitHub, Razorpay, MSG91 and the domain registrar. No shared logins.
- Two-factor authentication is on for all of them, using an authenticator app, not SMS.
- Passwords live in a password manager (Bitwarden free plan is enough), are at least 14 characters and are never reused.
- The Azure SQL admin login is used only for migrations. The app connects with its own database user that cannot drop tables or change permissions.

**Admin tools and scripts**

- Admin features in the app (Ads Manager, moderation) work only for accounts with the admin flag, and every admin action is written to an audit log with who, what, when and which user.
- Scripts that read or change raw data (SHOW-FACE-DATA, RESET-SOULINK-DATA, DELETE-UNFINISHED-ACCOUNTS, COPY-DATA-TO-CLOUD) run only against the local test database. They are blocked from running against the cloud database unless the Security lead logs a reason first.
- Nobody browses production tables by hand. Questions about a user are answered through admin screens.

**Users**

- Login is by one-time code; codes expire in 5 minutes, allow 5 tries and are stored only as a keyed hash.
- Codes are sent by SMS through a DLT-registered Indian provider, or by email, the moment the user asks; they are never shown in the app or returned by the API.
- Login sessions last at most 7 days; logging out and deleting an account end them.

**Reviews**

- Every 3 months the Security lead lists who has access to each system and removes anything not needed. The list and changes are saved in the compliance folder.
- When someone leaves, all their access is removed the same day (section 15).

## 5. Encryption, secrets and keys

All user data is encrypted on the network and on disk, and face fingerprints get a second layer of their own.

- **In transit:** HTTPS with TLS 1.2 or newer for the app, API and pitch site; the database connection uses encryption with certificate checking on.
- **At rest:** Azure SQL Transparent Data Encryption is on, with its keys in Azure Key Vault. Uploaded photos, videos and voice notes are stored in encrypted Azure Blob Storage in Central India.
- **Face fingerprints:** encrypted in the application with AES-256-GCM before they are saved, using a key held in Azure Key Vault, outside the database. A stolen database copy then holds no usable face data.
- **Secrets** (JWT secret, database password, API keys, Razorpay keys, SMS keys): kept only in Azure Key Vault and the password manager. Never committed to GitHub, never in chat or email. GitHub secret scanning stays on.
- **Rotation:** every secret is changed at least once a year, at once when a person with access leaves, and at once after any suspected leak. Changing the JWT secret logs everyone out, which is accepted.
- **Payments:** card, UPI and bank details go straight to Razorpay. Soulink stores only the payment reference and amount.

## 6. Secure development and change management

No change reaches users without passing the tests and a second look.

1. Work happens on a branch; the `deploy` branch is protected, so nothing is pushed to it directly.
2. Every change to the server, database or login flow is reviewed by the other founder before it merges. A change made with an AI assistant is reviewed the same way.
3. The automated tests run on every change and must pass. Security tests cover login, account deletion, data download, blocking, private accounts and admin-only routes.
4. Dependencies are checked weekly with `npm audit` and GitHub Dependabot; critical fixes are applied within 7 days, high within 30.
5. Database changes go only through numbered migration files, never by hand.
6. Before each release, check the OWASP Top 10 basics: input validation (Zod on every route), no raw SQL built from user input, rate limits on, CORS limited to Soulink's own addresses, security headers on (Helmet).
7. Every release is checked against the production settings list: production mode on, testing limits off, login codes delivered only by the SMS or email provider, no test accounts or access codes.
8. A new feature that collects a new kind of personal data, or uses it in a new way, gets a short privacy check first: what is collected, why, who sees it, how long it is kept, and whether the Privacy Policy needs to change.

## 7. Hosting, data location and infrastructure

Soulink runs on paid Microsoft Azure services in India: Central India (Pune) for the app, database, media and logs, with backup copies in South India (Chennai).

&#91;embedded content: Where Soulink data lives in production\]

- **Services:** Azure App Service (production tier, at least two instances) for the app and API; Azure SQL Database (General Purpose tier) for data; Azure Blob Storage for photos, videos and voice notes; Azure Key Vault for secrets and keys; Azure Log Analytics for logs.
- **Data in India:** all user data, backups and logs stay in Azure's Indian regions, which meets CERT-In's rule that logs are kept within India and leaves room for any future DPDP localisation rule.
- **Network:** the database and storage accept connections only over Azure's private network from the app servers; public access is off. Users reach the app only over HTTPS through Azure Front Door with its web application firewall.
- **Admin consoles:** Azure, GitHub and Razorpay are opened only from the founders' own devices (section 15), never from shared or public computers.
- **Vendors outside India** (AI, translation) receive only what the feature needs and never face fingerprints or scan frames (section 10).

## 8. Logging, monitoring and clock sync

Soulink keeps security logs for 1 year in India, which covers both CERT-In (180 days) and the DPDP Rules (1 year).

**What is logged**

| Event | Kept in the log | Never in the log |
| --- | --- | --- |
| Logins, OTP requests and failures, logouts | user id, time, IP address, device, result | the code itself |
| Admin actions and any reading of Restricted data | admin id, action, target user, reason | the data read |
| Account deletion, data download, consent and terms acceptance | user id, time, version | the downloaded file |
| Face enroll, face search, Soulmoji creation | user id, time, result, who searched | face images or fingerprints |
| Reports, offense marks, takedowns, lawful orders | who, what content, action taken, time taken | — |
| Payments and refunds | user id, Razorpay reference, amount | card or bank details |
| Server errors, deploys, configuration changes | time, version, who | secrets |

**Rules**

- Logs are written to Azure Log Analytics in Central India and cannot be edited or deleted by the app.
- Server clocks sync to NTP; the Azure servers point to NIC (samay1.nic.in) or NPL (time.nplindia.org) as CERT-In asks.
- Alerts go to both founders for: repeated failed logins, a burst of OTP requests from one address, an admin reading Restricted data, a spike in reports on one account, server errors above normal, and any change to production secrets.
- The Security lead looks over alerts daily and the full log summary weekly.

## 9. Incident response and breach notification

The clock starts the moment anyone at Soulink first notices an incident, not when it is confirmed.

| Who must be told | Deadline | What they get | Law |
| --- | --- | --- | --- |
| CERT-In (incident@cert-in.org.in) | 6 hours | The CERT-In incident form: what happened, when, systems hit | CERT-In Directions 2022 |
| Data Protection Board of India | First notice without delay; full report within 72 hours | Nature, extent, timing, likely impact, steps taken, people affected | DPDP Rules 2025, Rule 7 |
| Affected users | Without delay, in the app and by email or SMS | What happened, what data, likely effects, what we did, what they should do, a contact | DPDP Rules 2025, Rule 7 |
| Police / cyber cell | When a crime is involved | Complaint at cybercrime.gov.in or 1930 | IT Act, BNS |

**Steps**

1. **Report:** anyone who sees something odd tells the Security lead at once, by phone, not chat.
2. **Contain:** cut the attacker's access, change exposed secrets, take the affected feature offline if needed.
3. **Keep evidence:** save logs and screenshots; don't wipe or rebuild servers until a copy is kept.
4. **Assess:** whose data, what kind, how many people, is it still happening. Face data or chats exposed = top severity.
5. **Notify:** send the notices in the table above, using the templates kept in the compliance folder.
6. **Fix and recover:** close the hole, restore from backup if needed, test.
7. **Review within 7 days:** write what happened, why, and what changes; update this policy if needed.

Every incident, even a small one, is recorded in the incident log with dates, decisions and notices sent.

## 10. Vendors and data processors

Under the DPDP Act Soulink stays responsible for what its vendors do with user data, so every vendor is approved, listed and limited to what it needs.

| Vendor | Used for | Data it gets | Where |
| --- | --- | --- | --- |
| Microsoft Azure | Hosting, database, media storage, logs, Key Vault, translation | All app data (encrypted) | Central India (Pune); backups in South India |
| Anthropic (Claude) or the Soulink AI | Argue Referee verdicts | The written sides of an argument, no names | US for Claude; Soulink's own servers in India for the Soulink AI |
| Hugging Face | Soulmoji expression changes | The user's own Soulmoji selfie | Deleted after processing |
| MSG91 (DLT registered) | Login codes by SMS | Phone number, code | India |
| Razorpay | Payments, refunds | Name, phone, email, amount | India |
| GitHub | Source code | Code only, no user data | US |

**Rules**

- Before a vendor gets user data, check that it has a data processing agreement or terms that limit use to Soulink's purpose, security certifications (ISO 27001 or SOC 2), and breach notice to Soulink.
- Face fingerprints and scan frames are never sent to any vendor; face matching runs on Soulink's own server.
- AI vendors must not train on Soulink data; use API settings that turn training and long retention off.
- The list above is updated before a new vendor is used, and the Privacy Policy's list of service providers is updated with it.

## 11. Retention and deletion

Data is kept only as long as the table below says, then deleted automatically by scheduled jobs on the server.

| Data | Kept for | Then | Why |
| --- | --- | --- | --- |
| Profile, posts, Sparks, chats, connections, Soul DNA | While the account is open or paused | Erased when the account is deleted | DPDP: erase when the purpose ends |
| Account the user asked to delete | 30 days, hidden from everyone | Erased; logging in before then cancels | User's choice, as on Instagram; "delete now" skips the wait |
| Face fingerprint | While the account is open | Erased with the account | Purpose ends with the account |
| Face scan frames | Only while checking the scan (seconds) | Never stored, unless the user picks one as profile photo | Data minimisation |
| Identity record: name, username, date of birth, city, phone, email, join and leave dates, consent records | 1 year after erasure, rolling | Deleted by the daily purge job | DPDP Rules 2025 Rule 8(3); IT Rules 2021 Rule 3(1)(h); proof of consent (DPDP s.6(10)) |
| Login sessions (device, IP address, times) and the audit trail of actions | 1 year, rolling | Deleted | DPDP Rule 8(3) traffic data and logs; CERT-In (180 days in India) |
| Banned identity: name, contact, encrypted face fingerprint | 3 years from the ban (or until an appeal is accepted) | Face fingerprint erased at expiry; the record 1 year later | Stop repeat offenders creating new accounts; Terms and Privacy Policy say so |
| Content removed for breaking the law | 180 days, hidden | Deleted, unless an investigation asks to keep it | IT Rules 2021, Rule 3(1)(g) |
| Payment and invoice records | 8 years | Deleted | Companies Act and GST record keeping |
| OTP codes | 5 minutes | Deleted | Login only |
| Inactive accounts | 3 years without use | 48 hours' warning, then erased | DPDP Rules Third Schedule (applies at 2 crore users; adopted early) |
| Backups | 35 days, rolling | Overwritten | Recovery only |

Deleted data may remain in backups until they roll over, and is never restored except to recover from a disaster, after which deleted accounts are erased again.

A person who comes back can restore their profile details and Soul DNA from their signed "Download my data" file; Soulink accepts only an unchanged download whose phone number or email matches the new account.

## 12. Consent and user rights

Every use of personal data rests on a consent the user gave in the app, and every right under the DPDP Act can be used from the app or by email.

**Consent**

- Sign-up: 18+ confirmation and agreement to the Terms, Privacy Policy and Guidelines, recorded with the version and time.
- Face scan: a separate consent shown before the camera opens, recorded with its time.
- Face search, Discover, location, activity-based matching and notifications: off or on by the user's own switch in Settings; face search is off until the user turns it on.
- A change to the Terms or Privacy Policy that affects users gets a new version number, and the app asks everyone to agree again.
- Consent notices are shown in English or in any of the 22 Eighth Schedule languages the user picks, as the DPDP Rules require.

**Rights**

| Right | How the user uses it | Answered within |
| --- | --- | --- |
| Access (see my data) | Settings › Download my data | Immediately |
| Correction | Edit profile | Immediately |
| Erasure | Settings › Delete my account | Immediately (sign-up record kept 180 days) |
| Withdraw consent | Turn off the feature, or delete the account | Immediately |
| Grievance | Email the Grievance Officer | Acknowledged in 24 hours, resolved in 7 days |
| Nominate someone | Email the Grievance Officer | 7 days |

Requests by email are checked against the account's phone or email before anything is shared or deleted, so nobody can ask for someone else's data.

## 13. Content safety, takedowns and lawful requests

Soulink keeps its safe-harbour protection as an intermediary only if it acts within the IT Rules' deadlines, so these are run as fixed service times.

| Trigger | Action | Deadline |
| --- | --- | --- |
| Court order or government notice under s.79(3)(b) | Remove or disable the content, keep a copy for 180 days | 3 hours |
| Complaint about nudity, sexual content, morphed images or impersonation of the complainant (incl. deepfakes) | Remove | 2 hours |
| Any other user complaint | Acknowledge, then resolve | 24 hours / 7 days |
| Lawful request for user information from an authorised agency | Verify the request, share only what it names | 72 hours |
| Child sexual abuse material found | Remove at once, keep evidence, report to NCRB / cybercrime.gov.in | Immediately |
| Many users mark a post, Spark or comment offensive | Auto-hide or suspend, then human review | Automatic, review within 24 hours |

**Rules**

- A founder can be reached for takedown orders at all hours; the Grievance Officer's email and phone are checked at least every 2 hours during the day and alerts forward to phone.
- Every request is checked for authenticity (official email domain, signed order) before data is shared. Requests are logged with what was given.
- Anonymous messages keep the sender's identity so it can be shared on a lawful order; users are told this in the Terms.
- AI-made content (Soulmoji, Referee verdicts, translations) carries a visible label and, for images, an embedded AI marker in the file metadata.
- Ads are reviewed before they go live; betting and real-money gaming, tobacco, alcohol and surrogate ads, and miracle-cure claims are refused.

**Copyright** (modelled on Instagram and Facebook, within the Copyright Rules 2013, Rule 75)

1. A copyright owner or their authorised agent files the in-app or public Report copyright form: identity, the work, proof of ownership, the Soulink link, and signed statements including an undertaking to sue within 21 days.
2. The team decides within 36 hours, the limit in Rule 75; a reminder goes to the copyright inbox at 24 hours. A valid report takes the content down; viewers see that it is unavailable because of a copyright complaint.
3. The uploader is told why, with the reporter's name and email, and can contest in Settings › Account status.
4. If contested and no court order arrives within 21 days, the content is restored automatically and the strike removed.
5. Strikes last 12 months: 1 is a warning, 2 blocks posting for 7 days, 3 removes the account through the ban process.
6. Music: the Creative Commons library (commercial-use licences only) and the video's own sound. Deezer and songs uploaded from the phone are off in production; where allowed, the uploader must confirm they hold the rights.

## 14. Backups and business continuity

Soulink must be able to bring the app back within 8 hours and lose no more than 1 hour of data.

- **Database:** Azure SQL automatic backups with point-in-time restore (35 days). One long-term weekly backup kept for 4 weeks.
- **Media:** stored in Azure Blob Storage with soft delete on and geo-redundant copies within India (Central and South India).
- **Code and configuration:** in GitHub; production settings are written down (without secret values) so a new server can be built from scratch.
- **Restore test:** every 3 months, restore the database to a test copy and check that the app runs against it. Record the date and how long it took.
- **Outage message:** if the app is down for more than 30 minutes, post a notice on the pitch site and in app stores' support channels.
- **Key people:** both founders know how to restore and redeploy; the steps are written in docs/CLOUD-HOSTING.md and kept current.

## 15. People and devices

Most breaches at small companies start with a lost laptop or a phished password, so these rules apply to everyone, founders included.

**Devices used for Soulink**

- Full-disk encryption on (BitLocker on Windows, FileVault on Mac); screen lock after 5 minutes; operating system and browser updates installed within 14 days.
- Antivirus on (Microsoft Defender is enough).
- No production data stored on the device. Development databases hold test data only.
- A lost or stolen device is reported to the Security lead within 1 hour; its sessions and secrets are changed the same day.

**Joining**

- Signs an NDA and confidentiality clause covering user data before getting any access.
- Reads this policy and the Privacy Policy and confirms in writing.
- Gets only the access their work needs (section 4).

**Leaving**

- All access removed the same day: GitHub, Azure, Razorpay, MSG91, admin flag, password manager.
- Shared secrets they knew are changed within 24 hours.
- Company data on their devices is deleted and they confirm it in writing.

**Training**

- Everyone does a 1-hour session at joining and each year: phishing, handling user data, reporting incidents, takedown deadlines.
- Once the team reaches 10 people, set up the Internal Committee under the POSH Act.

## 16. Control register

Each control below maps to a section of this policy and names the evidence an auditor, investor or the Data Protection Board can ask to see.

| Control | Section | How it is met | Evidence |
| --- | --- | --- | --- |
| Login by one-time code | 4 | SMS through MSG91 with DLT-registered sender ID and templates, or email; hashed, 5 minutes, 5 tries | DLT registration, OTP service settings |
| Two-factor login on every admin account | 4 | Authenticator app on Azure, GitHub, Razorpay, MSG91, domain | Quarterly access review |
| Least privilege and access reviews | 4 | Named accounts, app database user without admin rights, reviews every 3 months | Access review records |
| Admin audit trail | 4, 8 | Every admin action and Restricted-data read logged with reason | Log Analytics queries |
| Admin scripts kept off production | 4 | Scripts refuse the production database without a logged approval | Script guard in code, approval log |
| Server-side session end | 4 | Logout and account deletion revoke the session on the server | Automated tests |
| Encryption in transit | 5 | HTTPS with TLS 1.2+, Azure Front Door, encrypted database connection | SSL Labs report |
| Encryption at rest | 5 | Azure SQL TDE and Blob encryption, keys in Key Vault | Azure configuration export |
| Face fingerprints encrypted in the app | 5 | AES-256-GCM with a Key Vault key; never sent to vendors | Code review, tests |
| Secrets management | 5 | Azure Key Vault, yearly rotation, GitHub secret scanning | Key Vault access log |
| Secure development | 6 | Protected deploy branch, reviewed changes, tests, Dependabot, OWASP checks | GitHub settings, CI history |
| Restricted CORS and security headers | 6 | Only Soulink's own addresses; Helmet; rate limits; Zod checks | Code, penetration test report |
| Data in India | 7 | App, database, media, logs in Central India; backups in South India | Azure resource list |
| Network isolation | 7 | Private endpoints for database and storage; web application firewall | Azure network configuration |
| Logs kept 1 year in India, clocks on NIC/NPL | 8 | Azure Log Analytics with 365-day retention; NTP settings | Retention policy, NTP config |
| Security alerts | 8 | Alerts to both founders for the events in section 8 | Alert rules, alert history |
| CERT-In readiness | 2, 9 | Point of contact registered; 6-hour reporting; templates ready | CERT-In registration, incident log |
| Breach notification | 9 | 72-hour report to the Data Protection Board, user notices | Templates, incident log |
| Vendor control | 10 | Data processing terms, AI training off, vendor list kept current | Vendor register |
| Retention and deletion | 11 | Scheduled purge jobs for each class in section 11 | Job logs |
| Consent records | 12 | Terms, Privacy and face-scan consent stored with version and time; notices in 22 languages | Consent table, app screens |
| User rights in the app | 12 | Download my data, Delete my account, Grievance Officer | App screens, request log |
| Takedowns and lawful requests | 13 | 2-hour and 3-hour takedowns, 24×7 contact, request log | Takedown log |
| AI labels | 13 | Visible labels and metadata markers on AI images | App screens |
| Ad review | 13 | Banned-category list, every ad reviewed before it runs | Ad review log |
| Backups and restore tests | 14 | 35-day point-in-time restore, geo copies, restore test every 3 months | Restore test records |
| Device security | 15 | BitLocker or FileVault, screen lock, Defender, updates | Device checklist |
| People | 15 | NDA, policy sign-off, yearly training, same-day offboarding | HR records |
| Payments | 5 | Razorpay handles all card, UPI and bank data | Razorpay agreement |

An independent penetration test is run before each major release and at least once a year; findings are fixed within 30 days for high and 7 days for critical.

## 17. Review, exceptions and approval

This policy is reviewed every year and also after any serious incident, a move to new hosting, a new kind of personal data, or a change in the law; the next review is due Oct 15, 2027.

- **Exceptions:** anyone who cannot follow a rule asks the Policy owner in writing, says why, what risk it adds and until when. Approved exceptions are logged and expire within 6 months.
- **Breaking the policy:** treated as misconduct; for contractors, a breach of contract. Deliberate misuse of user data is reported to the police.
- **Evidence:** access reviews, restore tests, training records, incident log, vendor checks and exceptions are kept in a compliance folder for at least 3 years. This is what an auditor or the Data Protection Board would ask to see.
- **Legal check:** a lawyer and a CERT-In empanelled auditor review this policy and its controls every year.

|  | Name | Role | Date |
| --- | --- | --- | --- |
| Approved by | Nikhil Cheedella | Founder, Policy owner |  |
| Prepared by | Sai Raghava Ragishetty | Co-founder, Security lead |  |

Version 1.0, effective from approval.
