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
| **Home** | Balance with Start AI / Buy / Sell / More buttons, live AI signal in plain English (“Buy SOL”, “Wait”), price chart with AI forecast, target / safety stop / market mood, open positions |
| **Activity** | Every trade, a live stream of what the AI is thinking, AI copilot chat, prices across exchanges |
| **Performance** | Balance, profit, win rate, balance over time, who made the money, best hours to trade, backtest on past data |
| **How AI decides** | 5-step pipeline, live neural network, the 9 models and their votes, live reasoning, pro chart |

## AI sessions
Press **Start AI** and choose a 1, 5 or 10-minute session. A countdown with live profit appears on the signal card; at the end a report modal shows profit (in $ and SOL), trades, win rate, best trade and the balance curve.

> Temporary demo behaviour: the **1-minute session is scripted** to show a fast, large profit (≈12–18% of the balance). 5- and 10-minute sessions use the real AI bot logic.

A short tutorial opens after the mode is chosen (can be disabled or reopened from **More**).

## Modes
- On every visit a welcome modal asks the user to pick **Demo** or **Real** (nothing is pre-selected).
- **Demo** — $10,000 virtual balance on live prices; the AI bot, copilot and manual trading are fully functional.
- **Real** — shows a warning that the AI bot trades only with wallets holding **at least $50**, then a *Connect wallet* flow (UI only, no wallet logic yet).

## Data
WebSocket + REST from Binance → Bybit → OKX with automatic fallback. If no exchange is reachable, an offline market simulator kicks in (a banner says so).

## Stack
Vite, React, TypeScript, lightweight-charts, framer-motion, zustand. Fonts: Unbounded / Onest / JetBrains Mono. No SVG — icons and logo are CSS, visualisations are canvas.

> AI signals are probabilistic estimates, not financial advice.
