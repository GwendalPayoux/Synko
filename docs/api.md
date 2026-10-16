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
