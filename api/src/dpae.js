// api/src/dpae.js — protocole « API DPAE » de l'URSSAF (régime général).
// Trois échanges, tous côté serveur (aucun identifiant ne sort d'Azure) :
//   1. authentifier() : POST XML <identifiants> sur mon.urssaf.fr — le compte
//      est un compte urssaf.fr HABILITÉ AU SERVICE « DPAE » (service 25 =
//      déclarant / tiers déclarant) ; la réponse est le jeton, en texte brut.
//   2. deposer()      : POST du message FR_DUE_Upload (norme repXML du guide
//      d'implémentation URSSAF), encodé ISO-8859-1 puis gzippé, en-tête
//      « Authorization: DSNLogin jeton=… » — la réponse contient l'idflux
//      (23 caractères) qui identifie le dépôt.
//   3. consulterRetour() : GET lister-retours-flux/{idflux} puis lecture des
//      bilans publiés — profil DPAE, etat_conformite OK (certificat) ou KO
//      (motif de refus). Les retours arrivent en général en moins d'une
//      minute : la consultation est UN essai par appel (pas de boucle de
//      10 min dans une Function) — le front re-demande jusqu'au bilan.
//
// Configuration (variables d'application de la SWA) :
//   DPAE_SIRET / DPAE_NOM / DPAE_PRENOM / DPAE_MDP : le compte urssaf.fr.
//   DPAE_MODE : "test" (indicateur 1 — contrôles réels, AUCUNE déclaration
//     enregistrée) ou "production" (indicateur 120). Absent = débranché.
//   DPAE_URL_AUTH / DPAE_URL_DEPOT / DPAE_URL_CONSULTATION : surcharges
//     éventuelles (bascule d'URL sans redéploiement).
// Références : guide d'implémentation API DPAE (dpae-edi.urssaf.fr, 5492) ;
// mise en œuvre vérifiée sur le client MIT wrapss/dpae-api-client.

const zlib = require("zlib");

const URLS = () => ({
  auth: process.env.DPAE_URL_AUTH || "https://mon.urssaf.fr/authentifier_dpae",
  depot: process.env.DPAE_URL_DEPOT || "https://depot.dpae-edi.urssaf.fr/deposer-dsn/1.0/",
  consultation: process.env.DPAE_URL_CONSULTATION || "https://consultation.dpae-edi.urssaf.fr/lister-retours-flux/2.0/",
});

function configuree() {
  return !!(process.env.DPAE_MODE && process.env.DPAE_SIRET && process.env.DPAE_NOM
    && process.env.DPAE_PRENOM && process.env.DPAE_MDP);
}

// 1 = environnement de contrôle (rien n'est enregistré), 120 = déclaration réelle.
const indicateurTest = () => (process.env.DPAE_MODE === "production" ? 120 : 1);

/* Échappement XML — toutes les valeurs passent par là avant le gabarit. */
const x = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/* Jeux de caractères admis par la norme (mêmes filtres que le guide) :
   l'employeur garde les minuscules accentuées, le salarié et les communes
   sont en capitales restreintes. Troncature à 32 comme le cahier technique. */
