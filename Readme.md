# TrafficSense — Real-Time Traffic Monitoring & Congestion Prediction

TrafficSense is a full-stack system that collects real-time traffic data across Bangalore and Mumbai, and visualizes live congestion patterns. A machine learning component for congestion prediction is currently in progress.

---

## Features

- **Real-time data collection** from 40 roads across Bangalore and Mumbai using the TomTom Traffic API
- **Automated pipeline** — data collected every ~30 minutes via GitHub Actions, externally triggered by cron-job.org for reliability
- **Live dashboard** — React frontend visualizing current speed, free-flow speed, and congestion ratio per road
- **REST API backend** serving traffic data and (upcoming) congestion predictions
- **ML-based congestion prediction** *(in progress)* — RandomForest model trained on historical speed/congestion data

---

## Tech Stack

**Backend (`artifacts/api-server`):**
- Node.js / TypeScript
- Express
- Drizzle ORM

**Frontend (`artifacts/trafficsense`):**
- React + TypeScript
- Vite
- Tailwind CSS + Radix UI components
- Recharts (data visualization)
- Leaflet / React-Leaflet (map view)

**Data Collection:**
- Python script (`collect_traffic.py`) — separate repo: [`traffic-data-collector`](https://github.com/Asadabz/traffic-data-collector)
- TomTom API
- GitHub Actions + cron-job.org for scheduled execution

---

## Project Structure

```
trafficsense_npm/
├── artifacts/
│   ├── api-server/        # Backend (Express + TypeScript)
│   └── trafficsense/      # Frontend (React + Vite)
├── lib/                   # Shared code/utilities
├── pnpm-workspace.yaml     # Monorepo config
└── package.json
```

---

## Data

- **Source:** TomTom Traffic API
- **Coverage:** 40 roads across Bangalore and Mumbai
- **Collection frequency:** ~48 times/day (every 30 minutes)
- **Fields:** `timestamp`, `city`, `road`, `current_speed`, `free_flow_speed`, `confidence`, `congestion_ratio`
- **Current dataset:** ~37,800+ rows spanning 20+ days (11 July – 31 July 2026), covering both cities

---

## ML Model Status

> **⚠️ Note:** The congestion prediction model is currently trained on a limited ~2-3 week data window. Data collection is ongoing, and the model will be retrained as more data (3-4+ weeks) becomes available. If predictions seem inconsistent right now, this is expected — the model is a work-in-progress baseline, not a final production model.

**Planned approach:**
- RandomForest Regressor predicting `congestion_ratio`
- Features: current speed, free-flow speed, road, city, hour of day, day of week
- Future goal: automated weekly retraining pipeline (fetch latest data → retrain → redeploy)

---

## Running Locally

**Backend:**
```powershell
cd artifacts/api-server
npm install
npm run dev
```

**Frontend:**
```powershell
cd artifacts/trafficsense
npm install
npm run dev
```

*(Exact scripts may vary — check `package.json` in each folder for the precise `dev`/`build`/`start` commands.)*

---

## Roadmap

- [x] Automated real-time data collection (40 roads, 2 cities)
- [x] Live dashboard with map visualization
- [ ] Baseline ML congestion prediction model (v1)
- [ ] Weekly auto-retraining pipeline via GitHub Actions
- [ ] Deploy backend + frontend to Render
- [ ] Model performance dashboard (accuracy over time as data grows)

---

## Author

Mohammad Asadulla Mulla — [GitHub](https://github.com/Asadabz)
"""
to start the project 
Terminal 1 — Python ML service:

powershell
cd "C:\Users\Dell\Desktop\projects\trafficsense_npm (3)\artifacts"
uvicorn predict_server:app --reload

Terminal 2 — Node.js backend:

powershell
cd "C:\Users\Dell\Desktop\projects\trafficsense_npm (3)\artifacts\api-server"
npm run dev

Terminal 3 — React frontend:

powershell
cd "C:\Users\Dell\Desktop\projects\trafficsense_npm (3)\artifacts\trafficsense"
npm run dev
"""