# Flux standard ACP-01 et ATT-01 — fin du Premium (chantier du 19/08)

Remplace le déclencheur HTTP (Premium) par « Quand un élément est créé »
(connecteur SharePoint standard, inclus dans Microsoft 365). L'API écrit
la liste, le flux part de l'élément : mêmes données, zéro URL secrète,
zéro licence Premium, et une demande jamais perdue (elle est écrite même
si le flux est en panne — relançable après coup sur l'élément).

Le kit `ATT-01-schema-declencheur.md` (schéma HTTP) devient SANS OBJET.

## Procédure de bascule (dans l'ordre, par tenant)

1. `python src/scripts/creer_listes_demarches.py` — prépare « Acompte »
   (colonnes canoniques ajoutées) et crée « Demandes attestations ».
2. Construire les deux flux ci-dessous (connecteurs SharePoint + Office
   365 Outlook uniquement — décision du 18/08 : plus aucun SMTP OVH).
3. Retirer `FLOW_URL_ACOMPTE` puis `FLOW_URL_ATTESTATION_EMPLOYEUR` des
   variables de la Static Web App → l'API bascule seule, sans
   redéploiement. (Marche arrière : remettre la variable.)
4. Tester une démarche de chaque depuis le portail (références
   `ACOMPTE-…` / `ATTESTATION-…` inchangées côté client).
5. Supprimer les deux anciens flux HTTP (et, à terme, la liste
   « Attestations test »).

## Flux « Acompte — AR + notification » (standard)

**Déclencheur** : Quand un élément est créé — liste **Acompte**.

Colonnes disponibles (celles écrites par l'API, noms internes canoniques) :

| Colonne | Contenu |
|---|---|
| `Title` | nom complet du salarié (« DURAND Camille ») |
| `Nom`, `Prenom` | séparés (Nom en capitales) |
| `Matricule` | nombre |
| `Montantdemande` | nombre (euros, 2 décimales) |
| `DateVersement` | date souhaitée (AAAA-MM-JJ) |
| `CodeClient`, `Reference` | identité et référence `ACOMPTE-…` (déjà générée — ne pas en créer une autre) |
| `EmailDemandeur` | destinataire de l'AR (e-mail vérifié par jeton) |
| `EmailGestionnaire` | destinataire de la notification |
| `Statut` | `Nouveau` à la création — passer à `Traité` en fin de flux ou à la main |

Étapes : 1) AR au demandeur (Outlook — citer Référence, montant, date de
versement) ; 2) notification au gestionnaire ; 3) [optionnel] passer
Statut à « Traité » une fois l'acompte saisi en paie.

⚠️ Les éléments HISTORIQUES de la liste portent les anciennes colonnes
accentuées (`Montantdemand_x00e9_`…) : le tableau de bord du portail lit
les deux générations, aucun rattrapage nécessaire.

## Flux « Attestation employeur — production + AR » (standard)

**Déclencheur** : Quand un élément est créé — liste **Demandes attestations**.

L'élément est autoportant : l'identité employeur y est déjà (imposée par
le serveur depuis « Paramètres clients ») — aucune recherche SharePoint
à faire dans le flux.

| Colonne | Contenu |
|---|---|
| `Title` | nom complet du salarié |
| `Civilite` | `Madame` / `Monsieur` |
| `DateNaissance`, `DateEntree` | dates (AAAA-MM-JJ) |
| `Poste`, `TypeContrat` | texte |
| `FormatSouhaite` | `PDF` ou `Word` — pilote la conversion |
| `RaisonSociale`, `AdresseEntreprise`, `Siret`, `Representant`, `FonctionRepresentant`, `LieuEdition` | identité employeur (serveur) |
| `CodeClient`, `Reference` | identité client et référence `ATTESTATION-…` |
| `EmailDemandeur`, `EmailGestionnaire` | AR et notification |
| `Statut` | `Reçue` → `En production` → `Produite` → `Envoyée` |

Étapes (mêmes que la synthèse du 16/08, sans les étapes 2 et 3 devenues
inutiles — la liste EST le point d'entrée et l'identité est déjà là) :
1) approbation gestionnaire ; 2) remplir le modèle Word (jetons du
tableau + date du jour) ; 3) si `FormatSouhaite` = PDF → conversion ;
4) dépôt GED `Documents clients/{CodeClient}/Attestations` ; 5) AR au
demandeur + notification gestionnaire ; 6) `Statut` → `Envoyée`.

## Ce qui ne change PAS

- Les formulaires du portail et leurs réponses (référence immédiate).
- Le verrou serveur (jeton, résolution client, options) — inchangé.
- Les 8 autres démarches, déjà en modèle standard.
- Le délai de déclenchement (~1-5 min, comme les flux standard actuels).
