// Soulink's legal pages: Terms of Use, Privacy Policy, Community Guidelines, Refunds and the Grievance Officer.
// Written for India (IT Act 2000 + IT Intermediary Rules 2021 as amended, DPDP Act 2023 + DPDP Rules 2025,
// Consumer Protection (E-Commerce) Rules 2020, ASCI code). Templates until a lawyer reviews them.
// When the text changes in a way people must agree to again, change TERMS_VERSION.

export const TERMS_VERSION = '2026-10-17';

export const LEGAL = {
  company: 'QM46 Solutions Private Limited',
  brand: 'Soulink',
  address: 'Hyderabad, Telangana, India', // TODO: full registered office address
  grievanceOfficer: 'Sai Raghava Ragishetty',
  grievanceEmail: 'Rragishetty@gmail.com',
  founder: 'Nikhil Cheedella',
  updated: '17 October 2026',
};

const G = LEGAL;

export const DOCS = {
  terms: {
    title: 'Terms of Use',
    intro: `These terms are an agreement between you and ${G.company} ("we", "Soulink"), ${G.address}. By creating an account or using Soulink you agree to them, to our Privacy Policy and to our Community Guidelines.`,
    sections: [
      ['Who can use Soulink', [
        'You must be 18 or older. We do not knowingly allow anyone under 18, and we remove accounts we find belong to a minor.',
        'One person, one account. Your account is tied to a live face scan so that every profile belongs to a real person. You may not create an account for someone else, pretend to be someone, or sell or share your account.',
      ]],
      ['Your content', [
        'You own what you post (photos, videos, Sparks, comments, messages). You give Soulink a non-exclusive, royalty-free licence to store, show and distribute it inside Soulink so the service works, for as long as it stays on Soulink.',
        'Only post what you have the right to share. Do not upload songs, film clips or other people\'s work unless you have permission. We remove content when the owner asks us to.',
        'You are responsible for what you post. Content must follow the Community Guidelines and Indian law.',
      ]],
      ['What is not allowed', [
        'Content that is obscene, pornographic, invasive of someone\'s privacy (including their body), harmful to children, harassing, hateful or insulting on grounds of religion, caste, gender or ethnicity, defamatory, or that promotes violence, gambling, money laundering or self-harm.',
        'Impersonating any person, deepfakes or AI images of a real person without their consent, and false or misleading information presented as fact.',
        'Content that threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with other countries or public order, or that infringes a patent, trademark or copyright.',
        'Malware, scraping, spam, fake engagement, or trying to get around our safety systems, including the face verification.',
      ]],
      ['Copyright and music', [
        'Only post music, video, photos and text you made yourself or have permission to use. Your video\'s own sound is always fine. Songs from films and record labels usually need the owner\'s licence.',
        'Copyright owners can report a Spark or post through the "It uses my copyrighted work" option or at Report copyright. We review reports within 36 hours. If we remove your content, we tell you who complained (their name and email) and why, and you can contest it in Settings › Account status. If you contest and the owner does not send us a court order within 21 days, it is restored, as India\'s Copyright Rules 2013 provide.',
        'Each upheld removal is a copyright strike, which lasts 12 months. 1 strike is a warning, 2 strikes stop you posting for 7 days, and 3 strikes in 12 months remove your account.',
      ]],
      ['AI features', [
        'Soulmoji stickers, the Argue Referee verdict and chat translations are made by AI. They are labelled as AI-generated. A Referee verdict is a fun, neutral opinion, not legal, medical or financial advice.',
        'Do not use our AI tools to make unlawful content or to make content of a real person without their consent. Doing so can lead to removal, suspension of your account and reporting to the authorities as required by law.',
      ]],
      ['Safety and enforcement', [
        'Anyone can mark a post, Spark or comment as offensive. Content marked by many people is hidden or suspended automatically, and we review reports.',
        'We may remove content or limit, suspend or close accounts that break these terms or the law, and we act on lawful orders from courts and government within the time the law requires.',
        'If your content is removed, you can ask our Grievance Officer to review the decision.',
      ]],
      ['Paid features', [
        'Some features cost money: Premium, a one-time message to someone you are not connected with, Spread around (promoting your Spark) and Soul Shop items. Prices are shown in rupees, including GST, before you pay. Payments are handled by our payment partner; we never store your card or bank details.',
        'Refunds and cancellations follow our Refund Policy.',
      ]],
      ['Ads and promotions', [
        'Soulink shows ads from brands. Ads are always marked "Sponsored", and Sparks that creators pay to promote are marked "Promoted". If a brand pays you to post, you must say so in your post (for example #ad), as the ASCI guidelines require.',
      ]],
      ['Our responsibility', [
        'Soulink is an intermediary: we provide the platform and do not check every post before it appears. We are not responsible for what users post or for meetings between users. Meet new people in public places and tell a friend where you are going.',
        'Soulink is provided "as is". To the extent the law allows, our total liability to you is limited to the amount you paid us in the 12 months before the claim.',
      ]],
      ['Pausing, deleting and coming back', [
        'Pause: Settings › Pause my account hides your profile and content and stops notifications. Nothing is deleted; log in again to come back.',
        'Delete: Settings › Delete my account. Your account is hidden at once and deleted after 30 days. Log in before then to cancel. You can also choose to delete everything straight away.',
        'Coming back: download your data before you delete. If you join again with the same phone number or email, Settings › Restore my data brings back your profile details and Soul DNA from that file. Photos, posts and chats cannot be restored.',
      ]],
      ['Removal for breaking the rules', [
        'We may close accounts that break these terms or the law. If we remove an account for serious or repeated violations (for example harassment, sexual content involving anyone without consent, impersonation, fraud or threats), we keep the person\'s name, phone number, email and an encrypted face fingerprint for up to 3 years, only to stop them creating a new account. You can appeal to our Grievance Officer.',
      ]],
      ['Law and disputes', [
        'These terms are governed by the laws of India. Courts in Hyderabad, Telangana have jurisdiction. Please contact our Grievance Officer first; most problems are solved there.',
        'We may update these terms. If a change matters, we will tell you in the app and ask you to agree again.',
      ]],
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what personal data ${G.company} ("Soulink") collects, why, and your rights under the Digital Personal Data Protection Act, 2023. Questions? Write to ${G.grievanceEmail}.`,
    sections: [
      ['What we collect', [
        'Account: phone number or email, username, name, date of birth, gender (optional), city, profession, bio, interests and profile photo.',
        'Face scan: during sign-up the camera checks that you are a real person. We keep only a face fingerprint (a list of numbers), not the scan photos, unless you choose to use the photo as your profile picture.',
        'Soul DNA: your answers to the personality quiz, used to work out compatibility (Soul Score).',
        'What you share: posts, Moments, Sparks, comments, messages, voice notes and Argue cases.',
        'Usage: likes, views, who you connect with, approximate location if you allow it (rounded to about 1 km, never your exact location), device and log data for security.',
      ]],
      ['Why we use it', [
        'To run Soulink: your profile, feed, chats and Sparks.',
        'To keep it real and safe: the face fingerprint stops fake and duplicate accounts; reports and logs help us stop abuse.',
        'To match you with people: Soul DNA and your settings decide who Discover suggests.',
        'To show ads: ads are chosen by where they appear and your city only. We do not build advertising profiles, and we do not sell your personal data.',
        'To meet legal duties, such as answering lawful requests from authorities.',
      ]],
      ['Your consent and choices', [
        'We ask for your consent when you sign up and separately before the face scan. You can withdraw consent at any time by deleting your account; withdrawing does not affect what was lawfully done before.',
        'You control Discover, private account, location, activity-based matching and notifications in Settings. Nobody can find you from a photo of your face.',
      ]],
      ['Who we share it with', [
        'Other users see what you choose to make visible (your profile, posts, Sparks). Chats are only between the people in them.',
        'Service providers who work for us under contract: Microsoft Azure for hosting, database, storage and logs (all in India), Microsoft Translator for translation, AI services for Soulmoji and the Argue Referee, MSG91 for login codes by SMS, an email service for login codes and account notices, and Razorpay for payments. AI services may process the text or photo you send them outside India; they never receive your face fingerprint and may not train on your data.',
        'Authorities, when Indian law requires it.',
      ]],
      ['How long we keep it', [
        'While your account is open, or paused. If you delete your account it is hidden at once and erased after 30 days (or straight away if you choose), unless you log in to cancel.',
        'When the account is erased, your profile, photos, face fingerprint, Soul DNA, posts, Sparks and chats are deleted. For 1 year we keep your name, username, date of birth, city, phone number, email, the dates you joined and left, your consent records, and logs of your logins and actions (device, IP address, time). The DPDP Rules 2025 and IT Rules 2021 require this so we can answer lawful requests; it is used for nothing else and then deleted.',
        'If your account is removed for serious or repeated rule-breaking, we keep your name, contact details and an encrypted face fingerprint for up to 3 years to stop you creating a new account.',
        'Payment and invoice records are kept for 8 years, as tax and company law require.',
      ]],
      ['Your rights', [
        'See your data: Settings › Download my data.',
        'Correct it: edit your profile at any time.',
        'Erase it: Settings › Delete my account.',
        'Complain: write to our Grievance Officer. We answer within 7 days (and always within the 90 days the DPDP Rules allow). If you are not satisfied, you can complain to the Data Protection Board of India.',
        'Nominate someone to exercise these rights if you die or cannot act: write to us.',
      ]],
      ['Security', [
        'Your data is stored in India, encrypted in transit and at rest; face fingerprints are encrypted again with a separate key. Access is limited to the people who need it, and we keep security logs in India to detect misuse. If a data breach affects you, we will tell you and the Data Protection Board as the law requires.',
      ]],
      ['Children', [
        'Soulink is only for people 18 and older. We do not knowingly process children\'s data; if we learn we have, we delete it.',
      ]],
      ['Contact', [
        `${G.grievanceOfficer}, Grievance Officer and data protection contact, ${G.company}, ${G.address}. Email: ${G.grievanceEmail}.`,
      ]],
    ],
  },

  guidelines: {
    title: 'Community Guidelines',
    intro: 'Soulink is for real people making real connections. These rules keep it that way.',
    sections: [
      ['Be real', ['One person, one account. No fake profiles, no impersonation, no AI faces of real people without consent.']],
      ['Be respectful', ['No harassment, bullying, threats, hate speech, or insults about religion, caste, gender, sexuality, region or disability. Respect a "no": stop messaging people who aren\'t interested.']],
      ['Keep it safe', ['No nudity or sexual content, nothing involving minors, no violence, self-harm encouragement, drugs, weapons or scams. Never share someone\'s private photos, phone number or address.']],
      ['Keep it honest', ['No false news presented as fact, no fake engagement, no spam. Mark paid partnerships as ads.']],
      ['Respect creators', ['Post your own work. Use music from Soulink\'s music library, your video\'s own sound, or songs you have the rights to. Copyright owners can report misuse, and 3 copyright strikes in 12 months remove an account.']],
      ['What happens if rules are broken', ['Tap ❗ to mark something offensive. Content many people mark is hidden (comments) or suspended (posts and Sparks). We remove illegal content, limit or close repeat offenders, and report serious crimes to the police.']],
    ],
  },

  refunds: {
    title: 'Refund & Cancellation Policy',
    intro: 'This policy covers everything you pay for on Soulink. Prices include GST.',
    sections: [
      ['Premium', ['You can cancel any time in Settings; Premium stays on until the end of the period you paid for and does not renew after that. If you were charged by mistake, or for a renewal you cancelled before it started, write to us within 7 days for a full refund.']],
      ['One-time message (₹500)', ['If the message could not be delivered because of a fault on our side, we refund it in full. Once delivered it cannot be refunded.']],
      ['Spread around', ['You can stop a Spread at any time. If you stop it within 24 hours of starting, or if your Spark is removed by us without breaking the rules, we refund the unused days.']],
      ['Soul Shop', ['Items can be returned unused within 7 days of delivery for a full refund. Damaged or wrong items are replaced or refunded.']],
      ['How refunds work', [`Write to ${G.grievanceEmail} with your username and payment reference. Approved refunds go back to the original payment method within 7 working days.`]],
    ],
  },

  grievance: {
    title: 'Grievance Officer',
    intro: 'If you have a complaint about content, your account or your personal data, contact our Grievance Officer.',
    sections: [
      ['Contact', [`${G.grievanceOfficer}`, `Email: ${G.grievanceEmail}`, `${G.company}, ${G.address}`]],
      ['What happens next', [
        'We acknowledge your complaint within 24 hours and resolve it within 7 days.',
        'Content showing nudity, sexual acts or impersonation of you, or a deepfake of you, is removed within 2 hours of your complaint.',
        'Tell us your username, a link or screenshot of the content, and what you want us to do.',
      ]],
      ['Copyright', [`Copyright owners: use the "It uses my copyrighted work" option on the Spark or post, or the Report copyright page. Or email ${G.grievanceEmail}. We decide within 36 hours.`]],
      ['Not satisfied?', ['You can appeal to the Grievance Appellate Committee (gac.gov.in) for content decisions, or complain to the Data Protection Board of India about personal data.']],
    ],
  },
};

export const DOC_KEYS = ['terms', 'privacy', 'guidelines', 'refunds', 'grievance'];
