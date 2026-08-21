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
