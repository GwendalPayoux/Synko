# Extension métier de Synko · 18 octobre 2026

## Organisation du code

Les modules complémentaires sont isolés dans `server/modules.mjs` (métier), `server/accounts.mjs` (comptes et opérateur), `server/planning.mjs` (règles et calculs), `server/workload.mjs` (charge), `server/templates.mjs` (structures de départ). Les routes du socle restent compatibles. Les composants se trouvent dans `src/modules.tsx` et `src/portfolio.tsx` ; les vues existantes consomment les mêmes données persistantes.

## Migrations et modèle

002 : archivage des projets, parent et effort des tâches, dépendances, dossiers, métadonnées et partage documentaire, commentaires, liens tâche/document, validations par version, révisions et écritures budgétaires, événements, notifications, modèles.

003 : jetons de compte hachés, date de vérification e-mail, capacité opérateur explicite et journal des opérations de sécurité.

004 : gardes relationnelles SQL empêchant de rattacher un parent de tâche/dossier ou un document à un autre projet, même avec un accès SQL direct.

005 : capacité hebdomadaire des membres et indisponibilités datées.

Toutes les relations métier sont contrôlées côté serveur par entreprise et projet, en plus des clés étrangères. Les cycles hiérarchiques et de dépendances sont refusés. La suppression d’une tâche parente est refusée tant qu’elle possède des enfants. Retirer un membre désaffecte ses tâches et clôt ses demandes de validation en attente avec un motif tracé.

## Règles de gestion

- Dépendance fin-début : le successeur doit commencer après la date de fin du prédécesseur. Les conflits sont affichés ; aucune propagation automatique n’est imposée.
- Les changements de tâche et les décisions documentaires sont revérifiés dans la transaction afin que deux requêtes concurrentes ne puissent pas écraser une révision ou décider deux fois.
- Une validation vise une version immuable, jamais le document « courant » de manière ambiguë. Un refus nécessite un motif. La restauration copie les octets sous une nouvelle clé et crée une nouvelle version.
- Budget : réel + engagements restant à payer + prévisions complémentaires = coût prévisionnel. Marge = budget révisé − coût prévisionnel. Reclasser un engagement en réel évite son double comptage. Les montants sont des entiers en centimes d’euro ; les révisions sont conservées.
- Charge : effort restant pondéré par la progression et réparti sur les dates restantes. Sur sept jours glissants, la capacité est proratisée aux jours ouvrés disponibles. C’est un indicateur de planification, pas un suivi de temps facturable.
- Les modèles copient des structures réelles, avec nouveaux identifiants et dates relatives. Ils ne copient ni utilisateurs, ni données documentaires confidentielles, ni budgets.
- Notifications : affectations/modifications de tâches et demandes/décisions de validation persistées. Les alertes d’échéance sont dédupliquées à la consultation. Le retrait d’un projet masque ses notifications au membre retiré.

## Limites et suite

La couverture actuelle figure dans le README. L’industrialisation reste distincte : PostgreSQL, stockage objet, antivirus, véritable livraison d’e-mail, tâches d’arrière-plan, OAuth Google/Microsoft, connecteur IA consenti, audit complet, rétention configurable, suppression/anonymisation RGPD, quotas, tests de charge, revue d’accessibilité et reprise après sinistre. L’opérateur plateforme dispose désormais d’un back-office de gestion des entreprises, comptes, droits et projets, avec suspension, réactivation et journal. La facturation reste non développée. Les approbations ne valent pas signature électronique. La lecture documentaire propose désormais une page à deux panneaux avec versions, validations et commentaires en onglets ; les paramètres sont organisés par sections et la déconnexion reste accessible dans leur en-tête.
