---
last_verified: 2026-07-01
---

# Discovery sources playbook

Operational mining guide for `/pandacorp:discover` researchers. Every source below was **live access-tested on 2026-07-01** (WebFetch/WebSearch, no login, no API keys). If a fetch pattern stops working, note it here and in the run report — do not silently fall back to trend listicles.

**Prime directive:** first-hand pain evidence only (a real complaint, a real 1-2★ review, a real voted feature request, a real sale). An article *about* trends is context, never evidence. Trend listicles ("50 micro-SaaS ideas for 2026") are BANNED as idea generators — that's where generic B2B me-too ideas come from.

## Access ledger

| Source | Access | Notes |
|---|---|---|
| Chrome Web Store reviews | ✅ fetch | `https://chromewebstore.google.com/detail/<slug>/<id>/reviews` — full texts, sortable lowest-first |
| Hacker News (Algolia API) | ✅ fetch | `https://hn.algolia.com/api/v1/search?query=<q>&tags=ask_hn&numericFilters=points>10` — free JSON |
| Canny public boards | ✅ fetch | `https://<company>.canny.io/` — titles + vote counts |
| AlternativeTo | ✅ fetch | `https://alternativeto.net/software/<app>/` — likes + complaint comments |
| Microns.io | ✅ fetch | listings show asking price + ARR without login |
| Apple App Store | ✅ fetch | product pages render review texts; `https://apps.apple.com/us/charts/iphone` for category mining |
| Capterra | ✅ fetch | B2B directory — use ONLY when deliberately evaluating a B2B incumbent (challenger lens) |
| IndieHackers | ✅ fetch | posts + comments; skews tools-for-builders — use for method/WTP threads, warily for ideas |
| Google product forums | ✅ fetch | `https://support.google.com/<product>/community` — thread titles by category |
| Reddit | ⚠️ WebSearch only | direct fetch blocked; see query mechanics below |
| G2 | ❌ 403 | do not attempt |
| Trustpilot | ❌ 403 | do not attempt |
| X/Twitter search | ❌ 402 login-wall | do not attempt; WebSearch snippets only, low yield |
| Google Play reviews | ❌ JS-loaded | use Apple instead |
| Spotify Idea Exchange | ❌ OAuth-walled | verified redirect to login |
| TikTok / YouTube comments, Discord, Facebook groups | ❌ agent | **owner-manual sources** — the owner harvests and pastes themes (see the skill's TikTok ritual) |

## Query mechanics (verified)

- **WebSearch + Reddit:** multi-term quoted phrases return ZERO results. Use at most ONE short quoted phrase plus loose keywords: `site:reddit.com "is there an app" funko collection`. If empty, relax fully: `reddit funko collection tracking app frustrated`. Per-sub sweeps: `site:reddit.com/r/<sub> <pain> spreadsheet`.
- **Subreddit selection sets the skew.** r/Entrepreneur, r/smallbusiness, r/agency → B2B me-too. Hobby/consumer/QoL subs (the niche's own subs, r/productivity, r/ADHD, r/datacurator, product subs like r/youtube, r/Steam) → consumer ideas.
- **Ask HN phrases that work:** `"is there an app that"`, `"I wish there was"`, `"what do you use for"` — vary and filter by points.
- **Chrome Web Store discovery:** WebSearch `chrome extension "stopped working" OR "wish it could" <niche>`, or fetch a category page, pick 3-4★ extensions with big installs, read their worst reviews (a beloved-but-flawed extension = a fork/improve wedge).
- **Canny board discovery:** WebSearch `site:canny.io <product>` or `"<product>" feedback board`. Gold = high-vote requests that are YEARS old or marked "not planned" — the incumbent won't do it; a companion micro-app/extension can.
- **AlternativeTo seeding:** seed with the consumer apps the target niche actually uses (e.g. Discogs, CLZ, Goodreads, MyAnimeList, Notion, Todoist) and read the *negative* comments on every popular alternative.
- **Pain-point SEO (autocomplete gap):** expand a consumer seed (`how to <pain>` + a…z), harvest "People also ask", then FETCH the top results and judge them — a high-interest query answered only by forum threads and spreadsheets is a distribution-validated gap.

## The willingness-to-pay oracle (mandatory before carding a monetary idea)

Check **Microns.io** (and press roundups of Acquire.com) for the candidate's category: do micro-apps of this kind actually SELL, with real ARR? Practitioner-consensus WTP evidence, ranked:
1. People already paying for a mediocre solution and complaining (paid-app 1-2★ reviews; marketplace listings).
2. Real behavior over stated intent (workarounds, spreadsheets, hiring someone).
3. High-buying-intent search demand with weak answers.
4. Pain intensity × frequency across independent communities (one complaint = outlier; dozens = market).

## Lens → source map

| Lens | Primary sources |
|---|---|
| App-enhancement (extensions) | CWS 1★ reviews · product subreddits via WebSearch · Google product forums · Canny boards · "I wish <app>" WebSearch |
| Owner identities / consumer niches | niche subreddits via WebSearch · Apple App Store 1-2★ · AlternativeTo · Ask HN · autocomplete gaps |
| Own-itch / QoL | the owner's own pasted pains (TikTok comments/DMs, his workflows) · Ask HN QoL asks · HabitKit-style consumer evidence |
| Incumbent challenger (AI-first rebuild / 80-20 unbundle) | the incumbent's Capterra 1-2★ + Canny board + AlternativeTo comments · "simpler alternative to X" search demand · Microns ARR for the category |

## Platform hostility map (app-enhancement + challenger lenses)

- 🔴 **Never**: WhatsApp and LinkedIn (they ban END-USER accounts for third-party tools — the user pays your risk); Spotify companion apps depending on its API (recommendation/audio-features endpoints cut for new apps, Nov 2024); anything that blocks YouTube ads.
- 🟢 **Tolerant, proven at scale**: YouTube UX-mods (Unhook 1M users), Steam (Augmented Steam), Gmail/Google Calendar (GMass, Checker Plus — a decade of tolerance), Twitch (BTTV/7TV), Notion.
- **Manifest V3** kills network-request blocking, NOT UI content-scripts — our lane is safe.
- **Maintenance risk is real**: platform redesigns break extensions (Valve's React rebuild of Steam). Budget it in the complexity bucket.

## Monetization from Perú (verified 2026-07-01)

Stripe does NOT operate in Perú. Working rails: **Polar** (MoR, factory default — Perú on its official list, payouts via Stripe Connect Express which doesn't require Stripe-in-country), **Paddle** (MoR, payout via Payoneer/wire), **Gumroad** (local PE bank account, good for one-time licenses). NOT viable: ExtensionPay (requires a Stripe account), Lemon Squeezy (unconfirmed for Perú + product in limbo post-Stripe-acquisition). Chrome Web Store has no payments — extensions bring their own checkout + license keys. Price anchors that work: consumer extension $3-5/mo, prosumer $8-19/mo, direct-ROI tools $20-30+/mo, one-time $10-30 via Gumroad.
