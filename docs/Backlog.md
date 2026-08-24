# Backlog Osmose RH — document vivant

Tenu au fil des sessions (créé le 22/08/2026, pendant le voyage de
Laurent). Une idée dictée = une ligne ici ; développée = déplacée dans
« En ligne ». Les décisions structurantes restent tracées dans la
synthèse de session et les docs dédiées.

## En ligne récemment (rien à faire)
- **Planning d'équipe + pointage sans matériel** (24/08, voir
  docs/Planning-et-pointage.md) : le planning que le client fait déjà
  devient la source des heures de paie. Grille salariés × jours,
  totaux hebdomadaires décomposés (normales, +25 %, +50 %,
  complémentaires, nuit, dimanche/fériés), bouton « Transmettre ces
  heures à mon gestionnaire » qui écrit dans les variables. Décompte
  **hebdomadaire** (l'erreur classique du calcul à la main).
  Contrôles à la saisie : 10 h/jour, 48 h et 44 h/semaine, temps
  partiel porté à 35 h (requalification), repos quotidien de 11 h, six
  jours consécutifs, 1er mai. On informe, on ne bloque pas.
  **Pointage** : QR code près de la porte, aucun compte, heure du
  serveur ; jeton dérivé du code client par HMAC, donc aucune colonne
  et révocation globale en changeant le secret.
  **Gestes** : relancer creer_site_rh.py (liste « Temps de travail » +
  colonne `DureeMensuelle` sur Salariés, à renseigner pour les temps
  partiels), et poser `POINTAGE_SECRET` dans la SWA pour le pointage.
- **Réembauche d'un ancien salarié** (24/08, voir docs/Reembauche.md) :
  troisième parcours de la brique Embauche — « Il a déjà travaillé chez
  nous ». Le dossier est repris (identité, NIR, adresse, banque, titre
  de séjour, pièces justificatives) ; le client ne saisit que le
  nouveau contrat. Le portail énonce ce que la réembauche impose :
  délai de carence entre deux CDD (chiffré et daté, L.1244-3-1), titre
  de séjour revérifié à la date d'embauche, période d'essai à réduire,
  visite médicale peut-être non nécessaire, ancienneté reprise, DPAE
  toujours due. Un point bloquant n'interdit pas : il exige un motif
  d'exception, tracé auprès du gestionnaire. Aucune colonne
  SharePoint, aucune variable, rien à faire pour l'activer.
- **La boîte mail comme point d'entrée** (24/08, voir
  docs/Courriel-boite-de-depot.md) : le client transfère l'arrêt à
  l'adresse de dépôt du cabinet, le portail reconnaît l'expéditeur,
  classe la pièce dans sa GED, lit le document ET le corps du message,
  rapproche le salarié de l'effectif, enregistre l'absence et répond ce
  qu'il a compris. Aucune connexion, aucun mot de passe. Le client vient
  toujours de l'annuaire, jamais du message ; aucune démarche créée dans
  le doute (salarié ambigu, motif ou date manquants → le gestionnaire
  prend le relais) ; référence `MAIL-…` déterministe contre les
  doublons. **Mise en service** : boîte partagée Microsoft 365, variable
  `COURRIEL_SECRET` dans la SWA, flux Power Automate à deux actions
  (recette complète dans la doc). Sans le secret : brique absente.
- **Dossier salarié enrichi** (14 champs, onglet Dossier, bandeau
  « Dossier incomplet » = liste de travail Osmose).
- **Embauche modèle B** : 3 PJ obligatoires (identité, Vitale, RIB),
  volet administratif facultatif — Osmose compile.
- **DPAE** : déclaration URSSAF depuis l'écran gestionnaire
  (docs/DPAE-API.md).
- **Messagerie « Mon gestionnaire »** : fils de discussion des deux
  côtés (docs/Fil-messagerie-portail.md).
- **Lecture automatique des pièces (OCR)** (24/08, voir
  docs/OCR-lecture-pieces.md) : la photo d'un document pré-remplit le
  formulaire — arrêt de travail (dates + motif) dans la déclaration
  d'absence, RIB (IBAN/BIC), carte Vitale (NIR) et pièce d'identité
  (nom de naissance, naissance, sexe, commune) dans l'onboarding.
  Bouton « 📷 Photographier ou joindre » qui ouvre l'appareil photo sur
  mobile. Un champ déjà saisi n'est jamais écrasé ; une bannière annonce
  ce qui a été lu et invite à vérifier. Le dépôt prime sur l'analyse :
  échec d'analyse = dépôt réussi quand même.
  **Mise en service (facultative)** : ressource Azure AI Document
  Intelligence + variables `OCR_ENDPOINT` et `OCR_CLE` dans la SWA.
  Sans elles, la fonctionnalité est absente, pas en panne — aucun appel,
  aucun coût.
