# Registre des activités de traitement (RGPD, art. 30)

**Document interne** — pré-rempli le 21/08/2026 depuis l'architecture
réelle du portail ; **à valider et dater par le dirigeant**, à revoir au
moins une fois par an et à chaque évolution du service. Cohérent avec la
politique publiée (`public/mentions-legales.html`).

**Organisme** : Synapse RH, SAS — RCS 449 648 377, APE 8121Z,
326 Chemin de Plaisance, 83200 Toulon — exerçant sous la marque
**Osmose RH**. Représentant : Laurent Gohebel. DPO : non désigné
(non obligatoire à cette échelle — à réévaluer avec la croissance).

---

## Volet A — traitements en qualité de RESPONSABLE de traitement

### A1. Comptes de l'espace client
- **Finalité** : authentification et sécurité de l'espace client.
- **Personnes** : utilisateurs des entreprises clientes (dirigeants, RH).
- **Données** : nom, e-mail professionnel, mot de passe (haché par
  Microsoft Entra External ID — jamais détenu par Synapse RH),
  journaux de connexion.
- **Base légale** : exécution du contrat.
- **Durée** : durée du contrat + 3 mois.
- **Destinataires** : gestionnaires habilités (liste `ADMIN_EMAILS`).
- **Sous-traitant** : Microsoft (Entra External ID, Azure — UE).

### A2. Demandes d'accès au portail
- **Finalité** : instruction des demandes d'ouverture d'espace.
- **Données** : e-mail, nom, entreprise, téléphone, message.
- **Base légale** : mesures précontractuelles.
- **Durée** : 12 mois.

### A3. Prospects (formulaires du site vitrine — liste « Leads site »)
- **Finalité** : réponse aux demandes et prospection commerciale B2B.
- **Données** : identité professionnelle, e-mail, entreprise, effectif,
  message. Pot de miel anti-robots (aucune donnée réelle).
- **Base légale** : intérêt légitime (sollicitation B2B) / démarche
  volontaire du prospect.
- **Durée** : 3 ans après le dernier contact.

### A4. Gestion des clients et facturation
- **Finalité** : gestion contractuelle, comptable et fiscale.
- **Données** : identité des contacts, coordonnées, SIRET, facturation.
- **Base légale** : contrat + obligations légales.
- **Durée** : documents comptables 10 ans.

## Volet B — traitements en qualité de SOUS-TRAITANT (art. 30-2)

### B1. Gestion administrative RH et paie pour le compte des clients
- **Responsables de traitement** : chaque entreprise cliente
  (employeur) — liste tenue dans « Paramètres clients ».
- **Catégories de personnes** : salariés des entreprises clientes.
- **Catégories de données** : identité (dont noms de naissance et
  marital, sexe, situation familiale), date, lieu, département et pays
  de naissance, nationalité, **NIR**, adresse, coordonnées, contrat et
  rémunération, **coordonnées bancaires (IBAN/BIC)**, choix de
  dématérialisation du bulletin, variables de paie, absences (motif de
  la nomenclature DSN, sans détail médical — les justificatifs médicaux
  transitent en documents), documents RH générés.
- **Opérations** : collecte via le portail, écriture dans les listes
  SharePoint du client, production de documents (contrats,
  attestations), notifications, restitution dans l'espace du client.
- **Transferts hors UE** : aucun (Azure Europe de l'Ouest, M365 UE).
- **Durées** : sur instruction du responsable ; par défaut, celles de la
  politique publiée (paie 5 ans, contractuel emploi + 5 ans).
- **Sous-traitants ultérieurs** : Microsoft (hébergement et services) —
  autorisation générale à prévoir dans l'annexe contractuelle.

## Mesures de sécurité communes (réellement en place)

- Authentification individuelle (Entra External ID), mot de passe géré
  par Microsoft, vérification par code e-mail.
- **Verrou serveur systématique** : jeton validé à chaque requête,
  identité résolue par les listes de rattachement — jamais par les
  déclarations du navigateur ; **cloisonnement par CodeClient** sur
  chaque lecture et écriture.
- Chiffrement TLS de bout en bout ; hébergement Union européenne.
- Accès gestionnaire restreint (liste `ADMIN_EMAILS`) ; compte de
  service dédié aux automatismes (moindre privilège).
- Secrets en variables d'application (jamais dans le code) ; rotation
  en cas d'exposition (appliquée le 21/08).
- Traçabilité : références horodatées de chaque démarche, historiques
  d'exécution des flux, versionnage SharePoint.

## Violations de données (procédure)

1. Détecter et qualifier (nature, personnes, volumes, risque).
2. **En qualité de sous-traitant : notifier le client concerné sans
   délai indu.** En qualité de responsable : notifier la CNIL sous
   **72 h** si risque pour les personnes, informer les personnes si
   risque élevé.
3. Consigner dans un registre des violations (même minime) ; corriger,
   tirer les leçons.

## Actions à mener (checklist dirigeant)

- [ ] **Annexe RGPD (art. 28) dans les contrats clients** — le document
      qui manque au rôle de sous-traitant : objet et durée du
      traitement, instructions, confidentialité, sous-traitance
      ultérieure (Microsoft), assistance, sort des données en fin de
      contrat, audits. **Prioritaire avant les premiers clients réels.**
- [ ] Valider (ou ajuster) les durées de conservation ci-dessus.
- [ ] Sensibilisation à la confidentialité de toute personne habilitée
      (engagement écrit pour les futurs collaborateurs).
- [ ] AIPD : à évaluer avec les clients selon volumes (NIR + données
      RH à grande échelle) — l'analyse incombe au responsable, Osmose
      assiste.
- [ ] Revue annuelle de ce registre (date de prochaine revue : …).
