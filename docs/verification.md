# Vérifications locales · 17 octobre 2026

- Installation `pnpm install --frozen-lockfile` réussie, scripts esbuild autorisés explicitement.
- Compilation de production Vite réussie, contrôle TypeScript sans erreur.
- Quatre tests Node réussis : parcours API/intégration, mots de passe, validation et permissions.
- Deux parcours navigateur complets réussis : Chromium desktop et viewport iPhone 13 avec Chromium (ce n’est pas un test Safari natif).
- Test des gestes souris Gantt/Kanban réussi sur desktop : dates et statuts relus via API. Ce test n’est pas exécuté sur mobile.
- Rendus desktop/mobile et thème sombre inspectés à partir des captures Playwright.
- Formatage Prettier vérifié.

Les données des tests sont créées dans des dossiers temporaires, sans compte ou projet préchargé dans l’application livrée. Captures et traces restent hors de Git. Ces vérifications ne constituent pas un audit de sécurité ni une validation de tous les modules du cahier des charges. L’exécution distante de la CI GitHub doit être vérifiée séparément.
