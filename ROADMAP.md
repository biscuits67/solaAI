# Solana AI — design & product roadmap

Review of v5 from three angles: product designer, experienced crypto trader, newcomer.

## A. Trust & credibility (highest priority)
- [ ] ~~Realistic demo results~~ — decision: keep the "wow" 1-minute session for now
- [x] Reasonable position sizes — no "sold 204 SOL" with a 170 SOL balance; explain boost/leverage
- [x] One confidence metric instead of two conflicting ones (73% vs 5/9)
- [x] AI does not propose a trade when the expected move is smaller than fees + spread
- [x] Stops/targets sized to real volatility, not 0.15% away from entry
- [x] Show realised vs unrealised P&L and fees paid per session
- [x] Public "AI track record" page: signal history with hit-rate, honest losses included
- [x] Short methodology + risk disclosure page (what the AI is, what it is not)

## B. Newcomer clarity
- [x] "Sell = profit if the price goes down" explained under the signal
- [x] (?) tooltips for every term: safety stop, target, boost, confidence, session
- [x] Fixed AI forecast horizon (e.g. 1 h), independent from the chart timeframe toggle
- [x] Remove duplicated info (mood / expected price shown twice)
- [x] Before a session: "AI will use up to $X · max possible loss $Y · fees ~$Z"
- [x] Empty states that teach (first visit → one clear next step)
- [x] Glossary / FAQ drawer

## C. Visual hierarchy & polish
- [x] One hero block: signal + explanation + risk summary + start button; balance & chart below
- [x] Min text size 13px, higher contrast for secondary text (WCAG AA)
- [x] Unified money format (`$` always first, same font for all amounts)
- [x] Price axis + crosshair labels on the home chart
- [x] Human status bar ("Live · Binance · 42 ms"), no debug-looking text
- [x] Consistent spacing scale (4/8/12/16/24/32/48) and radius scale
- [x] Skeleton loaders that match final layout (no layout jumps)
- [x] Micro-interactions: number roll, button press, success haptics-style feedback
- [ ] Light theme (optional)

## D. Trader features (for experienced users)
- [ ] Pro mode toggle: shows indicators, leverage, order book depth, raw scores
- [x] Session settings: max loss limit, max trades, take-profit for the whole session
- [ ] Notifications (browser push / Telegram) on signal change and session end
- [ ] Export trade history (CSV)
- [ ] More pairs later (JUP, BONK, WIF, JTO) — architecture already supports adapters
- [ ] Multi-timeframe confirmation (1m + 15m + 1h agree → higher confidence)

## E. Real mode (later)
- [ ] Phantom / Solflare / Backpack via Solana Wallet Adapter
- [ ] Execution through Jupiter aggregator (spot) — decide: DEX vs CEX API
- [ ] $50 minimum balance check, simulation before signing, slippage control
- [ ] Transaction history from chain, explorer links (Solscan)
- [ ] Security page: non-custodial, what permissions are requested

## F. Brand & marketing
- [ ] Landing page before the app (hero, how it works, track record, FAQ, CTA)
- [ ] ~~Own logo mark~~ — decision: keep the Solana logo (current mark is the Solana logo — trademark risk for a public product)
- [ ] OG image / favicon set / app icon for "Add to Home Screen" (PWA)
- [ ] Domain, analytics, legal pages (Terms, Privacy, Risk disclosure)

## G. Engineering
- [ ] Deploy (Vercel / Netlify) + CORS proxy for exchanges blocked in some regions
- [x] Code-split the chart library (bundle is ~660 KB)
- [x] Error boundary + offline/reconnect banner
- [ ] Unit tests for AI engine, trading engine and sessions
- [ ] Optional real LLM (Claude) for copilot & explanations via a small backend

## H. Design review #2 — page by page
Decisions: 1-minute session keeps the "wow" result (+12–18%) for now; logo stays Solana.

