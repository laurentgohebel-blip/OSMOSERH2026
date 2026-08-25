// api/src/procedures.js — la brique Procédures.
//
// Quatre procédures, une même mécanique : une suite d'étapes ordonnées,
// chacune contrainte par des délais qui se comptent depuis une étape
// antérieure. On saisit la date réelle d'une étape, le portail recalcule
// la fenêtre de toutes les suivantes.
//
// CE QUE CE MODULE TIENT : la FORME. Les délais, l'ordre, les documents
// obligatoires, les pièges de calendrier. C'est là que les petites
// entreprises se font condamner — le motif était réel, mais la
// convocation est partie trop tard.
//
// CE QU'IL NE TIENT PAS, et qu'il doit dire : le FOND. La cause réelle
// et sérieuse, la proportionnalité d'une sanction, la loyauté de la
// recherche de reclassement ne se calculent pas. Et les conventions
// collectives allongent souvent les délais légaux, imposent parfois une
// commission paritaire ou un entretien assisté : le portail tient le
// SOCLE LÉGAL et le dit, il ne connaît pas encore la convention du
// client.
//
// Les courriers produits sont des TRAMES pré-remplies du dossier, à
// relire et à adapter. Un modèle envoyé sans être lu est un risque, pas
// un gain de temps.

const D = require("./delais");

/* ── Vocabulaire des contraintes ─────────────────────────────────────
   auPlusTot / auPlusTard : { depuis: <clé d'étape>, jours|mois, type }
   `report: true` décale une échéance « au plus tôt » tombant un
   dimanche ou un férié au jour ouvrable suivant. */

