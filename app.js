// On importe Express, le framework web qui va nous permettre de créer un serveur HTTP simplement.
const express = require('express');

// On importe prom-client, la bibliothèque qui permet d'exposer des métriques au format Prometheus.
const promClient = require('prom-client');

// On crée l'application Express. C'est le point d'entrée de notre serveur.
const app = express();

// On récupère le "registre" par défaut de Prometheus.
// C'est lui qui va stocker toutes nos métriques et les rendre disponibles via /metrics.
const register = promClient.register;

// ─── Métriques par défaut ───────────────────────────────────────────────────
// On demande à prom-client de collecter automatiquement les métriques système :
//   - Utilisation CPU du processus Node.js
//   - Consommation mémoire (heap)
//   - Latence de l'event loop (indicateur de congestion)
promClient.collectDefaultMetrics({ register });

// ─── Compteur : nombre total de requêtes HTTP ──────────────────────────────
// Un Counter ne peut qu'augmenter (comme un compteur kilométrique).
// On lui donne :
//   - un nom : http_requests_total  (convention Prometheus : snake_case + _total)
//   - un texte d'aide (help) qui s'affiche dans /metrics
//   - des "labels" pour filtrer les données : méthode HTTP, route et code de statut
const httpTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requêtes HTTP reçues par le serveur',
  labelNames: ['method', 'route', 'status'],
});

// ─── Histogramme : durée des requêtes HTTP ─────────────────────────────────
// Un Histogram mesure des durées et les range dans des "buckets" (seaux).
// Chaque bucket représente un seuil de temps (en secondes).
// Ex : le bucket 0.1 compte toutes les requêtes qui ont pris moins de 100 ms.
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1], // seuils : 10ms, 50ms, 100ms, 300ms, 500ms, 1s
});

// ─── Middleware d'instrumentation ──────────────────────────────────────────
// Un middleware s'exécute sur TOUTES les requêtes, avant les routes.
// On l'utilise ici pour mesurer la durée de chaque requête et incrémenter le compteur.
app.use((req, res, next) => {
  // On démarre le chronomètre dès que la requête arrive.
  const end = httpDuration.startTimer();

  // On attend que la réponse soit envoyée ('finish') pour arrêter le chrono.
  res.on('finish', () => {
    // On incrémente le compteur en lui passant les labels associés à cette requête.
    httpTotal.inc({
      method: req.method,       // ex : GET, POST
      route:  req.path,         // ex : /, /health, /metrics
      status: res.statusCode,   // ex : 200, 404, 500
    });

    // On arrête le chronomètre → la durée est automatiquement rangée dans le bon bucket.
    end();
  });

  // On appelle next() pour passer au prochain middleware ou à la route.
  next();
});

// ─── Route / ───────────────────────────────────────────────────────────────
// On répond à un GET sur / avec un message JSON simple.
// C'est la page d'accueil de notre application.
app.get('/', (req, res) => {
  res.json({ message: 'Hello DevSecOps!' });
});

// ─── Route /health ─────────────────────────────────────────────────────────
// Cette route est utilisée par Docker pour vérifier que l'app est bien vivante.
// Si elle répond { status: 'ok' }, le conteneur est considéré "healthy".
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Route /error ──────────────────────────────────────────────────────────
// On expose une route qui retourne toujours une erreur 500.
// On l'utilise uniquement pour tester le panel "Taux d'erreur" dans Grafana.
app.get('/error', (req, res) => {
  res.status(500).json({ error: 'Erreur simulée pour les tests' });
});

// ─── Route /metrics ────────────────────────────────────────────────────────
// Prometheus va interroger cette URL toutes les 15 secondes pour collecter les métriques.
// On retourne toutes les métriques enregistrées dans le registre, au format texte Prometheus.
app.get('/metrics', async (req, res) => {
  // On précise le Content-Type pour que Prometheus reconnaisse le format.
  res.set('Content-Type', register.contentType);

  // On envoie le contenu texte des métriques.
  res.end(await register.metrics());
});

// ─── Démarrage du serveur ──────────────────────────────────────────────────
// On démarre le serveur sur le port 3000.
// On affiche un message dans la console pour confirmer que tout est bien parti.
app.listen(3000, () => {
  console.log('App démarrée sur le port 3000');
  console.log('→ http://localhost:3000/');
  console.log('→ http://localhost:3000/health');
  console.log('→ http://localhost:3000/metrics');
});
