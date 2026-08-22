# Brique « Salariés étrangers » — option de contrat

**22/08/2026.** Module autonome de conformité pour l'emploi de
ressortissants hors UE/EEE/Suisse. Vendu en **option** (`etrangers`
dans les Options du client) — activable client par client depuis
l'écran d'activation, comme embauche/acompte/attestation/paie.

## Ce que couvre la brique

**Socle (inclus dans l'option embauche, déjà livré) :** à l'embauche,
titre de séjour obligatoire (type, numéro, expiration, copie en PJ,
refus si expiré avant la prise de poste) + authentification
préfectorale suivie par le gestionnaire (R.5221-41, mail type).

**Option « Salariés étrangers » (cette brique) :**

1. **Page client « Salariés étrangers »** (menu latéral) : tous ses
   salariés hors UE/EEE/Suisse avec l'état du droit au séjour,
   calculé — jamais saisi :
   - **Valide** ;
   - **À renouveler** (moins de 90 jours de droits — la demande se
     dépose entre 4 et 2 mois avant l'expiration) ;
   - **En renouvellement** : un récépissé en cours de validité
     PROLONGE les droits, même titre expiré ;
   - **EXPIRÉ — interdiction d'emploi** (bandeau rouge L.8251-1).
   Le client déclare lui-même : « Déclarer un récépissé » (n°, fin de
   validité, copie) dès le dépôt en préfecture, puis « Nouveau titre
   reçu » à la délivrance — les copies partent en GED (Dépôts), les
   relances s'arrêtent, le cycle repart.

2. **Relances e-mail multi-paliers** (flux hebdo « Alertes
   échéances ») : J-90 → J-60 → J-30 → EXPIRÉ, chaque palier une
   seule fois (`AlerteTitreSejour` = dernier palier envoyé), ton
   croissant jusqu'à l'interdiction d'emploi. Un récépissé valide
   suspend tout ; une déclaration réarme le cycle. Les titres expirés
   depuis plus de 180 jours jamais alertés ne sont pas réveillés
   (dossier gestionnaire). Destinataires : contacts du client +
   gestionnaire ; `alertesTitres` porte `email`/`objet`/`corps` prêts
   à envoyer (même branchement de flux que docs du 22/08).

3. **Vue gestionnaire « Salariés étrangers — suivi & dossier
   inspection »** (écran admin, chargée à la demande) : tous clients,
   compteurs (expirés / en renouvellement / à renouveler / valides),
   et par salarié :
   - **Droit au travail** : Plein / Limité (étudiant 964 h/an) /
     Autorisation de travail requise — suggéré d'après le type de
     titre (en italique tant que non qualifié), à confirmer d'après la
     mention exacte du titre ;
   - **Autorisation de travail** : Non requise / À déposer / Déposée /
     Accordée / Refusée (demande sur le téléservice de l'Intérieur) ;
   - noms des **copies** (titre + récépissé) conservées dans les
     Documents du client — le dossier à présenter en cas de contrôle
     de l'inspection du travail ;
   - rappel **taxe OFII** (première admission au travail d'un
     travailleur étranger → taxe employeur).

## Routes (doctrine du 21/08 — aucune nouvelle route)
- Client : `GET /api/me?vue=etrangers` ;
  `POST /api/demande { action:"titreRenouvellement", id, mode:
  "recepisse"|"nouveauTitre", … }` (verrous : option + propriété).
- Gestionnaire : `GET /api/me?vue=admin&onglet=etrangers` ;
  `POST /api/demande { action:"adminEtrangers", id, droitTravail?,
  autorisationTravail? }`.
- Tout vit dans `api/src/etrangers.js` (module paresseux, comme admin
  et messages). États : `etatTitre()` — source unique, réutilisée par
  les échéances.

## Mise en service
1. Relancer `creer_site_rh.py` (colonnes : TitreSejourPj,
   RecepisseNumero, RecepisseFin, RecepissePj, DroitTravail,
   AutorisationTravail sur « Salariés »).
2. Cocher l'option **« Salariés étrangers (titres de séjour) »** sur
   les clients concernés (SharePoint « Paramètres clients » → Options,
   ou à l'activation d'un nouveau client).
3. Flux « Alertes échéances » : la boucle `alertesTitres` déjà
   documentée sert telle quelle (les paliers changent le contenu, pas
   le contrat).

## Données (liste « Salariés »)
`Nationalite, TitreSejourType, TitreSejourNumero, TitreSejourExpiration,
TitreSejourPj, RecepisseNumero, RecepisseFin, RecepissePj, DroitTravail,
AutorisationTravail, AlerteTitreSejour` (palier + horodatage).
L'état n'est JAMAIS stocké : toujours recalculé.
