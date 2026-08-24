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
écriture (modèle `majSalarie` : un id d'un autre client → 404). Clore ou
rouvrir est réservé au gestionnaire, côté API comme côté écran.

**Verrou d'écriture — opportuniste, par choix.** `If-Match` n'est pas
documenté sur `PATCH …/items/{id}/fields` : selon le comportement de
SharePoint, l'etag du listItem peut être hors périmètre et faire répondre
412 (ou 400) à *tous* les appels. Une réponse fait donc jusqu'à trois
essais, chacun **relisant et refusionnant** les échanges — le dernier part
sans `If-Match`. Conséquences assumées : un fil ne peut jamais être
condamné par un verrou mal placé, et la fenêtre d'écrasement se réduit à
l'intervalle entre la relecture et l'écriture du dernier essai (au lieu
d'être nulle si l'etag était fiable). Le diagnostic rendu suit l'échec
réel : 409 pour un fil disputé, 502 « relancer creer_site_rh.py » pour un
schéma incomplet — jamais l'un pour l'autre.

**À trancher sur un vrai tenant** : un `PATCH /fields` avec l'etag du
listItem, puis avec un etag volontairement périmé, dira si le verrou est
honoré. Si oui, on peut revenir à un verrou strict ; sinon, il faut
documenter le dernier-écrit-gagne. Le code fonctionne dans les deux cas —
c'est précisément ce que vérifient les scénarios [11 ter] et [14] du banc. `Statut` devient
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
  - **un flux unique** « Nouvelle activité dans un fil » : déclencheur
    « Quand un élément est modifié » sur « Messages gestionnaire »,
    condition de déclenchement `@equals(triggerBody()?['NotifEnvoyee'], false)`,
    puis une Condition sur `DernierAuteur` :
    « gestionnaire » → e-mail au client (`modele-reponse-client.html`,
    à `EmailDemandeur`) ; sinon → e-mail au gestionnaire
    (`modele-relance-gestionnaire.html`, à `EmailGestionnaire`) ; et dans
    les deux cas `NotifEnvoyee = Oui` pour finir (anti-doublon). Défaut de
    la colonne : vrai — l'existant ne déclenche rien. L'API pose
    `DerniereReponse` + `NotifEnvoyee = faux` **dans les deux sens** :
    sans quoi une relance du client ne préviendrait personne (le flux
    historique ne se déclenche qu'à la création).

## Opérations

- **Relancer `creer_site_rh.py`** sur chaque tenant pour créer les
  colonnes (idempotent : `traiter_liste` ajoute les colonnes manquantes).
  Sans cette relance, le portail fonctionne en dégradé lecture seule
  (fils sans réponses) et l'envoi reste intact.
- Flux Power Automate : mettre à jour le corps du flux de notification
  existant (modèle refondu) et créer le flux « Nouvelle activité dans un
  fil » (mode d'emploi complet en tête de `modele-reponse-client.html`).

## Vérification

`npm run test:api` joue deux bancs sans réseau ni tenant (annuaire et
Graph simulés), également en CI avant les tests de bout en bout :

- `tests/messages.test.cjs` — 52 assertions sur la messagerie :
  cloisonnement entre clients, fusion des réponses, conflits d'écriture,
  colonnes absentes, panne passagère, taille de la colonne `Echanges`,
  clôture réservée, et les deux hypothèses de comportement de `If-Match`.
- `tests/annuaire-cache.test.cjs` — non-régression du cache de lecture :
  la clé doit inclure les colonnes demandées (voir ci-dessous).

## Bugs corrigés au passage (revue du 21/08)

- **Cache de `items()` empoisonné** (`annuaire.js`, antérieur à la
  messagerie, le plus grave) : la clé de cache ne retenait que la liste,
  pas les colonnes. Ouvrir l'écran d'administration — qui lit
  « Paramètres clients » avec le seul `CodeClient` — servait pendant 60 s
  un client **sans options ni SIRET** à tout le portail : démarches
  refusées à tort et attestations émises sans mentions légales. Reproduit,
  corrigé, verrouillé par un test.
- **Écran gestionnaire planté** sur une réponse 200 au corps inattendu
  (une SWA qui sert `index.html` sur `/api/*`) : `boite.fils` valait
  `undefined`. Garde ajoutée.
- **Répondre impossible sur un tenant non re-provisionné** : `chargerFil`
  traduisait *toute* erreur Graph en « Fil introuvable », y compris le 400
  des colonnes absentes — le diagnostic soigné était inatteignable.
- **Repli de lecture trop large** : un simple 429 faisait servir des fils
  amputés (réponses disparues, fil clos rouvert). Le repli est désormais
  réservé au 400 de schéma.
- **Plafond du fil** compté en nombre d'échanges (200 × 4 000 caractères)
  alors que la colonne SharePoint tient ~64 000 : le fil devenait
  définitivement inécrivable. Plafond porté sur la taille sérialisée.
- **Lien profond** rejoué à chaque retour sur l'onglet, et perdu pour de
  bon si le premier chargement échouait.
- **Réponse invisible après envoi** : la lecture étant mise en cache 60 s
  et servie éventuellement par une autre instance, la réponse est
  maintenant ajoutée localement au fil au lieu d'être rechargée.
- Brouillon perdu au changement d'onglet, saisie effacée sur le mauvais
  fil après un envoi lent, compteur « à répondre » basé sur un `Statut`
  aux valeurs historiques, mode démo divergent de l'API.
