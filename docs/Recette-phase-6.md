# Recette phase 6 — validation complète après migration

À dérouler dans l'ordre, une fois les phases 4 (flux) et 5 (variables SWA)
terminées. Cocher au fur et à mesure. Toute case qui résiste : noter le
symptôme exact (message, référence, heure) avant de passer à la suite.

## 0. Préalables techniques

- [ ] Variables SWA posées (tableau de la synthèse du 16/08) — aucune absente
- [ ] `ADMIN_EMAILS` posée (adresses gestionnaires, séparées par des virgules)
      → l'écran d'activation des demandes d'accès s'affiche à leur connexion
- [ ] **Nouvelle SWA : indexation des routes saine** — `/api/admin-donnees`
      sans jeton répond `{"erreur":"Connexion requise."}` et `/api/lead`
      répond au POST (pas de 404). Sur l'ancienne SWA la table de routage
      était figée (voir Point-de-reprise du 17/08, § 18/08 fin) ; l'écran
      admin passe par `me?vue=admin` + `demande{action}` et fonctionne
      partout, mais `/api/lead` n'a PAS de détour : ce point est bloquant
      pour les formulaires du site vitrine.
- [ ] `FLOW_URL_ATTESTATION_EMPLOYEUR` renseignée (⚠️ pas `ATT01`)
- [ ] espace.osmoserh.fr actif (DNS + domaine personnalisé + certificat)
- [ ] `https://espace.osmoserh.fr` ajouté aux URI de redirection SPA de
      l'app « Portail Osmose RH »
- [ ] SPF de osmoserh.fr fusionné en un seul enregistrement
- [ ] Suite automatisée verte : action GitHub « Tests du portail (mode démo) »
      sur le dernier commit (ou `npm run test:e2e` en local)

## 1. Accès et verrou

- [ ] espace.osmoserh.fr → page de connexion s'affiche
- [ ] Connexion avec un compte rattaché → tableau de bord du bon client
- [ ] Compte NON rattaché (adresse vierge) → écran « Demande d'accès »
- [ ] Demande d'accès envoyée → référence `ACCES-…` affichée,
      **AR reçu par le demandeur**, notification reçue côté gestionnaire
      (⚠️ point en échec constaté le 17/08 sur l'ancien tenant — vérifier
      spécifiquement le déclencheur du flux)
- [ ] Re-soumission même adresse → « demande déjà en cours » (anti-doublon)
- [ ] Activation : ligne « Utilisateurs portail » ajoutée → reconnexion →
      l'espace s'ouvre sur le bon client
- [ ] Pré-provisionnement (parcours A d'`Onboarding-client.md`) : création
      d'un accès via « Nouveau client — accès sans demande » → première
      connexion du compte → l'espace s'ouvre directement, sans demande
      d'accès ; le client créé apparaît dans la liste « client existant »
- [ ] Reprise de l'effectif : coller un export Excel dans la section
      dédiée de l'écran admin → colonnes reconnues, aperçu, import →
      salariés visibles dans l'onglet Personnel du client, ré-import du
      même fichier → 100 % doublons ignorés (aucune ligne créée)
- [ ] /?demo → mode démonstration OK ; « Quitter » → retour connexion

## 2. Démarches (client de test, options toutes ouvertes)

Pour chaque démarche : formulaire → référence affichée → ligne écrite dans
la bonne liste → AR au demandeur → notification gestionnaire.

- [ ] **Attestation employeur** (ATT-01) : + approbation → document
      Word/PDF selon `formatSouhaite` → déposé dans
      `Documents clients/{client}/Attestations` → visible dans l'onglet
      Documents du portail
- [ ] **Acompte** : montant ET matricule en nombres, `nomSalarie` rempli,
      **date de versement** dans la liste
- [ ] **Embauche CDI** : ligne « Production contrat », approbation reçue,
      contrat généré
- [ ] **Embauche CDD avec date de fin** : idem + le CDD apparaît dans la
      page **Échéances**
- [ ] **Absence motif médical** : justificatif exigé (bloqué au formulaire
      ET refusé par l'API si contourné)
- [ ] **Absence congés payés** : passe sans justificatif ; visible dans la
      fiche salarié
- [ ] **Visite médicale**, **Mutuelle**, **Fin de contrat** : écriture +
      AR + fiche salarié à jour
- [ ] **Variables de paie** : grille multi-lignes → une ligne de liste par
      salarié
- [ ] **Message gestionnaire** : écrit dans « Messages gestionnaire »,
      AR avec message cité, lien « Répondre au client » fonctionnel

## 3. Documents

- [ ] Dépôt d'un fichier depuis le portail → visible dans la GED (dossier
      Dépôts du client) et re-listé dans l'onglet
- [ ] Téléchargement d'un document → fichier intact
- [ ] Extension refusée (.exe) et fichier > 10 Mo → rejetés proprement

## 4. Site vitrine et leads

- [ ] Liste « Leads site » créée (`python src/scripts/creer_leads_site.py`)
- [ ] Formulaire « accès prioritaire » (lancement.html) → page merci →
      ligne dans « Leads site » → notification reçue
- [ ] Formulaire contact → idem avec Sujet et Message remplis
- [ ] Champ caché rempli (test robot via curl) → 202 mais AUCUNE ligne créée
- [ ] Rebasculer les liens `TEMPORAIRE` du site vitrine
      (rechercher « TEMPORAIRE » dans index.html et Connexion.html)
      vers espace.osmoserh.fr, re-téléverser, re-tester les boutons

## 5. Flux périodiques et alertes

- [ ] Flux hebdomadaire échéances : exécution manuelle → e-mail J-30 aux
      bons destinataires, marquage anti-doublon posé
- [ ] Alerte de panne : provoquer un échec volontaire (ou vérifier la
      configuration) → e-mail à l'adresse d'alerte

## 6. E-mails

- [ ] Tous les expéditeurs en @osmoserh.fr
- [ ] Aucun AR en spam (tester vers une boîte Gmail ET une boîte Outlook
      externes) — sinon revoir SPF/DKIM
- [ ] Aucun lien SharePoint direct dans aucun e-mail (règle du 16/08 :
      tout pointe vers le portail)

## 7. Clôture

- [ ] Bascule DNS finale + communication aux clients existants
- [ ] Compte-rendu de recette (anomalies et corrections) dans docs/
- [ ] J+30 sans incident : décommissionner l'ancien tenant, retirer
      espace.synapserh.fr (SWA + URI de redirection), supprimer l'app
      d28a8309 et l'ancienne SWA yellow-field
