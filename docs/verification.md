# Vérifications locales · extension du 21 octobre 2026

TypeScript et compilation de production réussis. Onze tests Node unitaires et d’intégration réussis : comptes, permissions, isolation, concurrence, métiers, sauvegarde/restauration, aperçus, charge, administration plateforme et création atomique depuis un modèle.

Onze parcours Chromium desktop et profil iPhone 13 réussis. Ils couvrent la création d’entreprise et d’utilisateur, les filtres du back-office, l’accès administratif explicite, le modèle événement, les icônes, la conservation des modifications entre onglets et l’ouverture des détails tâche/document depuis les notifications. Le test spécifique aux gestes souris est volontairement ignoré sur mobile. Ce profil ne constitue pas un test Safari natif. Les captures locales sont dans `artifacts/` ; fiche tâche desktop et lecteur mobile inspectés.

Les tests utilisent des bases et fichiers temporaires. Le compte opérateur E2E est généré avec un mot de passe aléatoire uniquement dans la base éphémère ; ses identifiants ne sont pas ceux des comptes locaux. La base utilisateur a été sauvegardée avant migration 006 et le service local redémarré ; API et interface répondent HTTP 200. Les résultats GitHub Actions doivent être vérifiés séparément ; aucune affirmation de conformité, de sécurité exhaustive ou de performance en charge n’en découle.
