# Sécurité et exploitation

## État actuel

Socle de validation locale. Mots de passe salés via scrypt asynchrone, cookies HttpOnly/SameSite=Lax, sessions aléatoires hachées et expirables. Contrôles entreprise/projet/rôle sur chaque route métier, clés étrangères composites, requêtes SQL préparées, limite JSON 64 Ko, fichier 20 Mo. Origine stricte pour les mutations ; limitation des endpoints d’authentification à 30 tentatives par IP sur 15 minutes en mémoire. Ne pas faire confiance à un en-tête proxy pour l’IP. En production derrière proxy, adapter la limitation à une adresse résolue de façon fiable et à un stockage partagé.

Pas de clé externe ni compte de démonstration. Fichiers sous nom UUID, hors du dossier servi, téléchargement après contrôle d’accès, `application/octet-stream` et `attachment`, `nosniff`. Empreinte SHA-256 pour comparer les versions. Pas d’exécution ni aperçu HTML/PDF dans le navigateur. Réponse CSP, protection framing, referrer same-origin, erreurs internes masquées avec identifiant de requête. Le mode dev Vite n’est pas destiné à être exposé sur Internet.

Le droit opérateur plateforme doit être accordé explicitement par la CLI locale ; il ne donne pas accès aux contenus des autres entreprises. Les lecteurs ne voient pas les documents marqués internes, les budgets ni les charges. Les téléchargements sont journalisés, et les opérations de compte sensibles possèdent un journal de sécurité ; l’audit exhaustif reste à compléter. Les invitations sont des liens porteurs secrets ; ne pas les publier. Toute personne connaissant le lien peut s’inscrire pour l’e-mail désigné avant vérification effective de son adresse. Le transport local permet de valider le parcours de vérification mais ne prouve pas la possession d’une boîte e-mail distante ; un fournisseur de production doit être implémenté et la vérification rendue obligatoire avant exposition publique.

## Avant production

- PostgreSQL, connexions bornées, migrations déployées séparément et tests d’isolation réexécutés ; RLS en défense supplémentaire avec contexte transactionnel strict.
- HTTPS derrière reverse proxy, `SECURE_COOKIES=true`, `APP_ORIGIN` exact, en-tête HSTS au proxy, `HOST` adapté uniquement à l’hébergement choisi.
- Stockage objet privé, quotas entreprise/utilisateur, antivirus et quarantaine, liens temporaires contrôlés, chiffrement au repos et sauvegardes.
- Transport e-mail de production et politique de vérification obligatoire, MFA pour administrateurs, observabilité et alertes. Les jetons de reset/vérification réels et les sessions révocables sont déjà implémentés.
- Journal d’audit des actions sensibles et lectures de fichiers, rétention maîtrisée, accès restreint, stockage immuable selon besoins.
- Revue de dépendances et sécurité, tests de charge, limites globales de taille, temps de requête et quotas. Inscription publique configurable via `ALLOW_REGISTRATION=false`.
- Ne pas considérer ce document comme certification de conformité ou audit externe.

## Sauvegarde locale cohérente

1. Arrêter proprement l’API (Ctrl+C) et vérifier qu’aucun processus Synko n’écrit.
2. Copier **tout le dossier `data`** vers un emplacement sécurisé, chiffré et distinct du poste. Base, fichiers et éventuels journaux SQLite doivent rester ensemble.
3. Conserver la version du code et du schéma correspondante. Ne pas sauvegarder uniquement `synko.sqlite` pendant que WAL est actif.
4. Tester régulièrement la restauration sur une copie : démarrer avec `DATA_DIR` pointant vers cette copie, vérifier connexion, projets et téléchargement de plusieurs versions.

Une sauvegarde à chaud cohérente est également disponible : `pnpm backup:local`. Le script utilise l’API de sauvegarde SQLite, copie les fichiers immuables référencés par cet instantané et vérifie leurs empreintes. Le manifeste contient les sommes SHA-256. Les liens de compte de la boîte d’envoi locale et les configurations ne sont pas inclus.

Restauration non destructive : `pnpm restore:local -- chemin-sauvegarde nouveau-dossier` (ou `node scripts/restore.mjs chemin-sauvegarde nouveau-dossier`). La destination doit être inexistante. Les empreintes, l’intégrité SQLite et les clés étrangères sont contrôlées. Démarrer une instance avec `DATA_DIR` pointant vers cette copie ; ne jamais remplacer la base active à chaud. Le test métier vérifie un aller-retour avec versions documentaires. La planification automatique, le chiffrement et le stockage hors site restent à configurer.

## Données personnelles et RGPD

Données stockées : nom/e-mail/mot de passe haché, entreprise, appartenances, sessions, fichiers et activité. Aucun transfert vers IA, analytics, calendrier ou e-mail externe. L’hébergement, la durée de conservation, les bases légales, la politique de confidentialité et les accords de sous-traitance doivent être définis par Synapt avant commercialisation. L’export personnel JSON est implémenté pour profil, tâches et commentaires. La suppression/anonymisation, la rétention configurable et la clôture d’organisation restent à développer. Ne pas importer de documents clients confidentiels sur un environnement d’essai non maîtrisé.

## Transport de compte en développement

`MAIL_MODE=local` écrit les instructions réelles dans `data/mail-outbox`, hors du dossier public. Les liens sont des secrets temporaires : ne pas les committer ni les partager. Le reset expire après 30 minutes, la vérification après 24 heures. Une utilisation invalide le jeton ; une réinitialisation révoque les sessions. Les endpoints de récupération sont limités à 20 requêtes par IP sur 15 minutes. Le transport est désactivé en production et aucune livraison externe n’est simulée.
