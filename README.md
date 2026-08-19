# RWH-DSS — AI-Based Rooftop Rainwater Harvesting Decision Support System

A working decision-support platform for rooftop rainwater harvesting: it syncs
live CGWB/NWDP groundwater and rainfall telemetry into MySQL every hour, maps
the station network, designs recharge structures from a drawn rooftop polygon
with a full civil-engineering calculation sheet, analyses groundwater trends
from the real observed series, and produces printable reports.

**Stack:** MySQL 8 · FastAPI · SQLAlchemy · APScheduler · React + Vite +
Tailwind · Leaflet · ECharts.

---

## Modules

| Module | Route | What it does |
|---|---|---|
| **Dashboard** | `/` | Live stat cards, station map, sync activity feed over WebSocket |
| **GIS Map** | `/gis-map` | Full station network, basemap switcher, state/district/taluk + freshness filters, click-through station history charts |
| **RWH Design** | `/rwh-design` | Draw a rooftop → complete recharge design, hydraulics, BOQ, 20-step calculation sheet |
| **Predictions** | `/predictions` | Least-squares groundwater trend per station with confidence and caveats |
| **Reports** | `/reports` | Saved designs with printable full engineering report |

---

## Run it

Prerequisites: **MySQL 8**, **Python 3.12**, **Node 20+**.

### 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS rwh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER IF NOT EXISTS 'rwh'@'localhost' IDENTIFIED BY 'rwh_app_pw'; GRANT ALL PRIVILEGES ON rwh.* TO 'rwh'@'localhost'; FLUSH PRIVILEGES;"
```

Then load the schema **in this order** (dependencies matter):

```bash
cd database
for f in schema groundwater rainfall building recharge prediction indexes views procedures seed; do
  mysql -u rwh -prwh_app_pw rwh < $f.sql
done
```

`scheduler.sql` is optional — it registers a MySQL EVENT for the daily rainfall
rollup and needs `SET GLOBAL event_scheduler = ON` (superuser).

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows;  source .venv/bin/activate on POSIX
pip install -r requirements.txt
cp .env.example .env            # adjust DATABASE_URL if your creds differ
uvicorn main:app --reload --port 8000
```

The backend runs the first CGWB sync immediately at startup, then hourly.
**The initial groundwater sync pulls ~600k records and takes ~30-45 minutes** —
the dashboard fills in progressively while it runs; you don't need to wait.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

---

## Key design decisions worth knowing

**Structures are sized on a design storm, not annual rainfall.** Recharge pits
and trenches drain continuously by infiltration between storms, so sizing them
to hold a year's runoff would overbuild by orders of magnitude. The physical
structure is sized on a 50 mm design-storm event; annual rainfall only drives
the informational water-balance figures. (This was caught during testing —
sizing off the annual figure produced 6 pits for a single house.)

**Groundwater values are normalized to a positive depth below ground.** The
NWDP feed mixes sign conventions in one column (mostly negative depths, some
positive) and also carries reduced levels above MSL and sentinel values up to
25,851. Feeding a raw negative into the design engine silently inverts both the
3 m water-table separation rule and the 8 m injection-bore trigger, so every
value is normalized and anything outside a plausible 0–100 m depth range is
rejected rather than guessed at. The untouched feed value is kept alongside for
audit.

**"Latest reading per station" uses a per-station index seek.** The obvious
`ROW_NUMBER() OVER (PARTITION BY station_id …)` reads and sorts every row in the
readings table on every query — at 600k+ rows that took ~3 s and made the
dashboard cards time out. The correlated `MAX()` form seeks the
`(station_id, recorded_at)` index once per station instead.

**Trend confidence is seasonality-aware.** A linear fit over less than a full
year measures where you sit on the seasonal cycle, not a long-term trend —
extrapolating a post-monsoon recession to m/yr yields absurd figures like
−47 m/yr. Sub-annual series are capped at *low* confidence and carry an explicit
caveat, and slopes beyond ±5 m/yr are flagged as physically implausible.

---

## What's implemented

- **`database/*.sql`** — full MySQL schema: telemetry + sync bookkeeping,
  buildings/roofs/soil, raster & vector layer metadata, recharge
  pit/trench/borewell/filter-media/BOQ/report tables, ML prediction + SHAP
  tables, views, stored procedures, optional EVENT scheduler.
- **`backend/app/services/cgwb_client.py` + `sync_service.py`** — offset-paginated
  CKAN client with exponential-backoff retry, defensive field-name mapping
  against the real NWDP column names, `ON DUPLICATE KEY UPDATE` upserts on
  `(station_id, recorded_at)`, per-row failure logging to `sync_failures` so one
  bad record can't drop a page, full `sync_runs` bookkeeping. **Verified against
  the live API: 12,647/12,647 rainfall records and 600k+ groundwater records
  upserted with zero failures.**
- **`backend/app/scheduler/jobs.py`** — APScheduler running both syncs hourly plus
  once at startup, broadcasting progress over WebSocket.
- **`backend/app/services/rwh_design_engine.py`** — the design engine: runoff
  coefficient by roof material and slope, HSG lookup, water balance, adaptive
  pit-vs-trench selection with auto-splitting, 3 m separation rule with a logged
  override path, injection-borewell triggering, three-layer filter media stack,
  rational-method peak flow, pipe sizing by continuity, first-flush and
  desilting-chamber sizing, infiltration capacity and emptying time, excavation
  quantities, expected water-table rise, BOQ, and a 20-step calculation sheet
  showing every formula with its substitution.
- **`backend/app/services/live_data_service.py`** — Haversine nearest-station
  lookup feeding real telemetry into the design instead of typed-in guesses,
  with a 75 km cap and fallthrough to the next usable station.
- **`backend/app/services/trend_service.py`** — OLS regression per station with
  R², sample size, span, confidence banding and plain-language caveats.
- **`frontend/`** — all five modules above, dark theme, live WebSocket updates,
  cascading state → district → taluk filters, print-ready report layout.

## Known limitations

- **BOQ rates are illustrative placeholders** (`UNIT_RATES_INR`). Substitute the
  current state PWD/CPWD Schedule of Rates before using any cost figure for a
  tender or budget submission.
- **Specific yield for the water-table-rise estimate is assumed at 0.15** and the
  zone of influence at 15 m radius. Both should come from a site pumping test.
- **Design storm and rainfall intensity are national defaults** (50 mm event,
  75 mm/hr intensity). Replace with local IDF curves where available.
- **Trend analysis needs a full year of telemetry** before any station's slope
  should be read as a real trend — see the seasonality note above.
- **Auth is a single operator account** from environment variables. Wire a real
  `users`/`roles` table before multi-user deployment.
- **No engineering drawings or PDF generator yet** — the Reports module uses the
  browser's print-to-PDF. SVG sectional drawings are the next increment; the
  `reports` table is already in the schema for it.
- District/taluk boundary polygons, DEM/slope rasters, watersheds, roads and
  rivers have tables but no loader — bring your own shapefiles/GeoTIFFs.
- **Single worker**: the scheduler runs in-process, so run one backend process
  to avoid double-firing the hourly sync.
