# ATT-01 — schéma du déclencheur HTTP (généré depuis le code)

Source de vérité : payload du formulaire attestation (`AppShell.jsx` l. 1112)
+ enrichissement serveur (`demande.js` l. 214). Généré le 16/08/2026 — si le
formulaire ou l'API changent, régénérer depuis le code, pas de mémoire.

## ⚠️ Nom de la variable SWA — correction de la synthèse

L'API résout l'URL du flux ainsi (`demande.js` l. 201) :

```js
const cle = "FLOW_URL_" + d.demarche.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
```

Pour `demarche: "attestation-employeur"`, la variable est donc

```
FLOW_URL_ATTESTATION_EMPLOYEUR
```

et **non** `FLOW_URL_ATT01` (qui donnerait « Démarche inconnue ou non
configurée » → HTTP 400 côté portail).

La référence renvoyée au client aura le préfixe `ATTESTATION-…`.

## Schéma JSON du corps — à coller dans le déclencheur

`xq_note` et `website` (pots de miel) sont supprimés par l'API avant relais :
ils ne figurent pas dans le corps reçu. Pas de bloc `required` : le
déclencheur reste tolérant, les contrôles bloquants sont côté API.

```json
{
  "type": "object",
  "properties": {
    "demarche": { "type": "string" },
    "client": { "type": "string" },
    "email": { "type": "string" },
    "civilite": { "type": "string" },
    "nomSalarie": { "type": "string" },
    "dateNaissance": { "type": "string" },
    "dateEntree": { "type": "string" },
    "poste": { "type": "string" },
    "typeContrat": { "type": "string" },
    "formatSouhaite": { "type": "string" },
    "raisonSociale": { "type": "string" },
    "adresseEntreprise": { "type": "string" },
    "siret": { "type": "string" },
    "representant": { "type": "string" },
    "fonctionRepresentant": { "type": "string" },
    "lieuEdition": { "type": "string" },
    "emailGestionnaire": { "type": "string" },
    "reference": { "type": "string" },
    "recuLe": { "type": "string" }
  }
}
```

## Exemple de corps (pour « Générer à partir d'un exemple », au choix)

```json
{
  "demarche": "attestation-employeur",
  "client": "DEMO",
  "email": "client@entreprise.fr",
  "civilite": "Madame",
  "nomSalarie": "Marie Dupont",
  "dateNaissance": "1990-04-12",
  "dateEntree": "2021-09-01",
  "poste": "Comptable",
  "typeContrat": "CDI",
  "formatSouhaite": "PDF",
  "raisonSociale": "Aux Délices de Provence",
  "adresseEntreprise": "12 rue du Four, 83000 Toulon",
  "siret": "12345678900011",
  "representant": "Camille Renard",
  "fonctionRepresentant": "Gérante",
  "lieuEdition": "Toulon",
  "emailGestionnaire": "lgohebel@osmoserh.fr",
  "reference": "ATTESTATION-ABC123",
  "recuLe": "2026-08-16T10:00:00.000Z"
}
```

## Valeurs et formats à connaître

| Propriété | Contenu réel |
|---|---|
| `demarche` | toujours `attestation-employeur` |
| `email` | e-mail VÉRIFIÉ du demandeur (jeton) — destinataire de l'AR |
| `civilite` | `Madame` / `Monsieur` (liste du formulaire) |
| `nomSalarie` | nom complet en un champ, saisie libre |
| `dateNaissance`, `dateEntree` | `AAAA-MM-JJ` |
| `typeContrat` | valeur de la liste du formulaire (CDI, CDD…) |
| `formatSouhaite` | `PDF` ou `Word` — pilote la conversion en étape 6 |
| `client`, `raisonSociale` → `emailGestionnaire` | imposés par le serveur depuis « Paramètres clients » — jamais la saisie du navigateur |
| `reference` | `ATTESTATION-XXXXXXX`, déjà générée — l'écrire telle quelle, ne pas en créer une autre |
| `recuLe` | horodatage ISO UTC |

## Où chaque jeton sert dans le flux (étapes de la synthèse)

| Étape | Jetons |
|---|---|
| 2. Écriture `DemandesAttestations` | `nomSalarie` (Title), `reference`, `client` (CodeClient), `email`, `emailGestionnaire`, `civilite`, `dateNaissance`, `dateEntree`, `poste`, `typeContrat`, `formatSouhaite` — Statut : défaut `Reçue` |
| 3. Identité employeur | déjà dans le corps (`raisonSociale`, `adresseEntreprise`, `siret`, `representant`, `fonctionRepresentant`, `lieuEdition`) — la lecture de « Paramètres clients » devient optionnelle |
| 5. Modèle Word | `civilite`, `nomSalarie`, `dateNaissance`, `dateEntree`, `poste`, `typeContrat` + identité employeur + `lieuEdition` + date du jour |
| 6. Conversion | condition sur `formatSouhaite` = `PDF` |
| 7. Dépôt GED | chemin `Documents clients/{client}/Attestations` |
| 8. AR | destinataire `email`, copie/notification `emailGestionnaire`, citer `reference` |

Rappels de la synthèse : mode **signature** sur le déclencheur ; re-sélectionner
les modèles Word re-téléversés (nouveaux identifiants de fichier) ; l'URL du
déclencheur est un **secret** → variable SWA `FLOW_URL_ATTESTATION_EMPLOYEUR`.