- **Suivi commercial des options + correction d'un bug de cache**
  (24/08) : onglet gestionnaire « Abonnements » — qui a souscrit quoi,
  depuis quand, pour quel effectif suivi, quel forfait mensuel ; totaux
  (clients actifs, salariés suivis, récurrent mensuel), répartition par
  option, export CSV. **Détection d'opportunités** : un client dont les
  données montrent des salariés étrangers ou des habilitations sans
  l'option correspondante est signalé avec le motif chiffré.
  Aucun prix n'est inventé : catalogue via la variable SWA
  `TARIFS_OPTIONS` (JSON, ex. `{"etrangers":15,"securite":20}`), forfait
  négocié par client via la colonne `TarifMensuel` (prioritaire).
  **BUG CORRIGÉ au passage** : les six lecteurs de « Paramètres clients »
  utilisaient des `$select` différents alors que le cache `items()` est
  indexé par LISTE. Un lecteur étroit (`admin.donnees`, sans `Options`)
  remplissant le cache le premier appauvrissait `resoudreClient` pendant
  60 s → un client se connectant dans la minute suivant une consultation
  gestionnaire voyait **toutes ses tuiles grisées**, puis « ça se
  réparait tout seul ». Tous alignés sur `SELECT_CLIENTS` exporté par
  annuaire.js (même doctrine que `SELECT_SALARIES`).
  **Geste** : relancer creer_site_rh.py (DateSouscription, TarifMensuel).
- **Visite de reprise après arrêt** (23/08 nuit, art. R.4624-31) : les
  absences DÉJÀ déclarées dans le portail déclenchent l'obligation —
  congé maternité et maladie professionnelle (toute durée), accident du
  travail ou de trajet ≥ 30 j, maladie ou accident non professionnel
  ≥ 60 j. Échéance = retour + 8 jours ; alerte REPRISE une semaine
  avant le retour (le flux est hebdomadaire), puis RETARD. L'obligation
  s'éteint dès qu'une visite datée du retour ou après existe — y compris
  une simple demande « À planifier » : le client clique, les relances
  s'arrêtent. Section en tête de la page Échéances (encadré ambre),
  ligne « Visite de reprise » dans l'échéancier gestionnaire. Arrêts
  anciens jamais alertés (> 90 j de retard) : silence.
  **+ Nature de la visite** : les demandes de visite portent désormais
  un type (information/prévention à l'embauche, périodique, reprise,
  pré-reprise, à la demande) — affiché dans l'onglet Visites de la
  fiche. L'alerte de reprise ouvre le formulaire déjà réglé sur
  « Visite de reprise » via un bouton « Demander la visite » sur chaque
  ligne : un clic, et la relance s'éteint.
  **Geste** : relancer creer_site_rh.py (colonne AlerteReprise sur
  « Absences », TypeVisite sur « Visites médicales »). Limite connue :
  un arrêt sans date de fin (arrêt en cours) ne déclenche rien —
  l'obligation naît du retour. Toute visite datée du retour ou après
  éteint l'alerte, quel que soit son type (choix assumé : ne pas
  harceler un client qui a déjà fait le geste).
