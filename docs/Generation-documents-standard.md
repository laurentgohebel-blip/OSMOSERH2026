# Génération de documents SANS connecteur premium (fiche du 21/08)

Le connecteur « Word Online (Business) » (« Remplir un modèle Word »)
est **premium** : un flux qui l'utilise se suspend à l'exécution ou à la
fin de l'essai. Cette fiche le remplace par un circuit 100 % standard :
**modèle HTML → fichier → conversion PDF par le connecteur OneDrive
Entreprise** (standard). À appliquer au flux « Attestation employeur »
(et plus tard au contrat, même mécanique avec son propre gabarit).

## Étapes du flux « Attestation employeur — production + AR »

Déclencheur (inchangé) : « Quand un élément est créé » — liste
**Demandes attestations**. Après l'approbation éventuelle :

1. **Composer** (Opérations de données) — nommer `HTML attestation` :
   coller le contenu de `docs/modeles-flux/modele-attestation.html`,
   puis remplacer chaque `[[…]]` par le jeton dynamique :

| Balise du modèle | Jeton (élément Demandes attestations) |
|---|---|
| `[[RAISON_SOCIALE]]` | RaisonSociale |
| `[[ADRESSE_ENTREPRISE]]` | AdresseEntreprise |
| `[[SIRET]]` | Siret |
| `[[REPRESENTANT]]` | Representant |
| `[[FONCTION_REPRESENTANT]]` | FonctionRepresentant |
| `[[CIVILITE]]` | Civilite |
| `[[NOM_SALARIE]]` | Title |
| `[[POSTE]]` | Poste |
| `[[TYPE_CONTRAT]]` | TypeContrat |
| `[[LIEU_EDITION]]` | LieuEdition |
| `[[REFERENCE]]` | Reference |
| `[[DATE_NAISSANCE]]` | *expression* → `formatDateTime(triggerOutputs()?['body/DateNaissance'],'dd/MM/yyyy')` |
| `[[DATE_ENTREE]]` | *expression* → `formatDateTime(triggerOutputs()?['body/DateEntree'],'dd/MM/yyyy')` |
| `[[DATE_DU_JOUR]]` | *expression* → `formatDateTime(utcNow(),'dd/MM/yyyy')` |

2. **OneDrive Entreprise → « Créer un fichier »** (connexion svc-flux) :
   dossier `/GenerationTemp` (créé une fois dans le OneDrive de
   svc-flux), nom `Reference.html` (jeton Reference + `.html`),
   contenu = sortie de `HTML attestation`.
3. **Condition sur `FormatSouhaite`** :
   - **= PDF** : OneDrive Entreprise → **« Convertir un fichier »**
     (Id = Id du fichier créé, type cible **PDF**) →
     SharePoint → **« Créer un fichier »** : site RH, chemin
     `Documents clients/{CodeClient}/Attestations`, nom
     `Attestation-Reference.pdf`, contenu = contenu du fichier converti.
   - **= Word** : SharePoint → « Créer un fichier », même chemin, nom
     `Attestation-Reference.doc`, contenu = sortie de `HTML attestation`
     (un `.doc` au contenu HTML s'ouvre parfaitement dans Word, mise en
     forme comprise — astuce standard, aucun connecteur premium).
4. **OneDrive Entreprise → « Supprimer le fichier »** (le temporaire).
5. AR Outlook au demandeur (`EmailDemandeur`), notification gestionnaire
   (`EmailGestionnaire`), citer `Reference` — pas de lien SharePoint
   (le client retrouve le document dans l'onglet Documents du portail).
6. Mettre `Statut` de l'élément à « Envoyée ».

## Notes

- Tous les connecteurs utilisés (Opérations de données, OneDrive
  Entreprise, SharePoint, Outlook) sont **standard**.
- La conversion PDF respecte le CSS du modèle (paginé A4 aux marges du
  gabarit). Ajuster les styles dans le modèle HTML si besoin — c'est un
  simple fichier du dépôt, versionné.
- **Contrats (Production contrat)** : même mécanique, avec un gabarit
  `modele-contrat-cdi.html` / `-cdd.html` à écrire le moment venu
  (les contrats étant plus denses, garder la génération Word manuelle
  par le gestionnaire est acceptable en attendant).
- Supprimer l'action « Remplir un modèle Word » ET sa connexion Word
  Online du flux — c'est elle qui marque le flux comme premium.
