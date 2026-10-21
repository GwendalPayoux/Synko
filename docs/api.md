# Contrat API v0.1

Préfixe `/api`. Même origine que le frontend, cookie `synko_session` HttpOnly, expiration 7 jours. Mutations : en-tête `Origin` égal à `APP_ORIGIN` obligatoire. JSON sauf import binaire. Les tests montrent des exemples exécutables.

Réponse erreur : `{ "error": "message lisible", "request_id": "uuid" }`. Codes : 400 JSON invalide, 401 session absente, 403 permission/origine refusée, 404 entité inaccessible, 409 compte existant ou révision obsolète, 413 volume excessif, 422 validation, 429 limitation de tentatives, 500 erreur interne masquée. GET n’altère pas les données. L’API n’est pas encore décrite par un fichier OpenAPI.

| Méthode / route                                  | Contrat principal                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| GET `/health`                                    | `{ok:true}`, public                                                               |
| POST `/auth/register`                            | `{name,email,password,organization}` → 201 ; crée entreprise et administrateur    |
| POST `/auth/login`                               | `{email,password}` → cookie de session                                            |
| POST `/auth/accept`                              | `{name,email,password,token}` → 201 ; consomme invitation                         |
| POST `/auth/logout`                              | Révoque la session courante                                                       |
| POST `/auth/logout-all`                          | Révoque toutes les sessions de l’utilisateur                                      |
| GET `/me`                                        | Identité, organisation active, rôle, permissions                                  |
| PATCH `/me`                                      | `{name}`                                                                          |
| GET `/members`                                   | Membres de l’organisation courante                                                |
| POST `/invitations`                              | Admin entreprise ; `{email,role}` → `{url,expires_in_hours:72}`                   |
| GET `/projects`                                  | Projets accessibles, progression moyenne calculée                                 |
| POST `/projects`                                 | Admin/chef ; `{name,description,start_date,end_date,budget_cents,color}` → `{id}` |
| GET `/projects/:id`                              | Projet accessible                                                                 |
| PATCH `/projects/:id`                            | Admin/responsable ; `{status:active/paused/completed}`                            |
| GET `/projects/:id/members`                      | Membres du projet                                                                 |
| POST `/projects/:id/members`                     | Admin/responsable ; `{user_id}` membre de la même entreprise                      |
| GET `/tasks`                                     | Tâches affectées à l’utilisateur dans ses projets accessibles                     |
| GET `/projects/:id/tasks`                        | Tâches et jalons du projet                                                        |
| POST `/projects/:id/tasks`                       | Admin/responsable ; tâche décrite ci-dessous → `{id}`                             |
| PATCH `/projects/:id/tasks/:tid`                 | Champs modifiés + `revision` obligatoire                                          |
| DELETE `/projects/:id/tasks/:tid`                | Admin/responsable ; confirmation gérée par UI                                     |
| GET `/projects/:id/activity`                     | 100 dernières actions, auteur et horodatage                                       |
| GET `/projects/:id/documents`                    | Documents avec version courante                                                   |
| POST `/projects/:id/documents?name=...`          | Corps binaire, max 20 Mo → `{id}`                                                 |
| GET `/projects/:id/documents/:did/versions`      | Métadonnées et SHA-256 des versions                                               |
| POST `/projects/:id/documents/:did/versions`     | Binaire → nouvelle version, jamais écrasement                                     |
| GET `/projects/:id/documents/:did/versions/:vid` | Téléchargement autorisé `attachment`, octet-stream                                |

Tâche : `title`, `description`, `assignee_id` nullable, `start_date`, `end_date`, `status` (`todo`, `doing`, `review`, `done`), `priority` (`low`, `normal`, `high`), `progress` entier 0–100, `milestone` booléen. Dates ISO, fin ≥ début, jalon avec date unique ; affectataire membre du projet. Le statut `done` impose 100 %. Un contributeur affecté peut modifier uniquement `status`, `progress` et fournir la `revision`. Le lecteur ne peut rien modifier. Tous les accès sont contrôlés côté serveur.

Limites : pas de pagination métier (hormis activité limitée), d’API externe par jeton, d’idempotence des créations ou de transport temps réel. À ajouter avant volumes importants et intégrations externes.

## Routes de l’extension métier

Toutes les routes projet héritent du contrôle d’entreprise et d’appartenance. Administrateur/responsable : édition projet, relations de tâche, budget, modèles, métadonnées/restauration/validation de document, retrait de membre, événements. Collaborateur interne : commentaire, import et liaison documentaire. Validateur désigné uniquement : décision de validation. Lecteur : aucune mutation.

