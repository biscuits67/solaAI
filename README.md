# Solana AI — neural trading terminal for SOL

A glass, AI-first trading terminal for SOL/USDT: live CEX market data, a 9-expert AI ensemble you can watch think in real time, price forecasts, an autonomous AI trading bot, a chat copilot and a backtester.

## Run

```bash
npm install      # on Windows PowerShell use: npm.cmd install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Screens

| Tab | What it shows |
| --- | --- |
| **Home** | One hero block: the AI signal in plain English, confidence / target / safety stop, and a session starter that shows how much the AI may use, the max loss and fees before you press Start. Below: balance with Buy / Sell / History / Settings, price chart with price scale and AI forecast, "Why the AI thinks so". |
| **Activity** | Every trade, a live stream of the AI's reasoning, AI copilot chat, SOL across exchanges |
| **Performance** | Balance, profit, win rate, fees, balance over time, who made the money, best hours (after 10 trades), honest **AI track record** (past signals checked 2 h later, losses included), strategy test on past data |
| **How AI decides** | 5-step pipeline, live neural network, the 9 models and their votes, live reasoning, what the AI is / is not, your protection, Pro chart |

Help & glossary (the **?** button) explains every term; (?) bubbles next to terms do the same in place.

## AI sessions
Pick 1, 5 or 10 minutes in the hero block and press **Start**. You see in advance how much the AI may use, the max loss (the session stops automatically if it is reached) and estimated fees. A countdown with live profit appears on the signal card; at the end a report modal shows profit (in $ and SOL), trades, win rate, best trade and the balance curve.

> Temporary demo behaviour: the **1-minute session is scripted** to show a fast, large profit (≈12–18% of the balance). 5- and 10-minute sessions use the real AI logic, which only trades when the expected move beats fees.

A short tutorial opens after the mode is chosen (can be disabled or reopened from **More**).

## Modes
- On every visit a welcome modal asks the user to pick **Demo** or **Real** (nothing is pre-selected).
- **Demo** — $10,000 virtual balance on live prices; the AI bot, copilot and manual trading are fully functional.
- **Real** — shows a warning that the AI bot trades only with wallets holding **at least $50**, then a *Connect wallet* flow (UI only, no wallet logic yet).

## Data
WebSocket + REST from Binance → Bybit → OKX with automatic fallback. If no exchange is reachable, an offline market simulator kicks in (a banner says so).

## Stack
Vite, React, TypeScript, lightweight-charts, framer-motion, zustand. Fonts: Geist / Geist Mono. No SVG — icons and logo are CSS, visualisations are canvas.

> AI signals are probabilistic estimates, not financial advice.
