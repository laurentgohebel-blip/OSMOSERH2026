// api/src/functions/demande.js — Azure Functions v4 (fonctions managées Static Web Apps)
// Point d'entrée UNIQUE des formulaires du portail, désormais VERROUILLÉ :
//   1. le jeton External ID du navigateur est validé (annuaire.verifierJeton) ;
//   2. l'email vérifié est résolu en client via les listes du site RH
//      (annuaire.resoudreClient) — le payload n'est jamais cru sur parole ;
//   3. le payload relayé au flux est enrichi de l'identité entreprise
//      (raison sociale, SIRET…) et du gestionnaire : les flux Power Automate
//      n'ont plus AUCUNE recherche SharePoint à faire, que des jetons.
//
// Configuration : FLOW_URL_<DEMARCHE> (une par démarche) + variables AUTH_*/GRAPH_*
// (voir annuaire.js). Les URLs de flux restent secrètes côté Azure.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, creerDemandeAcces, creerEmbauche, creerVariablesPaie, creerFinContrat, tokenGraph, idsListes, viderCacheItems } = require("../annuaire");

app.http("demande", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    let d;
    try { d = await request.json(); }
    catch { return { status: 400, jsonBody: { erreur: "JSON attendu" } }; }

    // 1. Honeypot : un humain ne remplit jamais ce champ caché
    if (d.xq_note || d.website) return { status: 202, jsonBody: { reference: "OK" } }; // on ne renseigne pas le bot

    // 1 bis. Leads du site vitrine : la plateforme SWA ne route pas de
    // nouvelle fonction de façon fiable (constat définitif du 21/08, voir
    // me.js) — les formulaires publics postent donc ICI, en Content-Type
    // text/plain (requête « simple », pas de préflight OPTIONS à router).
    // Anonyme par nature : AVANT le verrou jeton, protégé par le pot de
    // miel ci-dessus + les validations et le CORS du module lead.
    if (d.action === "lead") {
      try {
        return await require("../lead").lead(request, context, d);
      } catch (e) {
        context.error("demande/lead :", e);
        return { status: 500, jsonBody: { erreur: `Module lead inchargeable : ${e.message}` } };
      }
    }

    // 1 bis-2. Onboarding salarié PUBLIC : le salarié invité n'a pas de
    // compte — le jeton d'invitation (48 hex, 14 jours, usage unique)
    // est l'unique clé. AVANT le verrou jeton utilisateur, protégé par
    // le pot de miel ci-dessus + les contrôles du module onboarding.
    if (d.action === "onboarding") {
      try {
        const onboarding = require("../onboarding");
        return d.mode === "soumettre"
          ? await onboarding.soumettre(d, context)
          : await onboarding.info(d, context);
      } catch (e) {
        if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
        context.error("demande/onboarding :", e);
        return { status: 500, jsonBody: { erreur: `Module onboarding inchargeable : ${e.message}` } };
      }
    }

    // 1 bis-3. Courriels entrants : le flux de la boîte de dépôt poste
    // ici le message d'un client. Pas de jeton utilisateur — un patron
    // qui transfère un arrêt depuis son téléphone n'ouvre pas le
    // portail —, mais un secret d'en-tête et, surtout, un expéditeur
    // qui doit être un contact portail actif : le CodeClient vient de
    // l'annuaire, jamais du contenu du message.
    if (d.action === "courriel") {
      try {
        return await require("../courriel").recevoir(request, d, context);
      } catch (e) {
        context.error("demande/courriel :", e);
        return { status: 500, jsonBody: { erreur: `Module courriel inchargeable : ${e.message}` } };
      }
    }

    // 1 bis-4. Pointage : page publique atteinte par un QR code affiché
    // près de la porte. Aucun compte — un salarié n'a pas d'accès au
    // portail. Le jeton du lien est DÉRIVÉ du code client par HMAC : il
    // n'ouvre que le pointage de cet employeur, et rien d'autre.
    if (d.action === "pointage") {
      try {
        return await require("../planning").pointage(d, context);
      } catch (e) {
        if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
        context.error("demande/pointage :", e);
        return { status: 502, jsonBody: { erreur: "Pointage indisponible — prévenez votre responsable." } };
      }
    }

    // 1 bis-5. Notes de frais, dépôt par le salarié : même famille que le
    // pointage — un lien public, un jeton dérivé du code client, aucun
    // compte. Le salarié photographie son ticket et le dépose ; rien
    // n'est remboursé sans validation explicite de l'employeur.
    if (d.action === "fraisDepot") {
      try {
        return await require("../notesdefrais").depot(d, context);
      } catch (e) {
        if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
        context.error("demande/fraisDepot :", e);
        return { status: 502, jsonBody: { erreur: "Dépôt indisponible — prévenez votre responsable." } };
      }
    }

    // 1 ter. Détour gestionnaire : même contournement — l'activation des
    // demandes d'accès et l'import d'effectif passent par cette route.
    // Le module admin re-vérifie lui-même le jeton ET la liste
    // ADMIN_EMAILS — un client ordinaire reçoit un 403.
    if (d.action === "adminActiver" || d.action === "adminImportSalaries" || d.action === "adminDpae" || d.action === "adminTitreSejour" || d.action === "adminEtrangers" || d.action === "adminPaie") {
      try {
        if (d.action === "adminEtrangers") return await require("../etrangers").adminMaj(request, context, d);
        // Boîte de réception de la paie : pointage Nouvelle → Intégrée.
        if (d.action === "adminPaie") return await require("../paie").statut(request, context, d);
        const admin = require("../admin");
        return d.action === "adminActiver" ? await admin.activer(request, context, d)
          : d.action === "adminDpae" ? await admin.dpae(request, context, d)
          : d.action === "adminTitreSejour" ? await admin.titreSejour(request, context, d)
          : await admin.importerSalaries(request, context, d);
      } catch (e) {
        context.error(`demande/${d.action} :`, e);
        return { status: 500, jsonBody: { erreur: `Module admin inchargeable : ${e.message}` } };
      }
    }

    // 1 quater. Fil de discussion « Mon gestionnaire » : réponse et
    // clôture passent aussi par cette route (doctrine me.js). Le module
    // vérifie lui-même le jeton et déduit le rôle du compte (ADMIN_EMAILS
    // → gestionnaire, sinon client résolu + propriété du fil vérifiée).
    if (d.action === "messageRepondre" || d.action === "messageStatut") {
      try {
        const messages = require("../messages");
        return d.action === "messageRepondre"
          ? await messages.repondre(request, context, d)
          : await messages.statut(request, context, d);
      } catch (e) {
        if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
        context.error(`demande/${d.action} :`, e);
        return { status: 500, jsonBody: { erreur: `Module messages inchargeable : ${e.message}` } };
      }
    }

    // 2. Identité vérifiée puis résolution client — le verrou.
    //    Cas particulier « acces » : la demande d'accès est LA démarche des
    //    comptes pas encore rattachés — jeton valide exigé, résolution non.
    let email, clientInfo;
    try {
      ({ email } = await verifierJeton(request));
      if (d.demarche === "acces") {
        if (!d.entreprise || String(d.entreprise).trim().length < 2 || !d.nom || String(d.nom).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Entreprise et nom sont requis." } };
        await creerDemandeAcces(email, d);
        return { status: 202, jsonBody: { reference: `ACCES-${Date.now().toString(36).toUpperCase()}` } };
      }
      clientInfo = await resoudreClient(email);

      // Verrou d'option : une démarche non souscrite est refusée côté
      // serveur, même si l'appel contourne l'interface (tuiles grisées).
      // fin-contrat relève de l'option 'embauche' : elle couvre le cycle
      // contrat complet (entrées ET sorties).
      const OPTION_PAR_DEMARCHE = { "attestation-employeur": "attestation", "acompte": "acompte", "embauche": "embauche", "variables-paie": "paie", "fin-contrat": "embauche", "absences": "embauche", "visite-medicale": "embauche", "mutuelle": "embauche", "avenant": "embauche" };
      const option = OPTION_PAR_DEMARCHE[d.demarche];
      if (option && !clientInfo.options.includes(option))
        return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };

      // Mise à jour du DOSSIER SALARIÉ (onglet Dossier de la fiche) —
      // action cliente sur la route historique (doctrine du 21/08).
      // Verrous : jeton + client résolus ci-dessus, option embauche,
      // et propriété de l'élément vérifiée AVANT toute écriture.
      // Procédures : licenciement, sanction, inaptitude, rupture
      // conventionnelle. Le portail tient les délais et l'ordre des
      // étapes — la forme, là où les petites entreprises se font
      // condamner. Rattaché à l'option « embauche », qui couvre déjà la
      // vie du contrat de son début à sa fin.
      if (d.action === "procedure") {
        if (!clientInfo.options.includes("embauche"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        try {
          const proc = require("../procedures");
          if (d.mode === "ouvrir") return await proc.ouvrir(clientInfo, email, d);
          if (d.mode === "etape") return await proc.majEtape(clientInfo, d);
          if (d.mode === "abandonner") return await proc.abandonner(clientInfo, d);
          if (d.mode === "document") return await proc.document(clientInfo, d);
          return await proc.lister(clientInfo);
        } catch (e) {
          if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
          context.error("demande/procedure :", e);
          return { status: 502, jsonBody: { erreur: "Procédures indisponibles — réessayez." } };
        }
      }

      // Planning d'équipe et temps de travail. L'option « paie » ouvre
      // la brique : ce que le planning produit, ce sont des variables.
      if (d.action === "planning") {
        if (!clientInfo.options.includes("paie"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        try {
          const planning = require("../planning");
          if (d.mode === "poser") return await planning.poser(clientInfo, d);
          if (d.mode === "supprimer") { await planning.supprimer(clientInfo.codeClient, d.id); return { status: 200, jsonBody: { ok: true } }; }
          if (d.mode === "variables" || d.mode === "apercu") return await planning.versVariables(clientInfo, email, d);
          return await planning.lire(clientInfo, d);
        } catch (e) {
          if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
          context.error("demande/planning :", e);
          return { status: 502, jsonBody: { erreur: "Planning indisponible — réessayez." } };
        }
      }

      // Notes de frais. Rattachées à l'option « paie » : ce que la
      // brique produit, ce sont des variables — un remboursement net et,
      // quand le plafond d'exonération est dépassé, du brut soumis.
      if (d.action === "frais") {
        if (!clientInfo.options.includes("paie"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        try {
          const ndf = require("../notesdefrais");
          if (d.mode === "saisir") return await ndf.saisir(clientInfo, email, d);
          if (d.mode === "statuer") return await ndf.statuer(clientInfo, d);
          if (d.mode === "variables" || d.mode === "apercu") return await ndf.versVariables(clientInfo, email, d);
          return await ndf.lister(clientInfo, d);
        } catch (e) {
          if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
          context.error("demande/frais :", e);
          return { status: 502, jsonBody: { erreur: "Notes de frais indisponibles — réessayez." } };
        }
      }

      // Saisie sur salaire. Option « paie » : ce que la brique produit,
      // c'est une retenue mensuelle en variables. Le calcul (quotité par
      // tranches, plancher RSA, pension alimentaire) vit dans saisie.js.
      if (d.action === "saisie") {
        if (!clientInfo.options.includes("paie"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        try {
          const saisies = require("../saisies");
          if (d.mode === "declarer") return await saisies.declarer(clientInfo, email, d, context);
          if (d.mode === "transmettre") return await saisies.transmettre(clientInfo, email, d);
          if (d.mode === "cloturer") return await saisies.cloturer(clientInfo, d);
          if (d.mode === "actualiser") return await saisies.actualiser(clientInfo, d);
          return await saisies.lister(clientInfo);
        } catch (e) {
          if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
          context.error("demande/saisie :", e);
          return { status: 502, jsonBody: { erreur: "Saisies indisponibles — réessayez." } };
        }
      }

      // Réembauche, écran de contrôle : le client choisit un ancien
      // salarié et un projet de contrat, et voit AVANT de valider ce que
      // le dossier reprend et ce que la loi impose (carence, titre,
      // essai, visite). Lecture seule — rien n'est écrit ici.
      if (d.action === "reembaucheControles") {
        if (!clientInfo.options.includes("embauche"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        try {
          return await require("../reembauche").controles(clientInfo, d);
        } catch (e) {
          if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
          context.error("demande/reembaucheControles :", e);
          return { status: 502, jsonBody: { erreur: "Lecture du dossier impossible — réessayez." } };
        }
      }

      if (d.action === "majSalarie") {
        if (!clientInfo.options.includes("embauche"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        return await majSalarie(clientInfo, d, context);
      }

      // Onboarding : le client génère (ou retrouve) le lien d'invitation
      // d'une fiche — verrous : option embauche + propriété de la fiche
      // (vérifiée dans le module).
      if (d.action === "onboardingInviter" || d.action === "onboardingEmbauche") {
        if (!clientInfo.options.includes("embauche"))
          return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        const onboarding = require("../onboarding");
        return d.action === "onboardingEmbauche"
          ? await onboarding.embaucher(email, clientInfo, d, context)
          : await onboarding.inviter(email, clientInfo, d, context);
      }

      // Brique « Salariés étrangers » : le client déclare un récépissé de
      // renouvellement ou un nouveau titre (verrous option + propriété
      // dans le module).
      if (d.action === "titreRenouvellement") {
        return await require("../etrangers").renouveler(clientInfo, d, context);
      }

      // Cas particulier « fin-contrat » : déclaration de départ — écrite
      // dans la liste « Fins de contrat », production documentaire par le
      // gestionnaire (STC, certificat, attestation France Travail).
      if (d.demarche === "fin-contrat") {
        const MOTIFS = ["Démission", "Rupture conventionnelle", "Licenciement pour motif personnel", "Licenciement pour motif économique", "Fin de CDD (terme prévu)", "Rupture anticipée de CDD", "Rupture période d'essai (employeur)", "Rupture période d'essai (salarié)", "Départ à la retraite", "Mise à la retraite", "Décès", "Autre"];
        if (!d.nom || String(d.nom).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Nom du salarié requis." } };
        if (!["CDI", "CDD", "Autre"].includes(d.typeContrat))
          return { status: 400, jsonBody: { erreur: "Type de contrat invalide." } };
        if (!MOTIFS.includes(d.motif))
          return { status: 400, jsonBody: { erreur: "Motif de fin de contrat invalide." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateFin || "")))
          return { status: 400, jsonBody: { erreur: "Date de fin de contrat requise." } };
        const reference = `FIN-${Date.now().toString(36).toUpperCase()}`;
        await creerFinContrat(email, clientInfo, d, reference);
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particulier « variables-paie » : la grille mensuelle. Pas de
      // flux HTTP — l'API écrit une ligne de liste par salarié transmis.
      if (d.demarche === "variables-paie") {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.mois || "")))
          return { status: 400, jsonBody: { erreur: "Mois invalide (format AAAA-MM)." } };
        const lignes = Array.isArray(d.lignes) ? d.lignes : [];
        if (lignes.length === 0)
          return { status: 400, jsonBody: { erreur: "Aucune ligne à transmettre." } };
        if (lignes.length > 100)
          return { status: 400, jsonBody: { erreur: "Trop de lignes (100 maximum par envoi)." } };
        for (let i = 0; i < lignes.length; i++)
          if (!lignes[i] || String(lignes[i].nom || "").trim().length < 2)
            return { status: 400, jsonBody: { erreur: `Ligne ${i + 1} : le nom du salarié est requis.` } };
        const reference = `VAR-${Date.now().toString(36).toUpperCase()}`;
        await creerVariablesPaie(email, clientInfo, d.mois, lignes);
        return { status: 202, jsonBody: { reference, lignes: lignes.length } };
      }

      // Cas particulier « embauche » (contrat + DPAE) : pas de flux HTTP —
      // l'API écrit dans « Production contrat » et le flux existant
      // « Production contrat + AR » se déclenche à la création.
      if (d.demarche === "embauche") {
        // Modèle B (22/08) : le client fournit les infos du contrat et
        // TROIS pièces obligatoires (identité, carte Vitale, RIB) déjà
        // déposées via /api/depot — le payload porte leurs noms finaux.
        // Osmose RH transcrit ensuite les pièces dans la fiche « Salariés »
        // (onglet Dossier, bandeau « Dossier incomplet »). Le volet
        // administratif reste accepté mais FACULTATIF : chaque champ
        // transmis est contrôlé, aucun n'est exigé.
        // Réembauche (24/08) : le salarié a déjà travaillé ici, son
        // dossier est au référentiel. On le REPREND — identité, NIR,
        // adresse, banque — et on ne redemande que ce qui appartient au
        // nouveau contrat. Les trois pièces ne sont pas réclamées : elles
        // sont déjà dans la GED du client depuis la première embauche.
        // `preparer` revérifie les points bloquants côté serveur ; le
        // contrôle d'affichage ne prouve rien.
        let reembauche = null;
        if (d.reprise) {
          try {
            reembauche = await require("../reembauche").preparer(clientInfo, d);
            d = { ...d, ...reembauche.demande };
          } catch (e) {
            if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur, ...(e.points ? { points: e.points } : {}) } };
            context.error("demande/reembauche :", e);
            return { status: 502, jsonBody: { erreur: "Reprise du dossier impossible — réessayez." } };
          }
        }
        const requis = ["typeContrat", "nom", "prenom", "dateNaissance", "lieuNaissance", "nationalite", "numeroSS", "adressePostale", "dateDebut", "poste", "dureeMensuelle",
          ...(reembauche ? [] : ["pjIdentite", "pjVitale", "pjRib"])];
        for (const c of requis)
          if (!d[c] || !String(d[c]).trim())
            return { status: 400, jsonBody: { erreur: `Champ manquant : ${c}` } };
        for (const c of ["pjIdentite", "pjVitale", "pjRib"])
          if (d[c] && (!/\.(pdf|jpe?g|png)$/i.test(String(d[c]).trim()) || String(d[c]).length > 255))
            return { status: 400, jsonBody: { erreur: "Pièce jointe invalide — reprenez le dépôt des trois documents." } };
        if (!/^[12]\d{12}(\d{2})?$/.test(String(d.numeroSS).replace(/\s/g, "")))
          return { status: 400, jsonBody: { erreur: "Numéro de sécurité sociale invalide (13 ou 15 chiffres)." } };
        if (!["CDI", "CDD"].includes(d.typeContrat))
          return { status: 400, jsonBody: { erreur: "Type de contrat non pris en charge." } };
        if (d.typeContrat === "CDD" && !d.dateFin)
          return { status: 400, jsonBody: { erreur: "Date de fin requise pour un CDD." } };
        if (d.sexe && !SEXES.includes(d.sexe))
          return { status: 400, jsonBody: { erreur: "Sexe invalide." } };
        if (d.situationFamiliale && !SITUATIONS.includes(d.situationFamiliale))
          return { status: 400, jsonBody: { erreur: "Situation familiale invalide." } };
        if (d.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(String(d.iban).replace(/\s/g, "").toUpperCase()))
          return { status: 400, jsonBody: { erreur: "IBAN invalide." } };
        if (d.bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(d.bic).replace(/\s/g, "").toUpperCase()))
          return { status: 400, jsonBody: { erreur: "BIC invalide." } };
        if (d.codePaysNaissance && !/^[A-Za-z]{2}$/.test(String(d.codePaysNaissance).trim()))
          return { status: 400, jsonBody: { erreur: "Code pays invalide (2 lettres)." } };
        if (d.emailSalarie && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.emailSalarie).trim()))
          return { status: 400, jsonBody: { erreur: "E-mail du salarié invalide." } };
        if (d.finPeriodeEssai && (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.finPeriodeEssai)) || String(d.finPeriodeEssai) <= String(d.dateDebut)))
          return { status: 400, jsonBody: { erreur: "Fin de période d'essai invalide (postérieure au début du contrat)." } };
        // Salarié étranger (hors UE/EEE/Suisse) : titre de séjour EXIGÉ —
        // type, numéro, date d'expiration et pièce jointe dédiée. Son
        // authentification préfectorale est ensuite suivie par le
        // gestionnaire (écran admin, statut « À authentifier »).
        if (titreSejourRequis(d.nationalite)) {
          for (const c of ["titreSejourType", "titreSejourNumero", "titreSejourExpiration", "pjTitreSejour"])
            if (!d[c] || !String(d[c]).trim())
              return { status: 400, jsonBody: { erreur: `Champ manquant (salarié étranger) : ${c}` } };
          if (!TITRES_SEJOUR.includes(d.titreSejourType))
            return { status: 400, jsonBody: { erreur: "Type de titre de séjour invalide." } };
          if (!/\.(pdf|jpe?g|png)$/i.test(String(d.pjTitreSejour).trim()) || String(d.pjTitreSejour).length > 255)
            return { status: 400, jsonBody: { erreur: "Pièce jointe du titre de séjour invalide — reprenez le dépôt." } };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.titreSejourExpiration)))
            return { status: 400, jsonBody: { erreur: "Date d'expiration du titre invalide (AAAA-MM-JJ)." } };
          if (String(d.titreSejourExpiration) < String(d.dateDebut))
            return { status: 400, jsonBody: { erreur: "Le titre de séjour expire avant la date d'embauche — embauche impossible en l'état." } };
        }
        // La fiche d'abord (upsert idempotent), le contrat ensuite : en cas
        // d'échec du contrat, une nouvelle tentative re-complète la fiche.
        const idFiche = await creerFicheSalarie(clientInfo, d);
        const reference = `EMB-${Date.now().toString(36).toUpperCase()}`;
        await creerEmbauche(email, clientInfo, d, reference);
        // Une réembauche décidée malgré un point bloquant doit se VOIR :
        // le gestionnaire reçoit le motif invoqué et les points passés
        // outre. C'est ce qui distingue une dérogation assumée d'un
        // oubli — et ce qu'on veut retrouver en cas de contrôle.
        if (reembauche?.derogation) {
          try {
            await creerMessageGestionnaire(email, clientInfo, {
              objet: `Réembauche en dérogation — ${d.nom} ${d.prenom} (${reference})`,
              message: [
                `Réembauche de ${d.nom} ${d.prenom}, contrat ${d.typeContrat} au ${d.dateDebut}.`,
                `Motif invoqué : ${reembauche.derogation}`,
                "",
                "Points signalés et passés outre :",
                ...reembauche.points.filter((p) => p.niveau === "bloquant").map((p) => `— ${p.titre} : ${p.detail}`),
              ].join("\n"),
            }, reference);
          } catch (e) {
            // La dérogation est tracée pour le gestionnaire, pas pour le
            // client : son échec ne doit pas annuler une embauche valide.
            context.error("demande/reembauche-derogation :", e);
          }
        }
        return { status: 202, jsonBody: { reference, ...(idFiche ? { idFiche: String(idFiche) } : {}), ...(reembauche ? { reprise: true } : {}) } };
      }

      // Bascule « connecteurs standard » (chantier fin du Premium,
      // docs/Flux-standard-ACP-ATT.md) : tant que la variable FLOW_URL_*
      // correspondante existe, le relais HTTP historique reste actif ;
      // dès qu'elle est retirée de la SWA, l'API écrit la liste et le
      // flux standard « à la création d'un élément » prend le relais.
      // Cutover par simple suppression de variable, réversible, sans
      // redéploiement. Prérequis : creer_listes_demarches.py exécuté.
      if (d.demarche === "acompte" && !process.env.FLOW_URL_ACOMPTE) {
        const nomSalarie = String(d.nomSalarie || `${d.nom || ""} ${d.prenom || ""}`).trim();
        if (nomSalarie.length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        const montant = Number(d.montant);
        if (!Number.isFinite(montant) || montant <= 0 || montant > 100000)
          return { status: 400, jsonBody: { erreur: "Montant invalide." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateVersement || "")))
          return { status: 400, jsonBody: { erreur: "Date de versement requise." } };
        // Avance sur salaire (26/08) : un PRÊT sur du travail à venir —
        // distinct de l'acompte (travail déjà fait, déduit en une fois).
        // Le remboursement est plafonné à un DIXIÈME du salaire par paie
        // (L.3251-3) : l'échéancier est calculé ici et stocké en clair
        // pour le gestionnaire de paie.
        let avance = null;
        if (d.typeVersement === "avance") {
          const A = require("../avance");
          const erreurs = A.valider({ montant, netMensuel: d.netMensuel, premierMois: d.premierMois });
          if (erreurs.length) return { status: 400, jsonBody: { erreur: erreurs[0] } };
          avance = A.echeancier({ montant, netMensuel: d.netMensuel,
            premierMois: d.premierMois || String(d.dateVersement).slice(0, 7) });
        }

        const reference = `${avance ? "AVANCE" : "ACOMPTE"}-${Date.now().toString(36).toUpperCase()}`;
        await creerElementDemarche("Acompte", {
          Title: nomSalarie,
          CodeClient: clientInfo.codeClient,
          Nom: String(d.nom || "").trim().toUpperCase().slice(0, 120),
          Prenom: String(d.prenom || "").trim().slice(0, 120),
          Montantdemande: Math.round(montant * 100) / 100,
          ...(Number.isFinite(Number(d.matricule)) ? { Matricule: Number(d.matricule) } : {}),
          DateVersement: d.dateVersement,
          Reference: reference,
          EmailDemandeur: email,
          EmailGestionnaire: clientInfo.emailGestionnaire || "",
          Statut: "Nouveau",
          ...(avance ? {
            TypeVersement: "Avance",
            NetMensuel: avance.netMensuel,
            Echeancier: require("../avance").resume(avance),
          } : {}),
        });
        return { status: 202, jsonBody: { reference, ...(avance ? { avance } : {}) } };
      }

      if (d.demarche === "attestation-employeur" && !process.env.FLOW_URL_ATTESTATION_EMPLOYEUR) {
        const nomSalarie = String(d.nomSalarie || "").trim();
        if (nomSalarie.length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!["Madame", "Monsieur"].includes(d.civilite))
          return { status: 400, jsonBody: { erreur: "Civilité requise." } };
        for (const [champ, libelle] of [["dateNaissance", "Date de naissance"], ["dateEntree", "Date d'entrée"]])
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d[champ] || "")))
            return { status: 400, jsonBody: { erreur: `${libelle} requise (AAAA-MM-JJ).` } };
        if (!d.poste || String(d.poste).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Poste requis." } };
        if (!["PDF", "Word"].includes(d.formatSouhaite))
          return { status: 400, jsonBody: { erreur: "Format souhaité invalide (PDF ou Word)." } };
        const reference = `ATTESTATION-${Date.now().toString(36).toUpperCase()}`;
        await creerElementDemarche("Demandes attestations", {
          Title: nomSalarie,
          Reference: reference,
          CodeClient: clientInfo.codeClient,
          EmailDemandeur: email,
          EmailGestionnaire: clientInfo.emailGestionnaire || "",
          Civilite: d.civilite,
          DateNaissance: d.dateNaissance,
          DateEntree: d.dateEntree,
          Poste: String(d.poste).trim().slice(0, 160),
          TypeContrat: String(d.typeContrat || "").trim().slice(0, 60),
          FormatSouhaite: d.formatSouhaite,
          RaisonSociale: clientInfo.raisonSociale || "",
          AdresseEntreprise: clientInfo.adresseEntreprise || "",
          Siret: clientInfo.siret || "",
          Representant: clientInfo.representant || "",
          FonctionRepresentant: clientInfo.fonctionRepresentant || "",
          LieuEdition: clientInfo.lieuEdition || "",
          Statut: "Reçue",
        });
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particulier « contact » : message au gestionnaire — JAMAIS
      // optionnel (le canal fait partie du service de base). Écrit dans
      // « Messages gestionnaire » ; le flux « + AR » notifie et accuse
      // réception, la réponse du gestionnaire part par e-mail classique.
      if (d.demarche === "contact") {
        if (!d.objet || String(d.objet).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Objet requis." } };
        if (!d.message || String(d.message).trim().length < 10)
          return { status: 400, jsonBody: { erreur: "Message trop court — précisez votre demande." } };
        const reference = `MSG-${Date.now().toString(36).toUpperCase()}`;
        await creerMessageGestionnaire(email, clientInfo, d, reference);
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particuliers « gestion du personnel » (absences, visite médicale,
      // mutuelle) : écriture directe dans la liste dédiée. Le flux « + AR »
      // attaché à chaque liste envoie l'accusé de réception au demandeur et
      // la notification au gestionnaire — l'API écrit donc les emails requis.
      if (d.demarche === "absences") {
        // Motifs fermés (nomenclature DSN, miroir de MOTIFS_ABSENCE du front) ;
        // true = justificatif exigé (arrêt, certificat…) dès la déclaration.
        const MOTIFS_ABSENCE = {
          "Maladie (arrêt de travail)": true,
          "Maladie professionnelle": true,
          "Accident du travail": true,
          "Accident de trajet": true,
          "Congé maternité": true,
          "Congé paternité / accueil de l'enfant": true,
          "Congé d'adoption": true,
          "Temps partiel thérapeutique": true,
          "Enfant malade": true,
          "Congés payés": false,
          "Congé sans solde": false,
          "Congé parental d'éducation": false,
          "Événement familial (mariage, naissance, décès…)": false,
          "Absence injustifiée": false,
          "Autre absence": false,
        };
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateDebut || "")))
          return { status: 400, jsonBody: { erreur: "Date de début requise." } };
        if (d.dateFin && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateFin)))
          return { status: 400, jsonBody: { erreur: "Date de fin invalide." } };
        if (!(d.motif in MOTIFS_ABSENCE))
          return { status: 400, jsonBody: { erreur: "Motif d'absence invalide — choisissez un motif de la liste." } };
        if (MOTIFS_ABSENCE[d.motif] && !String(d.justificatifUrl || "").trim())
          return { status: 400, jsonBody: { erreur: "Justificatif requis pour ce motif (arrêt de travail, certificat…)." } };

        // Accident du travail ou de trajet (25/08) : le volet accident
        // devient obligatoire — lieu, heure, circonstances, ce qui
        // s'oublie en six mois et que la DAT exigera mot pour mot. Les
        // deux horloges s'arment (48 h pour déclarer, 10 jours francs
        // pour les réserves) et le gestionnaire est prévenu DANS LA
        // MINUTE par le fil « Mon gestionnaire » : sur ce délai-là, le
        // flux d'échéances arriverait après la bataille.
        let accident = null;
        if (require("../accident").estAccident(d.motif)) {
          const A = require("../accident");
          const erreurs = A.valider(d);
          if (erreurs.length) return { status: 400, jsonBody: { erreur: erreurs[0] } };
          accident = { A, dos: A.dossier(d) };
        }

        const reference = `ABS-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Absences", email, clientInfo, d, reference, {
          DateDebut: d.dateDebut,
          ...(d.dateFin ? { DateFin: d.dateFin } : {}),
          Motif: d.motif,
          JustificatifUrl: String(d.justificatifUrl || "").trim().slice(0, 500),
          Statut: "Nouvelle",
          ...(accident ? accident.A.champs(d, accident.dos) : {}),
        });

        if (accident) {
          const salarie = String(d.salarie).trim();
          // Le message peut échouer sans faire échouer la déclaration :
          // la ligne est écrite, l'écran affiche les échéances — mais un
          // signal urgent perdu doit se voir dans les journaux.
          try {
            await creerMessageGestionnaire(email, clientInfo,
              accident.A.messageGestionnaire(d, accident.dos, salarie), reference);
          } catch (e) { context.error("absence/accident : message gestionnaire non envoyé —", e?.erreur || e?.message || e); }
          return { status: 202, jsonBody: { reference, accident: accident.dos } };
        }
        return { status: 202, jsonBody: { reference } };
      }

      if (d.demarche === "visite-medicale") {
        // Nature de la visite : miroir strict de TYPES_VISITE (front).
        // La reprise après arrêt est une obligation distincte du suivi
        // périodique — c'est elle qui éteint l'alerte correspondante.
        const TYPES_VISITE = ["Visite d'information et de prévention (embauche)", "Visite périodique", "Visite de reprise", "Visite de pré-reprise", "Visite à la demande"];
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateVisite || "")))
          return { status: 400, jsonBody: { erreur: "Date souhaitée requise." } };
        if (d.typeVisite && !TYPES_VISITE.includes(d.typeVisite))
          return { status: 400, jsonBody: { erreur: "Type de visite invalide — choisissez dans la liste." } };
        const reference = `VIS-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Visites médicales", email, clientInfo, d, reference, {
          DateVisite: d.dateVisite,
          TypeVisite: d.typeVisite || "Visite périodique",
          Statut: "À planifier",
        });
        return { status: 202, jsonBody: { reference } };
      }

      // Habilitations & CACES (23/08) : le client déclare une habilitation
      // (obtention ou recyclage) — une LIGNE PAR HABILITATION, l'historique
      // se conserve. La date d'expiration alimente les alertes de recyclage
      // (echeances.js : J-90/J-60/J-30 puis EXPIRÉE, sur la plus récente
      // par salarié + type).
      if (d.demarche === "habilitation") {
        // Les habilitations appartiennent à la brique SÉCURITÉ, future
        // option payante « securite ». Bascule commerciale SANS
        // redéploiement : poser SECURITE_STRICTE=1 dans la SWA — seule
        // l'option securite ouvrira alors la démarche. En transition,
        // l'option embauche suffit (clients actuels non impactés).
        const accesSecurite = clientInfo.options.includes("securite") ||
          (!process.env.SECURITE_STRICTE && clientInfo.options.includes("embauche"));
        if (!accesSecurite)
          return { status: 403, jsonBody: { erreur: "Option Sécurité (habilitations & CACES) non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!d.typeHabilitation || String(d.typeHabilitation).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Type d'habilitation requis." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateExpiration || "")))
          return { status: 400, jsonBody: { erreur: "Date de fin de validité requise (elle pilote les alertes de recyclage)." } };
        if (d.dateObtention && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateObtention)))
          return { status: 400, jsonBody: { erreur: "Date d'obtention invalide." } };
        if (d.dateObtention && String(d.dateExpiration) <= String(d.dateObtention))
          return { status: 400, jsonBody: { erreur: "La fin de validité doit être postérieure à l'obtention." } };
        const reference = `HAB-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Habilitations", email, clientInfo, d, reference, {
          TypeHabilitation: String(d.typeHabilitation).trim().slice(0, 120),
          Numero: String(d.numero || "").trim().slice(0, 60),
          Organisme: String(d.organisme || "").trim().slice(0, 120),
          ...(d.dateObtention ? { DateObtention: d.dateObtention } : {}),
          DateExpiration: d.dateExpiration,
        });
        return { status: 202, jsonBody: { reference } };
      }

      // Avenants au contrat (23/08) : demande de modification d'un contrat
      // en cours — le gestionnaire produit et fait signer l'avenant (même
      // circuit humain que les fins de contrat).
      if (d.demarche === "avenant") {
        const TYPES_AVENANT = ["Changement de poste / qualification", "Durée du travail", "Rémunération", "Lieu de travail", "Passage temps partiel / temps plein", "Télétravail", "Prolongation de CDD", "Renouvellement de période d'essai", "Autre modification"];
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!TYPES_AVENANT.includes(d.typeAvenant))
          return { status: 400, jsonBody: { erreur: "Type d'avenant invalide — choisissez dans la liste." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateEffet || "")))
          return { status: 400, jsonBody: { erreur: "Date d'effet souhaitée requise." } };
        if (!d.details || String(d.details).trim().length < 10)
          return { status: 400, jsonBody: { erreur: "Décrivez la modification souhaitée (nouveau poste, nouvel horaire, nouveau salaire…)." } };
        const reference = `AVE-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Avenants", email, clientInfo, d, reference, {
          TypeAvenant: d.typeAvenant,
          DateEffet: d.dateEffet,
          Details: String(d.details).trim().slice(0, 4000),
          Statut: "Nouvelle",
        });
        return { status: 202, jsonBody: { reference } };
      }

      if (d.demarche === "mutuelle") {
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!d.mutuelle || String(d.mutuelle).trim().length < 1)
          return { status: 400, jsonBody: { erreur: "Mutuelle requise." } };
        if (d.dateAdhesion && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateAdhesion)))
          return { status: 400, jsonBody: { erreur: "Date d'adhésion invalide." } };
        const reference = `MUT-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Adhésions mutuelles", email, clientInfo, d, reference, {
          Mutuelle: String(d.mutuelle).trim().slice(0, 120),
          DateAdhesion: d.dateAdhesion || new Date().toISOString().slice(0, 10),
          Statut: "Demande",
        });
        return { status: 202, jsonBody: { reference } };
      }
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("Verrou :", e);
      return { status: 502, jsonBody: { erreur: "Vérification du compte impossible, réessayez." } };
    }

    // 3. Démarche requise et résolution du flux cible
    if (!d.demarche || typeof d.demarche !== "string" || !d.demarche.trim())
      return { status: 400, jsonBody: { erreur: "Champ manquant : demarche" } };
    const cle = "FLOW_URL_" + d.demarche.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const flowUrl = process.env[cle];
    if (!flowUrl) {
      context.warn(`Démarche inconnue ou non configurée : ${d.demarche}`);
      return { status: 400, jsonBody: { erreur: "Démarche non reconnue" } };
    }

    // 4. Référence lisible, renvoyée au client et transmise au flux
    const reference = `${d.demarche.split("-")[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // 5. Relais enrichi : identité et données entreprise imposées par le serveur.
    //    Ce que le navigateur a déclaré pour email/client est écrasé.
    delete d.xq_note; delete d.website;
    const enrichi = {
      ...d,
      email,                                    // email VÉRIFIÉ (jeton)
      client: clientInfo.codeClient,            // client RÉSOLU (listes)
      raisonSociale: clientInfo.raisonSociale,
      adresseEntreprise: clientInfo.adresseEntreprise,
      siret: clientInfo.siret,
      representant: clientInfo.representant,
      fonctionRepresentant: clientInfo.fonctionRepresentant,
      lieuEdition: clientInfo.lieuEdition,
      emailGestionnaire: clientInfo.emailGestionnaire,
      reference,
      recuLe: new Date().toISOString(),
    };
    const r = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichi),
    });

    if (!r.ok) {
      const corps = (await r.text().catch(() => "")).slice(0, 200);
      context.error(`Relais flux ${cle} en échec : ${r.status} ${corps}`);
      return { status: 502, jsonBody: { erreur: `Relais vers le flux refusé → HTTP ${r.status}. ${r.status === 404 ? "URL de flux introuvable : flux désactivé, supprimé, ou URL erronée." : (r.status === 401 || r.status === 403) ? "Signature invalide : URL probablement tronquée au copier-coller." : corps}` } };
    }

    return { status: 202, jsonBody: { reference } };
  }
});

