// src/components/AdminActivation.jsx — écran gestionnaire : activation des
// demandes d'accès en un clic. Affiché par AppShell quand /api/me renvoie
// { admin: true } (adresse dans ADMIN_EMAILS côté API).
// Chaque demande propose : rattacher à un client existant, OU créer le
// client (code, raison sociale, options, identité employeur) — l'API fait
// les deux écritures SharePoint et passe la demande en « Traitée ».
// Routage : la table de routage de la SWA actuelle n'accepte plus de
// nouvelle route (voir api/src/functions/me.js) — l'écran passe donc par
// les routes historiques : GET /api/me?vue=admin et POST /api/demande
// { action: "adminActiver" }. Fonctionne aussi sur la future SWA.

import React, { useEffect, useState } from "react";
import { LogOut, RefreshCw, UserCheck, UserPlus, Building2, Check } from "lucide-react";
import { apiFetch } from "../apiClient";

const T = {
  navy: "#0D1F33", accent: "#1668D9", bg: "#F4F6F9", card: "#FFFFFF",
  border: "#E3E8EF", ink: "#1A2433", mut: "#5C6B80", err: "#A8564A", ok: "#0F6E56",
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};
const champ = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", fontSize: 13,
  border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.sans, background: "#fff",
};
const LIBELLES_OPTIONS = {
  embauche: "Embauche (contrats, personnel, fins)", acompte: "Acomptes",
  attestation: "Attestations", paie: "Variables de paie",
};

const N_VIDE = {
  codeClient: "", raisonSociale: "", options: ["embauche"],
  adresseEntreprise: "", siret: "", representant: "",
  fonctionRepresentant: "", lieuEdition: "", emailGestionnaire: "",
};

/* Formulaire d'activation, deux usages :
   - avec `demande` : traitement d'une demande d'accès en attente ;
   - sans `demande` : création directe (pré-provisionnement d'un client
     signé — le gestionnaire saisit l'adresse, le client entrera
     directement dans son espace à sa première connexion). */
