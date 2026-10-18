# Vérifications locales · extension métier du 18 octobre 2026

Contrôle TypeScript et compilation de production réussis. Huit tests Node unitaires et d’intégration réussis (comptes, permissions, concurrence, métiers, sauvegarde/restauration et calcul de charge). Cinq parcours Chromium desktop et profil iPhone 13 réussis, incluant les nouveaux modules ; ce profil ne constitue pas un test Safari natif. Captures budget/documents inspectées dans `artifacts/`. Le test spécifique aux gestes souris est volontairement ignoré sur mobile.

Les tests utilisent des bases et fichiers temporaires. La base utilisateur fait l’objet d’une sauvegarde avant migration. Les résultats GitHub Actions doivent être vérifiés séparément ; aucune affirmation de conformité, de sécurité exhaustive ou de performance en charge n’en découle.
