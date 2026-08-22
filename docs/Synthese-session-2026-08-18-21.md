# Synthèse de session — 18 au 21 août 2026

Du débogage d'une activation client à la bascule quasi complète sur le
tenant Osmose. Registre des identifiants : en tête de
`Plan-bascule-osmoserh.md`. Cette synthèse remplace la lecture des
points intermédiaires pour reprendre le fil.

## Ce qui est EN PRODUCTION et validé en réel

### Portail (les deux SWA)
- **Écran d'administration gestionnaire** (adresses `ADMIN_EMAILS`) :
  activation des demandes d'accès en un clic, **pré-provisionnement**
  (« Nouveau client — accès sans demande ») et **reprise de l'effectif**
  (collage Excel, détection de colonnes, doublons ignorés, compte-rendu).
  Validé trois fois en réel : activation du client bloqué (18/08),
  parcours A complet (18/08), onboarding Valmont sur le nouveau tenant
  (21/08 : client créé → effectif collé → inscription → espace peuplé).
- **Onboarding refondu** (`Onboarding-client.md`) : parcours A nominal
  (l'accès et l'effectif sont prêts AVANT la première connexion, e-mail
  de bienvenue), parcours B (demande spontanée) en filet. Modèles
  Excel séparés : `Modele_reprise_effectif.xlsx` (portail) ≠
  `Modele_import_salaries.xlsx` (circuit PAIE) — ne pas confondre.
- **Acompte et attestation en écriture directe SharePoint** (fin du
  déclencheur HTTP Premium) — s'active en NE posant PAS les variables
  `FLOW_URL_*` (fait sur la nouvelle SWA). Fiche des deux flux standard :
  `Flux-standard-ACP-ATT.md`.

### Doctrine des routes SWA (définitive — gravée dans me.js)
La découverte des fonctions par la plateforme Static Web Apps est
opaque et non fiable : cinq hypothèses testées et éliminées sur une SWA
NEUVE (table figée, casse, handler littéral, nombre par fichier,
position — admin-activer ligne 14 en 404 quand ping ligne 49 passait).
**Plus jamais de nouvelle route `/api/<nom>`.** Tout passe par les
routes historiques :
- admin : `GET /api/me?vue=admin` + `POST /api/demande`
  `{action: adminActiver | adminImportSalaries}` ;
- leads vitrine : `POST /api/demande` `{action:"lead"}` en **text/plain**
  (requête simple, aucun préflight) ;