- **Relances d'onboarding + échéancier gestionnaire** (23/08 nuit) :
  invitations dormantes relancées automatiquement via `notifications`
  (type `onboarding`) — rappel au salarié à J+3 (lien inclus, contrat
  mentionné s'il attend), dernier rappel à 2 j de l'expiration (copie
  client), notification au client à l'expiration (lien mort, à
  regénérer) ; anti-doublon AlerteInvitation, expirée > 30 j = silence.
  Écran gestionnaire : nouvel onglet « Échéances » = TOUTES les
  échéances de TOUS les clients (CDD, essais, visites, entretiens,
  titres, habilitations) triées par urgence, fenêtre 120 j + retards
  60 j, compteurs et filtres par type (module echeancier.js, règles
  importées d'echeances.js — source unique).
  **Geste** : relancer creer_site_rh.py (colonne AlerteInvitation).
- **Option « securite » câblée — future option payante** (23/08 nuit) :
  les habilitations appartiennent à la brique Sécurité. Option de
  contrat `securite` créée (écran gestionnaire). TRANSITION : tant que
  la variable SWA `SECURITE_STRICTE` n'est pas posée, l'option embauche
  continue d'ouvrir les habilitations (clients actuels non impactés).
  **Bascule commerciale, le jour J, sans redéploiement** :
  1. ajouter la valeur `securite` au choix « Options » de « Paramètres
     clients » (interface SharePoint, minuscule exacte) ;
  2. cocher l'option sur les clients payants (écran gestionnaire) ;
  3. poser `SECURITE_STRICTE=1` dans les variables de la SWA ;
  4. ouvrir la tuile (bloc "salaries" dans AppShell.jsx).
- **Brique Sécurité — développée mais EN RETRAIT** (23/08 nuit,
  décision Laurent) : la brique est codée (registre des habilitations de
  l'effectif, compteurs, badges, déclaration en un clic, encart DUERP/
  registres) mais la tuile reste affichée « Bientôt disponible »
  (grisée). Pour l'OUVRIR le jour venu : dans AppShell.jsx, passer la
  tuile `securite` du bloc "bientot" au bloc "salaries" — une ligne.
  En attendant, les habilitations se déclarent depuis la fiche du
  salarié (onglet Habilitations) et restent suivies partout (échéances,
  alertes e-mail).
- **Pré-embauche : embauche par invitation + contrat automatique**
  (23/08 nuit) : la tuile Embauche propose DEUX parcours — « J'ai les
  informations du salarié » (parcours complet existant) ou « Je fais
  saisir le salarié » : le client ne renseigne que le contrat (type,
  dates, poste, durée, essai, e-mail du salarié facultatif), une fiche
  minimale est créée et le lien d'onboarding porte la commande de
  contrat. Le salarié remplit son dossier (+ commune de naissance et les
  TROIS pièces, obligatoires dans ce parcours) et, à sa soumission, la
  demande part AUTOMATIQUEMENT dans « Production contrat » (réf. EMB,
  flux AR habituel — contrat + DPAE suivent le circuit normal). En cas
  d'échec du lancement, le lien reste actif pour re-soumettre. Bonus :
  après une embauche directe, l'écran de confirmation propose d'inviter
  le salarié à compléter son dossier.
  **Geste** : relancer creer_site_rh.py (6 colonnes contrat sur
  « Invitations salariés »).
- **Onboarding salarié self-service + entretiens professionnels** (23/08
  soir) : depuis la fiche d'un salarié au dossier incomplet, bouton
  « Inviter le salarié à compléter son dossier » → lien à jeton
  (14 jours, usage unique, idempotent) que le client envoie par le canal
  de son choix ; le salarié ouvre un formulaire PUBLIC (sans compte,
  ?onboarding=jeton) : état civil, coordonnées, banque, dépôt des pièces
  (préfixées Onboarding_NOM dans les Dépôts du client) — la fiche se
  complète toute seule, l'invitation passe « Complétée ». Entretiens
  professionnels : échéance = dernier entretien + 24 mois (sinon entrée
  + 24 mois), champ dans l'onglet Dossier, section Échéances, alertes
  J-60/J-30/RETARD (type `entretien-pro` dans `notifications` — la
  boucle du flux les couvre déjà).
  **Geste** : relancer creer_site_rh.py (liste « Invitations salariés »
  + 2 colonnes entretien sur « Salariés »).
- **Habilitations & CACES + Avenants au contrat** (23/08) :
  habilitations déclarées par le client (tuile dédiée ou fiche du
  salarié → Habilitations : type, numéro, organisme, obtention, fin de
  validité) — l'historique se conserve, un recyclage se déclare comme
  une nouvelle ligne du même type et éteint l'ancienne ; alertes de
  recyclage J-90/J-60/J-30 puis EXPIRÉE (tableau `notifications`,
  type `habilitation`) ; section « Habilitations à recycler » sur la
  page Échéances. Avenants : demande depuis la tuile « Avenant au
  contrat » ou la fiche (objet parmi 9 types, date d'effet, description),
  écrite dans la liste « Avenants » — le gestionnaire produit et fait
  signer (statuts Nouvelle/En cours/Traitée).
  **Geste** : relancer creer_site_rh.py (2 nouvelles listes) — la boucle
  `notifications` du flux couvre déjà les habilitations sans rien changer.
- **Périodes d'essai + visites médicales** (23/08) : fin de période
  d'essai saisie à l'embauche (champ facultatif) ou dans l'onglet
  Dossier ; alertes e-mail J-15 puis J-7 avant le terme (décision à
  prendre avant, délai de prévenance rappelé à J-7) ; suivi des visites
  médicales périodiques (périodicité par fiche, 60 mois par défaut,
  48 en suivi renforcé, nouvel entrant = 3 mois après l'embauche) avec
  alertes J-60, J-30 puis RETARD ; deux sections dédiées sur la page
  Échéances (client et démo). Les visites « Réalisées » déclarées dans
  le portail repoussent automatiquement l'échéance.

## Geste Cloud Shell mémorisé (Laurent le redemande régulièrement)
Récupérer la DERNIÈRE version du script puis le lancer — les IDs sont
non secrets, seul GRAPH_CLIENT_SECRET est saisi à l'invite (masqué) :
```bash
gh api repos/laurentgohebel-blip/OSMOSERH2026/contents/src/scripts/creer_site_rh.py \
  -H "Accept: application/vnd.github.raw" > creer_site_rh.py
export GRAPH_TENANT_ID='5dc184d2-699a-4051-9f46-d040bc141669'
export GRAPH_CLIENT_ID='be0f7e69-1192-4582-a3f7-984fae4ff145'
export RH_SITE_ID='osmoserh83.sharepoint.com,ac8bcc33-521f-4d94-bb53-fac93010637b,e2c157a4-925f-4f6b-abf5-e07d69a07ab0'
python3 creer_site_rh.py
```
(Si `gh` n'est plus connecté — Cloud Shell éphémère :
`gh auth login -h github.com -p https -w` d'abord.)

## Mise en service en attente (gestes Laurent — 10 min au calme)
- [ ] RE-relancer `creer_site_rh.py` (lot pré-embauche, 23/08 nuit) :
      6 colonnes contrat sur « Invitations salariés » (TypeContrat,
      DateDebut, DateFin, Poste, DureeMensuelle, FinPeriodeEssai).
      Sans ce passage, le parcours « Je fais saisir le salarié »
      échouera à la création du lien.
- [x] RE-relancer `creer_site_rh.py` — FAIT le 23/08 soir : liste
      « Invitations salariés » + colonnes entretien pro créées.
      ⚠ Au passage, le GRAPH_CLIENT_SECRET a été exposé dans le
      terminal → ROTATION faite le soir même (nouveau secret créé).
      À VÉRIFIER : ancien secret supprimé dans Entra ID + variable
      GRAPH_CLIENT_SECRET de la SWA mise à jour avec le nouveau.
- [x] RE-relancer `creer_site_rh.py` — FAIT le 23/08 après-midi :
      listes « Habilitations » et « Avenants » créées.
- [x] Relancer `creer_site_rh.py` — FAIT le 23/08 matin (Cloud Shell) :
      les 5 colonnes essai/visites ajoutées sur « Salariés ».
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
   **+ Brique autonome « Salariés étrangers »** (22/08, option de
   contrat `etrangers` — voir docs/Salaries-etrangers.md) : page client
   dédiée (états Valide / À renouveler / En renouvellement via
   récépissé / EXPIRÉ-interdiction, déclaration des récépissés et
   nouveaux titres avec copies en GED), relances e-mail multi-paliers
   J-90→J-60→J-30→EXPIRÉ suspendues par récépissé, vue gestionnaire
   tous clients (dossier inspection, droit au travail qualifié,
   autorisations, taxe OFII), section titres sur la page Échéances.
   **Gestes Laurent** : relancer creer_site_rh.py ;
   cocher l'option « Salariés étrangers » sur les clients concernés ;
   flux « Alertes échéances » : UNE SEULE 2e boucle « Pour chaque »
   sur `notifications` (À = `email`, Objet = `objet`, Corps = `corps`)
   — ce tableau unifié couvre titres de séjour, périodes d'essai et
   visites médicales (l'ancienne consigne `alertesTitres` est
   remplacée ; ce champ n'existe plus dans la réponse).
2. _(jamais transmis — « On y reviendra »)_

## Idées gardées, volontairement NON développées
- **Registre unique du personnel généré par le portail** (23/08) :
  idée conservée mais mise de côté — le logiciel de paie (Cegid) tient
  déjà le registre. Arguments pour y revenir un jour : autonomie du
  client en cas de contrôle inattendu, mentions titres de séjour tenues
  à jour par la brique étrangers, argument commercial. À réévaluer si
  un client ou l'inspection le réclame. (Un prototype front avait été
  écrit puis retiré — l'essentiel est trivial à refaire : les données
  sont déjà toutes dans /api/personnel.)

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
