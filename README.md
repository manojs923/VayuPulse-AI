# VayuPulse AI 🌬️
**Atmospheric Intelligence, ML Smog Forecasting & Clean-Air Agent Platform**

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.7%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Express 5](https://img.shields.io/badge/Express-5.0-000000.svg)](https://expressjs.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-135%2F135%20Passing-emerald.svg)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📌 1. Challenge Vertical & Problem Statement

### Challenge Vertical
**Environmental Intelligence, Atmospheric Physics & Climate-Health Agent Systems**

### The Core Problem
During urban winter temperature inversions, cold ground air becomes trapped beneath a warm upper boundary-layer lid. This stagnation caps fine particulates (PM2.5, PM10), nitrogen dioxide (NO2), carbon monoxide (CO), and ozone (O3), creating multi-day toxic smog episodes. Standard consumer weather apps only display static, delayed, regional AQI numbers without addressing vertical atmospheric dynamics or offering time-aware route exposure minimization.

### VayuPulse AI Mission
VayuPulse AI provides vulnerable families, school commuters, endurance athletes, and municipal resilience leads with:
1. **Deterministic Environmental Physics**: Pure EPA sub-index interpolation, boundary-layer lapse rate capping models, and single-compartment CADR decay calculations.
2. **Zero-Dependency ML Time-Series Forecaster**: Holt-Winters diurnal exponential smoothing blended with Ridge regression for 24-hour PM2.5/AQI forecasting with 90% confidence bands.
3. **Multi-Agent Orchestration Layer**: Autonomous Planner agent coupled with an adversarial Safety Critic agent verifying clinical protocol citations (`[WHO-PM25-24H]`, `[PED-ASTHMA-VULN]`, etc.) before presenting advice.
4. **Time-Dependent Clean-Corridor Transit**: Dijkstra lowest-dose pathfinding minimizing cumulative inhaled microgram dose ($\mu\text{g}$) across transportation modes and dynamic diurnal peaks.
5. **Low-Cost Indoor IAQ Interventions**: Mathematical 4-ACH compliance sizing for open-source **$40 DIY Corsi-Rosenthal filtration boxes (350 m³/h)** versus commercial HEPA units.

---

## 🏛️ 2. Architectural Blueprint & Decision Logic

```
                    ┌──────────────────────────────────────────────┐
                    │               CLIENT BROWSER                 │
                    │   React 19 + TypeScript 5.7 + Tailwind v4    │
                    │       Native Inline SVGs + WCAG Twins        │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP / JSON
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │         EXPRESS 5 ZERO-TRUST GATEWAY         │
                    │  • Helmet Strict CSP & Frameguard (DENY)     │
                    │  • Exact-Match CORS Allowlist                │
                    │  • 15 KB JSON Body Cap (/api/ai/forecast)    │
                    │  • 2 MB Multipart Cap (/api/ai/vision-haze)  │
                    │  • IP Rate Limiter (30 req/min)              │
                    │  • CWE-209-Safe Error Handler                │
                    └──────────────────────┬───────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ SHA-256 LRU Cache ]                [ MULTI-AGENT LAYER ]
             Keyed by payload hash                Planner ⇆ Safety Critic
             <10 ms Cache Hits                    Zod Schema Validation
                        │                                     │
                        │                                     ▼
                        │                         [ GROUNDED HYBRID RAG ]
                        │                         • Pure BM25 Keyword Rank
                        │                         • Cosine Vector Embedding
                        │                         • Reciprocal Rank Fusion
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           ▼
                        ┌─────────────────────────────────────┐
                        │      DETERMINISTIC PURE ENGINES     │
                        │  • EPA NAAQS 2024 PM2.5 Sub-Index   │
                        │  • Boundary Inversion ΔT Proxy      │
                        │  • CADR Mass-Balance Decay (4-ACH)  │
                        │  • Dijkstra Inhaled Dose Pathfinder │
                        │  • 1-D Kalman Filter Sensor Fusion  │
                        │  • Holt-Winters + Ridge ML Model    │
                        └─────────────────────────────────────┘
```

### Deterministic Separation of Concerns
Under strict design rules, **large language models never compute numbers, concentrations, or physical formulas**. All numbers are generated by pure, deterministic, unit-tested TypeScript engines. The AI models solely orchestrate tools, inspect citations, and explain verified results in clear prose.

---

## 👥 3. Target Personas & Clinical Safety Invariants

| Target Persona | Key Physiological Vulnerability | Invariant Enforced by Safety Critic |
| :--- | :--- | :--- |
| **Newborn Infant (0–12 Mo)** | Immature lung parenchyma, rapid respiratory rate | **Masks strictly contraindicated (<2y)** due to suffocation risk; nursery HEPA required. |
| **Asthmatic Child (5–12 Yrs)** | High minute ventilation per kg, reactive airways | Strict indoor recess during inversion; **pediatric-sized KF94** (not adult N95). |
| **Elderly Cardiac Patient** | Autonomic vascular imbalance, ischemic risk | Avoid early morning cold-air exertion; continuous indoor PM2.5 < 12 µg/m³ filtration. |
| **Outdoor Athlete** | Deep alveolar particulate penetration (60–80 L/min) | Reschedule workouts to the afternoon convective solar breakup window. |
| **School Commuter** | Fixed peak rush-hour street canyon exposure | Optimize departure time via Dijkstra time-dependent routing; enclosed transit mode. |
| **Neighborhood Resilience Lead** | Community-wide emissions and public warnings | Real-time collective PM2.5/CO2 abatement tracking; multilingual alerts with native RTL. |

---

## 🔬 4. Pure Compute & ML Engines

1. **EPA PM2.5 AQI Sub-Index ([`src/lib/aqiCompute.ts`](src/lib/aqiCompute.ts))**:
   - Implements EPA NAAQS 2024 revised piecewise breakpoints (0–500 scale).
   - Enforces 1-decimal truncation rules, non-negative bounds, and >500.4 capping with `isCapped` metadata.
2. **Boundary-Layer Temperature Inversion Model ([`src/lib/aqiCompute.ts`](src/lib/aqiCompute.ts))**:
   - Diagnostic proxy: $\Delta T = T_{\text{upper}} - T_{\text{ground}}$ combined with wind stagnation (< 6 km/h).
   - Severity: `NONE`, `MODERATE`, `SEVERE`, `CRITICAL`.
   - Estimates convective breakup window based on solar heating curve.
3. **Single-Compartment CADR Mass-Balance Decay ([`src/lib/aqiCompute.ts`](src/lib/aqiCompute.ts))**:
   - Decay formula: $t = \left(\frac{-\ln(1 - \eta) \times V}{\text{CADR}}\right) \times 60 \text{ minutes}$.
   - Evaluates compliance with the ASHRAE 4-ACH (Air Changes per Hour) standard.
   - Presets include the **$40 DIY Corsi-Rosenthal Box ($350\text{ m}^3/\text{h}$)** and commercial HEPA units.
4. **Dijkstra Lowest-Exposure Transit Router ([`src/lib/routing.ts`](src/lib/routing.ts))**:
   - Calculates cumulative inhaled dose: $\text{Dose} = \sum \left(\frac{\text{distance}}{\text{speed}}\right) \times C_{\text{PM2.5}} \times \text{ventilationRate} \times (1 - \text{filtrationEfficiency})$.
   - Modes: Underground Metro (75% filtration), EV/HEPA Cabin (85%), Electric Bus (40%), Diesel Bus (20%), Cycling ($2.3\text{ m}^3/\text{h}$ exertion), Walking.
   - Dynamic time-dependent departure optimization across the 24-hour ML forecast.
5. **Holt-Winters + Ridge Smog Forecaster ([`src/lib/mlForecast.ts`](src/lib/mlForecast.ts))**:
   - 24-hour diurnal seasonal smoothing combined with closed-form linear Ridge regression on physical features.
   - Computes empirical 90% confidence bands derived from residual quantiles.
   - Counterfactual API (`explainCounterfactual`) explaining exact microgram shifts per unit change in wind, inversion gradient, or traffic.

---

## 🛡️ 5. Zero-Trust Security & Key Custody

- **Server-Side Key Custody**: `OPENAI_API_KEY` and `GEMINI_API_KEY` reside strictly on the Node.js backend. A recursive scanner in [`src/test/keyCustody.test.ts`](src/test/keyCustody.test.ts) inspects all source code and built bundle assets in `dist/assets/`, guaranteeing zero key leakage.
- **Strict Content Security Policy**: Helmet configured with explicit CSP and `frameguard: { action: 'deny' }` (`X-Frame-Options: DENY`).
- **Input Sanitization**: Control characters stripped via [`src/lib/sanitize.ts`](src/lib/sanitize.ts) (`stripControlChars`), and prompt-injection override attempts are neutralized.
- **Route Body Limits**: Strict 15 KB cap on standard JSON endpoints; dedicated 2 MB cap with Sharp EXIF stripping on `/api/ai/vision-haze`.
- **CWE-209 Safe Error Handling**: Unhandled errors return a generic `{ error: "Internal Server Error" }`, preventing stack trace or database credential leakage.

---

## ♿ 6. WCAG 2.2 AA Accessibility & Multilingual Inclusivity

- **Inline SVGs with `.sr-only` Twins**: Every chart (5-sector heatmap, 7-hour sparkline, 24-hour forecast confidence band) is paired with an accessible HTML table marked `.sr-only` for screen readers.
- **Keyboard Navigation**: Full ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`) with visible focus rings.
- **Reduced Motion**: All animations respect `prefers-reduced-motion: reduce`.
- **Bidirectional Multilingual Alerts**: Emergency community broadcasts with automatic `dir="rtl"` switching for Arabic and Urdu, plus English and Hindi, labeled with a `"Review before broadcasting"` warning.

---

## 🧪 7. Test Suite Summary (135/135 Tests Passing)

All tests execute in isolated, mocked environments without requiring live keys or external network connections:

| Suite | File | Tests | Focus |
| :--- | :--- | :---: | :--- |
| **EPA Physics** | [`src/test/aqi.test.ts`](src/test/aqi.test.ts) | 23 | Breakpoints, >500.4 cap, inversion lapse rates, CADR decay, 4-ACH sizing |
| **ML Engine** | [`src/test/ml.test.ts`](src/test/ml.test.ts) | 9 | Horizon shapes, residual bounds, non-negativity, backtest MAE/RMSE/MAPE |
| **Sensor Fusion** | [`src/test/sensorFusion.test.ts`](src/test/sensorFusion.test.ts) | 6 | 1-D Kalman convergence, acute spike detection, stuck sensor freezes |
| **Dijkstra Transit** | [`src/test/routing.test.ts`](src/test/routing.test.ts) | 10 | Lowest dose pathfinding, flat reduction to static, 2 dose regression tests |
| **Telemetry Source** | [`src/test/telemetry.test.ts`](src/test/telemetry.test.ts) | 9 | Open-Meteo live CAMS adapter, city mean preservation, pressure level elevation, fallback |
| **Clean-Air Copilot** | [`src/test/copilotRouter.test.ts`](src/test/copilotRouter.test.ts) | 14 | Multi-intent classification, clinical triage notice, live observation timestamps, CR box & transit comparisons |
| **Multilingual i18n** | [`src/test/i18n.test.tsx`](src/test/i18n.test.tsx) | 7 | 8-language localization (Kannada, Hindi, English, Tamil, Telugu, Arabic, Urdu, Spanish), dynamic RTL, storage persistence |
| **Hybrid RAG** | [`src/test/rag.test.ts`](src/test/rag.test.ts) | 7 | BM25 rank, vector cosine similarity, RRF fusion, offline degradation |
| **Agent Orchestrator** | [`src/test/orchestrator.test.ts`](src/test/orchestrator.test.ts) | 8 | Tool allowlist, Planner-Critic loop, Zod schema validation, injection defenses |
| **Gateway Security** | [`src/test/api.test.ts`](src/test/api.test.ts) | 9 | Helmet CSP, 15 KB body cap, rate limiter, SHA-256 LRU cache, `/api/ai/telemetry` |
| **UI Components** | [`src/test/rendering.test.tsx`](src/test/rendering.test.tsx) | 6 | Tab mounting, simulated banner, medical disclaimer, `.sr-only` twins |
| **DOM & RTL** | [`src/test/dom.test.tsx`](src/test/dom.test.tsx) | 4 | Modal open/close, Copilot drawer, dynamic `dir="rtl"` Arabic/Urdu switching |
| **Responsible AI** | [`src/test/aiEval.test.ts`](src/test/aiEval.test.ts) | 21 | Gemini 3.5 parameter compliance, infant mask contraindication, child respirator wording |
| **Key Custody** | [`src/test/keyCustody.test.ts`](src/test/keyCustody.test.ts) | 2 | Scans `src/` and compiled bundle assets in `dist/assets/` for zero key leakage |

---

## ⚡ 8. Installation & Quickstart Guide

### Prerequisites
- Node.js 18.x or 20.x
- npm 9.x or higher

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/manojs923/VayuPulse-AI.git
cd VayuPulse-AI
npm install
```

### Step 2: Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Optional: Add your `OPENAI_API_KEY` or `GEMINI_API_KEY`. If left blank, VayuPulse AI operates seamlessly using its deterministic heuristic engine.)*

### Step 3: Run Verification Suite
```bash
# Typecheck (0 errors)
npm run typecheck

# Oxlint inspection (0 warnings)
npm run lint

# Run all 128 Vitest tests across 13 suites
npm run test:run

# Build production bundle
npm run build
```

### Step 4: Launch Development Environment
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser. The Express gateway operates concurrently on port `3001`.

---

## 🌐 9. Production Deployment Guidelines

### Backend Gateway (Node.js / Cloud Run / Container)
Deploy `server/server.ts` using Node.js or a container runtime:
```bash
# Build the TypeScript frontend bundle
npm run build

# Start production server with static hosting enabled
SERVE_STATIC=true npx tsx server/server.ts
```

Set the following environment variables in your deployment host:
```env
PORT=3001
ALLOWED_ORIGINS=https://your-frontend-domain.com
SERVE_STATIC=true
AI_PRIMARY_PROVIDER=openai
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
TELEMETRY_SOURCE=openmeteo
TELEMETRY_LAT=28.6139
TELEMETRY_LON=77.2090
```

---

## 📄 10. License
This project is open-source and licensed under the [MIT License](LICENSE).
