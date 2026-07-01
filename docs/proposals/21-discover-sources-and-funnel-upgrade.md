# Proposal 21 — /discover upgrade: verified sources, rotating lenses, two-phase funnel

**Date:** 2026-07-01 · **Status:** proposed (pending owner ok) · **Area:** plugin (`/pandacorp:discover`, `researcher`)

## Problem

After the 2026-06-26 memo-pitch redesign (proposal 10), the owner still rejects or shrugs at every discovery recommendation: nothing feels "wow", relevant, or worth building. Board evidence (17 cards):

- **Every Stream-A (general) card was discarded** with `profile_alignment: low` — all generic B2B SaaS (agency reports, freelancer CRM, multichannel seller assistant, token budget manager).
- **Stream B (profile) exhausted the collector niche**: the board already covers its pains (tracker, alerts, authentication, preorders, storefront, binder). New runs produce re-scopes/duplicates the owner discards ("es lo mismo que PandaTrack").
- Pending-but-meh cards leave **no signal** — the skill only learns from discards.
- The owner explicitly asked for a hunting ground the skill lacks: **improving the UX of mainstream apps** (browser extensions for YouTube/Gmail/Spotify-style products) mined from user complaints.

Root cause: the June redesign fixed **presentation and curation** (gates, memo-pitch) but not **candidate generation**. Garbage in → four beautiful memos of mediocre ideas.

## Research (2 agents, 2026-07-01, live access-tested)

### Source audit — what the agent can actually fetch today (no login)

