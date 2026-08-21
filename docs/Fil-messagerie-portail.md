# Fil de discussion « Mon gestionnaire » — messagerie du portail

*Créé le 21/08/2026 — chantier « fil complet », lots 1, 2 et 3 livrés.*

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

## Lot 3 — livré

- **Pastilles non-lu** : compteur `messagesNonLus` servi avec `/api/me`
  (best effort — une panne n'empêche jamais l'entrée), badge sur la tuile
  « Mon gestionnaire », point bleu sur les fils, marquage lu à
  l'ouverture des deux côtés. Colonne `DerniereReponse` : dernier texte
  du gestionnaire recopié à plat par l'API pour le flux e-mail.
- **Lien profond** `https://espace.osmoserh.fr/?msg=<id>` : ouvre
  directement le fil — côté client (tuile Mon gestionnaire) comme côté
  gestionnaire (onglet Messages). Paramètre consommé par AppShell et
  transmis à l'écran admin en prop.
- **Modèles d'e-mail** (docs/modeles-flux/) :
  - `modele-notification-portail.html` (au gestionnaire, flux existant
    « à la création ») : CTA « Répondre dans le portail » (`?msg=`),
    rappel Statut supprimé (automatique), mailto relégué en secours ;
  - `modele-reponse-client.html` (au client) : **nouveau flux** « Quand
    un élément est modifié » sur « Messages gestionnaire », condition de
    déclenchement
    `@and(equals(triggerBody()?['DernierAuteur'], 'gestionnaire'), equals(triggerBody()?['NotifEnvoyee'], false))`,
    action 1 = e-mail à `EmailDemandeur` (corps = le modèle, qui cite
    `DerniereReponse`), action 2 = Mettre à jour l'élément avec
    `NotifEnvoyee = Oui` (anti-doublon). Défaut de la colonne : vrai —
    l'existant ne déclenche rien.

## Opérations

- **Relancer `creer_site_rh.py`** sur chaque tenant pour créer les
  colonnes (idempotent : `traiter_liste` ajoute les colonnes manquantes).
  Sans cette relance, le portail fonctionne en dégradé lecture seule
  (fils sans réponses) et l'envoi reste intact.
- Flux Power Automate : mettre à jour le corps du flux de notification
  existant (modèle refondu) et créer le flux « réponse → e-mail client »
  (mode d'emploi complet en tête de `modele-reponse-client.html`).