- santé : `GET /api/ping` (champ `version` = déploiement servi —
  penser à CHANGER le marqueur à chaque modification qu'on veut tracer).

### Bascule osmoserh (phases 0, 1, 3 : terminées)
- **SharePoint osmoserh83** : 12 listes + bibliothèque créées/complétées
  par scripts (`creer_site_rh.py`, `creer_listes_demarches.py`,
  `creer_leads_site.py`, lancés en Azure Cloud Shell le 21/08).
  Restent 2 gestes d'interface : colonne « Options » (choix multiple)
  et liste « Production contrat » (tableau des libellés dans le runbook).
- **SWA « OsmoseRH2026 »** (lemon-meadow, offre **Free**) : déployée par
  le workflow unifié `deploy.yml` (l'ancienne SWA n'est plus déployée —
  figée jusqu'au décommissionnement). Variables posées, SANS `FLOW_URL_*`.
- **Tenant clients External ID RECRÉÉ** (`d0ce15bd…`, app « Portail
  Osmose RH » `19d1eb4c…`) : l'ancien (da198f21) n'était plus
  administrable — leçon : chaque brique appartient à lgohebel@osmoserh.fr.
  Config complète : SPA + API exposée (`access_as_user`) + flux
  d'inscription (avec « Nom d'affichage » en attribut) + consentement
  admin. Aucune perte (comptes de test uniquement).
- **Domaine `espace.osmoserh.fr` ACTIF** (CNAME OVH + SSL) — l'adresse
  définitive du produit est en service.
- **Site vitrine à jour en ligne** : liens basculés sur
  espace.osmoserh.fr, formulaires sur le circuit `/api/demande`.

### Économies (Infra-couts.md — cible ≈ moitié de la facture)
- Power Automate **Premium évité** (~165 €/an) : plus aucun flux HTTP.
- CI GitHub au régime : tests sur main seulement, docs/scripts sans
  déploiement (l'épuisement du quota du 19/08 ne se reproduira pas).
- SWA Free, licence **Basic** pour svc-flux, options mail OVH à résilier
  (MX sur Microsoft — démontré), ancien tenant à couper à J+30.

## Incidents notables et leçons
- **Secret Graph collé en clair dans la conversation** (21/08) →
  remplacé aussitôt. Leçon : un secret exposé se remplace, toujours.
- **SPF de synapserh.fr en double** (permerror — cause probable des AR
  en spam) : à corriger dans la zone OVH si pas déjà fait.
- **Ne jamais « traiter » une demande d'accès à la main dans
  SharePoint** (origine de l'incident du 18/08) — l'écran admin fait foi.
- `Bonjour unknown` : External ID enregistre « unknown » sans attribut
  nom — attribut ajouté au flux + repli e-mail dans le front.

## RESTE À FAIRE
1. **Phase 2 — les 8 flux Power Automate** (importés par solution, à
   re-pointer un par un) : connexions sous svc-flux, listes osmoserh83,
   SMTP → Outlook, adresses @osmoserh.fr, modèles Word re-téléversés ;
   + 2 nouveaux : « Bienvenue portail », « Leads site ». Check-list
   détaillée : runbook phase 2 + fiche ACP/ATT.
2. **Recette phase 6** complète (`Recette-phase-6.md`).
3. Communication clients + reprise des clients réels (outils prêts).
4. **J+30** : décommissionnement ancien tenant synapse, ancienne SWA,
   options OVH, `mx.ovh.com` hors SPF, retirer `ping` si sain.

## Décision métier du 22/08 — embauche « modèle B » (PJ obligatoires)

Question tranchée : qui saisit le dossier administratif du salarié ?
**Osmose RH compile les données, pas le client.** Le formulaire
d'embauche demande donc :
- les informations du **contrat** (11 champs d'origine, inchangés) ;
- **trois pièces jointes obligatoires** — pièce d'identité, carte
  Vitale, RIB — contrôlées (pdf/jpg/png, 10 Mo max), déposées via
  `/api/depot` dans `{code}/Dépôts` sous le nom
  `PJ-Embauche_{NOM}-{Prénom}_{type}_{date}.{ext}` ; l'API refuse
  l'embauche sans les trois noms (`pjIdentite`/`pjVitale`/`pjRib`) ;
- le **volet administratif reste disponible mais FACULTATIF** : chaque
  champ transmis est validé (sexe, situation, IBAN/BIC, code pays,
  e-mail), aucun n'est exigé ; un champ vide n'est jamais écrit dans la
  fiche « Salariés » (pas d'écrasement à l'upsert).

Le circuit de complétion : Osmose transcrit les pièces dans l'onglet
**Dossier** de la gestion du personnel — le bandeau « ⚠ Dossier
incomplet » y liste les champs manquants (règle `majSalarie`
inchangée : dossier complet exigé à l'enregistrement). **v2 (après
lancement)** : pré-remplissage par OCR des pièces (Azure Document
Intelligence) — le client scanne, le logiciel remplit, Osmose valide.
`VERSION_API = 2026-08-22-pj-embauche`.

## 22/08 (suite) — API DPAE branchée

L'écran gestionnaire déclare désormais les embauches à l'URSSAF
(section « DPAE — déclarations d'embauche » : brouillon pré-rempli,
dépôt, certificat de conformité). Mise en service, protocole et recette :
**`docs/DPAE-API.md`**. À faire : compte urssaf.fr habilité DPAE +
variables `DPAE_*` sur la SWA + relance de `creer_site_rh.py`
(colonnes DPAE et identification URSSAF des clients).
`VERSION_API = 2026-08-22-dpae`.