const nettoieEmployeur = (v) => String(v ?? "")
  .replace(/[^a-zA-Z0-9éèêëâàäöôûüîïç°²!#$%&'()*+,\-./:;<=>?@ ]/g, "").slice(0, 32);
const nettoieSalarie = (v) => String(v ?? "").toUpperCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Z' .&-]/g, "").slice(0, 32);
const nettoieCommune = (v) => String(v ?? "").toUpperCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Z0-9 .'-]/g, "").slice(0, 32);

/* Clé du NIR (les 2 chiffres de contrôle) : 97 − (NIR mod 97). Le NIR de
   13 chiffres peut contenir 2A/2B (Corse) — remplacés par 19/18 pour le
   calcul, conformément à la règle officielle. */
function cleNir(nir13) {
  const n = String(nir13).toUpperCase().replace("2A", "19").replace("2B", "18");
  if (!/^\d{13}$/.test(n)) return "";
  return String(97n - (BigInt(n) % 97n)).padStart(2, "0");
}

/* Construit le message FR_DUE_Upload (norme repXML) — champs déjà validés
   par l'appelant (admin.js). `d` : { employeur, salarie, contrat }. */
function construireMessage(d) {
  const e = d.employeur, s = d.salarie, c = d.contrat;
  const finContrat = c.nature === "CDD" || c.nature === "CTT" ? c.dateFin : "";
  return `<?xml version="1.0" encoding="ISO-8859-1" ?>
<FR_DUE_Upload xmlns:cct="urn:oasis:names:tc:ubl:corecomponentTypes:1.0:0.70"
    xmlns:rxdt="http://www.repxml.org/DataTypes"
    xmlns:rxorg="http://www.repxml.org/Organization"
    xmlns:rxpadr="http://www.repxml.org/PostalAddress"
    xmlns:rxpers="http://www.repxml.org/Person_Identity"
    xmlns:rxphadr="http://www.repxml.org/PhoneAddress"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" >
    <FR_DUE_Upload.Test.Indicator> ${indicateurTest()} </FR_DUE_Upload.Test.Indicator>
    <FR_DuesGroup>
        <FR_Employer>
            <FR_EmployerIdentity>
                <rxorg:FR_Organization.SIRET.Identifier> ${x(e.siret)} </rxorg:FR_Organization.SIRET.Identifier>
                <rxorg:FR_Organization.Designation.Text> ${x(nettoieEmployeur(e.designation))} </rxorg:FR_Organization.Designation.Text>
                <rxorg:FR_Organization.APE.Code> ${x(e.codeApe)} </rxorg:FR_Organization.APE.Code>
            </FR_EmployerIdentity>
            <FR_Employer.URSSAF.Code> ${x(e.codeUrssaf)} </FR_Employer.URSSAF.Code>
            <FR_EmployerAddress>
                <rxpadr:FR_PostalAddress.StreetDesignation.Text> ${x(nettoieEmployeur(e.adresse))} </rxpadr:FR_PostalAddress.StreetDesignation.Text>
                <rxpadr:FR_PostalAddress.Town.Text> ${x(nettoieEmployeur(e.ville))} </rxpadr:FR_PostalAddress.Town.Text>
                <rxpadr:FR_PostalAddress.Postal.Code> ${x(e.codePostal)} </rxpadr:FR_PostalAddress.Postal.Code>
            </FR_EmployerAddress>
            <FR_EmployerContact>
                <FR_PhoneNumber>
                    <rxphadr:FR_PhoneAddress.PhoneNumber.Text> ${x(e.telephone)} </rxphadr:FR_PhoneAddress.PhoneNumber.Text>
                </FR_PhoneNumber>
            </FR_EmployerContact>
        </FR_Employer>
        <FR_EmployeeGroup>
            <FR_Employee>
                <FR_EmployeeIdentity>
                    <rxpers:FR_PersonIdentity.Surname.Text> ${x(nettoieSalarie(s.nom))} </rxpers:FR_PersonIdentity.Surname.Text>
                    <rxpers:FR_PersonIdentity.ChristianName.Text> ${x(nettoieSalarie(s.prenom))} </rxpers:FR_PersonIdentity.ChristianName.Text>
                    <rxpers:FR_PersonIdentity.Sex.Code> ${x(s.sexe)} </rxpers:FR_PersonIdentity.Sex.Code>
                    <rxpers:FR_NNI>
                        <rxpers:FR_NNI.NIR.Identifier> ${x(s.nir)} </rxpers:FR_NNI.NIR.Identifier>
                        <rxpers:FR_NNI.NIRKey.Text> ${x(s.cleNir)} </rxpers:FR_NNI.NIRKey.Text>
                    </rxpers:FR_NNI>
                    <rxpers:FR_Birth>
                        <rxpers:FR_Birth.Date> ${x(s.dateNaissance)} </rxpers:FR_Birth.Date>
                        <rxpers:FR_Birth.Town.Text> ${x(nettoieCommune(s.communeNaissance))} </rxpers:FR_Birth.Town.Text>
                    </rxpers:FR_Birth>
                </FR_EmployeeIdentity>
                <FR_EmployeeComplement>
                    <FR_EmployeeComplement.Birth_Department.Code> ${x(s.departementNaissance)} </FR_EmployeeComplement.Birth_Department.Code>
                </FR_EmployeeComplement>
            </FR_Employee>
            <FR_Contract>
                <FR_Contract.StartContract.Date>${x(c.dateDebut)}</FR_Contract.StartContract.Date>
                <FR_Contract.StartContract.Time>${x(c.heureDebut)}</FR_Contract.StartContract.Time>
                <FR_Contract.EndContract.Date>${x(finContrat)}</FR_Contract.EndContract.Date>
                <FR_Contract.Nature.Code>${x(c.nature)}</FR_Contract.Nature.Code>
                <FR_Contract.HealthService.Text>${x(e.santeTravail || "01")}</FR_Contract.HealthService.Text>
            </FR_Contract>
        </FR_EmployeeGroup>
    </FR_DuesGroup>
</FR_DUE_Upload>`;
}

/* Jeton du service DPAE — redemandé à chaque action (il est court, et ne
   rien garder évite tout état entre exécutions de Functions). */
async function authentifier() {
  const corps = `<identifiants>
    <siret>${x(process.env.DPAE_SIRET)}</siret>
    <nom>${x(process.env.DPAE_NOM)}</nom>
    <prenom>${x(process.env.DPAE_PRENOM)}</prenom>
    <motdepasse>${x(process.env.DPAE_MDP)}</motdepasse>
    <service>25</service>
</identifiants>`;
  const r = await fetch(URLS().auth, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: corps,
  });
  if (r.status === 422) throw { status: 502, erreur: "URSSAF : authentification refusée — vérifiez le compte DPAE (variables DPAE_*) et son habilitation au service « DPAE »." };
  if (!r.ok) throw { status: 502, erreur: `URSSAF : authentification indisponible (HTTP ${r.status}).` };
  const jeton = (await r.text()).trim();
  if (jeton.length < 10) throw { status: 502, erreur: "URSSAF : jeton d'authentification invalide." };
  return jeton;
}

/* Dépose le message et rend l'idflux. */
async function deposer(jeton, xml) {
  const gz = zlib.gzipSync(Buffer.from(xml, "latin1"));
  const r = await fetch(URLS().depot, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      "Content-Encoding": "gzip",
      Authorization: `DSNLogin jeton=${jeton}`,
    },
    body: gz,
  });
  const texte = await r.text().catch(() => "");
  if (!r.ok) throw { status: 502, erreur: `URSSAF : dépôt refusé (HTTP ${r.status}) : ${texte.slice(0, 200)}` };
  const m = /idflux>(.*?)<\/idflux/.exec(texte);
  if (!m || m[1].length !== 23)
    throw { status: 502, erreur: `URSSAF : identifiant de flux introuvable dans la réponse : ${texte.slice(0, 200)}` };
  return m[1];
}

