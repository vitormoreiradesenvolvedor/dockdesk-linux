<img src="../../build/icon.png" width="72" alt="Icône de DockDesk" align="left" />

# DockDesk

**Docker sans mémoriser de commandes : une interface graphique complète pour Linux.**

<br clear="left"/>

🌐 [Português (BR)](../../README.md) · [English](README.en.md) · [中文](README.zh.md) · [हिन्दी](README.hi.md) · [Español](README.es.md) · **Français**

---

## La douleur qu'il résout

Chaque équipe a ce projet qu'il « suffit de lancer avec docker compose »… et quelqu'un qui bloque exactement à cette étape.
Développeurs front-end, QAs, designers techniques, nouveaux arrivants : des personnes qui ont **besoin** de containers au quotidien mais ne veulent pas (et ne devraient pas avoir à) mémoriser `docker exec -it`, les flags de logs ou l'ordre de démarrage des services.

DockDesk existe pour ce public : **ceux qui développent sur des projets utilisant Docker sans être experts Docker**. Tout ce que le quotidien exige est à un clic, avec des noms clairs, en six langues, sans cacher ce qui se passe dessous (les commandes équivalentes sont affichées dans l'interface).

## Ce qu'il fait

### Conteneurs
- Liste en direct avec statut, usage **CPU et mémoire**, ports mappés et recherche ;
- **Démarrer, arrêter, redémarrer et supprimer** en un clic (la suppression demande confirmation) ;
- Conteneurs **groupés par projet Compose** en accordéons (y compris les projets lancés hors de DockDesk), avec état ouvert/replié mémorisé et **réordonnancement par glisser-déposer** ;
- Panneau de détails : image, IP interne, réseaux, ports, volumes/montages et variables d'environnement.

### Terminal et commandes
- **Vrai terminal interactif** (équivalent à `docker exec -it`), avec **détection automatique des shells** disponibles dans l'image (bash, zsh, fish, ash, sh…) ;
- **Exécuter une commande** ponctuelle avec sortie, stderr et code de sortie, sans ouvrir de terminal ;
- **Logs en direct** avec auto-scroll intelligent ;
- Les onglets préservent ce qui tourne quand vous alternez, avec boutons d'effacement.

### Routines (raccourcis par conteneur)
- Créez des boutons comme `htop`, `npm run dev` ou `composer install` ;
- **Routines partielles** : la commande fixe (ex. : `cd /home/projet`) demande son complément à l'exécution (ex. : `&& npm install`) ;
- **Marqueur `[--]`** : écrivez `[--]` dans la commande pour indiquer **où** le complément entre, et pas seulement à la fin — le texte saisi remplit **tous** les marqueurs (ex. : `cd /app/[--] && npm run [--]`) ;
- **Le nom et la commande se replient tout seuls** quand ils sont longs, et les sauts de ligne que vous tapez (Entrée) sont respectés à l'exécution ;
- Chaque routine tourne dans **son propre terminal attaché à sa ligne**, visible tant que le processus vit (parfait pour `npm run dev`), avec **indicateur d'exécution**, réduction et bouton d'arrêt ;
- Sauvegardées par nom de conteneur : elles survivent aux recréations.

### Projets Compose
- Indiquez le dossier de vos projets et DockDesk **trouve les `docker-compose.yml` tout seul** (jusqu'à 4 niveaux, en ignorant `node_modules` et similaires) ;
- **Lancer (`up -d`), arrêter et redémarrer** en un clic, console avec sortie en temps réel et compteur de services actifs ;
- Boutons contextuels : « Lancer » disparaît quand tout tourne ; « Redémarrer/Arrêter » n'apparaissent que si quelque chose tourne.

### Images, volumes et réseaux
- Tous groupés par leur projet Compose, avec accordéons réordonnables ;
- Suppression protégée (avertit quand la ressource est utilisée) ;
- Les réseaux par défaut de Docker sont marqués et protégés contre la suppression.

### Expérience
- **Thème clair/sombre** en un clic ;
- **6 langues** : Português (BR), English, 中文, हिन्दी, Español et Français, dans l'interface et la zone de notification ;
- **Zone de notification** : fermer masque dans la tray ; options de lancement au démarrage et de démarrage masqué ;
- **Instance unique** : rouvrir ne fait que focaliser la fenêtre existante ;
- L'ordre des groupes, le thème, la langue et l'état des accordéons persistent entre les sessions.

![DockDesk, vue des conteneurs](../screenshot-containers.png)

## Installation

Téléchargez le dernier `.AppImage` dans [Releases](https://github.com/vitormoreiradesenvolvedor/dockdesk-linux/releases), rendez-le exécutable et lancez-le :

```bash
chmod +x DockDesk-*.AppImage
./DockDesk-*.AppImage
```

**Prérequis :** Linux avec Docker Engine actif et votre utilisateur dans le groupe `docker`
(`sudo usermod -aG docker $USER`) ; Docker Compose v2 pour la zone projets.

## Développement

```bash
npm install          # active aussi les hooks git du projet
npm start            # build du renderer + ouvre l'app
npm run test:e2e     # tests end-to-end (Playwright + Docker réel)
npm run dist         # génère l'AppImage dans release/
```

- **Architecture :** `electron/` (processus principal : Docker via socket avec dockerode, exposé par `contextBridge`) · `src/` (React + TypeScript + Vite, terminal avec xterm.js) · `tests/e2e/` (Playwright pilotant la vraie app).
- **Flux git et gouvernance :** règles de branches, commits, PRs et release automatisée dans [docs/git/governanca.fr.md](../git/governanca.fr.md).
