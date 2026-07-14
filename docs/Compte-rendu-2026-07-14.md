# Compte rendu — 14 juillet 2026

Portail Osmose RH — espace.synapserh.fr · 9 commits déployés (ce755c00 → 9f810e2e)

---

## 🛡️ Conformité & alertes

- **Mentions légales & RGPD** : page en ligne (`/mentions-legales.html`), liée depuis la connexion et le tableau de bord. Double rôle responsable de traitement / sous-traitant art. 28, finalités, durées de conservation, droits, cookies, sécurité. ⚠️ *À vérifier par Laurent : RCS 449 648 377, siège 326 Chemin de Plaisance 83200 Toulon, capital éventuel.*
- **Alertes fins de CDD** : flux hebdomadaire (lundi 8h) → e-mail à J-30 aux contacts du client + gestionnaire, marquage anti-doublon.
- **Page « Échéances »** dans le portail : compteurs 30/90 jours, badges d'urgence, statut de l'alerte e-mail, contrats terminés récemment, bouton vers Fin de contrat.
- **Alertes d'échec de flux** : tous les flux préviennent lgohebel@synapserh.fr en cas de panne.

## 👥 Bloc « Gestion administrative du personnel » — complet

- **3 nouvelles démarches** : Absences, Visite médicale, Mutuelle — listes SharePoint dédiées, formulaires, flux d'accusé de réception (client) + notification (gestionnaire), testés de bout en bout.
- **Fiche salarié** sur données réelles : tuile « Gestion du personnel » → effectif → fiche à onglets (Contrat, Absences, Visites, Mutuelle, Fin) avec compteurs et statuts ; chaque bouton de démarche ouvre le formulaire pré-rempli.
- **Référentiel « Salariés » + import client** : modèle Excel d'import (`/modeles/Modele_import_salaries.xlsx`, import réalisé par le cabinet à l'onboarding) ; l'API fusionne le stock importé et les embauches du pipeline. 3 salariés de démonstration importés chez TEST.
- **Formulaires branchés sur l'effectif** : liste déroulante des salariés dans Absence/Visite/Mutuelle (avec saisie libre en secours) ; sélecteur de pré-remplissage dans Fin de contrat (nom, prénom, matricule, type), Acompte (nom, prénom, matricule) et Attestation (nom, date d'entrée, poste, type).
- **Contraintes du formulaire Absence** : 15 motifs en liste fermée (nomenclature DSN) ; justificatif **obligatoire** pour les 9 motifs médicaux/AT/maternité — bloqué au formulaire ET refusé par l'API.

## 💬 Canaux

- **« Mon gestionnaire »** : tuile jamais optionnelle — objet + message → liste « Messages gestionnaire » (statuts Nouveau/Répondu/Clos), AR au client avec message cité, notification gestionnaire avec lien « Répondre au client » pré-rempli.
- **Demandes d'accès** : AR au demandeur + notification avec la procédure d'activation en 3 étapes — l'entonnoir d'onboarding n'est plus silencieux.

## 🎨 Portail

- **Production réorganisée par blocs** : « Vos salariés » (7 tuiles), « Votre paie » (2), « Vos échanges » (1), « Bientôt disponible » (Formation, Sécurité — grisées, non cliquables). Vérifié à 2560px et 1366px.

## 🚑 Incidents traités

1. **Listes fantômes** : la création SharePoint du matin avait entièrement échoué en silence (mauvais identifiants d'élévation, erreurs masquées) — les démarches renvoyaient une référence sans rien écrire. Tout recréé et fiabilisé : l'API vérifie désormais chaque écriture.
2. **Dates décalées d'un jour** : les colonnes date SharePoint stockent minuit heure de Paris (22h00 UTC la veille) ; l'affichage reculait tout d'un jour. Corrigé partout (helper `dateParis`).
3. **Déclencheur embauche muet** : la re-sauvegarde des flux avait figé un schéma exigeant des colonnes facultatives (Email, téléphone) → les embauches DAVO et BUSSY ont été « consommées » sans traitement, sans alerte possible. Cause corrigée (colonnes rendues facultatives + schéma régénéré), garde-fou posé sur les approbations (adresse hors organisation → repli gestionnaire), **les deux embauches rejouées intégralement** : contrats générés, approbations en attente.

## 📋 Actions Laurent

- [ ] Approuver les embauches DAVO et BUSSY : make.powerautomate.com → Approbations (ou Teams)
- [ ] Valider les informations des mentions légales (RCS, siège, capital)
- [ ] Test réel : une absence avec motif médical (le justificatif doit être exigé)

## 🔜 Prochaines étapes

1. **Chantier documents Power Automate** : démarche par démarche (embauche d'abord) — arbitrer champ par champ ce que fournit le client / le gestionnaire / la fiche client, pour éliminer les « [À compléter] » des contrats.
2. **Suite des contraintes de formulaires** (le patron motifs fermés + obligations conditionnelles + miroir API est posé).
3. **Récap hebdomadaire gestionnaire** (activité de la semaine + filet anti-panne silencieuse).
4. **Pack d'onboarding du client pilote** (août) : fiche client, utilisateurs, import des salariés, guide mis à jour.
5. **Octobre** : avenants, enrichissement du dossier salarié.

---
*Rédigé par Claude — session du 14/07/2026.*
