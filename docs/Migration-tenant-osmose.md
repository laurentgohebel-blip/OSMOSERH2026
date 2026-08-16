# Migration vers un tenant Microsoft « Osmose » neuf

> ⚠️ **Document initial (plan d'avant-migration).** L'état réel, les valeurs
> définitives (tenants, site, apps) et les décisions prises sont dans
> **`Synthese-migration-2026-08-16.md`** — c'est elle qui fait foi.
> En résumé au 16/08 : tenant workforce `osmoserh83` créé, couche de données
> SharePoint terminée (7/7 listes du code + bibliothèques), flux à
> reconstruire (ATT-01 d'abord), puis configuration SWA et recette.

Décision : créer un nouveau tenant Microsoft 365 / Entra et y déménager tout
l'écosystème (mails, SharePoint, Power Automate, Azure). Ce document est le
plan de référence — phases dans l'ordre, pièges connus, partage des rôles.

**À savoir avant de commencer**
- ⚠️ **Un domaine ne peut être vérifié que dans UN tenant à la fois.**
  Si osmoserh.fr a déjà été ajouté au tenant Synapse (étape 6 de l'ancien
  guide), il faudra l'en retirer avant de le vérifier dans le nouveau tenant.
  → Ne PAS faire l'étape 6 de `Bascule-osmoserh-fr.md` : ce guide reste
  valable uniquement pour ses étapes 1-5 (domaine web du portail), qui
  fonctionnent quel que soit le tenant.
- ⚠️ Le nom technique `osmoserh.onmicrosoft.com` est **déjà pris** par le
  tenant External ID (connexion clients). Le nouveau tenant M365 aura un
  autre nom initial (ex. `osmoserhfr.onmicrosoft.com`) — purement technique,
  invisible des clients.
- ✅ **Le tenant External ID ne migre PAS** : il est déjà « osmoserh », les
  comptes clients du portail et l'app « Portail Osmose RH » restent tels
  quels. Zéro impact sur la connexion des clients. Seul son rattachement de
  facturation passera sur la nouvelle souscription Azure.
- ⚠️ Les flux à déclencheur HTTP (`FLOW_URL_*`) requièrent une licence
  **Power Automate Premium** — à racheter dans le nouveau tenant.
- ⚠️ L'**historique** des approbations et des exécutions de flux ne se
  migre pas (les données SharePoint, si).

---

## Phase 0 — Créations et licences (Laurent)
1. Créer le tenant : admin.microsoft.com → nouveau tenant, ou via l'achat
   des licences. Nom initial : `osmoserhfr.onmicrosoft.com` (ou similaire).
2. Licences : Microsoft 365 Business (mail + SharePoint) pour chaque
   utilisateur interne + **Power Automate Premium** pour le compte qui
   possédera les flux.
3. Compte admin dédié (ex. `admin@osmoserhfr.onmicrosoft.com`) + MFA.

## Phase 1 — Domaine et utilisateurs (Laurent)
1. Retirer osmoserh.fr du tenant Synapse s'il y a été ajouté.
2. Vérifier osmoserh.fr dans le nouveau tenant (TXT dans la zone OVH).
3. Créer les utilisateurs internes en @osmoserh.fr.
4. **Ne pas encore toucher aux MX** : les mails restent sur l'ancien tenant
   jusqu'à la phase 5.

## Phase 2 — SharePoint (Claude ✦ scriptable)
Le site RH, ses listes et la bibliothèque « Documents clients ».
1. Créer le site RH vide dans le nouveau tenant (Laurent, 5 min).
2. **Script de provisionnement** (Claude) : recréation des listes avec leurs
   colonnes exactes via Graph — Paramètres clients, Utilisateurs portail,
   Production contrat, Acompte, Attestations, Absences, Visites médicales,
   Adhésions mutuelles, Fins de contrat, Salariés, Messages gestionnaire.
3. **Script de migration des données** (Claude) : lecture de chaque liste de
   l'ancien tenant → écriture dans le nouveau, puis copie des documents
   (bibliothèque + modèles) dossier par dossier. Volumes faibles → Graph
   suffit, pas d'outil payant.
4. Contrôle : comptages ancien/nouveau par liste, échantillons.
   Prérequis : une inscription d'app Graph dans CHAQUE tenant (lecture côté
   Synapse, écriture côté Osmose) — consentement admin des deux côtés.

## Phase 3 — Azure (Laurent, avec pas-à-pas Claude)
1. Nouvelle souscription Azure rattachée au tenant Osmose.
2. Nouvelle inscription d'app « élévation Graph » (Sites.Selected ou
   Sites.ReadWrite.All + Files, comme l'actuelle) → nouveaux AUTH_*/GRAPH_*.
3. Nouvelle **Static Web App** : reconnecter le dépôt GitHub (nouveau token
   de déploiement dans les secrets GitHub), reporter les variables
   d'application : AUTH_*, GRAPH_*, RH_SITE_ID (nouveau site), RAPPEL_SECRET,
   ALERTE_DEFAUT, et les FLOW_URL_* (phase 4).
4. Domaines personnalisés sur la nouvelle SWA : espace.osmoserh.fr
   (+ espace.synapserh.fr pendant la transition si souhaité).
5. External ID : rattacher la facturation du tenant CIAM à la nouvelle
   souscription. Ajouter https://espace.osmoserh.fr aux URI de redirection
   de l'app « Portail Osmose RH » (inchangée par ailleurs — le code du
   portail ne change pas : client ID et authority restent identiques).
