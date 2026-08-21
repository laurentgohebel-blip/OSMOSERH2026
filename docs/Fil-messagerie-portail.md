# Fil de discussion « Mon gestionnaire » — messagerie du portail

*Créé le 21/08/2026 — chantier « fil complet », lot 1 livré.*

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
| Répondre (2 côtés) | `POST /api/demande { action: "messageRepondre", id, texte }` | 2 |
| Clore / lu | `POST /api/demande { action: "messageStatut", … }` | 2 |
| Boîte gestionnaire | `GET /api/me?vue=admin&onglet=messages` | 2 |

L'auteur d'une réponse sera déduit du JETON (`ADMIN_EMAILS` → gestionnaire),
jamais du payload ; propriété vérifiée sur le `CodeClient` avant toute
écriture (modèle `majSalarie` : un id d'un autre client → 404).

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

## Lots suivants

2. Réponses des deux côtés + onglet Messages de l'écran gestionnaire +
   `Statut`/`Clos` automatiques.
3. Notifications : e-mail de notification refondu (bouton « Répondre dans
   le portail », voir docs/modeles-flux/modele-notification-portail.html),
   e-mail au client à chaque réponse, pastilles non-lu.

## Opérations

- **Relancer `creer_site_rh.py`** sur chaque tenant pour créer les
  colonnes (idempotent : `traiter_liste` ajoute les colonnes manquantes).
  Sans cette relance, le portail fonctionne en dégradé lecture seule
  (fils sans réponses) et l'envoi reste intact.
- Rien à changer dans les flux Power Automate au lot 1.
