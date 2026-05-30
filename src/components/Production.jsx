// src/components/Production.jsx
import React, { useState } from "react";

const styles = `
.prod-page{min-height:100vh;background:#f7fafc;color:#1a202c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif}
.prod-header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
.prod-header-inner{max-width:1400px;margin:0 auto;height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
.prod-brand{display:flex;align-items:center;gap:14px;cursor:pointer}
.prod-logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#8ea0ff,#7b61ff);box-shadow:0 8px 20px rgba(0,0,0,.15)}
.prod-title{font-size:20px;font-weight:800}
.prod-user{display:flex;align-items:center;gap:12px}
.prod-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;border:2px solid rgba(255,255,255,.35);font-size:14px}
.prod-name{font-size:14px;font-weight:700}.prod-tenant{font-size:12px;opacity:.9}
.prod-logout{margin-left:12px;padding:8px 12px;font-size:13px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;cursor:pointer}
.prod-logout:hover{background:rgba(255,255,255,.12)}
.prod-main{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.prod-sidebar{width:260px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px;height:fit-content;box-shadow:0 20px 60px rgba(0,0,0,.08);flex-shrink:0}
.prod-nav-title{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#4a5568;margin:6px 8px 10px}
.nav-btn{display:flex;align-items:center;gap:10px;padding:12px;font-size:14px;color:#4a5568;border-radius:10px;margin-bottom:4px;transition:.15s;cursor:pointer;border:none;background:transparent;width:100%;text-align:left}
.nav-btn:hover{background:#f3f5fa;color:#1a202c}
.nav-btn.active{background:#edf2f7;color:#2d3748;font-weight:700}
.prod-content{flex:1;display:flex;flex-direction:column;gap:28px;min-width:0}
.prod-top{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.08)}
.prod-top h2{font-size:22px;font-weight:800;margin-bottom:4px}
.prod-top p{color:#4a5568;font-size:14px}
.section-block{display:flex;flex-direction:column;gap:14px}
.section-label{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.6px}
.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.form-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:12px;cursor:pointer;transition:.15s}
.form-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.12)}
.fc-icon{font-size:32px;line-height:1}
.fc-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:999px}
.fc-top{display:flex;align-items:flex-start;justify-content:space-between}
.fc-title{font-size:15px;font-weight:800;color:#1a202c}
.fc-desc{font-size:12px;color:#4a5568;line-height:1.5}
.fc-btn{margin-top:auto;padding:9px 14px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;color:#fff;transition:.15s}
.fc-btn:hover{filter:brightness(1.1)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#fff;border-radius:16px;width:100%;max-width:580px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.25);overflow:hidden}
.modal-head{padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between}
.modal-head h3{font-size:17px;font-weight:800;display:flex;align-items:center;gap:10px}
.modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:#4a5568;padding:4px;border-radius:6px}
.modal-close:hover{background:#f3f5fa}
.modal-body{padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.modal-foot{padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:13px;font-weight:700;color:#2d3748}
.req{color:#e53e3e}
.field input,.field select,.field textarea{padding:10px 12px;border:1px solid #cbd5e0;border-radius:8px;font-size:14px;color:#1a202c;outline:none;transition:.15s;font-family:inherit;background:#fff}
.field input:focus,.field select:focus,.field textarea:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12)}
.field textarea{resize:vertical;min-height:80px}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field-sep{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#a0aec0;padding:4px 0;border-bottom:1px solid #e2e8f0;margin-top:4px}
.planning-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end}
.planning-row .field label{font-size:11px}
.btn{padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;border:none;transition:.15s}
.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;box-shadow:0 4px 12px rgba(102,126,234,.3)}
.btn-primary:hover{filter:brightness(1.07)}
.btn-ghost{background:#fff;color:#4a5568;border:1px solid #e2e8f0}
.btn-ghost:hover{background:#f7fafc}
.toast{position:fixed;bottom:28px;right:28px;z-index:2000;background:#276749;color:#fff;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);animation:slideUp .25s ease}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
@media(max-width:1000px){.form-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.form-grid{grid-template-columns:1fr}.prod-main{flex-direction:column}.prod-sidebar{width:100%}.field-row{grid-template-columns:1fr}.planning-row{grid-template-columns:1fr}}
`;