6. Décommission (fin de transition) : ancienne SWA, ancienne app Graph.

## Phase 4 — Power Automate (Laurent, avec pas-à-pas Claude)
1. Exporter chaque flux de l'ancien tenant (paquet .zip) → importer dans le
   nouveau ; recréer les connexions (SharePoint, Outlook, Approbations) à
   l'import.
2. Re-pointer les déclencheurs/actions SharePoint sur le NOUVEAU site.
3. Les flux HTTP donnent de **nouvelles URL** → reporter dans les
   FLOW_URL_* de la nouvelle SWA.
4. Expéditeurs/destinataires en @osmoserh.fr.
5. Test de bout en bout par démarche (le portail de test peut viser la
   nouvelle SWA avant la bascule DNS).

## Phase 5 — Mails (Laurent)
1. Export/import des boîtes (volume faible : export PST depuis Outlook ou
   migration IMAP native ; sinon outil au forfait par boîte).
2. Bascule des **MX/SPF/DKIM** de osmoserh.fr vers le nouveau tenant.
3. Conserver l'accès à l'ancien tenant quelques semaines (double lecture).

## Phase 6 — Bascule finale et tests (ensemble)
1. DNS : espace.osmoserh.fr → nouvelle SWA (CNAME déjà posé, il suffit de
   changer la cible si la SWA a changé de nom d'hôte).
2. Tests complets : connexion client réelle, chaque démarche + AR reçu,
   échéances, documents (dépôt + téléchargement), démo /?demo, /decouvrir.
3. Communication aux clients (nouvelle adresse du portail si changée).
4. Décommission progressif du tenant Synapse (après période de recouvrement).

---

## Partage des rôles
| Qui | Quoi |
|---|---|
| Claude | Scripts de provisionnement + migration SharePoint, adaptations de code si besoin, pas-à-pas détaillé de chaque phase, tests e2e après bascule |
| Laurent | Créations tenant/licences/souscription, consentements admin, import des flux, DNS/OVH, mails |

## Estimation
Étalée sur 1 à 2 semaines calendaires (attentes DNS/licences comprises),
avec ~2-3 jours de travail effectif. Coûts : licences du nouveau tenant
(dont Power Automate Premium) ; pas d'outil de migration payant nécessaire
grâce aux scripts Graph.
