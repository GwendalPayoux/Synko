# Synko · by Synapt

Premier socle fonctionnel de la plateforme de gestion de projets Synko. Interface française, responsive, claire et sombre. Aucun compte, projet ou document fictif n’est créé au démarrage.

## Démarrage

Prérequis : **Node.js 24 LTS**, **pnpm 11** (gestionnaire de paquets), navigateur récent.

```sh
pnpm install --frozen-lockfile
# Facultatif : copier .env.example vers .env
pnpm dev
```

Ouvrir **http://localhost:5173** (utiliser ce nom d’hôte précis pour respecter la protection d’origine). Cliquer sur « Créer un espace », saisir son nom, son entreprise, son e-mail et un mot de passe d’au moins 12 caractères. Le compte devient administrateur de sa nouvelle entreprise. Créer un projet, puis une tâche affectée à soi-même : elle apparaît dans le Gantt, le Kanban, la liste, le calendrier personnel et « Mes tâches ».

Pour inviter une personne : Paramètres → Inviter → transmettre le lien généré (72 h, lié à l’adresse e-mail) → après inscription, Équipe du projet → ajouter le membre. Les invitations ne sont pas envoyées par e-mail. Un compte existant peut accepter une invitation puis changer d’organisation dans ses paramètres.

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

Pour servir le build sans Vite : définir `APP_ORIGIN=http://127.0.0.1:3100` dans `.env`, puis `pnpm start` et ouvrir cette adresse. L’API et les fichiers compilés sont servis sur le même port. En développement, Vite relaie `/api` vers le port 3100.

## Stockage et sécurité

La base est créée automatiquement dans `data/synko.sqlite`. Les migrations SQL sont versionnées et appliquées au démarrage. Les fichiers privés sont dans `data/files`, hors du dossier web public. Ne pas supprimer `data` : il contient toutes les données réelles. Ne jamais le committer.

Les sessions ont une durée de 7 jours, leur identifiant est haché en base, le cookie est HttpOnly/SameSite. Les mots de passe utilisent scrypt avec sel aléatoire. Les mutations exigent l’origine configurée. L’API vérifie entreprise, rôle et accès au projet. Les administrateurs entreprise et PMO voient tous les projets de leur entreprise ; les autres rôles uniquement ceux auxquels ils appartiennent. Un lecteur accède aux projets autorisés et à leurs documents partagés ; les documents internes, budgets et charges sont exclus côté serveur.

**Ce socle est destiné à la validation locale, pas à une ouverture commerciale immédiate.** HTTPS, cookies Secure, transport d’e-mail de production, stockage objet avec antivirus, PostgreSQL, sauvegardes automatisées et revue de sécurité restent des prérequis de production. Voir [sécurité et exploitation](docs/security.md).

## Périmètre livré

