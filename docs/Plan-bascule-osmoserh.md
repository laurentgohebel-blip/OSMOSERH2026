# Plan de bascule — tenant Osmose (runbook du 20/08/2026)

Contrôle du tenant osmoserh récupéré. Ce runbook déroule la bascule de
bout en bout ; il remplace l'« ordre conseillé » du point de reprise.
Registre technique : synthèse du 16/08. Décisions de coûts intégrées
(`Infra-couts.md`) : **pas de Power Automate Premium, pas de FLOW_URL_\*,
SWA en offre Free, licences Basic sauf besoin Office**.

Repères du tenant cible (synthèse 16/08) :
- Tenant : `5dc184d2-699a-4051-9f46-d040bc141669`
- App Graph : `be0f7e69-1192-4582-a3f7-984fae4ff145` (Sites.Manage.All)
- RH_SITE_ID : `osmoserh83.sharepoint.com,ac8bcc33-…,e2c157a4-…`
- CIAM **recréé le 21/08** (l'ancien tenant da198f21 n'était plus
  administrable — leçon : l'annuaire clients doit appartenir à
  lgohebel@osmoserh.fr) : tenant `d0ce15bd-f382-4878-bc70-45e20eb59cfa`,
  app « Portail Osmose RH » `19d1eb4c-4b45-44c5-83d1-eaacc3713776`.
  Comptes clients à recréer (il n'y avait que des comptes de test).

## Phase 0 — vérifications (Laurent, ~30 min)

- [ ] Admin M365 → Domaines : **osmoserh.fr vérifié** dans CE tenant
      (DNS déjà sain, contrôlé le 18/08 : MX Microsoft, SPF unique)
- [ ] Licences : M365 Business **Basic** par défaut (Standard seulement
      si Office de bureau nécessaire) — **PAS de Premium**
- [ ] Boîte lgohebel@osmoserh.fr opérationnelle (envoyer/recevoir un test)
- [ ] App Graph be0f7e69 : **secret non expiré** (en régénérer un sinon)
      et consentement admin Sites.Manage.All accordé
- [ ] Site RH osmoserh83 accessible (l'URL de RH_SITE_ID s'ouvre)
- [ ] Rôle Dataverse / activation Power Automate du compte (ouvrir
      make.powerautomate.com dans le tenant : pas d'erreur)

## Phase 1 — structurer SharePoint (scripts, ~30 min)

Exécution : **Azure Cloud Shell** (portal.azure.com → icône >_ , Bash,
Python préinstallé — rien à installer en local) :

```
curl -O https://raw.githubusercontent.com/laurentgohebel-blip/SynapseRH2026/main/src/scripts/creer_site_rh.py
# (dépôt privé : sinon copier-coller le contenu dans l'éditeur { } du Cloud Shell)
export GRAPH_TENANT_ID=5dc184d2-699a-4051-9f46-d040bc141669
export GRAPH_CLIENT_ID=be0f7e69-1192-4582-a3f7-984fae4ff145
export RH_SITE_ID='osmoserh83.sharepoint.com,ac8bcc33-…,e2c157a4-…'
python creer_site_rh.py          # invite pour le secret — toutes les listes
python creer_listes_demarches.py # Acompte + Demandes attestations
python creer_leads_site.py       # Leads site (vitrine)
```

- [ ] `creer_site_rh.py` passé (12 listes + bibliothèque Documents clients)
- [ ] `creer_listes_demarches.py` passé
- [ ] `creer_leads_site.py` passé
- [ ] Colonne **Options** de « Paramètres clients » ajoutée À LA MAIN
      (Choix : embauche / acompte / attestation / paie — **plusieurs
      valeurs autorisées** ; Graph ne sait pas la créer)
- [ ] **« Production contrat »** créée via l'interface (seule liste à
      noms internes accentués). Libellés à saisir À LA CRÉATION (le nom
      interne se fige à ce moment ; renommer ensuite ne change rien) :

| Saisir à la création | Type | Nom interne attendu par l'API |
|---|---|---|
| `Type contrat` | Choix (CDI, CDD) | `Type_x0020_contrat` |
| `Nom` | Texte | `Nom` |
| `Prénom` | Texte | `Pr_x00e9_nom` |
| `Datedenaissance` | Texte | `Datedenaissance` |
| `Lieudenaissance` | Texte | `Lieudenaissance` |
| `Nationalité` | Texte | `Nationalit_x00e9_` |
| `N° Sécurité Sociale` | Nombre | `N_x00b0_S_x00e9_curit_x00e9_Soci` |
| `Adresse postale` | Texte | `Adresse_x0020_postale` |
| `Email` | Texte | `Email` |
| `Numérodetéléphone` | Texte | `Num_x00e9_rodet_x00e9_l_x00e9_ph` |
| `Datededébut` | Texte | `Dateded_x00e9_but` |
| `Datedefin` | Texte | `Datedefin` |
| `Postedetravail` | Choix (saisie libre) | `Postedetravail` |
| `Duréedutempsdetravail(h/mois)` | Nombre | `Dur_x00e9_edutempsdetravail_x002` |
| `CodeClient`, `EmailDemandeur`, `EmailGestionnaire` | Texte | idem |
| `Approuvé`, `Signé` | Oui/Non | `Approuv_x00e9_`, `Sign_x00e9_` |

      Vérification après création : paramètres de la liste → cliquer une
      colonne → le nom interne est dans l'URL (`Field=…`) ; comparer au
      tableau (référence : la même liste dans l'ancien tenant).

## Phase 2 — flux Power Automate (Laurent, designer)

Tout en connecteurs **standard** (SharePoint + Office 365 Outlook —
décision du 18/08 : plus aucun SMTP OVH), expéditeurs @osmoserh.fr,
**aucun lien SharePoint dans les e-mails** (règle du 16/08).

- [ ] « Demandes d'accès + AR » (création dans Demandes d'accès portail)
- [ ] « Bienvenue portail » (création dans Utilisateurs portail —
      modèle d'e-mail dans `Onboarding-client.md`)
- [ ] « Production contrat + AR » (approbation + contrat Word/PDF —
      re-téléverser les modèles Word, re-sélectionner leurs fichiers)
- [ ] « Acompte — AR + notification » (fiche `Flux-standard-ACP-ATT.md`)
- [ ] « Attestation employeur — production + AR » (même fiche)
- [ ] « Leads site — notification » (`Leads-site-vitrine.md`)
- [ ] Hebdomadaire échéances CDD (e-mail J-30, anti-doublon)
- [ ] Alerte de panne (échec de flux → e-mail)

## Phase 3 — nouvelle Static Web App (Laurent + Claude)

- [ ] Créer la SWA (abonnement Azure du tenant osmose, offre **Free**,
      région Europe) — build : app `/`, api `api`, output `build`
- [ ] Récupérer le jeton de déploiement → remplacer le secret GitHub
      `AZURE_STATIC_WEB_APPS_API_TOKEN` (⚠️ à partir de là, les push sur
      main déploient la NOUVELLE SWA ; l'ancienne continue de servir
      espace.synapserh.fr telle quelle)
- [ ] Variables d'application (tableau de la synthèse) : `GRAPH_*` du
      tenant osmose, `RH_SITE_ID`, `AUTH_*` CIAM **inchangées**,
      `ADMIN_EMAILS` — **PAS de FLOW_URL_\*** (démarches en standard)
- [ ] Premier déploiement vert → test immédiat sur l'URL azurestaticapps :
      `/api/ping` répond avec le bon `version` (doctrine du 21/08 :
      aucune nouvelle route /api/<nom> — admin et leads passent par les
      routes historiques, voir me.js)
- [ ] Domaine personnalisé **espace.osmoserh.fr** (CNAME OVH → validation)
- [ ] URI de redirection `https://espace.osmoserh.fr` ajoutée à l'app
      CIAM « Portail Osmose RH »

## Phase 4 — recette et reprise des clients

- [ ] Dérouler `Recette-phase-6.md` (préalables déjà en partie faits ici)
- [ ] Reprise des clients réels avec les outils de la semaine : écran
      admin → « Nouveau client — accès sans demande » (fiche + options)
      puis « Reprise de l'effectif » (collage Excel) — client par client
- [ ] E-mails de bienvenue nouveau domaine (modèle `Onboarding-client.md`)

## Phase 5 — bascule et nettoyage

- [ ] Site vitrine : rebasculer les liens `TEMPORAIRE` (index.html,
      Connexion.html) vers espace.osmoserh.fr, re-téléverser, re-tester
- [ ] Communication aux clients existants
- [ ] J+30 sans incident : décommissionner l'ancien tenant (licences),
      supprimer l'app d28a8309, l'ancienne SWA (espace.synapserh.fr),
      résilier les options e-mail OVH, retirer `include:mx.ovh.com` du
      SPF, retirer la fonction-témoin `ping` si la nouvelle SWA est saine
