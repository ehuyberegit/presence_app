# Présence — Journal de soi

Une application de journaling par pings aléatoires, pour capturer ce qui te traverse en temps réel.

## Structure

```
presence_app/
├── index.html        # Shell HTML
├── css/
│   └── style.css     # Tous les styles
├── js/
│   └── app.js        # Toute la logique
└── README.md
```

## Fonctionnalités

- **Nouveau ping** — note libre + tag de pensée + valence (positif / neutre / négatif) + intensité 1→5 + lieu et personne (optionnels)
- **Journal** — feed chronologique groupé par jour, résumé IA par jour (via Claude API)
- **Analyse** — répartition des tags, valence globale, intensité moyenne, mood par tag, distribution horaire, lieux, personnes
- **Tags** — créer / supprimer des catégories de pensée
- **Export** — JSON et CSV depuis la section Analyse

## Données

Tout est stocké en `localStorage` — aucune donnée n'est envoyée nulle part (sauf lors de la génération du résumé du jour, qui appelle l'API Anthropic).

## GitHub Pages

1. Push ce dossier sur un repo GitHub
2. Settings → Pages → Source : `main` / `root`
3. L'app tourne sur `https://ton-pseudo.github.io/nom-du-repo`

## Résumé du jour

Le bouton "Résumé du jour" dans le Journal appelle l'API Claude (`claude-sonnet-4-20250514`) pour générer un résumé narratif sobre de ta journée. L'API key est gérée par le proxy Anthropic — aucune clé à configurer.
