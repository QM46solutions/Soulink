# Soulink design rules (frozen 2026-09-29)

The welcome screen is the reference design. Every new screen follows these rules.

| Element | Rule | Code |
|---|---|---|
| Screen layout | Starfield background, back arrow top-left, content centred, 24px side padding, no scrollbar | `BrandScreen` in `mobile/src/components/BrandScreen.js` |
| Screen header | Big gradient "Soulink" wordmark, then a one-line title and a short grey subtitle, all centred | `BrandHeader` |
| Text links | One centred grey line with a purple link, e.g. "New to Soulink? Create account" | `LinkLine` |
| Buttons | 56px tall, fully rounded, purple→pink gradient, lift + glow on hover | `Button` in `components/ui.js` |
| Text fields | 56px tall, fully rounded, label above in small caps, purple glow ring when typing | `Input` in `components/ui.js` |
| Phone/email field | Rounded field with a round gradient arrow button inside it | `ContactEntry` |
| Choices | Rounded chips, centred | `Chip` |
| Fonts | Syne (titles), Inter (text), Space Mono (small tech labels) | `lib/theme.js` |
| Colours | void #08070d, soul #7c5cfc, aura #b08fff, spark #ff6b9d, mint #42e8c0, gold #f5c842 | `lib/theme.js` |
| Browser preview | App shown inside a phone-sized frame (412px wide) | `PhoneFrame` in `app/_layout.js` |

Principles: fewest taps possible, auto-advance where safe (a code checks itself on the 6th digit), long forms split into short steps with a progress bar, no dead or disabled features shown.