### System-wide
- [x] Two design languages are mixed: leftovers from v1/v2 (mono "k" badges like `chat`, `Arbitrage`, glowing range thumbs, glass segmented controls, Pro-chart toggles) vs the fintech style — unify every control
- [x] Zero is shown as profit (`+$0.00` in green) — zero/empty values must be neutral grey or "—"
- [x] Equal-height grid rows stretch empty cards (Activity "Your trades" ~700px of nothing) — align to content, not to the neighbour
- [x] Amber "exchanges unreachable" banner takes a full row on every page — move to the status bar as a small state
- [x] Every tab change replays a staggered blur entrance — premium apps animate once, subtly; keep page transitions under 200 ms
- [x] No keyboard focus styles — add visible focus rings
- [x] Layout jumps when blocks appear/disappear (open positions, session panel) — reserve space or animate height
- [x] On wide screens (1920+) content sits in a narrow column with large empty sides — scale grid / max-width ~1600
- [x] App footer is landing-sized — use a slim one-line footer inside the app, keep the big one for the landing page
- [x] Toasts stack duplicates ("AI bot stopped" + "Session complete") — one meaningful toast per event
- [x] Microcopy guide: one tone of voice (short, calm, second person), consistent capitalisation

### Home
- [x] Signal card: dead space between stats and button; button far from the content it acts on
- [x] Chart: no price scale, overlapping time labels at small ranges

### Activity
- [x] Empty "Your trades" should teach the next step and be compact
- [x] Thought stream double-codes state (coloured bar + coloured mono caps chip) — keep one, use sentence-case labels
- [x] Copilot: disabled Send looks broken; huge empty chat area
- [x] Exchanges widget with 5× "no access" looks broken — hide unavailable venues or collapse the card

### Performance
- [x] New user sees a dead page: zeros, flat line, empty heatmap — needs a real empty state ("Run your first session") or sample data
- [x] Winning trades `0%` + amber ring for "no trades" reads as failure — show "—"
- [x] Heatmap of 168 empty cells is noise — show only after ~10 trades
- [x] Balance chart: overlapping labels, flat line with 1 point
- [x] Backtest: four different control types in one row, jargon ("Period per candle"), long paragraph — simplify to "Strategy · Period · Run"

### How AI decides
- [x] Neural network canvas is the hero but labels are small and low-contrast
- [x] Pro chart toggles use the old visual style

## I. Motion & animation review
- [x] Too many infinite animations at once (pulsing dots in status bar / signal pill / cards, sheen, floating circles, grain, particles, ripples) — they compete; allow max one "live" pulse per screen
- [x] Staggered blur entrance on every tab switch feels slow — first load only; tab switch = 150–200 ms crossfade
- [ ] ~~`filter: blur()`~~ — decision: keep blur animations in enter/exit animations (modals, toasts, titles) is GPU-heavy and janky on laptops — use opacity + transform only
- [x] Price rolls/counts every tick → constant visual noise; prices should tick with a brief colour flash, only balance/profit count up
- [x] Meaningful moments have no motion: signal change (Wait → Sell), trade opened/closed, balance updated after a trade — these deserve the animation budget
- [x] Charts animate only on first draw and then jump on new data — smooth morph between datasets / timeframe switches
- [x] One easing curve and random durations (0.35–1.6 s) everywhere — define a motion system:
  - durations: 120 (micro) · 200 (UI) · 320 (panels) · 600 (story moments)
  - easings: standard, emphasized, spring for physical elements (switches, sheets)
- [x] Hover/press states incomplete: cards only change border, rows have no hover, no pressed state on cards
- [x] Skeleton → content swaps without a crossfade
- [x] `prefers-reduced-motion` is handled in CSS only — framer-motion ignores it; wrap the app in `MotionConfig reducedMotion="user"`
- [x] Confetti covers the profit number — confine it to the edges / behind content


## Status (v6)
Sections A, B, C, H and I are done (except the items marked as decisions above and the optional light theme). Next candidates: D (Pro mode, notifications, CSV export), F (landing page), G (deploy, tests), E (real wallet trading).
