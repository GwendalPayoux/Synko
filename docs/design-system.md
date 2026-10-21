# Identité et Design System

Synko : calme, structuré, précis. Fond ivoire, surfaces blanches, texte encre, accent vert forêt et sauge. Aucune image distante ni police chargée sur un service externe. Police système contemporaine (Inter si installée, sinon Segoe UI/sans-serif). Icônes Lucide, traits homogènes et tailles 14–24 px.

## Tokens implémentés

| Usage                       | Clair     | Sombre    |
| --------------------------- | --------- | --------- |
| Fond `--bg`                 | `#f7f8f5` | `#171e1b` |
| Surface `--surface`         | `#ffffff` | `#202a25` |
| Navigation `--sidebar`      | `#f0f3ee` | `#1b2420` |
| Texte `--text`              | `#27352f` | `#e0e9e1` |
| Secondaire `--muted`        | `#7a857f` | `#9caaa1` |
| Bordure `--line`            | `#e5e9e2` | `#344139` |
| Accent `--accent`           | `#315b4e` | `#91b9a1` |
| Accent doux `--accent-soft` | `#e5eee4` | `#304d3d` |

Les couleurs projet sauge, terracotta, ardoise, lavande identifient les projets sans dépendre d’une image. Statuts : texte explicite + point coloré. Typographie : titres de page 29–34 px, section 17–21 px, textes 11–14 px. Grille d’espacement 4/8/12/16/24/32, rayons 6–13 px, bordures fines, ombres réservées aux modales et messages flottants.

## Composants

`components.tsx` : Badge, Avatar, Progress, Empty, Modal, Field. CSS partagé : boutons primaire/secondaire/discret, boutons icône, recherche, champs, segments, navigation, onglets, cartes, tableaux, messages d’erreur, états de chargement. `dialog` natif gère focus, clavier Échap et modalité ; retour du focus à la fermeture. Suppression de tâche avec confirmation explicite.

Le mode sombre est une préférence locale, conservée au rechargement. Les favoris sont stockés localement par identifiant utilisateur. Les filtres restent en mémoire pendant la session de navigation mais ne sont pas encore persistés entre rechargements.

## Adaptation et accessibilité

Navigation latérale persistante sur desktop, tiroir sur mobile. Tableau et Gantt défilent dans leur propre conteneur. Calendrier en grille adaptable. Breakpoints 1500/1200/980/760 px. Focus visible ; boutons d’icône nommés ; champs associés à leurs labels ; progression exposée via ARIA ; erreurs `role=alert`, sauvegarde `role=status`. Le Gantt se déplace au clavier et s’édite aussi dans un formulaire ; le Kanban reste éditable par panneau sur tactile. Animations désactivables via `prefers-reduced-motion`.

Une conformité WCAG complète n’est pas certifiée. Avant production : audit de contraste (notamment petits textes secondaires), lecteurs d’écran, agrandissement 200 %, cibles tactiles et calendrier au clavier.

## Paramètres et lecture documentaire

Les paramètres utilisent une navigation de sections à gauche et une seule section active à droite. La déconnexion est dans l’en-tête visible, indépendant des formulaires. L’identité de la sidebar est informative et ne duplique pas l’accès aux paramètres.

Le clic sur le nom d’un document ouvre une vue de consultation dédiée : aperçu à gauche, onglets Informations / Versions / Validations / Commentaires à droite. Le raccourci d’historique ouvre directement l’onglet Versions dans cette même vue. Les panneaux défilent indépendamment sur desktop ; ils sont empilés sur mobile. Les anciennes versions se consultent sans restauration, avec indication explicite. Les métadonnées techniques sont repliées. Le retour à la liste replace le focus sur le nom du document.

La création d’un événement est accessible dans l’en-tête de la page Calendrier.

Les détails d’une tâche utilisent une boîte de dialogue à onglets (informations, planification, documents, discussion, historique). Les informations restent montées pendant la navigation pour préserver les modifications ; les actions restent en pied de dialogue. Les icônes de projets proviennent d’une liste Lucide homogène, sélectionnable au clavier. Les actions iconographiques avec aria-label affichent une infobulle au survol et à la prise de focus, y compris dans les dialogues natifs. Le menu latéral peut défiler sur les petits écrans.
