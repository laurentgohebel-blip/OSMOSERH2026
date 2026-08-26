// tests/demo.spec.js — parcours complet du mode démonstration.
// La démo intercepte tous les appels /api/* : ces tests valident donc le
// portail (navigation, vues, formulaires) SANS toucher à Microsoft — et
// vérifient précisément qu'AUCUNE requête réseau /api/* ne part en démo.
import { test, expect } from "@playwright/test";

const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** Ouvre le portail et entre en démonstration depuis la page de connexion. */
async function entrerDemo(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Vous découvrez Osmose RH/ }).click();
  await expect(page.getByText("Bonjour Camille")).toBeVisible({ timeout: 10_000 });
}

test.describe("Mode démonstration", () => {
  let appelsApi;

  test.beforeEach(({ page }) => {
    appelsApi = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/")) appelsApi.push(u.pathname);
    });
  });

  test("la page de connexion propose la démonstration", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Se connecter ou créer un compte" })).toBeVisible();
    await expect(page.getByText("Explorer la démonstration")).toBeVisible();
    await expect(page.getByText("Mentions légales & confidentialité")).toBeVisible();
  });

  test("l'entrée en démo affiche le tableau de bord fictif — zéro appel /api", async ({ page }) => {
    await entrerDemo(page);
    await expect(page.getByText("Mode démonstration").first()).toBeVisible();
    await expect(page.getByText("Aux Délices de Provence").first()).toBeVisible();
    await expect(page.getByText("Acompte MOREAU Julien — 300 € à traiter")).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("les échéances de CDD fictives sont affichées", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Échéances" }).click();
    await expect(page.getByText("ROUX Thomas").first()).toBeVisible();
    await expect(page.getByText("Dans 18 j")).toBeVisible();
    await expect(page.getByText("BLANCHARD Emma").first()).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("l'effectif et la fiche salarié fonctionnent", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Gestion du personnel").first().click();
    for (const nom of ["BERTRAND Sophie", "MOREAU Julien", "BLANCHARD Emma", "FONTAINE Hugo"]) {
      await expect(page.getByText(nom).first()).toBeVisible();
    }
    await page.getByText("MOREAU Julien").first().click();
    await expect(page.getByText("CDI — Boulanger", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: /^Absences/ }).click();
    await expect(page.getByText("Maladie (arrêt de travail)").first()).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("déclarer une absence la fait apparaître dans la fiche", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Gestion du personnel").first().click();
    await page.getByText("MOREAU Julien").first().click();
    await page.getByRole("button", { name: /^Absences/ }).click();
    await page.getByRole("button", { name: "Déclarer une absence" }).click();

    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(dansNJours(7));
    await dates.nth(1).fill(dansNJours(11));
    await page.locator("select").last().selectOption({ label: "Congés payés" });
    await page.getByRole("button", { name: /Déclarer l'absence/ }).click();
    await expect(page.getByText(/réf\. ABS-/)).toBeVisible();

    // Le « ça vit » de la démo : l'absence est aussitôt dans le dossier.
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Gestion du personnel").first().click();
    await page.getByText("MOREAU Julien").first().click();
    await page.getByRole("button", { name: /^Absences \(2\)/ }).click();
    await expect(page.getByText("Congés payés").first()).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("réembaucher un ancien salarié : dossier repris et carence signalée", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Embauche", { exact: true }).first().click();
    await page.getByText("Il a déjà travaillé chez nous").click();

    // PEREZ sort d'un CDD récent : un nouveau CDD se heurte à la carence.
    await page.locator("select").first().selectOption("PEREZ Manon");
    await page.locator("select").nth(1).selectOption("CDD");
    await page.locator('input[type="date"]').first().fill(dansNJours(2));
    await page.locator('input[type="date"]').nth(1).fill(dansNJours(60));
    await page.getByPlaceholder("151,67").fill("151,67");

    // Ce que le client n'a PAS à ressaisir doit être dit explicitement.
    await expect(page.getByText(/Repris du dossier, rien à ressaisir/)).toBeVisible();
    await expect(page.getByText(/num[ée]ro de s[ée]curit[ée] sociale/)).toBeVisible();

    // Et ce que la loi impose doit être énoncé, chiffré.
    await expect(page.getByText("Délai de carence non respecté")).toBeVisible();
    await expect(page.getByText(/jours d'ouverture de l'entreprise/)).toBeVisible();

    // Un point bloquant n'interdit pas : il exige un motif.
    await page.getByRole("button", { name: /Demander le contrat/ }).click();
    await expect(page.getByText(/indiquez le motif/i)).toBeVisible();
    await page.locator("select").last().selectOption({ label: "Emploi saisonnier" });
    await page.getByRole("button", { name: /Demander le contrat/ }).click();
    await expect(page.getByText("Réembauche déclarée")).toBeVisible();
    await expect(page.getByText(/aucune pi[èe]ce [àa] red[ée]poser/i)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("planning d'équipe : poser un créneau et voir les heures du mois", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Planning d'équipe").first().click();
    await expect(page.getByRole("heading", { name: "Planning d'équipe" })).toBeVisible();

    // Le lien de pointage s'affiche : c'est ce que le client colle près de la porte.
    await expect(page.getByText(/Pointage sans matériel/)).toBeVisible();
    await expect(page.getByText(/\?pointage=/)).toBeVisible();

    // Poser un créneau sur le premier salarié, premier jour de la semaine.
    await page.locator("button:visible", { hasText: "+ ajouter" }).first().click();
    const valider = page.locator("button", { hasText: /^Ajouter$/ });
    await expect(valider).toBeVisible();
    await valider.click();
    await expect(page.getByText("09:00–17:00").first()).toBeVisible();

    // Les heures du mois se calculent depuis le planning.
    await page.getByRole("button", { name: /Voir les heures du mois/ }).click();
    await expect(page.getByText(/Heures calculées pour/)).toBeVisible();
    await page.getByRole("button", { name: /Transmettre ces heures/ }).click();
    await expect(page.getByText(/ligne.*transmise/)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("procédures : l'inaptitude affiche son compte à rebours et sa trame", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Procédures", { exact: true }).first().click();

    // Les quatre procédures sont proposées.
    await expect(page.getByText("Licenciement pour motif personnel").first()).toBeVisible();
    await expect(page.getByText("Sanction disciplinaire").first()).toBeVisible();
    await expect(page.getByText("Rupture conventionnelle individuelle").first()).toBeVisible();

    // Le dossier en cours porte l'alerte qui compte.
    await expect(page.getByText(/versement du salaire doit reprendre/)).toBeVisible();

    // Déplier montre la frise des étapes, dont celle marquée sans objet.
    await page.getByText("MOREAU Julien").first().click();
    await expect(page.getByText("Avis d'inaptitude du médecin du travail")).toBeVisible();
    await expect(page.getByText("Sans objet").first()).toBeVisible();
    await expect(page.getByText(/Obligation de moyens/)).toBeVisible();

    // La trame de courrier s'ouvre, avec son avertissement.
    await page.getByRole("button", { name: "Voir la trame du courrier" }).first().click();
    await expect(page.getByText(/À relire et à adapter/)).toBeVisible();
    await expect(page.getByText(/liste dressée par le préfet/)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("accident du travail : le volet se déplie et les 48 h s'affichent", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Absences", { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Déclarer une absence" })).toBeVisible();

    // Un motif ordinaire : pas de volet.
    await page.locator("select").last().selectOption("Congés payés");
    await expect(page.getByText("Les faits — pendant qu'ils sont frais")).not.toBeVisible();

    // Accident du travail : le volet se déplie, avec l'avertissement 48 h.
    await page.locator("select").last().selectOption("Accident du travail");
    await expect(page.getByText("Les faits — pendant qu'ils sont frais")).toBeVisible();
    await expect(page.getByText(/48 heures/).first()).toBeVisible();

    // Le remplir et déclarer.
    const salarie = page.locator("input[list], select").first();
    await page.getByPlaceholder(/Atelier, chantier/).fill("Atelier menuiserie");
    await page.getByPlaceholder(/L'activité en cours/).fill("Chute d'un escabeau en rangeant des panneaux en hauteur.");
    // Champs génériques : salarié, date de début, date d'accident.
    await page.locator("input[type=date]").first().fill(dansNJours(0));
    await page.locator("input[type=date]").nth(2).fill(dansNJours(0));
    // Le salarié via le champ dédié.
    await page.getByRole("combobox").first().selectOption({ index: 1 }).catch(async () => {
      await page.locator("input").first().fill("MARTIN Paul");
    });
    // Justificatif requis pour ce motif.
    await page.getByPlaceholder(/collez le lien/).fill("https://exemple/arret.pdf");
    await page.getByRole("button", { name: "Déclarer l'accident" }).click();

    // Les gestes s'affichent, dans l'ordre : feuille, DAT, réserves.
    await expect(page.getByText("Ce qu'il faut faire maintenant")).toBeVisible();
    await expect(page.getByText(/S6201/)).toBeVisible();
    await expect(page.getByText(/R\.441-3/)).toBeVisible();
    await expect(page.getByText(/dix jours francs/)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("notes de frais : la part exonérée, la part soumise, et la note bloquée", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Notes de frais", { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Notes de frais" })).toBeVisible();

    // Le lien à envoyer à l'équipe : c'est lui qui remplace l'enveloppe.
    await expect(page.getByText(/\?frais=/)).toBeVisible();

    // Les trois notes de la pile, et le motif qui bloque la troisième.
    await expect(page.getByText("Le Bistrot du Port")).toBeVisible();
    await expect(page.getByText(/Dépassement de 6\.90 €/)).toBeVisible();
    await expect(page.getByText(/Justificatif manquant/)).toBeVisible();

    // Valider en lot ne prend QUE ce qui est validable ; la note sans
    // ticket est écartée, avec son motif.
    await page.getByRole("button", { name: /Tout sélectionner/ }).click();
    await page.getByRole("button", { name: /^Valider/ }).click();
    await expect(page.getByText(/2 notes validées/)).toBeVisible();

    // Le récapitulatif sépare le remboursement net du brut soumis.
    await page.getByRole("button", { name: /Voir le récapitulatif/ }).click();
    await expect(page.getByText(/Ce qui partira en paie/)).toBeVisible();
    await expect(page.getByText(/Frais au-delà du plafond \(soumis\)/)).toBeVisible();
    await page.getByRole("button", { name: /Transmettre à mon gestionnaire/ }).click();
    await expect(page.getByText(/transmise/)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("saisie sur salaire : la quotité détaillée et la transmission", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    await page.getByText("Saisie sur salaire", { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Saisie sur salaire" })).toBeVisible();

    // Le dossier en cours : la retenue, le reste au salarié, l'échéancier.
    await expect(page.getByText("MARTIN — Saisie des rémunérations", { exact: false })).toBeVisible();
    await expect(page.getByText("236,94 €").first()).toBeVisible();
    await expect(page.getByText("1263,06 €")).toBeVisible();
    await expect(page.getByText(/en ~9 mois/)).toBeVisible();

    // Le détail par tranches se déplie, vérifiable au centime.
    await page.getByText(/Voir le calcul, tranche par tranche/).click();
    await expect(page.getByText("1/20")).toBeVisible();
    await expect(page.getByText(/646,52 € restent au salarié/)).toBeVisible();

    // La confidentialité et l'interdiction de sanctionner sont dites.
    await expect(page.getByText(/strictement confidentielle/)).toBeVisible();
    await expect(page.getByText(/Ne sanctionnez jamais/)).toBeVisible();

    // Transmettre la retenue du mois — puis refus du doublon.
    await page.getByRole("button", { name: /Transmettre la retenue/ }).click();
    await expect(page.getByText(/transmise en variables de paie/)).toBeVisible();
    await expect(page.getByRole("button", { name: /déjà transmise/ })).toBeDisabled();
    expect(appelsApi).toHaveLength(0);
  });

  test("les documents fictifs sont listés", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Documents" }).click();
    // La vue affiche un dossier à la fois : Contrats par défaut, puis Paie.
    await expect(page.getByText("Contrat_ROUX_Thomas_CDD.pdf")).toBeVisible();
    await page.getByRole("button", { name: /^Paie/ }).click();
    await expect(page.getByText("Bulletins_juin_2026.pdf")).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("la messagerie gestionnaire : fils, conversation, nouveau message", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Production" }).click();
    // Pastille non-lu sur la tuile (une réponse du gestionnaire attend).
    await expect(page.getByTitle("1 message non lu")).toBeVisible();
    await page.getByText("Mon gestionnaire").first().click();

    // La liste des fils, avec leurs statuts.
    await expect(page.getByRole("button", { name: /Question sur la paie/ })).toBeVisible();
    await expect(page.getByTitle("Réponse non lue")).toBeVisible();
    await expect(page.getByRole("button", { name: /Attestation pour la banque/ })).toBeVisible();
    await expect(page.getByText("Clos")).toBeVisible();

    // Le fil répondu : la réponse du gestionnaire est dans la conversation,
    // et l'ouvrir marque le fil lu (la pastille disparaît de la liste).
    await page.getByRole("button", { name: /Question sur la paie/ }).click();
    await expect(page.getByText(/régularisées sur le bulletin de juillet/)).toBeVisible();
    await expect(page.getByText("Votre gestionnaire — ", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Retour aux messages" }).click();
    await expect(page.getByTitle("Réponse non lue")).toHaveCount(0);

    // Répondre dans un fil ouvert : la réponse s'ajoute à la conversation.
    await page.getByRole("button", { name: /Transmission d'informations/ }).click();
    await page.getByPlaceholder("Répondre dans ce fil…").fill("L'avenant signé est déposé dans les documents.");
    await page.getByRole("button", { name: /^Répondre$/ }).click();
    await expect(page.getByText("L'avenant signé est déposé dans les documents.")).toBeVisible();
    await page.getByRole("button", { name: "Retour aux messages" }).click();

    // Un fil clos ne propose pas de réponse.
    await page.getByRole("button", { name: /Attestation pour la banque/ }).click();
    await expect(page.getByText(/Fil clos — pour une nouvelle demande/)).toBeVisible();
    await expect(page.getByPlaceholder("Répondre dans ce fil…")).toHaveCount(0);
    await page.getByRole("button", { name: "Retour aux messages" }).click();

    // Un nouveau message crée un fil, aussitôt en tête de liste.
    await page.getByRole("button", { name: "Nouveau message" }).click();
    await page.locator("select").selectOption({ label: "Demande de document" });
    await page.locator("textarea").fill("Pourriez-vous nous transmettre une copie du contrat de Léa Garcia ?");
    await page.getByRole("button", { name: /Envoyer le message/ }).click();
    await expect(page.getByText(/réf\. MSG-/)).toBeVisible();
    await page.getByRole("button", { name: "Voir mes messages" }).click();
    await expect(page.getByText(/Pourriez-vous nous transmettre une copie/)).toBeVisible();
    expect(appelsApi).toHaveLength(0);
  });

  test("quitter la démo revient à la connexion, sans démo rémanente", async ({ page }) => {
    await entrerDemo(page);
    await page.getByRole("button", { name: "Quitter la démonstration" }).click();
    await expect(page.getByRole("button", { name: "Se connecter ou créer un compte" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Se connecter ou créer un compte" })).toBeVisible();
    await expect(page.getByText("Mode démonstration")).toHaveCount(0);
  });

  test("l'entrée directe /?demo ouvre la démo et nettoie l'URL", async ({ page }) => {
    await page.goto("/?demo", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Bonjour Camille")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("demo=");
    expect(appelsApi).toHaveLength(0);
  });
});

test.describe("Page découvrir", () => {
  test("la page présente la vidéo et les deux boutons", async ({ page }) => {
    await page.goto("/decouvrir.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Osmose RH en 2 minutes")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(1);
    await expect(page.getByText("Explorer la démonstration interactive")).toBeVisible();

    const src = await page.locator("video source").getAttribute("src");
    const reponse = await page.request.get(src);
    expect(reponse.ok()).toBeTruthy();
    expect((await reponse.body()).length).toBeGreaterThan(1_000_000);
  });
});
