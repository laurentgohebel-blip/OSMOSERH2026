# Backlog Osmose RH — document vivant

Tenu au fil des sessions (créé le 22/08/2026, pendant le voyage de
Laurent). Une idée dictée = une ligne ici ; développée = déplacée dans
« En ligne ». Les décisions structurantes restent tracées dans la
synthèse de session et les docs dédiées.

## En ligne récemment (rien à faire)
- **Dossier salarié enrichi** (14 champs, onglet Dossier, bandeau
  « Dossier incomplet » = liste de travail Osmose).
- **Embauche modèle B** : 3 PJ obligatoires (identité, Vitale, RIB),
  volet administratif facultatif — Osmose compile.
- **DPAE** : déclaration URSSAF depuis l'écran gestionnaire
  (docs/DPAE-API.md).
- **Messagerie « Mon gestionnaire »** : fils de discussion des deux
  côtés (docs/Fil-messagerie-portail.md).

## Mise en service en attente (gestes Laurent — 10 min au calme)
- [ ] Relancer `creer_site_rh.py` (Cloud Shell) : colonnes DPAE +
      messagerie + identification URSSAF des clients. UN passage
      couvre tout.
- [ ] Variables SWA `DPAE_*` (mode test d'abord) — docs/DPAE-API.md §2.
- [ ] Compléter l'identification URSSAF des fiches clients (code
      URSSAF, APE, ville, CP, santé travail).
- [ ] Flux messagerie (deux flux à re-pointer — doc messagerie).

## Liste d'améliorations du portail (dictée par Laurent)
1. **Gestion du personnel — enrichir les fiches** : ✅ TERMINÉ le 22/08.
   Fiches 14 champs + onglet Dossier ; reprise d'effectif étendue au
   dossier complet (collage Excel, colonnes reconnues, normalisations
   tolérantes) ; modèle Excel de reprise 24 colonnes ; export des
   fiches en un clic depuis la gestion du personnel (CSV pour Excel).
   **+ Volet salarié étranger** (ajout du 22/08) : nationalité hors
   UE/EEE/Suisse détectée à l'embauche → titre de séjour obligatoire
   (type, numéro, expiration, copie recto-verso en PJ, refus si expiré
   avant l'embauche) ; suivi de l'authentification préfectorale dans
   l'écran gestionnaire (badge À authentifier/Authentifié/Refusé,
   mail type R.5221-41, avertissement dans le brouillon DPAE) ;
   champs titre dans l'onglet Dossier.
   **+ Alerte d'expiration des titres** (22/08) : e-mail automatique à
   J-90 (contacts du client + gestionnaire, anti-doublon
   `AlerteTitreSejour`, rattrapage des titres expirés < 30 j, corps
   « URGENT » si expiré) via le flux hebdomadaire existant — la réponse
   de `/api/echeances` porte un tableau séparé `alertesTitres` avec
   `email`, `objet` et `corps` PRÊTS À ENVOYER. Page Échéances du
   client : section « Titres de séjour à renouveler » (J-120 + expirés
   récents). **Geste Laurent** : dans le flux « Alertes échéances »,
   ajouter une 2e boucle « Pour chaque » sur `alertesTitres` avec un
   simple Envoyer un e-mail (À = `email`, Objet = `objet`,
   Corps = `corps`) — rien d'autre à composer.
2. _(jamais transmis — « On y reviendra »)_

## Idées / suites déjà actées
- OCR v2 : pré-remplissage du dossier depuis les PJ (Azure Document
  Intelligence) — après le lancement.
- Alerte délai DPAE (fenêtre légale : 8 jours avant l'embauche).
- Annexe RGPD art. 28 aux contrats clients (projet à rédiger —
  prioritaire avant les clients réels).
- Recette phase 6 complète (Recette-phase-6.md) — le bêta-test en
  couvre l'essentiel.
- J+30 bascule : décommissionner tenant synapse, ancienne SWA, options
  mail OVH, `mx.ovh.com` hors SPF, retirer `ping` si sain.
- SPF de synapserh.fr en double (zone OVH) — jamais confirmé corrigé.

## En attente d'un tiers
- Fiches du bêta-testeur (dépouillement + corrections à mon retour de
  chaque lot — transferts photo/copier-coller acceptés).