// ── Navigation ────────────────────────────────────────────────────────────────
const NAV = [
  { r:"dashboard",  icon:"📊", label:"Tableau de bord" },
  { r:"conges",     icon:"🏖️", label:"Congés" },
  { r:"production", icon:"⚡", label:"Production" },
  { r:"documents",  icon:"📄", label:"Documents" },
  { r:"formations", icon:"🎓", label:"Formations" },
  { r:"equipe",     icon:"👥", label:"Équipe" },
  { r:"paie",       icon:"💰", label:"Fiches de paie" },
  { r:"support",    icon:"🛟", label:"Support" },
  { r:"parametres", icon:"⚙️", label:"Paramètres" },
  { r:"admin",      icon:"🛠️", label:"Admin RH" },
];

// ── Sections & formulaires ────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "onboarding",
    label: "🚀 Onboarding",
    color: "#3182ce",
    bg: "rgba(49,130,206,.07)",
    forms: [
      {
        id: "contrat",
        icon: "📄",
        color: "#3182ce",
        label: "Génération de contrat",
        desc: "CDI, CDD, alternance — contrat de travail complet prêt à signer.",
        fields: [
          { sep: "Informations salarié" },
          { key:"nomSalarie",    label:"Nom & Prénom",       type:"text",   required:true },
          { key:"dateNaissance", label:"Date de naissance",  type:"date" },
          { key:"adresse",       label:"Adresse complète",   type:"textarea", rows:2 },
          { key:"nationalite",   label:"Nationalité",        type:"text" },
          { sep: "Poste & contrat" },
          { key:"typeContrat",   label:"Type de contrat",    type:"select", options:["CDI","CDD","Alternance","Stage","Freelance"] },
          { key:"intitulePoste", label:"Intitulé du poste",  type:"text",   required:true },
          { key:"departement",   label:"Département",        type:"text" },
          { key:"dateDebut",     label:"Date de début",      type:"date",   required:true },
          { key:"dateFin",       label:"Date de fin (si CDD)", type:"date" },
          { sep: "Rémunération" },
          { key:"salaireBrut",   label:"Salaire brut mensuel (€)", type:"number", required:true },
          { key:"tempsTravail",  label:"Temps de travail",   type:"select", options:["Temps plein (35h)","Temps partiel 80%","Temps partiel 50%","Forfait jours"] },
          { key:"avantages",     label:"Avantages (mutuelle, tickets…)", type:"textarea", rows:2 },
          { sep: "Entreprise" },
          { key:"societe",       label:"Raison sociale",     type:"text",   required:true },
          { key:"siret",         label:"SIRET",              type:"text" },
          { key:"signataire",    label:"Signataire (nom)",   type:"text",   required:true },
          { key:"lieuSignature", label:"Lieu de signature",  type:"text" },
        ],
      },
      {
        id: "dpae",
        icon: "🏛️",
        color: "#0891b2",
        label: "DPAE",
        desc: "Déclaration Préalable à l'Embauche à transmettre à l'URSSAF.",
        fields: [
          { sep: "Employeur" },
          { key:"raisonSociale", label:"Raison sociale",        type:"text", required:true },
          { key:"siret",         label:"N° SIRET établissement",type:"text", required:true },
          { key:"apeNaf",        label:"Code APE / NAF",        type:"text" },
          { key:"adresseEtab",   label:"Adresse établissement", type:"textarea", rows:2 },
          { sep: "Salarié" },
          { key:"nomSalarie",    label:"Nom de naissance",      type:"text", required:true },
          { key:"prenomSalarie", label:"Prénom",                type:"text", required:true },
          { key:"dateNaissance", label:"Date de naissance",     type:"date", required:true },
          { key:"lieuNaissance", label:"Commune de naissance",  type:"text" },
          { key:"deptNaissance", label:"Département de naissance", type:"text" },
          { key:"nir",           label:"N° Sécurité sociale",   type:"text" },
          { sep: "Embauche" },
          { key:"dateEmbauche",  label:"Date d'embauche",       type:"date", required:true },
          { key:"heureEmbauche", label:"Heure d'embauche",      type:"time" },
          { key:"typeContrat",   label:"Type de contrat",       type:"select", options:["CDI","CDD","Apprentissage","Contrat pro","Intérim","Stage"] },
          { key:"dureeContrat",  label:"Durée (si CDD)",        type:"text" },
          { key:"caisseRetraite",label:"Caisse de retraite",    type:"text" },
          { key:"medTravail",    label:"Service de santé au travail", type:"text" },
        ],
      },
      {
        id: "planning",
        icon: "📅",
        color: "#7c3aed",
        label: "Génération planning",
        desc: "Planning de travail hebdomadaire ou mensuel personnalisé.",
        fields: [
          { sep: "Informations générales" },
          { key:"nomSalarie",  label:"Nom & Prénom",        type:"text", required:true },
          { key:"poste",       label:"Poste",               type:"text" },
          { key:"periode",     label:"Période (ex: Mars 2026)", type:"text", required:true },
          { key:"typeContrat", label:"Type de contrat",     type:"select", options:["CDI","CDD","Alternance","Stage"] },
          { key:"heuresSem",   label:"Heures / semaine",    type:"number" },
          { sep: "Rythme de travail" },
          { key:"lundi",    label:"Lundi",    type:"text", placeholder:"ex: 9h–12h / 14h–18h" },
          { key:"mardi",    label:"Mardi",    type:"text", placeholder:"ex: 9h–12h / 14h–18h" },
          { key:"mercredi", label:"Mercredi", type:"text", placeholder:"ex: 9h–12h / 14h–18h" },
          { key:"jeudi",    label:"Jeudi",    type:"text", placeholder:"ex: 9h–12h / 14h–18h" },
          { key:"vendredi", label:"Vendredi", type:"text", placeholder:"ex: 9h–12h / 14h–18h" },
          { key:"samedi",   label:"Samedi",   type:"text", placeholder:"ex: Repos" },
          { key:"dimanche", label:"Dimanche", type:"text", placeholder:"ex: Repos" },
          { sep: "Informations complémentaires" },
          { key:"lieuTravail",  label:"Lieu de travail",       type:"text" },
          { key:"responsable",  label:"Responsable / manager", type:"text" },
          { key:"commentaires", label:"Commentaires / notes",  type:"textarea", rows:2 },
        ],
      },
    ],
  },
  {
    id: "rh",
    label: "📋 Documents RH",
    color: "#667eea",
    bg: "rgba(102,126,234,.07)",
    forms: [
      {
        id: "attestation", icon:"📋", color:"#667eea",
        label:"Attestation de travail",
        desc:"Attestation de présence et d'emploi certifiée RH.",
        fields:[
          { key:"nom",     label:"Nom & Prénom",    type:"text",   required:true },
          { key:"poste",   label:"Poste occupé",    type:"text",   required:true },
          { key:"contrat", label:"Type de contrat", type:"select", options:["CDI","CDD","Alternance","Stage"] },
          { key:"entree",  label:"Date d'entrée",   type:"date" },
          { key:"societe", label:"Société",         type:"text",   required:true },
        ],
      },
      {
        id: "notefrais", icon:"🧾", color:"#10b981",
        label:"Note de frais",
        desc:"Remboursement de frais professionnels.",
        fields:[
          { key:"nom",   label:"Nom & Prénom",         type:"text", required:true },
          { key:"motif", label:"Motif du déplacement", type:"text", required:true },
          { key:"debut", label:"Période — début",      type:"date" },
          { key:"fin",   label:"Période — fin",        type:"date" },
          { key:"total", label:"Montant total (€)",    type:"number" },
        ],
      },
      {
        id: "avenant", icon:"✍️", color:"#ed8936",
        label:"Avenant contrat",
        desc:"Modifications apportées au contrat en vigueur.",
        fields:[
          { key:"nom",       label:"Nom & Prénom",             type:"text",     required:true },
          { key:"societe",   label:"Société",                  type:"text",     required:true },
          { key:"dateeffet", label:"Date d'effet",             type:"date",     required:true },
          { key:"detail",    label:"Détail des modifications", type:"textarea" },
        ],
      },
    ],
  },
  {
    id: "paie",
    label: "💰 Paie",
    color: "#0d9488",
    bg: "rgba(13,148,136,.07)",
    forms: [
      {
        id: "acompte", icon:"💵", color:"#0d9488",
        label:"Demande d'acompte",
        desc:"Versement anticipé d'une partie du salaire du mois en cours.",
        fields:[
          { sep:"Informations salarié" },
          { key:"nom",          label:"Nom & Prénom",          type:"text",   required:true },
          { key:"matricule",    label:"Matricule / N° salarié",type:"text" },
          { key:"service",      label:"Service / Département", type:"text" },
          { sep:"Demande" },
          { key:"montant",      label:"Montant demandé (€)",   type:"number", required:true },
          { key:"moisConcerne", label:"Mois concerné",         type:"text",   placeholder:"ex: Mars 2026", required:true },
          { key:"dateVersement",label:"Date de versement souhaitée", type:"date" },
          { key:"motif",        label:"Motif de la demande",   type:"textarea" },
          { sep:"Modalités" },
          { key:"rib",          label:"RIB / IBAN (si différent)", type:"text" },
          { key:"remboursement",label:"Mode de remboursement", type:"select", options:["Retenue sur salaire du mois","Retenue en 2 fois","Autre"] },
        ],
      },
      {
        id: "avance", icon:"💳", color:"#0891b2",
        label:"Avance sur salaire",
        desc:"Avance remboursable sur les salaires des mois suivants.",
        fields:[
          { sep:"Informations salarié" },
          { key:"nom",       label:"Nom & Prénom",           type:"text",   required:true },
          { key:"matricule", label:"Matricule / N° salarié", type:"text" },
          { key:"service",   label:"Service / Département",  type:"text" },
          { sep:"Demande" },
          { key:"montant",   label:"Montant de l'avance (€)",type:"number", required:true },
          { key:"motif",     label:"Motif de la demande",    type:"textarea", required:true },
          { key:"dateDebut", label:"Date souhaitée",         type:"date" },
          { sep:"Remboursement" },
          { key:"nbMensualites",  label:"Nombre de mensualités", type:"select", options:["1 mois","2 mois","3 mois","4 mois","6 mois","Autre"] },
          { key:"montantMensuel", label:"Montant mensuel retenu (€)", type:"number" },
          { key:"debutRemb",      label:"Début du remboursement",     type:"date" },
          { key:"commentaires",   label:"Commentaires",               type:"textarea" },
        ],
      },
      {
        id: "regul", icon:"🔄", color:"#7c3aed",
        label:"Régularisation de salaire",
        desc:"Correction d'une erreur ou omission sur un bulletin de paie.",
        fields:[
          { sep:"Informations salarié" },
          { key:"nom",       label:"Nom & Prénom",           type:"text", required:true },
          { key:"matricule", label:"Matricule / N° salarié", type:"text" },
          { key:"service",   label:"Service",                type:"text" },
          { sep:"Régularisation" },
          { key:"moisConcerne",  label:"Mois concerné",             type:"text", placeholder:"ex: Février 2026", required:true },
          { key:"typeRegul",     label:"Type de régularisation",    type:"select", options:["Heures supplémentaires","Prime oubliée","Absence non déduite","Trop-perçu","Frais non remboursés","Autre"] },
          { key:"montant",       label:"Montant à régulariser (€)", type:"number", required:true },
          { key:"sensRegul",     label:"Sens de la régularisation", type:"select", options:["À verser au salarié","À récupérer par l'employeur"] },
          { key:"description",   label:"Description détaillée",     type:"textarea", required:true },
          { sep:"Pièces justificatives" },
          { key:"justificatifs", label:"Documents joints (description)", type:"textarea", placeholder:"Listez les justificatifs attachés à cette demande" },
          { key:"validePar",     label:"Validé par (manager)",           type:"text" },
        ],
      },
      {
        id: "saisie", icon:"⚖️", color:"#dc2626",
        label:"Saisie sur salaire",
        desc:"Traitement d'une saisie administrative ou judiciaire sur salaire.",
        fields:[
          { sep:"Informations salarié" },
          { key:"nom",       label:"Nom & Prénom",           type:"text", required:true },
          { key:"matricule", label:"Matricule / N° salarié", type:"text" },
          { key:"adresse",   label:"Adresse du salarié",     type:"textarea", rows:2 },
          { sep:"Saisie" },
          { key:"typeSaisie",    label:"Type de saisie",            type:"select", options:["Saisie-arrêt (judiciaire)","Cession volontaire","Saisie administrative à tiers détenteur","Pension alimentaire"] },
          { key:"organisme",     label:"Organisme créancier",       type:"text",   required:true },
          { key:"refDossier",    label:"Référence dossier / acte",  type:"text",   required:true },
          { key:"dateNotif",     label:"Date de notification",      type:"date",   required:true },
          { key:"montantMensuel",label:"Montant mensuel à retenir (€)", type:"number", required:true },
          { key:"dateFin",       label:"Date de fin (si connue)",   type:"date" },
          { sep:"Coordonnées de versement" },
          { key:"ibanCreancier", label:"IBAN du créancier",         type:"text" },
          { key:"refVirement",   label:"Référence à indiquer",      type:"text" },
          { key:"commentaires",  label:"Commentaires",              type:"textarea" },
        ],
      },
    ],
  },
  {
    id: "securite",
    label: "🦺 Sécurité",
    color: "#d97706",
    bg: "rgba(217,119,6,.07)",
    forms: [
      {
        id: "accueil_secu", icon:"🦺", color:"#d97706",
        label:"Demande accueil sécurité",
        desc:"Planification de l'accueil sécurité pour un nouveau collaborateur ou intervenant.",
        fields:[
          { sep:"Personne concernée" },
          { key:"nom",        label:"Nom & Prénom",            type:"text",   required:true },
          { key:"typePersonne",label:"Type de personne",       type:"select", options:["Nouveau salarié","Intérimaire","Prestataire","Stagiaire","Visiteur"] },
          { key:"societe",    label:"Société / organisme",     type:"text" },
          { key:"poste",      label:"Poste / mission",         type:"text",   required:true },
          { sep:"Accueil" },
          { key:"dateAccueil",   label:"Date d'accueil souhaitée", type:"date",   required:true },
          { key:"lieuTravail",   label:"Site / lieu de travail",   type:"text",   required:true },
          { key:"responsable",   label:"Responsable d'accueil",    type:"text",   required:true },
          { key:"dureePresence", label:"Durée de présence prévue", type:"text",   placeholder:"ex: 3 mois, 1 semaine…" },
          { sep:"Modules sécurité requis" },
          { key:"moduleGeneral", label:"Accueil sécurité général",   type:"select", options:["Oui","Non"] },
          { key:"moduleIncendie",label:"Consignes incendie / évacuation", type:"select", options:["Oui","Non"] },
          { key:"moduleChimique",label:"Risques chimiques",           type:"select", options:["Oui","Non","N/A"] },
          { key:"moduleEPI",     label:"Port des EPI obligatoires",   type:"select", options:["Oui","Non"] },
          { key:"zones",         label:"Zones accessibles",           type:"textarea", placeholder:"Décrivez les zones autorisées…" },
          { key:"commentaires",  label:"Commentaires",                type:"textarea" },
        ],
      },
      {
        id: "autorisation_emp", icon:"📜", color:"#b45309",
        label:"Autorisation employeur",
        desc:"Autorisation délivrée par l'employeur pour une activité, sortie ou intervention spécifique.",
        fields:[
          { sep:"Salarié" },
          { key:"nom",       label:"Nom & Prénom",           type:"text", required:true },
          { key:"matricule", label:"Matricule / N° salarié", type:"text" },
          { key:"poste",     label:"Poste occupé",           type:"text", required:true },
          { sep:"Autorisation" },
          { key:"typeAutorisation", label:"Type d'autorisation", type:"select", options:["Travail en hauteur","Travail isolé","Conduite engin / chariot","Habilitation électrique","Travaux par points chauds","Accès zone restreinte","Sortie matériel entreprise","Autre"] },
          { key:"description",    label:"Description de l'activité autorisée", type:"textarea", required:true },
          { key:"dateDebut",      label:"Date de début de validité",           type:"date",     required:true },
          { key:"dateFin",        label:"Date de fin de validité",             type:"date",     required:true },
          { key:"lieu",           label:"Lieu / périmètre concerné",           type:"text" },
          { sep:"Conditions" },
          { key:"conditions",     label:"Conditions et restrictions",          type:"textarea", placeholder:"EPI requis, supervision, horaires autorisés…" },
          { key:"formationRequise",label:"Formation préalable requise",        type:"select",   options:["Oui — déjà réalisée","Oui — à planifier","Non requise"] },
          { key:"signataire",     label:"Signataire employeur",                type:"text",     required:true },
        ],
      },
    ],
  },
  {
    id: "formation",
    label: "🎓 Formation",
    color: "#4f46e5",
    bg: "rgba(79,70,229,.07)",
    forms: [
      {
        id: "demande_formation", icon:"🎓", color:"#4f46e5",
        label:"Demande de formation",
        desc:"Soumission d'une demande de formation professionnelle ou CPF.",
        fields:[
          { sep:"Informations salarié" },
          { key:"nom",       label:"Nom & Prénom",           type:"text", required:true },
          { key:"matricule", label:"Matricule / N° salarié", type:"text" },
          { key:"poste",     label:"Poste actuel",           type:"text", required:true },
          { key:"service",   label:"Service / Département",  type:"text" },
          { key:"manager",   label:"Manager",                type:"text" },
          { sep:"Formation demandée" },
          { key:"intitule",   label:"Intitulé de la formation",      type:"text",   required:true },
          { key:"organisme",  label:"Organisme de formation",        type:"text" },
          { key:"type",       label:"Type de formation",             type:"select", options:["Présentiel","Distanciel / E-learning","Mixte","Conférence / Séminaire"] },
          { key:"financement",label:"Mode de financement",           type:"select", options:["Plan de développement des compétences","CPF","CPF de transition","OPCO","Financement personnel","Autre"] },
          { key:"duree",      label:"Durée estimée",                 type:"text",   placeholder:"ex: 2 jours, 14h" },
          { key:"dateDebut",  label:"Date souhaitée — début",        type:"date" },
          { key:"dateFin",    label:"Date souhaitée — fin",          type:"date" },
          { key:"cout",       label:"Coût estimé (€)",               type:"number" },
          { sep:"Justification" },
          { key:"objectifs",  label:"Objectifs professionnels visés",type:"textarea", required:true, placeholder:"En quoi cette formation est-elle utile à votre poste ?" },
          { key:"lienPoste",  label:"Lien avec le poste actuel",     type:"select",  options:["Directement lié","Évolution de poste","Développement personnel","Obligation réglementaire"] },
          { key:"urgence",    label:"Niveau d'urgence",              type:"select",  options:["Normal","Urgent","Obligation légale"] },
          { key:"commentaires",label:"Commentaires complémentaires", type:"textarea" },
        ],
      },
    ],
  },
  {
    id: "divers",
    label: "📝 Autres documents",
    color: "#e53e3e",
    bg: "rgba(229,62,62,.07)",
    forms: [
      {
        id: "crh", icon:"📝", color:"#e53e3e",
        label:"Compte-rendu RH",
        desc:"Formalisation d'un entretien RH.",
        fields:[
          { key:"collab", label:"Collaborateur",    type:"text",   required:true },
          { key:"rh",     label:"RH référent",      type:"text",   required:true },
          { key:"type",   label:"Type d'entretien", type:"select", options:["Annuel","Recadrage","Mobilité","Départ","Autre"] },
          { key:"date",   label:"Date",             type:"date",   required:true },
          { key:"points", label:"Points abordés",   type:"textarea", required:true },
        ],
      },
      {
        id: "materiel", icon:"💻", color:"#805ad5",
        label:"Demande de matériel",
        desc:"Commande d'équipements informatiques.",
        fields:[
          { key:"nom",      label:"Nom & Prénom",     type:"text",     required:true },
          { key:"detail",   label:"Matériel demandé", type:"textarea", required:true },
          { key:"priorite", label:"Priorité",         type:"select",   options:["Normale","Urgente","Critique"] },
          { key:"justif",   label:"Justification",    type:"textarea" },
        ],
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name) {
  const p = (name||"").trim().split(/\s+/);
  return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"--";
}

// ── Modale formulaire ─────────────────────────────────────────────────────────
function Modal({ form, onClose }) {
  const [values, setValues] = useState(() => {
    const v = {};
    form.fields.forEach(f => {
      if (f.sep) return;
      v[f.key] = f.type === "select" ? (f.options?.[0] || "") : "";
    });
    return v;
  });
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setValues(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    for (const f of form.fields) {
      if (f.sep) continue;
      if (f.required && !values[f.key]) { alert(`Champ obligatoire : ${f.label}`); return; }
    }
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); onClose(); }, 1800);
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{form.icon} {form.label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {form.fields.map((f, i) => {
            if (f.sep) return <div key={i} className="field-sep">{f.sep}</div>;
            return (
              <div className="field" key={f.key}>
                <label>{f.label}{f.required && <span className="req"> *</span>}</label>
                {f.type === "textarea" ? (
                  <textarea rows={f.rows || 3} placeholder={f.placeholder || ""}
                    value={values[f.key]} onChange={e => set(f.key, e.target.value)} />
                ) : f.type === "select" ? (
                  <select value={values[f.key]} onChange={e => set(f.key, e.target.value)}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type || "text"} placeholder={f.placeholder || ""}
                    value={values[f.key]} onChange={e => set(f.key, e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSubmit}>✅ Valider</button>
        </div>
      </div>
      {submitted && <div className="toast">✅ Formulaire soumis avec succès !</div>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Production({ user, onNavigate, onLogout }) {
  const [activeForm, setActiveForm] = useState(null);

  const u = { displayName:"Jean Dupont", givenName:"Jean", tenantLabel:"Client", ...(user||{}) };
  const go = (r) => { if (typeof onNavigate === "function") onNavigate(r); else window.location.hash = r; };

  return (
    <div className="prod-page">
      <style>{styles}</style>

      {/* HEADER */}
      <header className="prod-header">
        <div className="prod-header-inner">
          <div className="prod-brand" onClick={() => go("dashboard")}>
            <div className="prod-logo"/>
            <span className="prod-title">Synapse — Espace Client</span>
          </div>
          <div className="prod-user">
            <div className="prod-avatar">{initials(u.displayName)}</div>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1.1}}>
              <span className="prod-name">{u.displayName}</span>
              <span className="prod-tenant">{u.tenantLabel}</span>
            </div>
            <button className="prod-logout" onClick={() => typeof onLogout==="function" && onLogout()}>Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="prod-main">
        {/* SIDEBAR */}
        <aside className="prod-sidebar">
          <div className="prod-nav-title">Navigation</div>
          <nav>
            {NAV.map(({ r, icon, label }) => (
              <button key={r} className={`nav-btn${r==="production"?" active":""}`} onClick={() => go(r)}>
                {icon} {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* CONTENU */}
        <main className="prod-content">
          <div className="prod-top">
            <h2>⚡ Production documentaire</h2>
            <p>Sélectionnez un formulaire pour créer un document. Les champs marqués <span style={{color:"#e53e3e"}}>*</span> sont obligatoires.</p>
          </div>

          {SECTIONS.map(section => (
            <div className="section-block" key={section.id}>
              <div className="section-label" style={{background:section.bg, color:section.color}}>
                {section.label}
              </div>
              <div className="form-grid">
                {section.forms.map(f => (
                  <div className="form-card" key={f.id} onClick={() => setActiveForm(f)}>
                    <div className="fc-top">
                      <span className="fc-icon">{f.icon}</span>
                      <span className="fc-badge" style={{background:f.color+"20", color:f.color}}>
                        Formulaire
                      </span>
                    </div>
                    <div className="fc-title">{f.label}</div>
                    <div className="fc-desc">{f.desc}</div>
                    <button className="fc-btn"
                      style={{background:`linear-gradient(135deg,${f.color},${f.color}cc)`}}
                      onClick={e => { e.stopPropagation(); setActiveForm(f); }}>
                      Ouvrir →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>

      {activeForm && <Modal form={activeForm} onClose={() => setActiveForm(null)} />}
    </div>
  );
}