| Module                                | État                                 | Périmètre réel et limites                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comptes                               | Partiellement opérationnels          | Connexion, changement de mot de passe, sessions listées/révocables, export JSON personnel. Récupération et vérification par jetons réels à usage unique via boîte d’envoi locale optionnelle ; aucun e-mail externe.                                                                                                                |
| Organisations et rôles                | Partiellement opérationnels          | Cinq rôles entreprise, changement de rôle avec protection du dernier administrateur, invitations de comptes nouveaux ou existants, changement d’organisation. Registre plateforme en lecture pour un opérateur explicitement habilité par CLI. Pas de suspension globale d’entreprise ni de facturation.                            |
| Projets                               | Opérationnels sur le périmètre livré | Création et édition nom/description/dates/responsable/couleur/statut, transfert de responsabilité, archivage/restauration, recherche, tri, favoris et préférences locales.                                                                                                                                                          |
| Tâches et jalons                      | Opérationnels sur le périmètre livré | Création, édition, suppression confirmée, sous-tâches, dépendances fin-début sans cycles, charge estimée, commentaires, documents liés, historique et contrôle de révision.                                                                                                                                                         |
| Gantt                                 | Partiellement opérationnel           | Déplacement, redimensionnement, clavier, zoom, hiérarchie et traits de dépendances avec conflits signalés. Pas de déplacement automatique en cascade ni de calcul de chemin critique ; fenêtre de 730 jours.                                                                                                                        |
| Kanban et liste                       | Opérationnels sur le périmètre livré | Statuts partagés, glisser-déposer desktop, panneau d’édition tactile, recherche et filtre de statut.                                                                                                                                                                                                                                |
| Calendrier                            | Partiellement opérationnel           | Tâches et événements projet, vues mois/semaine/agenda, filtres projet/type, création et suppression d’événements. Dates entières, pas d’horaires, récurrence ou synchronisation externe.                                                                                                                                            |
| Documents                             | Partiellement opérationnels          | Dossiers imbriqués, renommage/déplacement, archivage, partage interne/projet, imports/téléchargements réels, versions et restauration par nouvelle version, commentaires, validations de version avec refus motivé et décisions non réinscriptibles. Aperçu texte jusqu’à 1 Mo ; pas d’aperçu PDF/Office ni signature électronique. |
| Équipes et charge                     | Partiellement opérationnelles        | Ajout/retrait, désaffectation sûre des tâches, capacités hebdomadaires et indisponibilités, charge estimée sur sept jours et alertes. Calcul simple par jours calendaires pour les efforts et jours ouvrés pour les capacités, sans calendrier de jours fériés ni nivellement des ressources.                                       |
| Budget                                | Opérationnel sur le périmètre livré  | Budget initial/révisé, révisions motivées, dépenses, engagements, prévisions complémentaires, reclassement engagement → réel, répartition par catégorie, écart et alerte de dépassement. Devise EUR, centimes entiers. Pas de comptabilité/facturation ou justificatifs financiers.                                                 |
| Notifications                         | Partiellement opérationnelles        | Notifications persistantes, déduplication, lu/non lu, affectations, modifications et validations. Échéances calculées à la consultation ; pas de worker, push ou e-mail en arrière-plan.                                                                                                                                            |
| Modèles                               | Partiellement opérationnels          | Modèles informatique/organisationnel/technique et création de modèles depuis un projet ; copie des tâches, hiérarchie, dépendances, charges et dossiers, dates recalées. Les affectations, workflows d’approbation, fichiers et budgets ne sont pas copiés.                                                                         |
| Portefeuille PMO                      | Opérationnel sur le périmètre livré  | Vue entreprise des avancements, retards, échéances et marges budgétaires, accès direct aux projets. Pas de portefeuilles personnalisés.                                                                                                                                                                                             |
| Activité et sécurité                  | Partiellement opérationnelles        | Journal transactionnel des mutations principales et téléchargements, événements de sécurité pour opérations de compte et registre plateforme. Couverture d’audit exhaustive et rétention réglementaire à compléter.                                                                                                                 |
| IA, signatures, intégrations externes | Non développées                      | Aucun résultat simulé ni envoi de données à un service externe.                                                                                                                                                                                                                                                                     |

**Aucune fonctionnalité métier simulée.** Les états vides sont intentionnels. La présence d’un écran ne vaut pas implémentation de tout le module.

## Documentation

- [Architecture, choix et modèle cible](docs/architecture.md)
- [Direction graphique et tokens](docs/design-system.md)
- [Contrat API](docs/api.md)
- [Développement et plan d’implémentation](docs/development.md)
- [Sécurité, sauvegarde et déploiement](docs/security.md)

Les tests API et navigateur utilisent des bases temporaires, jamais `data/`. La CI compile, teste l’API et exécute le parcours E2E desktop/mobile. Les captures locales sont générées dans `artifacts/` (ignoré par Git).

## Comptes et exploitation locale

Pour tester la récupération : définir `MAIL_MODE=local` dans `.env`, redémarrer, puis utiliser « Mot de passe oublié ». Les messages contenant les liens réels sont déposés dans `data/mail-outbox/` et ne sont accessibles que sur disque. Les jetons sont hachés en base, expirants et à usage unique ; un reset révoque toutes les sessions. Le transport local est forcé à désactivé avec `NODE_ENV=production`. Aucun transport SMTP de production n’est implémenté.

Pour habiliter un compte opérateur existant : `node scripts/platform-admin.mjs compte@entreprise.fr`. Cette action locale explicite est journalisée ; aucun endpoint public ne peut accorder ce droit. Le registre global apparaît ensuite dans les paramètres. Ce droit ne donne aucun accès implicite aux documents des autres entreprises.

Les migrations 002 à 005 étendent la base existante sans remplacer les comptes, projets ou fichiers. Sauvegarder avant le premier redémarrage d’une version migrante. Voir [le lot métier livré](docs/business-release.md).

Sauvegarde à chaud : `pnpm backup:local`. Restauration vérifiée vers un dossier neuf : `node scripts/restore.mjs chemin-sauvegarde nouvelle-destination`. Aucun écrasement de dossier existant n’est autorisé. La copie distante, le chiffrement et la planification automatique restent des opérations d’exploitation à configurer.