/* Crée ou complète la fiche « Salariés » lors d'une embauche : le
   référentiel s'auto-alimente avec le dossier complet du volet
   administratif. Recherche par CodeClient + nom/prénom normalisés
   (même clé que personnel.js) : trouvé → mise à jour, absent → création.
   Écriture STRICTE : une embauche ne rend jamais une référence si la
   fiche n'a pas pu être écrite. */
async function creerFicheSalarie(clientInfo, d) {
  const { items } = require("../annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Salariés"]) throw { status: 502, erreur: "Référentiel « Salariés » introuvable." };

  const nom = String(d.nom).trim().toUpperCase();
  const prenom = String(d.prenom).trim();
  const cleFiche = `${nom} ${prenom.toUpperCase()}`.trim();
  const existants = await items(tok, ids["Salariés"], "CodeClient,Nom,Prenom");
  const existant = existants.find((s) => s.CodeClient === clientInfo.codeClient &&
    `${String(s.Nom || "").trim().toUpperCase()} ${String(s.Prenom || "").trim().toUpperCase()}`.trim() === cleFiche);

  // Volet administratif FACULTATIF (modèle B) : un champ non transmis
  // n'est PAS écrit — une mise à jour (re-tentative, ré-embauche) ne
  // doit jamais effacer ce qu'Osmose a déjà transcrit depuis les pièces.
  const si = (col, val) => (String(val ?? "").trim() ? { [col]: val } : {});
  const fields = {
    Title: `${nom} ${prenom}`.trim(),
    CodeClient: clientInfo.codeClient,
    Nom: nom.slice(0, 120),
    Prenom: prenom.slice(0, 120),
    Poste: String(d.poste).trim().slice(0, 160),
    TypeContrat: d.typeContrat,
    DateEntree: d.dateDebut,
    ...(d.dateFin ? { DateSortie: d.dateFin } : {}),
    Statut: "Actif",
    AdressePostale: String(d.adressePostale).trim().slice(0, 250),
    NumeroSS: String(d.numeroSS).replace(/\s/g, "").slice(0, 15),
    DateNaissance: d.dateNaissance,
    NomNaissance: nom.slice(0, 120),
    ...si("Matricule", String(d.matricule || "").trim().slice(0, 40)),
    ...si("Email", String(d.emailSalarie || "").trim().toLowerCase().slice(0, 200)),
    ...si("Telephone", String(d.telephoneSalarie || "").trim().slice(0, 40)),
    ...si("Sexe", d.sexe),
    ...si("NomMarital", String(d.nomMarital || "").trim().slice(0, 120)),
    ...si("SituationFamiliale", d.situationFamiliale),
    ...si("DepartementNaissance", String(d.departementNaissance || "").trim().slice(0, 80)),
    ...si("CodeDepartementNaissance", String(d.codeDepartementNaissance || "").trim().toUpperCase().slice(0, 3)),
    ...si("PaysNaissance", String(d.paysNaissance || "").trim().slice(0, 80)),
    ...si("CodePaysNaissance", String(d.codePaysNaissance || "").trim().toUpperCase().slice(0, 2)),
    ...si("Iban", String(d.iban || "").replace(/\s/g, "").toUpperCase().slice(0, 34)),
    ...si("Bic", String(d.bic || "").replace(/\s/g, "").toUpperCase().slice(0, 11)),
    ...(d.bulletinDematerialise === true || d.bulletinDematerialise === false
      ? { BulletinDematerialise: d.bulletinDematerialise === true } : {}),
    // Nationalité (toujours utile au dossier) + titre de séjour pour les
    // salariés étrangers — l'expiration alimentera le suivi de
    // renouvellement.
    ...si("Nationalite", String(d.nationalite || "").trim().slice(0, 80)),
    ...si("TitreSejourType", String(d.titreSejourType || "").trim().slice(0, 60)),
    ...si("TitreSejourNumero", String(d.titreSejourNumero || "").trim().toUpperCase().slice(0, 40)),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(String(d.titreSejourExpiration || ""))
      ? { TitreSejourExpiration: d.titreSejourExpiration } : {}),
    ...si("TitreSejourPj", String(d.pjTitreSejour || "").trim().slice(0, 255)),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(String(d.finPeriodeEssai || ""))
      ? { FinPeriodeEssai: d.finPeriodeEssai } : {}),
  };

  const base = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items`;
  const r = existant
    ? await fetch(`${base}/${existant.id}/fields`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
    : await fetch(base, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
  if (!r.ok) throw { status: 502, erreur: "Création de la fiche salarié impossible — réessayez." };
  viderCacheItems();
  // L'id de la fiche permet d'enchaîner sur l'invitation d'onboarding
  // depuis l'écran de confirmation d'embauche.
  return existant ? existant.id : (await r.json().catch(() => ({}))).id || null;
}

/* Met à jour le dossier d'un salarié (liste « Salariés ») pour le client
   connecté. Chaque champ est validé et mappé sur sa colonne ; seuls les
   champs transmis sont modifiés (une chaîne vide efface). L'élément est
   relu AVANT écriture pour vérifier qu'il appartient bien au client —
   un id d'un autre client donne 404, jamais une fuite. */
const SEXES = ["", "Masculin", "Féminin"];
const SITUATIONS = ["", "Célibataire", "Marié(e)", "Pacsé(e)", "Divorcé(e)", "Séparé(e)", "Veuf(ve)", "Union libre"];

/* ── Salarié étranger (22/08) ─────────────────────────────────────────
   Un ressortissant hors UE/EEE/Suisse ne peut être embauché qu'avec un
   titre de séjour autorisant le travail, que l'employeur doit faire
   AUTHENTIFIER par la préfecture au moins 2 jours ouvrables avant
   l'embauche (art. L.8251-1 et R.5221-41 s. du code du travail).
   Détection et référentiels : brique autonome ../etrangers (source
   unique — le front duplique la même liste de radicaux). */
const { titreSejourRequis, TITRES_SEJOUR } = require("../etrangers");
async function majSalarie(clientInfo, d, context) {
  const id = String(d.id || "").trim();
  if (!/^\d+$/.test(id)) return { status: 400, jsonBody: { erreur: "Fiche salarié introuvable." } };
  const f = d.fiche || {};
  const txt = (v, max) => String(v ?? "").trim().slice(0, max);
  const dateOuVide = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");

  // Espaces retirés AVANT toute troncature (un NIR saisi « 2 90 04… »
  // dépasse 20 caractères avec ses espaces — couper d'abord mangerait
  // un chiffre).
  const nir = String(f.numeroSS ?? "").replace(/\s/g, "").slice(0, 15);
  if (nir && !/^[12]\d{12}(\d{2})?$/.test(nir))
    return { status: 400, jsonBody: { erreur: "Numéro de sécurité sociale invalide (13 ou 15 chiffres)." } };
  const iban = String(f.iban ?? "").replace(/\s/g, "").toUpperCase().slice(0, 34);
  if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban))
    return { status: 400, jsonBody: { erreur: "IBAN invalide." } };
  const bic = txt(f.bic, 11).replace(/\s/g, "").toUpperCase();
  if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))
    return { status: 400, jsonBody: { erreur: "BIC invalide." } };
  const email = txt(f.email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return { status: 400, jsonBody: { erreur: "Adresse e-mail invalide." } };
  if (!SEXES.includes(txt(f.sexe, 20)))
    return { status: 400, jsonBody: { erreur: "Sexe invalide." } };
  if (!SITUATIONS.includes(txt(f.situationFamiliale, 30)))
    return { status: 400, jsonBody: { erreur: "Situation familiale invalide." } };

  // Dossier OBLIGATOIRE (décision du 22/08) : un enregistrement incomplet
  // est refusé — miroir strict de la règle affichée par le portail.
  const REQUIS = {
    adressePostale: "adresse postale", numeroSS: "n° de sécurité sociale",
    dateNaissance: "date de naissance", sexe: "sexe",
    nomNaissance: "nom de naissance", situationFamiliale: "situation familiale",
    departementNaissance: "département de naissance",
    codeDepartementNaissance: "code département",
    paysNaissance: "pays de naissance", codePaysNaissance: "code pays",
    email: "e-mail", telephone: "téléphone", iban: "IBAN", bic: "BIC",
  };
  const valeurs = { ...f, numeroSS: nir, iban, bic, email, dateNaissance: dateOuVide(f.dateNaissance) };
  const manquants = Object.keys(REQUIS).filter((k) => !String(valeurs[k] ?? "").trim());
  if (manquants.length)
    return { status: 400, jsonBody: { erreur: `Champs obligatoires manquants : ${manquants.map((k) => REQUIS[k]).join(", ")}.` } };

  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const base = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${id}`;

  // Verrou de propriété : l'élément doit appartenir au client connecté.
  const rl = await fetch(`${base}?$expand=fields($select=CodeClient)`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!rl.ok) return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };
  const item = await rl.json();
  if (item.fields?.CodeClient !== clientInfo.codeClient)
    return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };

  const fields = {
    Matricule: txt(f.matricule, 40),
    AdressePostale: txt(f.adressePostale, 250),
    NumeroSS: nir,
    DateNaissance: dateOuVide(f.dateNaissance) || null,
    Sexe: txt(f.sexe, 20),
    NomNaissance: txt(f.nomNaissance, 120),
    NomMarital: txt(f.nomMarital, 120),
    SituationFamiliale: txt(f.situationFamiliale, 30),
    DepartementNaissance: txt(f.departementNaissance, 80),
    CodeDepartementNaissance: txt(f.codeDepartementNaissance, 3).toUpperCase(),
    PaysNaissance: txt(f.paysNaissance, 80),
    CodePaysNaissance: txt(f.codePaysNaissance, 2).toUpperCase(),
    Email: email,
    Telephone: txt(f.telephone, 40),
    Iban: iban,
    Bic: bic,
    BulletinDematerialise: f.bulletinDematerialise === true,
    // Nationalité et titre de séjour : FACULTATIFS (seuls les salariés
    // étrangers sont concernés par le titre) — hors de la règle REQUIS.
    Nationalite: txt(f.nationalite, 80),
    TitreSejourType: txt(f.titreSejourType, 60),
    TitreSejourNumero: txt(f.titreSejourNumero, 40).toUpperCase(),
    TitreSejourExpiration: dateOuVide(f.titreSejourExpiration) || null,
    // Suivi du contrat (facultatif) : période d'essai + visite médicale
    FinPeriodeEssai: dateOuVide(f.finPeriodeEssai) || null,
    PeriodiciteVisiteMois: /^\d{1,3}$/.test(String(f.periodiciteVisiteMois || "").trim())
      ? Number(f.periodiciteVisiteMois) : null,
    DerniereVisiteMedicale: dateOuVide(f.derniereVisiteMedicale) || null,
    DernierEntretienPro: dateOuVide(f.dernierEntretienPro) || null,
  };

  const r = await fetch(`${base}/fields`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    context.error("majSalarie :", r.status, corps);
    return { status: 502, jsonBody: { erreur: "Enregistrement de la fiche impossible — réessayez. (Colonnes du dossier absentes ? Relancer creer_site_rh.py.)" } };
  }
  viderCacheItems();
  return { status: 200, jsonBody: { ok: true } };
}