| Route                                                                                          | Usage                                                                                               |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET /organizations ; POST /organizations/switch                                                | Appartenances et organisation active                                                                |
| POST /invitations/accept-existing                                                              | Invitation liée à l’e-mail du compte connecté                                                       |
| PATCH /members/:id                                                                             | Rôle entreprise ; conserve un administrateur et refuse de rétrograder un responsable sans transfert |
| GET /sessions ; DELETE /sessions/:id                                                           | Ses sessions et révocation                                                                          |
| POST /me/password ; POST /me/verification ; GET /me/export                                     | Sécurité et données personnelles                                                                    |
| GET /auth/capabilities ; POST /auth/forgot ; POST /auth/reset ; POST /auth/verify              | Transport explicite et jetons de compte                                                             |
| GET /platform/organizations                                                                    | Registre opérateur explicitement habilité                                                           |
| PATCH /projects/:id                                                                            | Informations générales, responsable, statut, archived booléen                                       |
| DELETE /projects/:id/members/:uid                                                              | Retrait avec désaffectation des tâches                                                              |
| GET /projects/:id/planning                                                                     | Dépendances et conflits                                                                             |
| GET/PATCH /projects/:id/tasks/:tid/details                                                     | Hiérarchie, prédécesseurs, effort, commentaires et historique ; PATCH exige revision                |
| POST /projects/:id/tasks/:tid/comments ou attachments                                          | Commentaire ou lien documentaire                                                                    |
| GET /projects/:id/budget ; POST budget/revisions ou budget/entries ; PATCH budget/entries/:eid | Calcul centralisé, révisions, écritures et reclassement                                             |
| GET/POST /projects/:id/folders ; PATCH folders/:fid                                            | Dossiers et hiérarchie                                                                              |
| PATCH /projects/:id/documents/:did                                                             | Métadonnées, dossier, archivage, audience project/internal                                          |
| GET documents/:did/details ou preview ; POST documents/:did/comments ou restore ou approvals   | Détails, aperçu texte, commentaire, restauration et demande de validation                           |
| PATCH /projects/:id/approvals/:aid                                                             | Décision approved/rejected, motif requis pour refus                                                 |
| GET /events ; POST /projects/:id/events ; DELETE /projects/:id/events/:eid                     | Événements accessibles                                                                              |
| GET /notifications ; PATCH /notifications/:nid                                                 | Notifications persistantes, read booléen                                                            |
| GET /templates ; POST /projects/:id/template ; POST /templates/:id/instantiate                 | Bibliothèque et copie de structure à dates relatives                                                |
| GET /portfolio                                                                                 | Vue transverse PMO/admin                                                                            |
| GET/POST /availability ; DELETE /availability/:id ; PATCH /capacity                            | Indisponibilités et capacité horaire                                                                |
| GET /projects/:id/workload                                                                     | Charge du projet, sur 7 jours, capacités ajustées des absences                                      |

Les chemins documentaires abrégés dans le tableau sont relatifs à /projects/:id. Les tests d’intégration fournissent des requêtes exécutables avec champs, réponses et contrôles négatifs.

## Administration Synko et navigation contextuelle (migration 006)

Toutes les routes /platform exigent un compte plateforme actif ; l’administrateur entreprise reçoit 403.

| Route                                   | Contrat                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET /platform/organizations             | Toutes les entreprises, état et compteurs                                                                    |
| POST /platform/organizations            | name, admin_user_id optionnel ; opérateur administrateur initial par défaut                                  |
| PATCH /platform/organizations/:id       | name, suspended ; conservation des données                                                                   |
| POST /platform/organizations/:id/access | Appartenance administrateur explicite et journalisée ; bascule de session                                    |
| GET /platform/organizations/:id/members | Membres, rôles et état des comptes                                                                           |
| GET /platform/projects                  | org_id, q, sort (organization/name/end_date/created_at/status), page ; {items,total,page}, 50 lignes         |
| POST /platform/projects                 | org_id, owner_id, nom, dates, budget, statut, couleur et icône                                               |
| PATCH /platform/projects/:id            | Édition des métadonnées, responsable et archived ; journalisation                                            |
| GET /platform/users                     | org_id, q, sort (name/email/created_at), page ; appartenances et état, sans hash ni secret                   |
| POST /platform/users                    | name, email, password, org_id, role ; aucun envoi d’e-mail implicite                                         |
| PATCH /platform/users/:id               | name, email, disabled, platform_admin, org_id et role optionnels ; conserve les autres appartenances         |
| POST /platform/users/:id/password       | password ; révoque sessions et jetons                                                                        |
| DELETE /platform/users/:id/sessions     | Ferme toutes les sessions du compte                                                                          |
| GET /platform/audit                     | 200 dernières actions plateforme                                                                             |
| GET /notifications/:id/target           | {type,project_id,entity_id} ; destinataire et accès à l’élément revérifiés ; 404 si supprimé ou inaccessible |
| GET /projects/:id/events/:eventId       | Détail d’un événement autorisé                                                                               |

POST /projects accepte template_id facultatif et icon (liste fermée). Sans template_id, le projet est vierge. Le modèle, les tâches, dépendances et dossiers sont copiés dans une transaction. GET /templates inclut duration_days et icon. Le modèle « Organisation d’un événement » contient cadrage, lieu et prestataires, programme, communication, logistique, jour J et bilan. Les dates sont relatives au début du nouveau projet. Les modèles personnalisés conservent aussi l’icône du projet source.