| Source | Access | Verdict |
|---|---|---|
| G2 reviews | ❌ 403 | DROP — also structurally B2B (the #1 cause of the skew) |
| Trustpilot | ❌ 403 | DROP — services skew, low yield |
| X/Twitter search | ❌ 402 login-wall | DROP as agent source |
| Google Play reviews | ❌ JS-loaded | DROP — use Apple only |
| reddit.com direct fetch | ❌ blocked | Mine via WebSearch snippets only; query mechanics matter (ONE short quoted phrase + loose terms; multi-quoted queries return zero) |
| Trend reports / listicles | (readable) | DEMOTE — where the generic B2B ideas come from; context only, never a generator |
| Capterra | ✅ | Keep only for deliberate B2B evaluation |
| Apple App Store reviews + charts | ✅ | KEEP/ADD — consumer-heavy, end-to-end minable |
| **Chrome Web Store reviews** (sortable 1★) | ✅ | **ADD — top priority**: consumer-native, aims at the extension form factor |
| **Ask HN via Algolia API** (`hn.algolia.com/api/v1/search?query=...&tags=ask_hn`) | ✅ free JSON | **ADD** — explicit unmet-need asks, best signal/noise tested |
| **Canny public boards** (`<product>.canny.io`) | ✅ with vote counts | **ADD** — quantified demand for feature gaps |
| **AlternativeTo.net** | ✅ incl. complaints | **ADD** — seed with consumer apps the niche uses |
| **Microns.io listings** (price + ARR visible) | ✅ | **ADD as WTP oracle** — before carding, check the category ever sells with real ARR |
| Google product forums (support.google.com communities) | ✅ | ADD for mainstream-app complaint mining |
| Pain-point SEO (autocomplete + "People also ask" + judge answer quality) | ✅ | ADD — validates distribution together with the pain (HeadshotPro playbook) |
| TikTok/YouTube comments, Discord, Facebook groups | ❌ agent | Owner-manual only (see Change 4) |

Practitioner consensus on WTP evidence, ranked: (1) people already paying for a mediocre solution and complaining; (2) real behavior over stated intent; (3) high-buying-intent search demand; (4) pain intensity × frequency across communities; (5) visible workarounds. Documented solo-builder successes cluster on **own itch / own audience** (TypingMind $45k/mo, HabitKit ~$30k/mo) and **keyword-first** — never "mined a trend report".

### App-enhancement (extension) space — verdict: fertile, with guardrails

- **Evidence**: Unhook 1M users; GMass ~$130k/mo (Gmail); Closet Tools $38-41k MRR solo; Easy Folders $3.7k MRR in 6 months; 7TV ~3M users at $3.99/mo. Counter-evidence: spray-and-pray portfolios earn ~$20/mo total — one deep pain beats sixteen gadgets.
- **Platform hostility map**: 🔴 WhatsApp, LinkedIn (user-account bans), Spotify-API companions (endpoints cut Nov 2024), YouTube ad-blocking. 🟢 tolerant: YouTube UX-mods, Steam, Gmail/GCal, Twitch, Notion. Manifest V3 kills network-blocking, NOT UI content-scripts (our lane).
- **Hottest targets now**: (1) YouTube — 2025-26 redesign anger is a ready spec list; (2) Steam — perfect fit with the owner's geek TikTok audience; (3) Gmail/GCal — where the money is, but distribution ≠ his TikTok.
- **Monetization from Peru — verified**: Stripe NOT available; **Polar ✅ (already the factory default), Paddle ✅ (Payoneer payout), Gumroad ✅ (local bank)**; Lemon Squeezy unconfirmed + in limbo; ExtensionPay ❌ (needs Stripe). Freemium unlock $3-19/mo by audience; license keys via MoR.
- **TikTok distribution is proven for extensions** (Tactiq: $1,820 → 150k users) — when the extension targets the channel's audience.

## The plan — 4 changes

### Change 1 — Replace the source list with a verified mining playbook
New file `plugin/skills/discover/sources.md`: per-source access status, example queries, mining mechanics (incl. the Reddit-via-WebSearch query pattern), the WTP-oracle step (Microns), and the platform hostility map + Peru-payments table. `discover` SKILL.md and `researcher.md` reference it instead of the current hardcoded "Reddit, forums, 1-2★ G2/Capterra/App Store/Trustpilot, social, trends" line. Researchers stop improvising queries against sources that 403.

### Change 2 — Kill the A/B 50/50; rotate expedition lenses
Each run picks 2-3 lenses (declared in the report; `$ARGUMENTS` can pin one):
1. **App-enhancement** (new): mine complaints of tolerant mainstream apps → extension/companion candidates. Codified anti-picks: WhatsApp, LinkedIn, Spotify-API, YouTube ads.
2. **Owner identities beyond collecting**: TikTok creator, frontend+AI dev, Peruvian SMB context, gamer/anime consumer. **Collector lens goes dormant** (board-saturated) unless genuinely new signal appears.
3. **Own-itch / QoL personal**: pains from the owner's own workflows (the success-story cluster).
4. **Incumbent challenger** (upgraded from "calibration" to a full generative lens, owner requests 2026-07-01): target a *successful* SaaS with many paying users and take a slice, via two attack modes that can combine:
   - **Mode A — AI-first rebuild of ONE workflow.** Evidence at every scale: Gamma ($100M ARR, ~50 people, AI-first PowerPoint — [Businesswire](https://www.businesswire.com/news/home/20251110805751/en/Gamma-Surpasses-$100M-ARR-Raises-at-$2.1B-Valuation-as-It-Replaces-PowerPoint-for-the-AI-Era)), Cursor ($100M→$300M ARR vs GitHub Copilot's head start), indie-scale TypingMind ($45k/mo improving ChatGPT's UI). The structural window: incumbents bolt AI on as an add-on; they can't rebuild their core around it without breaking legacy customers.
   - **Mode B — 80/20 unbundling.** Take a bloated/overwhelming suite and ship ONLY the feature people actually pay for, radically simpler and cheaper. Canonical solo evidence: Carrd (one-page sites unbundled from website builders — [$1M ARR solo AMA](https://www.indiehackers.com/post/hi-im-aj-maker-of-carrd-and-after-2-5m-sites-1m-arr-and-a-funding-round-probably-time-for-an-ama-1b7fcf52fe), [$2M ARR by limiting features](https://www.indiehackers.com/post/tech/growing-carrd-to-2m-arr-in-a-crowded-market-with-zero-marketing-by-limiting-features-dbeoP4bDlEL3zzsivdgj)), Tally ("free simple Typeform" — [$150k MRR by doing less, better](https://blog.tally.so/bootstrapping-to-150k-mrr-by-doing-less-better/)). This is the strongest structural wedge of all: the incumbent CANNOT match the price/simplicity without cannibalizing its suite pricing — and it naturally yields micro/small builds, the factory's preferred band.
   **Codified rules (the red-team):** (a) never rebuild the suite — one workflow (A) or the 20% feature (B); pick **single-player/prosumer incumbents** (form builders, budget managers, resume tools) where switching cost is low; team-locked B2B (Jira-class) is out of the micro/small band and its switching costs are brutal. (b) "same + AI button" is NOT a wedge — the incumbent adds that in a sprint (PhotoAI's growth flattened once incumbents caught up); the wedge must be structural: AI **is** the flow, radical simplicity, price, or Spanish/LATAM-native. (c) For unbundling: the extracted feature must be a **retention/payment driver** (not a commodity that's free elsewhere) and must be **separable** (its value can't depend on the suite's integrated data). (d) The filter vs the dead-wrapper graveyard is complaint evidence: "users love X but hate Y" / "too complex, I only use X" / "too expensive for the one thing I use" — mined from the incumbent's own 1-2★ reviews (Capterra IS legitimately in scope for this lens, and fetchable), Canny board, AlternativeTo comments, "simpler alternative to X" search demand, Microns ARR for the category. (e) Founder-fit for this lens is measured as "can he reach the first 10 users" (pain-point SEO/communities/word-of-mouth à la Carrd), not "does he live the problem" — gate 3a must know this.

### Change 3 — Two-phase funnel: taste enters BEFORE the spend
Phase 1 (cheap): 8-12 **teasers** — one-liner bet + strongest single evidence link + complexity bucket. No memos, no cards. Phase 2: the owner picks the 2-3 that spark; only those go through the full gates + memo-pitch + carding. Non-picked teasers get a one-line reaction capture (meh/no + why) appended to the run log and distilled into profile attraction/rejection patterns — the "pending-but-meh" signal that today evaporates. Requires no MC change initially (teasers render in chat; card flow unchanged).

### Change 4 — The owner's TikTok as source #1 (embedded exploration)
The agent cannot read TikTok; the owner can. Light ritual: paste recurring comment/DM themes (or ask the audience directly) → `discover` treats them as seed candidates in the own-itch/audience lens. Distribution note added to gates: a consumer extension aimed at his audience (Steam/YouTube/anime) gets `distribution_channel: @pandadcollector`; Gmail-style prosumer tools must name CWS-SEO/Reddit instead.

## Implementation (after owner ok)

`plugin/skills/discover/SKILL.md` (steps 1-2 rework + two-phase flow), new `plugin/skills/discover/sources.md`, `plugin/agents/researcher.md` (query mechanics + source playbook pointer), `factory/profile.md` (lenses + attraction patterns section), plugin MINOR bump, decision-log entries (plugin + ideas). MC Propuesta tab untouched; optional later: teaser view + reaction capture (FRD-02 follow-up).
