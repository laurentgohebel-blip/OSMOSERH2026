# Fil de discussion « Mon gestionnaire » — messagerie du portail

*Créé le 21/08/2026 — chantier « fil complet », lots 1 et 2 livrés.*

## Constat

Le canal « Mon gestionnaire » était un aller simple : le client envoyait
(liste « Messages gestionnaire », flux + notification), puis plus rien —
pas de relecture dans le portail, réponse du gestionnaire par e-mail
hors système, `Statut` à mettre à jour à la main dans SharePoint.

## Modèle

**Un élément de « Messages gestionnaire » = un fil.** Le message initial
reste dans `Message` (compatibilité flux/jetons existants), les réponses
s'accumulent dans les nouvelles colonnes (creer_site_rh.py) :

| Colonne | Type | Rôle |
|---|---|---|
| `Echanges` | Texte long | JSON `[{ qui: "client"\|"gestionnaire", quand: ISO, texte }]` |
| `DerniereMaj` | Date/heure | tri de la liste (défaut lecture : `Created`) |
| `DernierAuteur` | Texte | `client` \| `gestionnaire` (défaut : `client`) |
| `Clos` | Oui/Non | fil terminé (le champ Choix `Statut` reste `Nouveau`/`Répondu` : ses valeurs ne sont pas modifiables sur les tenants existants) |
| `NonLuClient`, `NonLuGestionnaire` | Oui/Non | pastilles non-lu (lot 3) |

**Tout est à défaut sûr côté lecture** : un élément d'avant la messagerie
(colonnes absentes) est servi à l'identique — échanges vides, dernière
activité = création, non clos. L'écriture d'un premier message n'utilise
AUCUNE nouvelle colonne : zéro régression sur un tenant non re-provisionné.

## Routes (doctrine du 21/08 — aucun nouveau /api/&lt;nom&gt;)

| Besoin | Route | Lot |
|---|---|---|
| Fils du client | `GET /api/me?vue=messages` → module paresseux `api/src/messages.js` | **1 (fait)** |
| Créer un fil | `POST /api/demande { demarche: "contact" }` — inchangé (+ cache vidé) | **1 (fait)** |
| Répondre (2 côtés) | `POST /api/demande { action: "messageRepondre", id, texte }` | **2 (fait)** |
| Clore / rouvrir / lu | `POST /api/demande { action: "messageStatut", id, clos?, lu? }` | **2 (fait)** |
| Boîte gestionnaire | `GET /api/me?vue=admin&onglet=messages` | **2 (fait)** |

L'auteur d'une réponse est déduit du JETON (`ADMIN_EMAILS` → gestionnaire),
jamais du payload ; propriété vérifiée sur le `CodeClient` avant toute
écriture (modèle `majSalarie` : un id d'un autre client → 404). Écritures
sous verrou optimiste (`If-Match` sur l'etag ; une réponse rejoue sa
lecture une fois en cas de conflit, jamais d'écrasement). `Statut` devient
« à qui est la balle » : réponse gestionnaire → `Répondu`, relance client →
`Nouveau` (le fil réapparaît dans la boîte). Fil clos : réponse refusée des
deux côtés — le gestionnaire rouvre. `NotifEnvoyee` est remise à faux à
chaque réponse gestionnaire : le flux « réponse → e-mail client » (lot 3)
notifie puis la repasse à vrai (anti-doublon des flux « à la
modification »).

## Lot 1 — livré

- `api/src/messages.js` : lecture des fils, filtrage serveur sur le
  CodeClient, repli colonnes historiques si la lecture complète échoue.
- `me.js` : dispatch `?vue=messages` (comptes clients uniquement).
- `demande.js` : `viderCacheItems()` après écriture d'un message (le fil
  apparaît immédiatement, malgré le cache items de 60 s).
- Portail : la tuile « Mon gestionnaire » devient une messagerie — liste
  des fils (objet, date, statut Transmis/Répondu/Clos, dernier échange),
  conversation en bulles, « Nouveau message » = formulaire historique.
- Démo : trois fils fixtures + l'envoi crée un fil (état en mémoire) ;
  test Playwright du parcours complet (tests/demo.spec.js).

## Lot 2 — livré

- `messages.js` : `repondre` / `statut` / `boite` (règles ci-dessus) ;
  routes câblées dans `demande.js` (actions) et `me.js` (onglet).
- Portail client : zone de réponse dans le fil (fil clos → lecture seule),
  marquage lu à l'ouverture.
- Écran gestionnaire : onglets « Demandes d'accès » / « Messages clients
  (n à répondre) » — boîte tous clients triée par activité, conversation,
  réponse, Clore/Rouvrir, marquage lu.
- Démo + tests : réponse client mutée en mémoire, parcours étendu
  (réponse dans le fil, fil clos sans composeur).

## Lot 3 — à venir

Notifications : e-mail de notification refondu (bouton « Répondre dans
le portail », lien profond `?msg=`), flux « réponse gestionnaire →
e-mail client » (condition `DernierAuteur = gestionnaire` ET
`NotifEnvoyee = faux`, puis repasse `NotifEnvoyee` à vrai), pastilles
non-lu dans les listes et sur la tuile.

## Opérations

- **Relancer `creer_site_rh.py`** sur chaque tenant pour créer les
  colonnes (idempotent : `traiter_liste` ajoute les colonnes manquantes).
  Sans cette relance, le portail fonctionne en dégradé lecture seule
  (fils sans réponses) et l'envoi reste intact.
- Rien à changer dans les flux Power Automate au lot 1.