/* Consulte les retours d'un dépôt. Rend :
   { pret: false }                                — bilan pas encore publié ;
   { pret: true, conforme: true,  certificat }    — DPAE acceptée ;
   { pret: true, conforme: false, message }       — refusée (motif URSSAF). */
async function consulterRetour(jeton, idflux) {
  const entetes = { Authorization: `DSNLogin jeton=${jeton}` };
  const r = await fetch(`${URLS().consultation}${encodeURIComponent(idflux)}`, { headers: entetes });
  if (!r.ok) return { pret: false };
  let consultation;
  try { consultation = await r.json(); } catch { return { pret: false }; }
  const urls = [];
  for (const flux of consultation?.retours?.flux || [])
    for (const retour of flux.retour || [])
      if (retour.url) urls.push(retour.url);

  for (const url of urls) {
    const rb = await fetch(url, { headers: entetes });
    if (!rb.ok) continue;
    const bilan = await rb.text();
    if (!bilan.includes('profil="DPAE"')) continue;
    if (bilan.includes("<etat_conformite>KO</etat_conformite>")) {
      const motif = /<message>([\s\S]*?)<\/message>/.exec(bilan);
      return { pret: true, conforme: false, message: (motif ? motif[1] : "motif non précisé").trim().slice(0, 1500) };
    }
    if (bilan.includes("<etat_conformite>OK</etat_conformite>")) {
      const certif = /<certificat_conformite>(.*?)<\/certificat_conformite>/.exec(bilan);
      if (certif && certif[1].trim().length >= 10)
        return { pret: true, conforme: true, certificat: certif[1].trim() };
    }
  }
  return { pret: false };
}

module.exports = { configuree, indicateurTest, construireMessage, authentifier, deposer, consulterRetour, cleNir };
