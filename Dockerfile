# ─── Image de base ────────────────────────────────────────────────────────────
# On part de node:20-alpine.
# "alpine" est une version ultra-légère de Linux (~5 Mo au lieu de ~900 Mo).
# Moins de paquets = moins de failles de sécurité potentielles.
FROM node:20-alpine

# ─── Répertoire de travail ────────────────────────────────────────────────────
# On définit le dossier dans lequel toutes les prochaines commandes vont s'exécuter.
# Si le dossier n'existe pas, Docker le crée automatiquement.
WORKDIR /app

# ─── Copie des fichiers de dépendances ───────────────────────────────────────
# On copie UNIQUEMENT package.json et package-lock.json en premier.
# Astuce : Docker met en cache chaque instruction. Si package.json ne change pas,
# Docker réutilise le cache et n'exécute pas "npm ci" à chaque build → plus rapide.
COPY package*.json ./

# ─── Installation des dépendances ────────────────────────────────────────────
# "npm ci" (clean install) est préférable à "npm install" en CI/CD car :
#   - Il respecte strictement le package-lock.json (versions exactes garanties).
#   - Il échoue si package-lock.json n'est pas à jour.
#   - "--only=production" : on n'installe pas les devDependencies dans l'image finale.
RUN npm ci --only=production

# ─── Copie du code source ─────────────────────────────────────────────────────
# On copie app.js maintenant (après npm ci) pour optimiser le cache Docker.
COPY app.js .

# ─── Sécurité : utilisateur non-root ─────────────────────────────────────────
# Par défaut, Docker exécute les processus en tant que root (dangereux !).
# On crée un groupe "appgroup" et un utilisateur "appuser" sans privilèges.
# Si un attaquant prend le contrôle du processus, il n'aura pas les droits root.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# On bascule sur ce nouvel utilisateur pour la suite.
USER appuser

# ─── Port exposé ──────────────────────────────────────────────────────────────
# On documente le port utilisé par l'application (purely informatif pour Docker).
EXPOSE 3000

# ─── Health check ─────────────────────────────────────────────────────────────
# Docker va régulièrement tester si l'application répond bien.
#   --interval=30s : vérification toutes les 30 secondes
#   --timeout=5s   : si pas de réponse en 5s → échec
# On utilise wget (disponible sur alpine) pour faire un GET sur /health.
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1

# ─── Commande de lancement ────────────────────────────────────────────────────
# On lance l'application Node.js quand le conteneur démarre.
# Forme JSON recommandée (évite les problèmes de gestion des signaux Unix).
CMD ["node", "app.js"]
