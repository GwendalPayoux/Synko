# Développement et feuille de route

## Workflow

Node 24, pnpm 11. `pnpm dev` lance API et Vite ; `pnpm build` vérifie TypeScript puis compile. `pnpm test` exécute les tests Node sans serveur préexistant. `pnpm test:e2e` exige un build et Chromium Playwright ; les tests créent un serveur temporaire sur 3199, sans utiliser la base personnelle.

Conventions : composants React en PascalCase, fichiers TypeScript front ; modules serveur `.mjs` ESM ; dates ISO ; noms SQL snake_case ; chaînes métier françaises dans l’UI ; identifiants techniques anglais. Toute mutation métier exige validation serveur, permission, portée entreprise, transaction si plusieurs écritures, et journal si pertinente. Aucun secret dans le code. Un module nouveau doit modifier le tableau de couverture du README.

Git : `main` stable après validation CI, branches `codex/<sujet>` ou `feature/<sujet>`, PR avant intégration, commits descriptifs `feat:`, `fix:`, `test:`, `docs:`. Pas de push forcé ni suppression distante automatique. Le premier import peut être poussé sur une branche `codex/synko-foundations` si l’accès d’écriture est accordé.

## Étapes

1. **Livré dans ce socle** : interface, thème, API, migrations, inscriptions entreprises, sessions, rôles, invitations par lien, projets, tâches, Gantt simple, Kanban/liste, calendrier personnel, import/version/téléchargement documentaire, journal, tests.
2. **Compléter la sécurité d’accès** : vérification des e-mails, récupération par jeton à usage unique, invitations de comptes existants, changement d’organisation, gestion des rôles/retraits, partage client explicite, audits de connexion et de téléchargement. Stockage objet, contrôle antivirus et limites par entreprise.
3. **Compléter la planification** : sous-tâches, dépendances avec prévention des cycles, commentaires, pièces jointes, filtrage avancé, événements, charge ; préciser la règle de recalcul des dépendances avant propagation automatique des dates.
4. **Compléter les documents** : dossiers, déplacement/archivage, aperçu sécurisé, restauration par nouvelle version, validations avec décisions immuables et refus motivé.
5. **Modules avancés** : révisions de budget, dépenses et engagements, catégories, notifications persistantes + outbox, modèles versionnés, tableau PMO. Ajouter une intégration seulement avec fournisseur/configuration et tests réels.
6. **Industrialiser** : PostgreSQL et migration des données, tests de charge, sauvegardes/restauration automatisées, HTTPS et secrets de déploiement, observabilité, accessibilité, politique RGPD, tests Firefox/WebKit. Ensuite desktop et mobile selon demande.
7. **IA** : service serveur désactivé tant qu’organisation, consentement et fournisseur ne sont pas configurés. Pas d’appel depuis le navigateur avec une clé. D’abord résumé de projet avec périmètre strict, traçabilité, contrôle d’accès et coût borné.

## Validation

Tests intégration : inscription, session, création de projets/tâches, injection stockée sans exécution SQL, dates invalides, isolation entreprise, restrictions de rôle, accès membre projet, révisions concurrentes, versions de fichiers et octets téléchargés, CSRF par origine, activité et réouverture de base.

Tests E2E desktop + mobile : inscription, création du projet et tâche affectée, décalage du Gantt au clavier, édition depuis Kanban, synchronisation liste, import et téléchargement, version supplémentaire, retour tableau de bord, thèmes, absence de débordement horizontal global, déconnexion/reconnexion. Un test desktop supplémentaire vérifie le déplacement et le redimensionnement Gantt à la souris, puis le glisser-déposer Kanban avec vérification des valeurs persistées. Ce test souris est volontairement ignoré sur mobile, dont le parcours utilise les formulaires tactiles. Les jalons doivent encore recevoir leur propre parcours E2E.

Tests manquants identifiés : charge, réseau interrompu, permissions exhaustives de tous les endpoints, expiration des invitations/sessions avec horloge contrôlée, reprise après crash, antivirus, lecteurs d’écran. La CI n’est considérée verte qu’après exécution sur GitHub, pas après simple création du YAML.
