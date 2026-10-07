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
| **AI Brain** | Live neural network visualisation (9 experts → hidden layer → output), 5-stage reasoning pipeline, AI signal gauge & confidence, chart with AI forecast cone / levels / signal markers, live **AI thought stream**, AI trading bot control, forecast, demo equity, chat copilot |
| **Trades** | Equity KPIs, positions / orders / history, manual order panel, PnL by source, PnL heatmap, cross-exchange prices |
| **Backtest** | Replay any of 4 strategies over up to 1000 candles with equity curve, trade markers and stats |

## Modes
- On every visit a welcome modal says you are in **Demo** mode and lets you pick Demo or Real.
- **Demo** — $10,000 virtual balance on live prices; the AI bot, copilot and manual trading are fully functional.
- **Real** — shows a warning that the AI bot trades only with wallets holding **at least $50**, then a *Connect wallet* flow (UI only, no wallet logic yet).

## Data
WebSocket + REST from Binance → Bybit → OKX with automatic fallback. If no exchange is reachable, an offline market simulator kicks in (a banner says so).

## Stack
Vite, React, TypeScript, lightweight-charts, framer-motion, zustand. Fonts: Unbounded / Onest / JetBrains Mono. No SVG — icons and logo are CSS, visualisations are canvas.

> AI signals are probabilistic estimates, not financial advice.
