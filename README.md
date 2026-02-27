# nodeapp-devsecops

Application Node.js instrumentée avec Prometheus, visualisée dans Grafana, avec un pipeline DevSecOps complet sur GitHub Actions.

---

## Architecture

```
Développeur → git push → GitHub Actions (Build → Hadolint → Trivy → CodeQL → GHCR)
                                         ↓
                              docker compose up
                                         ↓
              App Node.js :3000  →  Prometheus :9090  →  Grafana :3001
              Node Exporter :9100 ↗
```

---

## Stack technique

| Outil | Rôle |
|---|---|
| Node.js + Express | Application web |
| prom-client | Exposition des métriques au format Prometheus |
| Docker + Docker Compose | Conteneurisation et orchestration locale |
| Prometheus | Collecte et stockage des métriques |
| Grafana | Visualisation des métriques (dashboards) |
| Node Exporter | Métriques système (CPU, RAM, disque) |
| Hadolint | Lint du Dockerfile (bonnes pratiques) |
| Trivy | Scan de vulnérabilités de l'image Docker |
| CodeQL | Analyse statique du code JavaScript |
| GHCR | Registry Docker hébergé par GitHub |

---

## Lancer la stack en local

### Prérequis
- Docker et Docker Compose installés
- Node.js 20 (pour les tests locaux hors Docker)

### Démarrage

```bash
# Cloner le projet
git clone https://github.com/staniska973/devsecops-monitoring.git
cd devsecops-monitoring

# Lancer tous les conteneurs
docker compose up -d --build

# Vérifier que tout est démarré
docker compose ps
```

### URLs d'accès

| Service | URL | Identifiants |
|---|---|---|
| Application | http://localhost:3000 | — |
| Métriques (Prometheus) | http://localhost:3000/metrics | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / admin123 |
| Node Exporter | http://localhost:9100/metrics | — |

---

## Pipeline GitHub Actions

Le pipeline se déclenche automatiquement à chaque `git push` sur `main`.

```
Build & Test  ──┬──  Hadolint (lint Dockerfile)
                ├──  Trivy (scan vulnérabilités image)
                └──  CodeQL (analyse statique JS)
                          └──  Publish → GHCR  (si tout est vert + branche main)
```

---

## Dashboards Grafana

> **Configuration préalable** : Connections → Data sources → Add → Prometheus → URL : `http://prometheus:9090` → Save & test

### Panel 1 — Requêtes par seconde

```
rate(http_requests_total[1m])
```

![Dashboard Requêtes par seconde](docs/dashboard-rps.png)

---

### Panel 2 — Taux d'erreur HTTP (%)

```
sum(rate(http_requests_total{status=~"5[0-9][0-9]"}[1m])) / sum(rate(http_requests_total[1m])) * 100
```

![Dashboard Taux d'erreur](docs/dashboard-errors.png)

---

### Panel 3 — Latence p95 (ms)

```
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le)) * 1000
```

![Dashboard Latence p95](docs/dashboard-latency.png)

---

### Dashboard complet

![Dashboard complet](docs/dashboard-full.png)

---

### Dashboard Node Exporter (métriques système — bonus)

Importé depuis grafana.com avec l'ID `1860`.

![Dashboard Node Exporter](docs/dashboard-node-exporter.png)

---

## Structure du projet

```
devsecops-monitoring/
├── .github/
│   └── workflows/
│       └── devsecops.yml       ← Pipeline GitHub Actions (5 jobs)
├── prometheus/
│   └── prometheus.yml          ← Configuration du scraping Prometheus
├── docs/                       ← Screenshots des dashboards Grafana (à remplir)
│   ├── dashboard-rps.png
│   ├── dashboard-errors.png
│   ├── dashboard-latency.png
│   ├── dashboard-full.png
│   └── dashboard-node-exporter.png
├── app.js                      ← Application Node.js + métriques prom-client
├── package.json
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
└── .gitignore
```

---

## Générer du trafic pour tester les métriques

```bash
for i in $(seq 1 100); do
  curl -s http://localhost:3000/ > /dev/null
  curl -s http://localhost:3000/health > /dev/null
  sleep 0.2
done
```

---

## Arrêter la stack

```bash
# Arrêter les conteneurs
docker compose down

# Arrêter ET supprimer les volumes (données Prometheus + Grafana perdues)
docker compose down -v
```