# Sécurité et exploitation

## État actuel

Socle de validation locale. Mots de passe salés via scrypt asynchrone, cookies HttpOnly/SameSite=Lax, sessions aléatoires hachées et expirables. Contrôles entreprise/projet/rôle sur chaque route métier, clés étrangères composites, requêtes SQL préparées, limite JSON 64 Ko, fichier 20 Mo. Origine stricte pour les mutations ; limitation des endpoints d’authentification à 30 tentatives par IP sur 15 minutes en mémoire. Ne pas faire confiance à un en-tête proxy pour l’IP. En production derrière proxy, adapter la limitation à une adresse résolue de façon fiable et à un stockage partagé.

Pas de clé externe ni compte de démonstration. Fichiers sous nom UUID, hors du dossier servi, téléchargement après contrôle d’accès, `application/octet-stream` et `attachment`, `nosniff`. Empreinte SHA-256 pour comparer les versions. Pas d’exécution ni aperçu HTML/PDF dans le navigateur. Réponse CSP, protection framing, referrer same-origin, erreurs internes masquées avec identifiant de requête. Le mode dev Vite n’est pas destiné à être exposé sur Internet.

Le rôle plateforme n’existe pas encore ; aucune élévation implicite. Le rôle lecteur partage tout le projet explicitement autorisé, pas une sélection documentaire fine. Les journaux métier actuels n’auditent pas encore toutes les opérations d’authentification, invitations et téléchargements. Les invitations sont des liens porteurs secrets ; ne pas les publier. Toute personne connaissant le lien peut s’inscrire pour l’e-mail désigné tant qu’une vérification e-mail réelle n’est pas développée.

## Avant production

- PostgreSQL, connexions bornées, migrations déployées séparément et tests d’isolation réexécutés ; RLS en défense supplémentaire avec contexte transactionnel strict.
- HTTPS derrière reverse proxy, `SECURE_COOKIES=true`, `APP_ORIGIN` exact, en-tête HSTS au proxy, `HOST` adapté uniquement à l’hébergement choisi.
- Stockage objet privé, quotas entreprise/utilisateur, antivirus et quarantaine, liens temporaires contrôlés, chiffrement au repos et sauvegardes.
- Vérification e-mail, réinitialisation à usage unique et expiration courte, gestion des sessions et accès, MFA pour administrateurs ; ajouter observabilité et alertes de sécurité.
- Journal d’audit des actions sensibles et lectures de fichiers, rétention maîtrisée, accès restreint, stockage immuable selon besoins.
- Revue de dépendances et sécurité, tests de charge, limites globales de taille, temps de requête et quotas. Inscription publique configurable via `ALLOW_REGISTRATION=false`.
- Ne pas considérer ce document comme certification de conformité ou audit externe.

## Sauvegarde locale cohérente

1. Arrêter proprement l’API (Ctrl+C) et vérifier qu’aucun processus Synko n’écrit.
2. Copier **tout le dossier `data`** vers un emplacement sécurisé, chiffré et distinct du poste. Base, fichiers et éventuels journaux SQLite doivent rester ensemble.
3. Conserver la version du code et du schéma correspondante. Ne pas sauvegarder uniquement `synko.sqlite` pendant que WAL est actif.
4. Tester régulièrement la restauration sur une copie : démarrer avec `DATA_DIR` pointant vers cette copie, vérifier connexion, projets et téléchargement de plusieurs versions.

Restauration : arrêter l’application, conserver le dossier actuel sous un autre nom, recopier la sauvegarde complète, relancer avec la version compatible. Aucun script destructif de restauration automatique n’est fourni. La sauvegarde à chaud et les tests de restauration automatisés restent à développer.

## Données personnelles et RGPD

Données stockées : nom/e-mail/mot de passe haché, entreprise, appartenances, sessions, fichiers et activité. Aucun transfert vers IA, analytics, calendrier ou e-mail externe. L’hébergement, la durée de conservation, les bases légales, la politique de confidentialité et les accords de sous-traitance doivent être définis par Synapt avant commercialisation. Export, suppression/anonymisation, rétention configurable et clôture d’organisation ne sont pas encore implémentés. Ne pas importer de documents clients confidentiels sur un environnement d’essai non maîtrisé.
