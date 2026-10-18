# Développement

Node 24 LTS, pnpm 11. `pnpm dev` démarre API et Vite ; `pnpm build` contrôle TypeScript et compile ; `pnpm test` exécute les tests unitaires/API ; `pnpm test:e2e` démarre un serveur de test temporaire et vérifie desktop/mobile avec Chromium. `pnpm format:check` vérifie le formatage.

Les identifiants sont stables, les dates ISO, les montants en centimes. Toute mutation doit vérifier entreprise, accès au projet et capacité métier côté serveur. Écritures multiples : transaction. Toute nouvelle règle doit posséder un test d’intégration et les opérations importantes un journal. Ne pas committer `data/`, `.env`, les captures ou les secrets.

Git : branches de travail `codex/<sujet>`, commits descriptifs, aucun push forcé. La CI GitHub compile, vérifie le style, exécute les tests Node et les parcours E2E.

## Couverture actuelle

Tests API : organisations, rôles, invitations nouvelles/existantes, sessions, mots de passe/jetons à usage unique, export, plateforme, données persistantes, isolation inter-entreprises, hiérarchie et cycles, commentaires, documents internes, dossiers, restauration, validations immuables et concurrentes, calcul budgétaire et dépassement, charge et disponibilités, notifications, copies de modèles, retrait et archivage.

Tests navigateur : connexion/création, Gantt clavier et souris avec redimensionnement, Kanban, documents, thème et responsive ; parcours additionnel sous-tâche/dépendance/commentaire, budget, dossier, aperçu, approbation, modèle, édition projet et événement sur desktop/mobile. Le test spécifique aux gestes souris n’est pas exécuté sur le profil tactile.

## Suite de développement

Se reporter au tableau de couverture du README et aux limites explicites de [l’extension métier](business-release.md). Priorités de production : adaptateur PostgreSQL et reprise des données, stockage objet/antivirus, fournisseur e-mail, outbox de notifications avec worker, audit et rétention, RGPD, charge et sécurité, puis intégrations externes configurées. Aucun test local ne constitue une certification de conformité.