function FormulaireActivation({ demande, clients, options, onActivee, onClientCree, notifier }) {
  const creation = !demande;
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState(creation || !clients.length ? "nouveau" : "existant");
  const [codeExistant, setCodeExistant] = useState("");
  const [n, setN] = useState({
    ...N_VIDE, raisonSociale: demande?.entreprise || "", representant: demande?.nom || "",
  });
  const [envoi, setEnvoi] = useState(false);
  const majN = (k, v) => setN((p) => ({ ...p, [k]: v }));
  const basculerOption = (o) =>
    majN("options", n.options.includes(o) ? n.options.filter((x) => x !== o) : [...n.options, o]);

  const activer = async () => {
    const adresse = (creation ? email : demande.email).trim().toLowerCase();
    if (creation && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse))
      return notifier("Adresse e-mail du client invalide.");
    if (mode === "existant" && !codeExistant) return notifier("Choisissez le client à rattacher.");
    if (mode === "nouveau" && (!n.codeClient.trim() || !n.raisonSociale.trim()))
      return notifier("Code client et raison sociale sont requis.");
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminActiver",
          email: adresse,
          ...(demande ? { demandeId: demande.id } : {}),
          ...(mode === "existant" ? { codeClient: codeExistant } : { nouveau: n }),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notifier(j.erreur || `Activation refusée (HTTP ${r.status}).`); setEnvoi(false); return; }
      if (mode === "nouveau" && onClientCree) onClientCree(j.codeClient, n.raisonSociale.trim());
      if (creation) {
        setEmail(""); setCodeExistant(""); setN({ ...N_VIDE }); setEnvoi(false);
        notifier(`✓ ${adresse} rattaché à ${j.codeClient} — l'espace s'ouvrira dès sa première connexion.`);
      } else {
        notifier(`✓ ${adresse} rattaché à ${j.codeClient} — le client peut recharger sa page.`);
        onActivee(demande.id);
      }
    } catch {
      notifier("API injoignable — réessayez.");
      setEnvoi(false);
    }
  };

  const fr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
      {creation ? (
        <>
          <input style={champ} type="email" placeholder="Adresse e-mail du client *"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.mut }}>
            Le client devra créer son compte de connexion avec cette adresse exacte —
            c'est elle qui ouvre son espace.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div>
              <strong style={{ fontSize: 14.5 }}>{demande.nom || demande.email}</strong>
              <span style={{ color: T.mut, fontSize: 12.5 }}> — {demande.entreprise || "entreprise non précisée"}</span>
            </div>
            <span style={{ fontSize: 11.5, color: T.mut }}>{fr(demande.recueLe)}</span>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 12.5, color: T.mut }}>
            {demande.email}{demande.telephone ? ` · ${demande.telephone}` : ""}
          </p>
          {demande.message && (
            <p style={{ margin: "6px 0 0", fontSize: 12.5, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
              {demande.message}
            </p>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 14, margin: "14px 0 10px", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={mode === "existant"} onChange={() => setMode("existant")} disabled={!clients.length} />
          <UserCheck size={14} /> Client existant
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={mode === "nouveau"} onChange={() => setMode("nouveau")} />
          <Building2 size={14} /> Nouveau client
        </label>
      </div>

      {mode === "existant" ? (
        <select style={champ} value={codeExistant} onChange={(e) => setCodeExistant(e.target.value)}>
          <option value="">— Choisir le client —</option>
          {clients.map((c) => (
            <option key={c.codeClient} value={c.codeClient}>{c.codeClient} — {c.raisonSociale}</option>
          ))}
        </select>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <input style={champ} placeholder="Code client * (ex. DUPONT)" value={n.codeClient}
            onChange={(e) => majN("codeClient", e.target.value.toUpperCase())} />
          <input style={champ} placeholder="Raison sociale *" value={n.raisonSociale}
            onChange={(e) => majN("raisonSociale", e.target.value)} />
          <input style={{ ...champ, gridColumn: "1 / -1" }} placeholder="Adresse de l'entreprise (documents)"
            value={n.adresseEntreprise} onChange={(e) => majN("adresseEntreprise", e.target.value)} />
          <input style={champ} placeholder="SIRET" value={n.siret} onChange={(e) => majN("siret", e.target.value)} />
          <input style={champ} placeholder="Représentant (Prénom Nom)" value={n.representant}
            onChange={(e) => majN("representant", e.target.value)} />
          <input style={champ} placeholder="Fonction du représentant" value={n.fonctionRepresentant}
            onChange={(e) => majN("fonctionRepresentant", e.target.value)} />
          <input style={champ} placeholder="Lieu d'édition des documents" value={n.lieuEdition}
            onChange={(e) => majN("lieuEdition", e.target.value)} />
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, padding: "2px 0" }}>
            {options.map((o) => (
              <label key={o} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={n.options.includes(o)} onChange={() => basculerOption(o)} />
                {LIBELLES_OPTIONS[o] || o}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={activer} disabled={envoi} style={{
          all: "unset", cursor: envoi ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
          background: T.accent, color: "#fff", borderRadius: 8, padding: "9px 18px",
          fontSize: 13, fontWeight: 600, fontFamily: T.sans, opacity: envoi ? 0.7 : 1,
        }}>
          <Check size={15} /> {envoi ? "Activation…" : creation ? "Créer l'accès" : "Activer l'accès"}
        </button>
      </div>
    </div>
  );
}

export default function AdminActivation({ user, onLogout }) {
  const [donnees, setDonnees] = useState(null); // null | { demandes, clients, options } | { erreur }
  const [toast, setToast] = useState(null);
  const notifier = (m) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  const charger = () => {
    setDonnees(null);
    apiFetch("/api/me?vue=admin")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setDonnees(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setDonnees({ erreur: "API injoignable — rechargez la page." }));
  };
  useEffect(charger, []);

  const retirer = (id) =>
    setDonnees((d) => ({ ...d, demandes: d.demandes.filter((x) => x.id !== id) }));

  // Un client créé (avec ou sans demande) devient immédiatement proposable
  // en « client existant » dans les autres fiches, sans rechargement.
  const ajouterClient = (codeClient, raisonSociale) =>
    setDonnees((d) => d?.clients && !d.clients.some((c) => c.codeClient === codeClient)
      ? { ...d, clients: [...d.clients, { codeClient, raisonSociale }].sort((a, b) => a.codeClient.localeCompare(b.codeClient)) }
      : d);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <header style={{ background: T.navy, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: T.serif, fontSize: 18 }}>Osmose <em style={{ color: "#7FB0E8" }}>RH</em></span>
        <span style={{ fontSize: 12.5, color: "#9FB2C9" }}>Administration — demandes d'accès</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9FB2C9" }}>{user?.email}</span>
        <button onClick={charger} title="Actualiser" style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex" }}><RefreshCw size={15} /></button>
        <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "26px 18px 60px" }}>
        {donnees === null && <p style={{ color: T.mut, fontSize: 13.5 }}>Chargement des demandes…</p>}
        {donnees?.erreur && (
          <p style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            {donnees.erreur}
          </p>
        )}
        {donnees?.demandes && (
          donnees.demandes.length === 0 ? (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
              Aucune demande d'accès en attente. ✨
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: T.mut }}>
                {donnees.demandes.length} demande{donnees.demandes.length > 1 ? "s" : ""} en attente — l'activation crée la fiche client
                (si besoin), rattache le compte et passe la demande en « Traitée ».
              </p>
              {donnees.demandes.map((dem) => (
                <FormulaireActivation key={dem.id} demande={dem} clients={donnees.clients}
                  options={donnees.options} onActivee={retirer} onClientCree={ajouterClient} notifier={notifier} />
              ))}
            </div>
          )
        )}

        {donnees?.demandes && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
              <UserPlus size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />
              Nouveau client — accès sans demande
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Pour un client qui vient de signer : créez sa fiche et rattachez son adresse
              AVANT sa première connexion — il entrera directement dans son espace,
              sans demande d'accès ni attente.
            </p>
            <FormulaireActivation clients={donnees.clients} options={donnees.options}
              onClientCree={ajouterClient} notifier={notifier} />
          </section>
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.navy, color: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 13, maxWidth: "84%", boxShadow: "0 8px 30px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