/* Écrit une ligne de démarche « standard » (Acompte, Demandes attestations) :
   champs déjà construits par l'appelant, réponse Graph vérifiée — le client
   ne reçoit jamais une référence pour une ligne qui n'a pas été écrite. */
async function creerElementDemarche(liste, fields) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[liste]) throw { status: 502, erreur: `Liste « ${liste} » introuvable — lancer creer_listes_demarches.py.` };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[liste]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: `Enregistrement dans « ${liste} » impossible — réessayez.`, detail: corps };
  }
}

/* Écrit un message client dans « Messages gestionnaire » (canal de contact).
   Même exigence que les autres écritures : réponse Graph vérifiée. */
async function creerMessageGestionnaire(email, clientInfo, d, reference) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Messages gestionnaire"]) throw { status: 502, erreur: "Canal gestionnaire indisponible." };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Messages gestionnaire"]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: String(d.objet).trim().slice(0, 255),
      Message: String(d.message).trim().slice(0, 4000),
      Reference: reference,
      CodeClient: clientInfo.codeClient,
      RaisonSociale: clientInfo.raisonSociale || "",
      EmailDemandeur: email,
      EmailGestionnaire: clientInfo.emailGestionnaire || "",
      Statut: "Nouveau",
    } }),
  });
  if (!r.ok) throw { status: 502, erreur: "Envoi du message impossible — réessayez." };
  viderCacheItems(); // le fil doit apparaître aussitôt dans « Mon gestionnaire »
}

