# NFL Graphs

Interactive NFL charts built from free [nflverse](https://github.com/nflverse) data.
Static site — no server, no database, no cost. Works on phone and laptop.

**Views**
- **Team Efficiency** — offensive vs defensive EPA per play (the classic nflverse scatter, with team logos)
- **Player Leaders** — passing / rushing / receiving leaderboards, sortable by yards, TDs, EPA, and more
- **Standings & Scores** — division standings and weekly results
- **Team Trends** — a team's weekly point differential and weekly offense/defense EPA

## How it works

`scripts/build_data.py` downloads nflverse data (play-by-play parquet, player/team
season stats, schedules), computes everything, and writes small JSON files into
`public/data/`. The site (`public/`) is plain HTML + one JS file + a vendored copy
of [ECharts](https://echarts.apache.org/). Nothing is fetched from third parties at
runtime except team logos (ESPN CDN).

## Run locally

```bash
pip install -r requirements.txt
python scripts/build_data.py          # writes public/data/*.json
python -m http.server 8891 --directory public
# open http://localhost:8891
```

Build specific seasons: `NFL_SEASONS="2024,2025" python scripts/build_data.py`

## Deploy (GitHub Pages, free)

1. Create a GitHub repo and push this folder.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds the data and
   deploys on every push, weekly during the season, and on manual trigger.

Your site will be at `https://<username>.github.io/<repo>/`.

## Data & credits

Data from [nflverse](https://github.com/nflverse) (play-by-play, player/team stats,
schedules). Team logos from ESPN. Not affiliated with or endorsed by the NFL.
