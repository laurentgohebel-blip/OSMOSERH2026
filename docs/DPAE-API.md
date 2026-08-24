# API DPAE (URSSAF) — branchement du portail

**22/08/2026.** Le portail déclare les embauches à l'URSSAF (déclaration
préalable à l'embauche) directement depuis l'écran gestionnaire — plus de
saisie sur net-entreprises/due.urssaf.fr. Circuit conforme au modèle B :
le client dépose son embauche + pièces, **Osmose vérifie puis déclare**.

## Le circuit dans le portail

1. Le client envoie une embauche (formulaire + 3 PJ) → « Production
   contrat », comme avant. Rien ne change pour lui.
2. Écran gestionnaire → section **« DPAE — déclarations d'embauche »** :
   chaque embauche apparaît avec son état (À déclarer / Déposée /
   Conforme / Refusée).
3. **Déclarer** ouvre un brouillon **pré-rempli** : employeur (fiche
   « Paramètres clients »), salarié (contrat + fiche « Salariés » —
   sexe et département de naissance déduits du NIR, clé contrôlée),
   contrat (nature, dates ; heure d'embauche par défaut 09:00).
   Toute incohérence (clé NIR fausse, champ manquant) est signalée —
   à vérifier sur les pièces jointes (carte Vitale).
4. **Déposer** : l'API s'authentifie auprès de l'URSSAF, construit le
   message normé, le dépose, et note l'identifiant de flux sur
   l'embauche. Le bilan revient en général en moins d'une minute :
   **Conforme** (certificat de conformité, conservé sur l'élément) ou
   **Refusée** (motif URSSAF affiché — corriger et redéposer).
   Bouton « Vérifier » si le bilan se fait attendre.

Suivi SharePoint (« Production contrat ») : `DpaeStatut`, `DpaeIdFlux`,
`DpaeCertificat`, `DpaeMessage`, `DpaeDeclareLe`.

## Mise en service (à faire une fois)

### 1. Compte URSSAF (côté urssaf.fr — 10 min)
- Le service utilise un **compte urssaf.fr classique habilité au
  service « DPAE »** (mode « déclarant », service 25) — PAS le portail
  API (portailapi.urssaf.fr, réservé aux concentrateurs/éditeurs).
- Sur urssaf.fr, avec le compte de Synapse RH (tiers déclarant) :
  vérifier l'habilitation DPAE pour chaque SIRET client géré
  (délégation tiers déclarant habituelle).
- Noter : SIRET du compte, nom, prénom, mot de passe.

### 2. Variables de la SWA (Azure → Configuration)
| Variable | Valeur |
|---|---|
| `DPAE_MODE` | `test` d'abord, `production` après recette |
| `DPAE_SIRET` | SIRET du compte urssaf.fr (14 chiffres) |
| `DPAE_NOM` / `DPAE_PRENOM` | identité du compte |
| `DPAE_MDP` | mot de passe du compte (secret — jamais dans le code) |

Sans ces variables, la section DPAE reste consultative (message clair).
`DPAE_URL_AUTH` / `DPAE_URL_DEPOT` / `DPAE_URL_CONSULTATION` :
surcharges optionnelles si l'URSSAF change ses adresses.

### 3. Colonnes SharePoint
Exécuter `src/scripts/creer_site_rh.py` dans Azure Cloud Shell (même
méthode que d'habitude) : il ajoute les colonnes DPAE à « Production
contrat » et l'identification URSSAF à « Paramètres clients » :
`CodeUrssaf` (3 chiffres), `CodeApe` (ex. 1623Z), `VilleEntreprise`,
`CodePostalEntreprise`, `TelephoneEntreprise`, `SanteTravail` (code du
service de santé au travail, défaut 01).

### 4. Compléter les fiches clients
Renseigner ces colonnes pour chaque client (une fois) — les DPAE
suivantes arrivent alors entièrement pré-remplies.

### 5. Recette puis bascule
- `DPAE_MODE=test` : **l'indicateur de test (1) est envoyé dans le
  message** — l'URSSAF contrôle tout mais n'enregistre RIEN. Faire une
  embauche de bout en bout : dépôt, bilan, certificat.
- Quand tout est conforme : `DPAE_MODE=production` (indicateur 120).
  Aucun redéploiement — changement de variable seulement.

## Protocole (référence technique)
1. **Authentification** : POST `https://mon.urssaf.fr/authentifier_dpae`
   (XML `<identifiants>` : siret, nom, prénom, mot de passe,
   service 25) → jeton en texte brut. 422 = identifiants/habilitation.
2. **Dépôt** : POST `https://depot.dpae-edi.urssaf.fr/deposer-dsn/1.0/`,
   en-tête `Authorization: DSNLogin jeton=…`, corps = message
   `FR_DUE_Upload` (norme repXML), **ISO-8859-1 gzippé** → `idflux`
   (23 caractères).
3. **Retours** : GET `https://consultation.dpae-edi.urssaf.fr/lister-retours-flux/2.0/{idflux}`
   → URLs de bilans ; bilan `profil="DPAE"` → `etat_conformite` OK
   (certificat) ou KO (message).

Guide officiel : « API DPAE — guide d'implémentation » (5492) sur
dpae-edi.urssaf.fr ; mise en œuvre recoupée avec le client MIT
`wrapss/dpae-api-client`. Tout vit dans `api/src/dpae.js` (protocole)
et `api/src/admin.js` (action `adminDpae`, phases preparer/deposer/
retour — route `/api/demande`, doctrine du 21/08).

## Limites connues (v1)
- Régime général uniquement (pas MSA — les exploitants agricoles
  passeraient par la DPAE MSA, hors périmètre).
- Une DPAE par clic — pas de dépôt en masse (le volume réel est
  unitaire).
- Le NIR « Production contrat » est une colonne Nombre : les NIR corses
  (2A/2B) n'y tiennent pas — la fiche « Salariés » (texte) fait foi,
  le panneau permet la correction.
- La DPAE doit partir **dans les 8 jours avant l'embauche** : le
  portail affiche la date de début, le respect du délai reste au
  gestionnaire (alerte automatique = piste v2).
