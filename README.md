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

Pour inviter une personne : Paramètres → Inviter → transmettre le lien généré (72 h, lié à l’adresse e-mail) → après inscription, Équipe du projet → ajouter le membre. Les invitations ne sont pas envoyées par e-mail. Un compte existant ne peut pas encore accepter une seconde appartenance.

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

Pour servir le build sans Vite : définir `APP_ORIGIN=http://127.0.0.1:3100` dans `.env`, puis `pnpm start` et ouvrir cette adresse. L’API et les fichiers compilés sont servis sur le même port. En développement, Vite relaie `/api` vers le port 3100.

## Stockage et sécurité

La base est créée automatiquement dans `data/synko.sqlite`. Les migrations SQL sont versionnées et appliquées au démarrage. Les fichiers privés sont dans `data/files`, hors du dossier web public. Ne pas supprimer `data` : il contient toutes les données réelles. Ne jamais le committer.

Les sessions ont une durée de 7 jours, leur identifiant est haché en base, le cookie est HttpOnly/SameSite. Les mots de passe utilisent scrypt avec sel aléatoire. Les mutations exigent l’origine configurée. L’API vérifie entreprise, rôle et accès au projet. Les administrateurs entreprise et PMO voient tous les projets de leur entreprise ; les autres rôles uniquement ceux auxquels ils appartiennent. Un lecteur voit tout le contenu d’un projet auquel il est ajouté : le partage document par document n’est pas encore disponible.

**Ce socle est destiné à la validation locale, pas à une ouverture commerciale immédiate.** HTTPS, cookies Secure, vérification des e-mails, récupération de mot de passe, stockage objet avec antivirus, PostgreSQL, sauvegardes automatisées et revue de sécurité restent des prérequis de production. Voir [sécurité et exploitation](docs/security.md).

## Périmètre livré

| Module                                | État                                            | Périmètre réel                                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification                      | Partiellement opérationnelle                    | Inscription entreprise, connexion, expiration, déconnexion, révocation de toutes les sessions, édition du nom ; pas de réinitialisation ni vérification e-mail                           |
| Organisations et permissions          | Partiellement opérationnelles                   | Isolation entreprise, 5 rôles entreprise, invitations, appartenance projet ; pas d’administrateur plateforme ni édition des rôles                                                        |
| Projets                               | Partiellement opérationnels                     | Création, cartes/liste, recherche, favoris locaux, tri, budget initial, statut et clôture ; édition générale et archivage absents                                                        |
| Tâches et jalons                      | Partiellement opérationnels                     | Création, édition, suppression confirmée, dates, affectation, priorité, statut, progression, révision anti-écrasement ; pas de sous-tâches/dépendances/commentaires                      |
| Gantt                                 | Partiellement opérationnel                      | Vue par défaut, déplacement, redimensionnement, trois zooms, défilement, édition clavier et jalons ; fenêtre limitée à 730 jours, pas de chemin critique ni dépendances                  |
| Kanban et liste                       | Opérationnels pour les tâches livrées           | Données partagées, glisser-déposer Kanban sur desktop, édition par panneau et statuts dans la liste                                                                                      |
| Tableau de bord et calendrier         | Partiellement opérationnels                     | Tâches affectées, mois/semaine/agenda, indicateurs calculés ; pas de réunions ni création d’événements ni synchronisation externe                                                        |
| Documents                             | Partiellement opérationnels                     | Import binaire réel (20 Mo), téléchargement autorisé, versions immuables, historique et empreintes SHA-256, recherche ; pas de dossiers, aperçu, restauration, suppression ni validation |
| Équipe                                | Partiellement opérationnelle                    | Invitations et ajout de membres existants au projet ; pas de retrait, charge ni disponibilités                                                                                           |
| Activité                              | Opérationnelle sur les mutations projet livrées | Journal serveur transactionnel, 100 dernières actions consultables                                                                                                                       |
| Budget                                | Partiellement opérationnel                      | Budget initial en centimes ; dépenses, engagements, révisions, calcul d’écart absents                                                                                                    |
| Notifications                         | Partiellement opérationnelles                   | Alertes d’échéances calculées ; pas de notifications persistantes ni lu/non lu                                                                                                           |
| IA, modèles, signatures, intégrations | Non développés                                  | Aucun service appelé ni résultat simulé                                                                                                                                                  |

**Aucune fonctionnalité métier simulée.** Les états vides sont intentionnels. La présence d’un écran ne vaut pas implémentation de tout le module.

## Documentation

- [Architecture, choix et modèle cible](docs/architecture.md)
- [Direction graphique et tokens](docs/design-system.md)
- [Contrat API](docs/api.md)
- [Développement et plan d’implémentation](docs/development.md)
- [Sécurité, sauvegarde et déploiement](docs/security.md)

Les tests API et navigateur utilisent des bases temporaires, jamais `data/`. La CI compile, teste l’API et exécute le parcours E2E desktop/mobile. Les captures locales sont générées dans `artifacts/` (ignoré par Git).
