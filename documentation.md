# Godsview — Project Documentation

> A beginner-friendly breakdown of everything this project does.

---

## 🌍 What Is Godsview?

**Godsview** is a free, open-source **real-time global intelligence dashboard**.

Think of it like a command centre that pulls together news, maps, military activity, financial data, and AI analysis — all in one place, updating live.

You can use it as:
- A **website** → [godsview.app](https://godsview.app)
- A **desktop app** for Windows, macOS, or Linux
- An **installable mobile shortcut** (PWA)

---

## 🗂️ The Four Variants

The same codebase runs four different "flavours" of the dashboard:

| Variant | Focus | URL |
|---|---|---|
| **Godsview** | Geopolitics, military, conflicts | godsview.app |
| **Tech Monitor** | AI, startups, cloud, cybersecurity | tech.godsview.app |
| **Finance Monitor** | Global markets, banks, trade | finance.godsview.app |
| **Happy Monitor** | Positive news & uplifting stories | happy.godsview.app |

You can switch between them with a single click in the header.

---

## 🔑 Core Features (Plain English)

### 1. 🗺️ Interactive 3D Map
- A live, spinning **3D globe** (or flat map if you prefer)
- You can toggle **36+ data layers** on/off, for example:
  - Conflict zones
  - Military bases (220+)
  - Undersea internet cables
  - Oil & gas pipelines
  - Nuclear facilities
  - Satellite-detected wildfires
  - Cyber threat locations
  - Stock exchanges & financial centres
- Markers **cluster together** at low zoom and spread apart when you zoom in
- You can **share the exact map view** via a URL (it saves your zoom level, layers, and region)

---

### 2. 🤖 AI-Powered Summaries
- The **"World Brief"** is an AI-written summary of today's top global events
- It tries to use AI in this order (falls back automatically if one fails):
  1. **Ollama** – runs AI on *your own computer*, totally private
  2. **Groq** – fast cloud AI
  3. **OpenRouter** – another cloud AI option
  4. **Browser AI (T5)** – runs in your browser, no server needed
- Summaries are cached for 24 hours so the AI isn't called thousands of times
- Supports **16 languages**, and will generate summaries in your chosen language

---

### 3. 📰 Live News Feeds
- **150+ RSS news feeds** from sources worldwide, updated continuously
- News is automatically grouped by topic and sorted by severity
- **Custom keyword alerts** — you can set words to watch (e.g., "earthquake", "bitcoin") and get highlighted when they appear
- **Entity linking** — country names, leaders, and organisations in headlines are auto-linked
- **Virtual scrolling** — even with hundreds of articles, the page stays fast

---

### 4. 📺 Live Video Streams
- **8 live TV channels** embedded directly: Bloomberg, Sky News, Al Jazeera, Euronews, DW, France24, CNBC, Al Arabiya
- **19 live webcams** from geopolitical hotspots (Jerusalem, Tehran, Kyiv, Washington DC, etc.)
- Video automatically **pauses when you're idle** to save your battery/data
- Quality can be set to Auto, 360p, 480p, or 720p

---

### 5. 📊 Country Intelligence Briefs
- Click **any country on the map** and get a full intelligence report including:
  - **Instability Score (0–100)** — an AI-calculated risk score for that country
  - AI-written analysis with numbered source citations
  - Top news headlines for that country
  - Active signals (protests, military flights, earthquakes, internet outages, etc.)
  - A **7-day event timeline** chart
  - Prediction market odds (from Polymarket)
  - Nearby infrastructure (cables, pipelines, bases, etc. within 600km)
  - The country's stock market performance
- Briefs can be **exported as JSON, CSV, or PNG image**

---

### 6. 📈 Market & Crypto Intelligence
- Real-time **crypto prices** (Bitcoin, Ethereum, Solana, XRP, and more)
- Bitcoin ETF fund flow tracker
- **Fear & Greed Index** with 30-day history
- Stablecoin health monitor (USDT, USDC, etc.)
- A **7-signal "macro radar"** that gives a composite BUY or CASH verdict
- Oil & gas prices (WTI/Brent crude)

---

### 7. 🛡️ Threat & Security Monitoring
- **Cyber threat map** — live IOCs (malicious servers, malware hosts, phishing sites) plotted on the globe from 6 threat intelligence feeds
- **Military flight tracking** via ADS-B transponders (live aircraft positions)
- **Naval vessel tracking** via AIS (live ship positions)
- **APT threat actor** attribution (named hacker groups linked to countries)
- Detects **internet outages** worldwide (via Cloudflare Radar)
- Monitors **undersea cable health** — alerts when cables are damaged or under repair

---

### 8. 🌡️ Natural Disaster & Climate Monitoring
- **Earthquake alerts** (M4.5+) from USGS, updated every 5 minutes
- Disaster alerts from the UN (GDACS) and NASA (EONET)
- **Wildfire hotspots** detected by NASA satellites
- **Climate anomaly panel** — 15 conflict-prone zones monitored for unusual temperature or rainfall

---

### 9. 🧠 Anomaly & Pattern Detection
- The system learns what "normal" looks like for each region and alerts when something is unusually high (e.g., "Military flights 3× above normal for this time of year")
- **Convergence detection** — if protests, military flights, and earthquakes all happen near the same location at the same time, the system flags it
- **Trending keyword spike detection** — if a word suddenly appears 3× more than usual across all news feeds, it's flagged with an AI-generated summary

---

### 10. 🖥️ Desktop App (Windows, Mac, Linux)
- A fully native desktop application built with **Tauri** (lightweight, not Electron)
- Runs all API processing **locally** on your machine
- **API keys stored securely** in your OS's built-in password manager (not a text file)
- Settings window (Cmd+, / Ctrl+,) for configuring AI providers, API keys, and debug logs
- Auto-checks for updates every 6 hours
- Can run **completely offline** with Ollama for AI

---

### 11. 🌐 Progressive Web App (PWA)
- Can be **installed to your home screen** like a native app
- **Maps work offline** — up to 500 map tiles are cached locally
- Smart caching: news is always fresh, but fonts/images are cached for speed

---

### 12. 🔏 Privacy Modes
The dashboard has three privacy levels:

| Mode | How it works |
|---|---|
| **Web App** | Everything runs in the cloud (Vercel servers). Convenient, no setup needed. |
| **Desktop + Cloud Keys** | App runs locally; your API keys are in your OS keychain, not on a server. |
| **Desktop + Ollama (Air-gapped)** | Everything runs on your machine. No data leaves your computer at all. |

---

### 13. 🌍 Languages & Regions
- The UI is available in **16 languages**: English, French, Spanish, German, Italian, Polish, Portuguese, Dutch, Swedish, Russian, Arabic, Chinese, Japanese, Turkish, Thai, Vietnamese
- **Arabic** and **Hebrew** have full right-to-left layout support
- News feeds switch to local-language sources based on your language setting (e.g., French loads Le Monde, France24)

---

### 14. 🎨 UI & Usability
- **Dark and light themes** — dark by default, toggleable in the header
- **Cmd+K / Ctrl+K command palette** — fuzzy search across all countries, news, layers, and more
- **Panel drag-and-drop** — rearrange the dashboard panels however you like
- **Panel resizing** — drag panel edges to make them taller or shorter
- **Map pin** — pin the map so it stays visible while you scroll
- **Historical playback** — rewind the dashboard to a past snapshot
- **Ultra-wide monitor support** — special L-shaped layout for 2000px+ screens
- **Share stories** to Twitter/X, LinkedIn, WhatsApp, Telegram, Reddit, and Facebook

---

## 🛠️ Technology Used (For the Curious)

| What | Technology |
|---|---|
| Frontend framework | Vite + TypeScript |
| 3D Map | MapLibre GL JS + deck.gl (WebGL) |
| Desktop app | Tauri (Rust-based) |
| AI (local) | Ollama / LM Studio |
| AI (cloud) | Groq, OpenRouter |
| Browser AI | Transformers.js (runs in browser) |
| Charts | D3.js |
| Caching | Redis (Upstash) |
| Hosting | Vercel (Edge Functions) |
| API contracts | Protocol Buffers (proto files) |
| Testing | Playwright (end-to-end) |
| Analytics | PostHog (privacy-first) |

---

## 📁 Project Folder Structure (Simplified)

```
Godsview-main/
├── src/              # All the frontend code (UI, map, panels)
├── api/              # Backend API handlers (news, military, markets, etc.)
├── server/           # Server-side logic
├── proto/            # API contract definitions (Protocol Buffers)
├── src-tauri/        # Desktop app code (Rust + sidecar)
├── docs/             # Documentation & API specs
├── e2e/              # End-to-end browser tests (Playwright)
├── tests/            # Unit tests
├── scripts/          # Build & utility scripts
├── public/           # Static files (icons, manifests)
├── data/             # Static data files
└── convex/           # Real-time database (Convex)
```

---

## 🚀 Running It Locally (Quick Start)

1. Install [Node.js](https://nodejs.org/) (v18+)
2. Copy `.env.example` to `.env` and fill in any API keys you want
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start the development server
5. Open your browser to `http://localhost:5173`

> **Tip:** Most features work without any API keys. Some advanced features (live military tracking, certain financial data) require free API keys from external services.

---

## 📄 License

This project is licensed under **AGPL-3.0** — it's free and open source, but if you modify and distribute it, you must also share your changes publicly.

---

*Documentation written for beginners — March 2026*
