# Présence

> Interruptions aléatoires pour observer tes pensées — inspiré de l'Experience Sampling Method de Csikszentmihalyi.

## C'est quoi ?

Une webapp minimaliste qui te bipe à intervalles aléatoires pendant la journée. À chaque ping, tu notes ce qui occupait ton esprit : tags rapides + texte libre. L'idée est de développer une conscience de ses patterns de pensées au fil du temps.

## Fonctionnalités

- ⏱ Intervalles configurables (5–120 min) avec variance aléatoire ±50%
- 🔔 Notifications système desktop (Chrome / Firefox)
- 🔊 Son + flash visuel + clignotement de l'onglet au moment du ping
- 🏷 Tags rapides + texte libre pour chaque entrée
- 📓 Journal avec filtres Jour / Semaine / Mois
- ✏️ Entrées modifiables et supprimables
- 📊 Stats en temps réel (taux de réponse)
- 🌗 Thème sombre / clair
- 💾 Données stockées localement dans le navigateur (localStorage)
- 📤 Export CSV

## Utilisation

Ouvre simplement `index.html` dans ton navigateur, ou accède à la version hébergée :

**→ [ton-pseudo.github.io/presence]()**

Chaque utilisateur a ses propres données stockées localement sur son appareil.

## Structure

```
presence/
├── index.html       # Structure HTML
├── css/
│   └── style.css    # Styles et thèmes
├── js/
│   └── app.js       # Logique de l'application
└── README.md
```

## Déploiement (GitHub Pages)

1. Fork ou clone ce repo
2. Va dans **Settings → Pages**
3. Source : `main` / `/ (root)`
4. Ton lien : `https://[pseudo].github.io/[nom-repo]`
