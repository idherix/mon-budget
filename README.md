# 💰 Mon Budget

Application web installable (PWA) de suivi de budget mensuel, pensée pour iPhone.
100 % locale : aucune donnée ne quitte le téléphone.

## Fonctionnalités

- **Accueil** : solde du mois, revenus / dépenses, objectif d'épargne avec barre de progression, budgets par catégorie (vert → orange à 80 % → rouge en cas de dépassement), dernières opérations.
- **Opérations** : liste par jour, recherche (entreprise, lieu, note, montant), filtres par type et par catégorie. Touche une opération pour la modifier ou la supprimer.
- **Stats** : taux d'épargne, moyenne par jour, projection de fin de mois, plus grosse dépense, répartition (donut), évolution sur 12 mois, dépenses cumulées vs mois précédent et rythme du budget, dépenses par jour de la semaine, variations vs mois précédent, top entreprises et top lieux.
- **Réglages** : objectif d'épargne, ajout / modification / suppression des catégories (emoji, nom, couleur, budget max), export et restauration d'une sauvegarde (.json), export CSV pour Excel.
- Saisie manuelle de chaque opération : montant, catégorie, entreprise, lieu, date et note. Les entreprises et les lieux déjà saisis sont proposés automatiquement.
- Changement de mois avec les flèches, ou en glissant vers la gauche ou la droite sur l'Accueil et les Stats.
- Fonctionne hors connexion.

## Structure

```
mon-budget/
├── index.html            # squelette de l'appli + barre d'onglets
├── styles.css            # design (fond clair, animations)
├── app.js                # logique : données, écrans, formulaires
├── charts.js             # graphiques SVG faits maison (aucune dépendance)
├── sw.js                 # service worker (hors connexion)
├── manifest.webmanifest  # infos d'installation
└── icons/                # icônes de l'appli
```

## 1. Tester en local (VS Code)

- Avec l'extension **Live Server** : clic droit sur `index.html` → *Open with Live Server*.
- Ou dans le terminal : `python -m http.server 8000` puis ouvre http://localhost:8000.

Pour tester sur l'iPhone (même Wi-Fi) : ouvre `http://<IP-de-ton-PC>:8000` dans Safari.

## 2. Mettre en ligne avec GitHub Pages

1. Crée un dépôt sur GitHub, par exemple `mon-budget`. Il peut être public ou privé si ton offre GitHub permet Pages en privé.
2. Dans VS Code, ouvre le dossier puis lance :
   ```bash
   git init
   git add .
   git commit -m "Première version de Mon Budget"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/mon-budget.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch → Branch : `main` / `(root)` → Save**.
4. Une à deux minutes plus tard, l'appli est disponible sur `https://<ton-pseudo>.github.io/mon-budget/`.

## 3. Installer sur l'iPhone

1. Ouvre l'URL dans **Safari** (pas Chrome).
2. Touche le bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Lance l'appli depuis son icône : elle s'ouvre en plein écran, comme une vraie appli.

## ⚠️ À savoir sur les données

- Les données sont stockées dans l'appli installée sur ton iPhone. Ce que tu saisis dans Safari **n'apparaît pas** dans l'appli installée, et inversement. Utilise toujours l'icône de l'écran d'accueil.
- Si tu supprimes l'appli de l'écran d'accueil, ou si tu effaces les données de sites web dans *Réglages iOS → Safari*, tes données sont perdues.
  👉 **Réglages → Exporter une sauvegarde** de temps en temps, et range le fichier dans Fichiers / iCloud Drive.

## Mettre à jour l'appli

1. Modifie le code, puis `git add . && git commit -m "..." && git push`.
2. Dans `sw.js`, incrémente `CACHE_VERSION` (`mon-budget-v2`, …).
3. Sur l'iPhone, ferme puis rouvre l'appli : la nouvelle version se charge. Si besoin, fais-le deux fois.

Tes données ne sont pas touchées par une mise à jour.