/* Écrit une ligne « gestion du personnel » (Absences, Visites médicales,
   Adhésions mutuelles) : socle commun imposé par le serveur (identité client,
   référence, emails pour le flux d'accusé de réception) + champs spécifiques.
   Toute réponse non-2xx de Graph LÈVE une erreur : le client ne reçoit
   jamais une référence pour une ligne qui n'a pas été écrite. */
async function creerElementPersonnel(liste, email, clientInfo, d, reference, champs) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[liste]) throw { status: 502, erreur: `Liste « ${liste} » introuvable.` };
  const mots = String(d.salarie).trim().split(/\s+/);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[liste]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: String(d.salarie).trim().slice(0, 255),
      Reference: reference,
      CodeClient: clientInfo.codeClient,
      RaisonSociale: clientInfo.raisonSociale || "",
      SalarieNom: (mots[0] || "").toUpperCase(),
      SalariePrenom: mots.slice(1).join(" "),
      EmailDemandeur: email,
      EmailGestionnaire: clientInfo.emailGestionnaire || "",
      ...champs,
    } }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: `Enregistrement dans « ${liste} » impossible — réessayez.`, detail: corps };
  }
}


// Le fil « Mon gestionnaire » sert de signal urgent à d'autres modules
// (saisies.js). Requis à l'exécution seulement — jamais au chargement —,
// donc sans cycle : ce module est entièrement évalué avant tout appel.
module.exports = { creerMessageGestionnaire };
