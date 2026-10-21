# Vérifications locales · extension du 21 octobre 2026

TypeScript et compilation de production réussis. Onze tests Node unitaires et d’intégration réussis : comptes, permissions, isolation, concurrence, métiers, sauvegarde/restauration, aperçus, charge, administration plateforme et création atomique depuis un modèle.

Treize parcours Chromium desktop et profil iPhone 13 réussis (suite générale et reprise ciblée après correction des clics de cartes). Ils couvrent la création d’entreprise et d’utilisateur, les filtres du back-office, l’accès administratif explicite, le modèle événement, les icônes, la conservation des modifications entre onglets et l’ouverture des détails tâche/document depuis les notifications. Le test spécifique aux gestes souris est volontairement ignoré sur mobile. Ce profil ne constitue pas un test Safari natif. Les captures locales sont dans `artifacts/` ; fiche tâche desktop et lecteur mobile inspectés.

Les nouveaux contrôles couvrent aussi le calendrier personnel, le filtre initial des projets actifs, la couleur du projet et les clics sur les lignes documentaires. Les tests serveur vérifient le rattachement automatique lors de la création et de la promotion d’un administrateur, ainsi que le refus de son retrait par un chef de projet.

Les tests utilisent des bases et fichiers temporaires. Le compte opérateur E2E est généré avec un mot de passe aléatoire uniquement dans la base éphémère ; ses identifiants ne sont pas ceux des comptes locaux. La base utilisateur a été sauvegardée avant migration 007 et le service local redémarré ; API et interface répondent HTTP 200. Les résultats GitHub Actions doivent être vérifiés séparément ; aucune affirmation de conformité, de sécurité exhaustive ou de performance en charge n’en découle.
