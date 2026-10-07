# Solana AI — design & product roadmap

Review of v5 from three angles: product designer, experienced crypto trader, newcomer.

## A. Trust & credibility (highest priority)
- [ ] Realistic demo results: 1-min session +0.5–2.5%, occasional losing trade (decision pending: keep "wow" mode for demos?)
- [ ] Reasonable position sizes — no "sold 204 SOL" with a 170 SOL balance; explain boost/leverage
- [ ] One confidence metric instead of two conflicting ones (73% vs 5/9)
- [ ] AI does not propose a trade when the expected move is smaller than fees + spread
- [ ] Stops/targets sized to real volatility, not 0.15% away from entry
- [ ] Show realised vs unrealised P&L and fees paid per session
- [ ] Public "AI track record" page: signal history with hit-rate, honest losses included
- [ ] Short methodology + risk disclosure page (what the AI is, what it is not)

## B. Newcomer clarity
- [ ] "Sell = profit if the price goes down" explained under the signal
- [ ] (?) tooltips for every term: safety stop, target, boost, confidence, session
- [ ] Fixed AI forecast horizon (e.g. 1 h), independent from the chart timeframe toggle
- [ ] Remove duplicated info (mood / expected price shown twice)
- [ ] Before a session: "AI will use up to $X · max possible loss $Y · fees ~$Z"
- [ ] Empty states that teach (first visit → one clear next step)
- [ ] Glossary / FAQ drawer

## C. Visual hierarchy & polish
- [ ] One hero block: signal + explanation + risk summary + start button; balance & chart below
- [ ] Min text size 13px, higher contrast for secondary text (WCAG AA)
- [ ] Unified money format (`$` always first, same font for all amounts)
- [ ] Price axis + crosshair labels on the home chart
- [ ] Human status bar ("Live · Binance · 42 ms"), no debug-looking text
- [ ] Consistent spacing scale (4/8/12/16/24/32/48) and radius scale
- [ ] Skeleton loaders that match final layout (no layout jumps)
- [ ] Micro-interactions: number roll, button press, success haptics-style feedback
- [ ] Light theme (optional)

## D. Trader features (for experienced users)
- [ ] Pro mode toggle: shows indicators, leverage, order book depth, raw scores
- [ ] Session settings: max loss limit, max trades, take-profit for the whole session
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
- [ ] Own logo mark + wordmark (current mark is the Solana logo — trademark risk for a public product)
- [ ] OG image / favicon set / app icon for "Add to Home Screen" (PWA)
- [ ] Domain, analytics, legal pages (Terms, Privacy, Risk disclosure)

## G. Engineering
- [ ] Deploy (Vercel / Netlify) + CORS proxy for exchanges blocked in some regions
- [ ] Code-split the chart library (bundle is ~660 KB)
- [ ] Error boundary + offline/reconnect banner
- [ ] Unit tests for AI engine, trading engine and sessions
- [ ] Optional real LLM (Claude) for copilot & explanations via a small backend