const PROCEDURES = {
  /* ─────────────────────────────────────────────────────────────────
     LICENCIEMENT POUR MOTIF PERSONNEL
     Le socle : L.1232-2 (cinq jours ouvrables entre la présentation de
     la convocation et l'entretien) et L.1232-6 (deux jours ouvrables au
     moins entre l'entretien et la notification). Le second est le plus
     souvent violé : on notifie le lendemain, « pour en finir ». */
  "licenciement-personnel": {
    libelle: "Licenciement pour motif personnel",
    resume: "Convocation, entretien préalable, notification, préavis.",
    etapes: [
      { cle: "convocation", libelle: "Envoi de la convocation à l'entretien préalable",
        document: "convocation-entretien", obligatoire: true,
        aide: "Lettre recommandée avec accusé de réception ou remise en main propre contre décharge. Elle doit indiquer l'objet, la date, l'heure, le lieu, et la faculté de se faire assister." },
      { cle: "presentation", libelle: "Présentation de la convocation au salarié",
        obligatoire: true,
        aide: "C'est cette date — la première présentation par La Poste, ou la remise en main propre — qui fait courir le délai, pas la date d'envoi." },
      { cle: "entretien", libelle: "Entretien préalable",
        auPlusTot: { depuis: "presentation", jours: 5, type: "ouvrables", report: true },
        obligatoire: true,
        aide: "Cinq jours ouvrables pleins après la présentation (L.1232-2). Le samedi est ouvrable ; le dimanche et les jours fériés ne le sont pas." },
      { cle: "notification", libelle: "Notification du licenciement",
        document: "notification-licenciement",
        auPlusTot: { depuis: "entretien", jours: 2, type: "ouvrables", report: true },
        obligatoire: true,
        aide: "Deux jours ouvrables au moins après l'entretien (L.1232-6), par lettre recommandée avec accusé de réception. La lettre fixe les limites du litige : le motif qu'elle énonce est le seul qui pourra être défendu." },
      { cle: "fin-preavis", libelle: "Fin du préavis",
        aide: "Le préavis court à compter de la première présentation de la lettre de notification. Sa durée dépend de l'ancienneté et de la convention collective." },
      { cle: "documents", libelle: "Remise des documents de fin de contrat",
        document: "documents-fin-contrat", obligatoire: true,
        aide: "Certificat de travail, attestation destinée à France Travail, solde de tout compte et son reçu. Le portail prépare la demande auprès de votre gestionnaire." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────
     SANCTION DISCIPLINAIRE
     Deux horloges qui tournent en sens inverse : deux mois pour ENGAGER
     depuis la connaissance des faits (L.1332-4), et un mois au plus
     pour NOTIFIER après l'entretien (L.1332-2). Dépasser l'une ou
     l'autre annule la sanction, quel que soit le comportement reproché. */
  "sanction-disciplinaire": {
    libelle: "Sanction disciplinaire",
    resume: "Des faits connus à la sanction notifiée, deux délais à ne pas manquer.",
    etapes: [
      { cle: "faits", libelle: "Connaissance des faits par l'employeur",
        obligatoire: true,
        aide: "Le point de départ de tout : l'employeur dispose de deux mois pour engager les poursuites disciplinaires (L.1332-4). Au-delà, les faits sont prescrits — même graves, même avérés." },
      { cle: "convocation", libelle: "Envoi de la convocation à l'entretien préalable",
        document: "convocation-entretien",
        auPlusTard: { depuis: "faits", mois: 2 },
        aide: "Obligatoire dès que la sanction envisagée a une incidence sur la présence, la fonction, la carrière ou la rémunération (L.1332-2). Un simple avertissement en est dispensé par la loi — mais la convention collective peut l'imposer." },
      { cle: "entretien", libelle: "Entretien préalable",
        auPlusTard: { depuis: "faits", mois: 2 },
        aide: "Aucun délai minimum légal entre convocation et entretien pour une sanction autre qu'un licenciement — mais un délai raisonnable s'impose, et la convention collective en fixe souvent un." },
      { cle: "notification", libelle: "Notification de la sanction",
        document: "notification-sanction",
        auPlusTot: { depuis: "entretien", jours: 2, type: "ouvrables", report: true },
        auPlusTard: { depuis: "entretien", mois: 1 },
        obligatoire: true,
        aide: "Entre deux jours ouvrables et un mois après l'entretien (L.1332-2). Passé le mois, la sanction ne peut plus être prononcée pour ces faits." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────
     INAPTITUDE
     Le piège le plus coûteux : passé UN MOIS depuis l'examen médical,
     l'employeur qui n'a ni reclassé ni licencié doit REPRENDRE LE
     VERSEMENT DU SALAIRE (L.1226-4 / L.1226-11), sans contrepartie de
     travail et sans limite dans le temps. Beaucoup de dirigeants
     l'ignorent et temporisent — c'est précisément ce qui coûte cher. */
  "inaptitude": {
    libelle: "Inaptitude constatée par le médecin du travail",
    resume: "Un mois pour reclasser ou licencier, sinon le salaire repart.",
    etapes: [
      { cle: "avis", libelle: "Avis d'inaptitude du médecin du travail",
        obligatoire: true,
        aide: "La date de l'examen médical fait courir le délai d'un mois. Lisez l'avis : s'il mentionne que tout maintien dans un emploi serait gravement préjudiciable à la santé, ou que l'état de santé fait obstacle à tout reclassement, l'employeur est dispensé de rechercher un reclassement (L.1226-2-1)." },
      { cle: "recherche-reclassement", libelle: "Recherche de reclassement",
        document: "recherche-reclassement",
        aide: "Obligation de moyens, à mener sérieusement et à CONSIGNER PAR ÉCRIT : son absence suffit à priver le licenciement de cause réelle et sérieuse, même si aucun poste n'existait. Sauf dispense expresse portée sur l'avis." },
      { cle: "consultation-cse", libelle: "Consultation du CSE sur le reclassement",
        aide: "Obligatoire lorsqu'un CSE existe, quelle que soit l'origine de l'inaptitude, et AVANT toute proposition au salarié. Sans objet dans les entreprises qui n'en ont pas." },
      { cle: "proposition-ou-impossibilite", libelle: "Proposition de poste, ou notification de l'impossibilité de reclasser",
        document: "impossibilite-reclassement",
        aide: "Si aucun poste n'est disponible, l'employeur doit faire connaître au salarié, par écrit, les motifs qui s'opposent au reclassement (L.1226-2-1)." },
      { cle: "convocation", libelle: "Envoi de la convocation à l'entretien préalable",
        document: "convocation-entretien",
        aide: "Le licenciement pour inaptitude suit la procédure de licenciement pour motif personnel." },
      { cle: "presentation", libelle: "Présentation de la convocation au salarié" },
      { cle: "entretien", libelle: "Entretien préalable",
        auPlusTot: { depuis: "presentation", jours: 5, type: "ouvrables", report: true } },
      { cle: "notification", libelle: "Notification du licenciement pour inaptitude",
        document: "notification-inaptitude",
        auPlusTot: { depuis: "entretien", jours: 2, type: "ouvrables", report: true },
        auPlusTard: { depuis: "avis", mois: 1, avertissement: "reprise-salaire" },
        obligatoire: true,
        aide: "À défaut de reclassement ou de licenciement dans le mois de l'examen médical, l'employeur reprend le versement du salaire correspondant à l'emploi occupé avant la suspension (L.1226-4)." },
      { cle: "documents", libelle: "Remise des documents de fin de contrat",
        document: "documents-fin-contrat", obligatoire: true,
        aide: "Si l'inaptitude est d'origine professionnelle, l'indemnité de licenciement est doublée et une indemnité compensatrice de préavis est due (L.1226-14) — le préavis n'étant pas exécuté." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────
     RUPTURE CONVENTIONNELLE
     Deux délais incompressibles : quinze jours CALENDAIRES de
     rétractation (L.1237-13), puis quinze jours OUVRABLES d'instruction
     par la DREETS (L.1237-14). Envoyer la demande d'homologation avant
     la fin de la rétractation la rend irrecevable. */
  "rupture-conventionnelle": {
    libelle: "Rupture conventionnelle individuelle",
    resume: "Entretien, signature, quinze jours de rétractation, homologation.",
    etapes: [
      { cle: "entretien", libelle: "Entretien (au moins un)",
        obligatoire: true,
        aide: "Le salarié peut se faire assister ; s'il l'est, l'employeur peut l'être aussi et doit l'en informer. Aucun délai n'est imposé entre l'entretien et la signature." },
      { cle: "signature", libelle: "Signature de la convention de rupture",
        document: "convention-rupture", obligatoire: true,
        aide: "Formulaire Cerfa. Un exemplaire doit être REMIS au salarié : à défaut, la rupture est nulle. L'indemnité ne peut être inférieure à l'indemnité légale de licenciement." },
      { cle: "fin-retractation", libelle: "Fin du délai de rétractation",
        auPlusTot: { depuis: "signature", jours: 15, type: "calendaires" },
        obligatoire: true,
        aide: "Quinze jours calendaires à compter du lendemain de la signature (L.1237-13). Chaque partie peut se rétracter, sans motif, par lettre recommandée ou remise contre décharge." },
      { cle: "homologation-demande", libelle: "Envoi de la demande d'homologation",
        auPlusTot: { depuis: "fin-retractation", jours: 1, type: "calendaires" },
        obligatoire: true,
        aide: "Après l'expiration du délai de rétractation, jamais avant. Télé-procédure TéléRC. Pour un salarié protégé, il s'agit d'une demande d'autorisation à l'inspection du travail, pas d'une homologation." },
      { cle: "homologation-reponse", libelle: "Décision de la DREETS",
        auPlusTot: { depuis: "homologation-demande", jours: 15, type: "ouvrables" },
        obligatoire: true,
        aide: "Quinze jours ouvrables à compter de la réception de la demande (L.1237-14). Le silence vaut homologation." },
      { cle: "rupture", libelle: "Date de rupture du contrat",
        auPlusTot: { depuis: "homologation-reponse", jours: 1, type: "calendaires" },
        aide: "Au plus tôt le lendemain de l'homologation. Le contrat se poursuit normalement jusque-là." },
      { cle: "documents", libelle: "Remise des documents de fin de contrat",
        document: "documents-fin-contrat", obligatoire: true },
    ],
  },
};

const typeValide = (t) => Object.prototype.hasOwnProperty.call(PROCEDURES, String(t || ""));

/* ── Calcul de l'état d'une procédure ────────────────────────────────
   `faites` : { <clé d'étape>: "AAAA-MM-JJ" | "sans-objet" }
   Rend, pour chaque étape : sa date si elle est faite, sinon la fenêtre
   dans laquelle elle doit tomber, et l'écart au jour dit. */
function etat(type, faites = {}, aujourdhui) {
  if (!typeValide(type)) throw { status: 400, erreur: "Procédure inconnue." };
  const jour = D.estDate(aujourdhui) ? aujourdhui : new Date().toISOString().slice(0, 10);
  const def = PROCEDURES[type];
  const dates = {};
  for (const [k, v] of Object.entries(faites)) if (D.estDate(v)) dates[k] = v;

  const borne = (regle) => {
    if (!regle) return "";
    const base = dates[regle.depuis];
    if (!base) return "";
    const brut = regle.mois !== undefined
      ? D.ajouterMois(base, regle.mois)
      : D.ajouter(base, regle.jours, regle.type || "calendaires");
    return regle.report ? D.reporterSiNonOuvrable(brut) : brut;
  };

  const etapes = def.etapes.map((e) => {
    const fait = faites[e.cle];
    const sansObjet = fait === "sans-objet";
    const date = D.estDate(fait) ? fait : "";
    const tot = borne(e.auPlusTot);
    const tard = borne(e.auPlusTard);

    let statut = "a-venir";
    if (sansObjet) statut = "sans-objet";
    else if (date) statut = "faite";
    else if (tard && jour > tard) statut = "hors-delai";
    else if (tot && jour < tot) statut = "attente";     // le délai n'est pas encore écoulé
    else if (tot || tard) statut = "a-faire";
    else statut = "a-faire";

    // Une étape faite peut l'avoir été trop tôt ou trop tard : on le dit,
    // car c'est exactement ce qu'un conseil de prud'hommes regardera.
    const irregularites = [];
    if (date && tot && date < tot)
      irregularites.push(`Réalisée le ${D.fr(date)}, avant la date la plus proche possible (${D.fr(tot)}).`);
    if (date && tard && date > tard)
      irregularites.push(`Réalisée le ${D.fr(date)}, après la date limite (${D.fr(tard)}).`);

    return {
      cle: e.cle, libelle: e.libelle, aide: e.aide || "", document: e.document || null,
      obligatoire: !!e.obligatoire, statut, date,
      auPlusTot: tot, auPlusTard: tard,
      joursRestants: tard && !date ? D.compter(jour, tard, "calendaires") * (jour > tard ? -1 : 1) : null,
      avertissement: e.auPlusTard?.avertissement || null,
      irregularites,
    };
  });

  const prochaine = etapes.find((e) => e.statut === "a-faire" || e.statut === "attente" || e.statut === "hors-delai") || null;
  const terminee = etapes.filter((e) => e.obligatoire).every((e) => e.statut === "faite" || e.statut === "sans-objet");

  return {
    type, libelle: def.libelle, resume: def.resume,
    etapes, prochaine: prochaine ? prochaine.cle : null, terminee,
    // L'échéance de la procédure = la plus proche limite non tenue.
    echeance: etapes.filter((e) => e.auPlusTard && !e.date && e.statut !== "sans-objet")
      .map((e) => e.auPlusTard).sort()[0] || "",
    alertes: alertes(etapes, jour),
  };
}

/* Ce qui doit remonter au gestionnaire, par ordre de gravité. */
function alertes(etapes, jour) {
  const out = [];
  for (const e of etapes) {
    for (const i of e.irregularites) out.push({ niveau: "irregularite", etape: e.cle, titre: e.libelle, detail: i });
    if (e.date || e.statut === "sans-objet") continue;
    if (e.auPlusTard && jour > e.auPlusTard) {
      out.push({ niveau: "depasse", etape: e.cle, titre: `${e.libelle} — délai dépassé`,
        detail: e.avertissement === "reprise-salaire"
          ? `La limite était le ${D.fr(e.auPlusTard)}. Le versement du salaire doit être repris (L.1226-4) tant que le salarié n'est ni reclassé ni licencié.`
          : `La limite était le ${D.fr(e.auPlusTard)}.` });
    } else if (e.auPlusTard) {
      const reste = D.compter(jour, e.auPlusTard, "calendaires");
      if (reste <= 10) out.push({ niveau: reste <= 3 ? "urgent" : "proche", etape: e.cle,
        titre: `${e.libelle} — ${reste} jour${reste > 1 ? "s" : ""}`,
        detail: `À faire au plus tard le ${D.fr(e.auPlusTard)}.` });
    }
  }
  const ordre = { depasse: 0, irregularite: 1, urgent: 2, proche: 3 };
  return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}

/* ── Trames de courrier ──────────────────────────────────────────────
   Pré-remplies du dossier, à relire et à adapter. Volontairement
   sobres : un modèle trop bavard se signe sans être lu. */
function courrier(cle, ctx = {}) {
  const s = `${ctx.prenom || ""} ${ctx.nom || ""}`.trim() || "le salarié";
  const soc = ctx.raisonSociale || "l'entreprise";
  const lieu = ctx.lieuEdition || "";
  const entete = `${soc}\n${ctx.adresseEntreprise || ""}\n\n${s}\n${ctx.adresseSalarie || ""}\n\n${lieu ? `${lieu}, le ` : "Le "}${D.fr(ctx.date || new Date().toISOString().slice(0, 10))}\nLettre recommandée avec accusé de réception\n\n`;
  const signature = `\n\nPour ${soc},\n${ctx.representant || ""}${ctx.fonctionRepresentant ? `\n${ctx.fonctionRepresentant}` : ""}`;

  const modeles = {
    "convocation-entretien": {
      objet: "Convocation à un entretien préalable",
      corps: `${entete}Objet : convocation à un entretien préalable\n\nMadame, Monsieur,\n\nNous sommes conduits à envisager à votre égard une mesure de ${ctx.mesure || "licenciement"}.\n\nNous vous convoquons à un entretien préalable qui se tiendra le ${D.fr(ctx.dateEntretien) || "……"} à ${ctx.heureEntretien || "……"}, ${ctx.lieuEntretien || "au siège de l'entreprise"}.\n\nAu cours de cet entretien, nous vous exposerons les motifs de la mesure envisagée et recueillerons vos explications.\n\nVous pouvez vous faire assister par une personne de votre choix appartenant au personnel de l'entreprise. En l'absence de représentant du personnel, vous pouvez vous faire assister par un conseiller de votre choix inscrit sur une liste dressée par le préfet, consultable à l'inspection du travail et à la mairie.\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.${signature}`,
    },
    "notification-licenciement": {
      objet: "Notification de licenciement",
      corps: `${entete}Objet : notification de licenciement\n\nMadame, Monsieur,\n\nÀ la suite de notre entretien du ${D.fr(ctx.dateEntretien) || "……"}, nous vous notifions par la présente votre licenciement pour le motif suivant :\n\n${ctx.motif || "[Exposer ici les faits précis, datés et vérifiables qui fondent la décision. Cette lettre fixe les limites du litige : aucun autre motif ne pourra être invoqué par la suite.]"}\n\nVotre préavis, d'une durée de ${ctx.preavis || "……"}, débutera à la première présentation de cette lettre.\n\nVotre certificat de travail, votre attestation destinée à France Travail et votre solde de tout compte vous seront remis à l'issue de votre contrat.\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.${signature}`,
    },
    "notification-sanction": {
      objet: "Notification d'une sanction disciplinaire",
      corps: `${entete}Objet : notification d'une sanction disciplinaire\n\nMadame, Monsieur,\n\nÀ la suite de notre entretien du ${D.fr(ctx.dateEntretien) || "……"}, et après avoir pris connaissance de vos explications, nous vous notifions la sanction suivante : ${ctx.sanction || "[nature de la sanction]"}.\n\nCette décision fait suite aux faits suivants :\n\n${ctx.motif || "[Exposer les faits précis et datés.]"}\n\nNous vous invitons à modifier votre comportement afin qu'une telle mesure n'ait pas à se renouveler.\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.${signature}`,
    },
    "recherche-reclassement": {
      objet: "Recherche de reclassement — trace écrite",
      corps: `Recherche de reclassement de ${s}\nAvis d'inaptitude du ${D.fr(ctx.dateAvis) || "……"}\n\nRestrictions portées par le médecin du travail :\n${ctx.restrictions || "[Reprendre les termes exacts de l'avis.]"}\n\nPostes examinés :\n— [intitulé, service, pourquoi il convient ou non au regard des restrictions]\n— …\n\nAménagements étudiés (poste, horaires, matériel, formation) :\n— …\n\nÉchanges avec le médecin du travail :\n— [date, teneur]\n\nConclusion :\n[Poste proposé, ou motifs précis qui s'opposent au reclassement.]\n\nCe document doit être conservé : l'absence de trace écrite d'une recherche sérieuse suffit à priver le licenciement de cause réelle et sérieuse, même lorsqu'aucun poste n'était disponible.`,
    },
    "impossibilite-reclassement": {
      objet: "Impossibilité de reclassement",
      corps: `${entete}Objet : impossibilité de reclassement\n\nMadame, Monsieur,\n\nÀ la suite de l'avis d'inaptitude rendu par le médecin du travail le ${D.fr(ctx.dateAvis) || "……"}, nous avons recherché les possibilités de vous reclasser au sein de l'entreprise.\n\nNous sommes au regret de vous faire connaître les motifs qui s'opposent à votre reclassement :\n\n${ctx.motif || "[Exposer précisément les recherches menées et les raisons pour lesquelles aucun poste compatible avec les restrictions médicales n'a pu être proposé.]"}\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.${signature}`,
    },
    "notification-inaptitude": {
      objet: "Notification de licenciement pour inaptitude",
      corps: `${entete}Objet : notification de licenciement pour inaptitude et impossibilité de reclassement\n\nMadame, Monsieur,\n\nLe médecin du travail vous a déclaré inapte à votre poste par avis du ${D.fr(ctx.dateAvis) || "……"}.\n\nNous avons recherché les possibilités de vous reclasser et vous en avons fait connaître les résultats. Aucun poste compatible avec les conclusions du médecin du travail n'ayant pu vous être proposé, nous vous notifions votre licenciement pour inaptitude et impossibilité de reclassement.\n\n${ctx.professionnelle ? "Votre inaptitude étant d'origine professionnelle, vous percevrez l'indemnité spéciale de licenciement ainsi qu'une indemnité compensatrice de préavis.\n\n" : "Le préavis ne pouvant être exécuté du fait de votre inaptitude, il ne vous sera pas versé d'indemnité compensatrice de préavis, sauf disposition conventionnelle plus favorable.\n\n"}Votre certificat de travail, votre attestation destinée à France Travail et votre solde de tout compte vous seront remis.\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.${signature}`,
    },
    "convention-rupture": {
      objet: "Rupture conventionnelle — points à vérifier avant signature",
      corps: `Rupture conventionnelle de ${s}\n\nÀ vérifier avant de signer :\n\n— Un exemplaire de la convention est REMIS au salarié. À défaut, la rupture est nulle.\n— L'indemnité de rupture est au moins égale à l'indemnité légale de licenciement, et à l'indemnité conventionnelle lorsque celle-ci est plus favorable.\n— La date de rupture envisagée est postérieure au lendemain de l'homologation.\n— Le salarié a été informé de la possibilité de se faire assister lors de l'entretien.\n— Salarié protégé : c'est une autorisation de l'inspection du travail qu'il faut demander, et non une homologation.\n\nDélai de rétractation : quinze jours calendaires à compter du lendemain de la signature, soit jusqu'au ${D.fr(ctx.finRetractation) || "……"} inclus.\nDemande d'homologation à déposer à partir du ${D.fr(ctx.depotHomologation) || "……"}.`,
    },
    "documents-fin-contrat": {
      objet: "Documents de fin de contrat",
      corps: `Documents à remettre à ${s} :\n\n— Certificat de travail\n— Attestation destinée à France Travail\n— Solde de tout compte et son reçu\n— État récapitulatif de l'épargne salariale, le cas échéant\n— Information sur la portabilité de la mutuelle et de la prévoyance\n\nCes documents sont quérables et doivent être tenus à disposition dès la fin du contrat.`,
    },
  };
  return modeles[cle] || null;
}

/* ── Accès aux données ───────────────────────────────────────────────
   `require` paresseux : tout ce qui précède est du calcul pur,
   vérifiable sans annuaire, sans jeton et sans réseau. */

const LISTE = "Procédures";

const lireJson = (v) => { try { const o = JSON.parse(v || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };

async function dossiers(codeClient) {
  const { tokenGraph, idsListes, items, dateParis } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  return (await items(tok, ids[LISTE], "Title,Reference,CodeClient,SalarieNom,SalariePrenom,EmailDemandeur,EmailGestionnaire,TypeProcedure,Etapes,Contexte,Statut,DateOuverture,DateEcheance,AlerteProcedure"))
    .filter((x) => x.CodeClient === codeClient)
    .map((x) => ({
      id: x.id, reference: x.Reference || "",
      nom: x.SalarieNom || "", prenom: x.SalariePrenom || "",
      type: x.TypeProcedure || "", statut: x.Statut || "En cours",
      faites: lireJson(x.Etapes), contexte: lireJson(x.Contexte),
      ouverture: dateParis(x.DateOuverture) || "", echeance: dateParis(x.DateEcheance) || "",
      alerte: x.AlerteProcedure || "",
    }));
}

/* Un dossier enrichi de son état calculé — c'est cette forme que le
   front consomme, jamais les étapes brutes. */
const enrichir = (d, jour) => ({ ...d, ...etat(d.type, d.faites, jour), id: d.id, reference: d.reference,
  nom: d.nom, prenom: d.prenom, statut: d.statut, ouverture: d.ouverture });

async function ecrire(fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items`, {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: "Ouverture de la procédure impossible — réessayez.", detail: corps };
  }
  viderCacheItems();
}

async function majDossier(id, fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}/fields`, {
    method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement impossible — réessayez." };
  viderCacheItems();
}

/* Le dossier, cloisonné : on ne retrouve que ce qui appartient au
   client du jeton. */
async function dossierDu(clientInfo, id) {
  const tous = await dossiers(clientInfo.codeClient);
  const d = tous.find((x) => String(x.id) === String(id));
  if (!d) throw { status: 404, erreur: "Procédure introuvable." };
  return d;
}

/* ── Actions ─────────────────────────────────────────────────────── */

async function lister(clientInfo) {
  const jour = new Date().toISOString().slice(0, 10);
  const tous = (await dossiers(clientInfo.codeClient)).map((d) => enrichir(d, jour));
  const rang = { "En cours": 0, "Terminée": 1, "Abandonnée": 2 };
  return { status: 200, jsonBody: {
    procedures: tous.sort((a, b) => (rang[a.statut] - rang[b.statut]) || String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"))),
    catalogue: Object.entries(PROCEDURES).map(([cle, p]) => ({ cle, libelle: p.libelle, resume: p.resume })),
  } };
}

async function ouvrir(clientInfo, email, d) {
  if (!typeValide(d.type)) return { status: 400, jsonBody: { erreur: "Procédure inconnue." } };
  const nom = String(d.nom || "").trim();
  if (nom.length < 2) return { status: 400, jsonBody: { erreur: "Salarié requis." } };

  // Les dates de départ posées à l'ouverture (faits connus, avis
  // d'inaptitude) : ce sont elles qui arment l'horloge.
  const faites = {};
  for (const [k, v] of Object.entries(d.faites || {}))
    if (v === "sans-objet" || D.estDate(v)) faites[k] = v;

  const jour = new Date().toISOString().slice(0, 10);
  const e = etat(d.type, faites, jour);
  const reference = `PROC-${Date.now().toString(36).toUpperCase()}`;
  const mots = nom.split(/\s+/);
  await ecrire({
    Title: `${PROCEDURES[d.type].libelle} — ${nom}`.slice(0, 255),
    Reference: reference,
    CodeClient: clientInfo.codeClient, RaisonSociale: clientInfo.raisonSociale || "",
    SalarieNom: (mots[0] || "").toUpperCase(), SalariePrenom: mots.slice(1).join(" "),
    EmailDemandeur: email, EmailGestionnaire: clientInfo.emailGestionnaire || "",
    TypeProcedure: d.type,
    Etapes: JSON.stringify(faites), Contexte: JSON.stringify(d.contexte || {}),
    Statut: "En cours", DateOuverture: jour,
    ...(e.echeance ? { DateEcheance: e.echeance } : {}),
  });
  return { status: 201, jsonBody: { reference, ...e } };
}

/* Enregistre — ou efface — la date d'une étape. Effacer est nécessaire :
   une date saisie par erreur fausse tout ce qui suit. */
async function majEtape(clientInfo, d) {
  const dossier = await dossierDu(clientInfo, d.id);
  const def = PROCEDURES[dossier.type];
  if (!def) return { status: 400, jsonBody: { erreur: "Procédure inconnue." } };
  if (!def.etapes.some((e) => e.cle === d.etape))
    return { status: 400, jsonBody: { erreur: "Étape inconnue pour cette procédure." } };
  if (d.valeur && d.valeur !== "sans-objet" && !D.estDate(d.valeur))
    return { status: 400, jsonBody: { erreur: "Date invalide (AAAA-MM-JJ)." } };

  const faites = { ...dossier.faites };
  if (!d.valeur) delete faites[d.etape]; else faites[d.etape] = d.valeur;

  const jour = new Date().toISOString().slice(0, 10);
  const e = etat(dossier.type, faites, jour);
  await majDossier(dossier.id, {
    Etapes: JSON.stringify(faites),
    DateEcheance: e.echeance || null,
    Statut: e.terminee ? "Terminée" : "En cours",
  });
  return { status: 200, jsonBody: { ...e, id: dossier.id } };
}

async function abandonner(clientInfo, d) {
  const dossier = await dossierDu(clientInfo, d.id);
  await majDossier(dossier.id, { Statut: "Abandonnée", DateEcheance: null });
  return { status: 200, jsonBody: { ok: true } };
}

/* La trame de courrier d'une étape, remplie du dossier ET du client :
   l'en-tête d'une lettre recommandée n'a pas à être ressaisi. */
async function document(clientInfo, d) {
  const dossier = await dossierDu(clientInfo, d.id);
  const def = PROCEDURES[dossier.type];
  const etape = def.etapes.find((e) => e.cle === d.etape);
  if (!etape || !etape.document) return { status: 404, jsonBody: { erreur: "Aucun document pour cette étape." } };

  const e = etat(dossier.type, dossier.faites, new Date().toISOString().slice(0, 10));
  const ctx = {
    nom: dossier.nom, prenom: dossier.prenom,
    raisonSociale: clientInfo.raisonSociale, adresseEntreprise: clientInfo.adresseEntreprise,
    representant: clientInfo.representant, fonctionRepresentant: clientInfo.fonctionRepresentant,
    lieuEdition: clientInfo.lieuEdition,
    date: new Date().toISOString().slice(0, 10),
    dateEntretien: dossier.faites.entretien || e.etapes.find((x) => x.cle === "entretien")?.auPlusTot || "",
    dateAvis: dossier.faites.avis || "",
    finRetractation: e.etapes.find((x) => x.cle === "fin-retractation")?.auPlusTot || "",
    depotHomologation: e.etapes.find((x) => x.cle === "homologation-demande")?.auPlusTot || "",
    mesure: dossier.type === "sanction-disciplinaire" ? "sanction disciplinaire" : "licenciement",
    ...dossier.contexte,
  };
  const doc = courrier(etape.document, ctx);
  if (!doc) return { status: 404, jsonBody: { erreur: "Modèle indisponible." } };
  return { status: 200, jsonBody: { ...doc, etape: etape.cle, libelle: etape.libelle } };
}

/* ── Alertes, tous clients ───────────────────────────────────────────
   Consommé par /api/echeances pour alimenter le tableau `notifications`.
   AVERTISSEMENT MÉTIER : les délais de procédure se comptent en JOURS,
   parfois deux. Un flux hebdomadaire les manquera. Ces alertes valent
   pour un flux QUOTIDIEN ; le portail, lui, les affiche en direct. */
async function alertesProcedures(tok, ids, items, clients) {
  if (!ids[LISTE]) return [];
  const jour = new Date().toISOString().slice(0, 10);
  const lignes = await items(tok, ids[LISTE], "Title,Reference,CodeClient,SalarieNom,SalariePrenom,EmailDemandeur,EmailGestionnaire,TypeProcedure,Etapes,Statut,AlerteProcedure");
  const out = [];
  for (const l of lignes) {
    if (l.Statut !== "En cours" || !typeValide(l.TypeProcedure)) continue;
    const client = clients.find((c) => c.CodeClient === l.CodeClient);
    if (!client || client.Actif === false) continue;
    let e;
    try { e = etat(l.TypeProcedure, lireJson(l.Etapes), jour); } catch { continue; }
    const grave = e.alertes.find((a) => a.niveau === "depasse") || e.alertes.find((a) => a.niveau === "urgent");
    if (!grave) continue;
    // Anti-doublon : un même palier ne se renvoie pas chaque jour.
    const palier = `${grave.niveau}:${grave.etape}`;
    if (String(l.AlerteProcedure || "").startsWith(palier)) continue;
    const salarie = `${l.SalarieNom || ""} ${l.SalariePrenom || ""}`.trim();
    out.push({
      id: l.id, palier: `${palier} ${jour}`,
      email: l.EmailGestionnaire || client.EmailGestionnaire || "",
      salarie, raisonSociale: client.RaisonSociale || l.CodeClient,
      type: "procedure", niveau: grave.niveau,
      objet: `${grave.niveau === "depasse" ? "Délai dépassé" : "Délai imminent"} — ${PROCEDURES[l.TypeProcedure].libelle}, ${salarie}`,
      corps: `${client.RaisonSociale || l.CodeClient}\n${PROCEDURES[l.TypeProcedure].libelle} — ${salarie}\n\n${grave.titre}\n${grave.detail}\n\nRéférence ${l.Reference || ""}`,
    });
  }
  return out;
}

module.exports = {
  PROCEDURES, typeValide, etat, courrier, alertes,
  lister, ouvrir, majEtape, abandonner, document, dossiers, alertesProcedures,
};
