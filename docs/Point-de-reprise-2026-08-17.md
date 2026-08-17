# Point de reprise — 17 août 2026 (complète la synthèse du 16/08)

Ce qui a bougé depuis la synthèse, pendant le blocage Microsoft.

## Fait et en production (portail — dépôt SynapseRH2026)

- **Vidéo de démonstration finale** : voix Laurent + nappe musicale
  « lumineuse » (composition originale, dosage validé après ajustement),
  en ligne sur `/videos/demo-osmose-rh.mp4`. La piste voix seule est
  récupérable dans l'historique Git (commit `60f9a44`) pour tout remixage.
- **Suite de tests e2e + CI** : 9 tests Playwright (parcours démo complet,
  /?demo, /decouvrir, garantie zéro appel réseau /api en démo), joués à
  chaque push (`.github/workflows/tests.yml`). Verts en local et sur GitHub.
  C'est le filet de sécurité de la bascule : `npm run test:e2e`.
- **API `/api/lead`** : réception des formulaires du site vitrine
  (anonyme, pot de miel, CORS restreint) → liste « Leads site ».
  Script prêt-à-lancer : `python src/scripts/creer_leads_site.py`
  (idempotent, colonnes exactes). Docs : `Leads-site-vitrine.md`.
- **Kit ATT-01** : schéma du déclencheur généré depuis le code
  (`ATT-01-schema-declencheur.md`) — ⚠️ variable `FLOW_URL_ATTESTATION_EMPLOYEUR`,
  pas `ATT01`.
- **Check-list de recette** : `Recette-phase-6.md`.

## Fait et en ligne (site vitrine OVH — osmoserh.fr)

- 9 pages corrigées et **restructurées** : racine = vraie page d'accueil
  (avec section Démonstration et vidéo), formulaire d'accès prioritaire sur
  `lancement.html`, `Accueil.html` = redirection. Liens morts réparés
  (`a-propos.html`), dépendance `synapse.css` supprimée, meta descriptions,
  favicon partout.
- **Vidéo hébergée sur OVH** (`www/videos/`) : indépendante du portail —
  décision définitive, ne pas repointer vers le portail.
- **Formulaires branchés** sur `https://espace.osmoserh.fr/api/lead`
  (message de repli propre tant que la liste n'existe pas).
- **Liens temporaires vers l'ancien domaine** (démo, page de présentation,
  bouton Espace client) — marqués `<!-- TEMPORAIRE -->` dans `index.html`
  et `Connexion.html` : rechercher « TEMPORAIRE » au moment de la bascule
  pour tout rebasculer vers espace.osmoserh.fr.

## Constats des tests du 17/08 (ancien tenant, portail en service)

- **Connexion réelle OK** : compte dont l'e-mail figure dans « Utilisateurs
  portail » → accès direct au client « Entreprise de démonstration SAS »
  (verrou serveur vérifié dans le code : aucun repli possible).
- 🔴 **AR de la demande d'accès non reçu** par le demandeur (nouveau compte,
  adresse vierge). L'API écrit la liste et rend la référence ; les e-mails
  relèvent du flux « Demandes d'accès + AR ». Destinataire côté Osmose :
  configuré EN DUR dans le flux (lgohebel@synapserh.fr). À vérifier au
  déblocage : historique d'exécution du flux (déclencheur muet ?), spams.
  Ce flux est de toute façon à reconstruire dans le nouveau tenant.

## Reprise au déblocage Microsoft (ordre conseillé)

1. Points ouverts de la synthèse : domaine osmoserh.fr vérifié dans quel
   tenant, licence Power Automate Premium, rôle Dataverse, SPF fusionné.
2. Reconstruire **ATT-01** (kit prêt) → `FLOW_URL_ATTESTATION_EMPLOYEUR`.
3. Phase 5 : variables SWA (tableau de la synthèse).
4. `python src/scripts/creer_leads_site.py` + flux de notification leads.
5. Flux « Demandes d'accès + AR » : reconstruire et re-tester l'entonnoir
   (le compte de test du 17/08 est en attente, prêt à activer).
6. Dérouler `Recette-phase-6.md`.

## Côté Laurent, sans Microsoft (si pas déjà fait)

- OVH : supprimer `Acceuil.html` (mal orthographié), `synapse.css`,
  `auth.js` ; vérifier que `favicon.svg` existe bien dans www.
- GitHub : passer le dépôt `synapse-contrat` en privé (mécanisme
  d'écriture exposé publiquement).
- Renommer (plus tard) la raison sociale du client de test
  « Entreprise de démonstration SAS » pour éviter la confusion avec le
  mode démonstration (boulangerie fictive).
