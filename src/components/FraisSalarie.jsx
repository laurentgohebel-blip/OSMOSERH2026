// src/components/FraisSalarie.jsx — la page que le salarié ouvre pour
// déposer une note de frais.
//
// Le geste tient en trois secondes : je choisis mon nom, je photographie
// le ticket, je vérifie ce que la lecture a trouvé, j'envoie. Pas de
// compte, pas de mot de passe, pas d'application à installer — le même
// principe que le pointage.
//
// L'OCR PRÉ-REMPLIT, IL NE DÉCIDE PAS. Tout ce qu'il propose reste
// modifiable, et un ticket illisible n'empêche jamais d'envoyer la note :
// on saisit alors les trois champs à la main, comme avant. Une lecture
// ratée fait perdre dix secondes, pas la note de frais.

import React, { useState, useEffect, useRef } from "react";

const T = {
  bg: "#F7F6F3", card: "#FFFFFF", ink: "#1D1B18", mut: "#6B6560",
  accent: "#0F5C4A", border: "#E3E0DA",
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
};

const vide = { categorie: "", date: "", montant: "", quantite: 1, tva: "", km: "", cv: "", commercant: "", motif: "" };

export default function FraisSalarie({ jeton }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [cle, setCle] = useState("");
  const [f, setF] = useState(vide);
  const [piece, setPiece] = useState(null);      // { nom } du fichier déposé
  const [lecture, setLecture] = useState(null);  // état de l'OCR
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const fichier = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/demande", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fraisDepot", mode: "info", jeton }),
        });
        const j = await r.json().catch(() => ({}));
        setEtat(r.ok ? { ...j } : { erreur: j.erreur || "Lien indisponible." });
      } catch { setEtat({ erreur: "Connexion impossible — réessayez dans un instant." }); }
    })();
  }, [jeton]);

  const categorie = (etat.categories || []).find((c) => c.cle === f.categorie);
  const surBareme = categorie?.regime === "bareme";
  const surForfait = categorie?.regime === "forfait";

  /* La photo part d'abord vers le dépôt, qui la range dans la GED du
     client et la fait lire au passage. Le fichier existe donc AVANT que
     la note ne soit créée : si le salarié abandonne ensuite, il reste
     un justificatif orphelin dans les documents, jamais une note fausse. */
  const photographier = async (file) => {
    if (!file) return;
    if (!cle) { setMsg({ erreur: "Choisissez d'abord votre nom." }); return; }
    setLecture({ enCours: true }); setMsg(null);
    try {
      const qui = (etat.salaries || []).find((s) => s.cle === cle);
      const url = `/api/depot?frais=${encodeURIComponent(jeton)}`
        + `&salarie=${encodeURIComponent(`${qui?.nom || ""} ${qui?.prenom || ""}`.trim())}`
        + `&nom=${encodeURIComponent(file.name)}&analyser=frais`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setLecture({ erreur: j.erreur || "Envoi de la photo impossible." }); return; }
      setPiece({ nom: j.nom });
      const champs = j.extraction?.champs;
      if (champs) {
        setF((x) => ({
          ...x,
          date: champs.date || x.date,
          montant: champs.montant != null ? String(champs.montant) : x.montant,
          tva: champs.tva != null ? String(champs.tva) : x.tva,
          commercant: champs.commercant || x.commercant,
        }));
        setLecture({ lu: true, devise: champs.devise || "" });
      } else {
        setLecture({ lu: false, motif: j.extraction?.motif || "" });
      }
    } catch { setLecture({ erreur: "Connexion impossible pendant l'envoi de la photo." }); }
  };

  const envoyer = async () => {
    if (!cle) { setMsg({ erreur: "Choisissez votre nom." }); return; }
    if (!f.categorie) { setMsg({ erreur: "Choisissez la nature du frais." }); return; }
    if (!f.date) { setMsg({ erreur: "Indiquez la date du frais." }); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await fetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fraisDepot", mode: "note", jeton, cle, ...f, justificatif: piece?.nom || "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ erreur: j.erreur || "Dépôt refusé." }); setEnvoi(false); return; }
      setMsg({ ok: true, reference: j.reference, points: j.points || [], qualification: j.qualification });
      setF(vide); setPiece(null); setLecture(null);
      if (fichier.current) fichier.current.value = "";
    } catch { setMsg({ erreur: "Connexion impossible — réessayez." }); }
    setEnvoi(false);
  };

  const cadre = { minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink, padding: 18,
    display: "flex", alignItems: "flex-start", justifyContent: "center" };
  const carte = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
    padding: "24px 20px", width: "100%", maxWidth: 460, margin: "18px 0" };
  const champ = { width: "100%", boxSizing: "border-box", padding: "13px 12px", fontSize: 16,
    border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff", fontFamily: T.sans, marginBottom: 12 };
  const label = { display: "block", fontSize: 12.5, color: T.mut, marginBottom: 5, fontWeight: 600 };

  if (etat.chargement) return <div style={cadre}><div style={carte}>Chargement…</div></div>;
  if (etat.erreur) {
    return (
      <div style={cadre}>
        <div style={{ ...carte, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, fontFamily: T.serif, margin: "0 0 10px" }}>Dépôt indisponible</h1>
          <p style={{ fontSize: 13.5, color: T.mut, margin: 0 }}>{etat.erreur}</p>
          <p style={{ fontSize: 12.5, color: T.mut, marginTop: 12 }}>Remettez votre ticket à votre responsable.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={cadre}>
      <div style={carte}>
        <p style={{ fontSize: 12, color: T.accent, fontWeight: 600, margin: "0 0 2px", letterSpacing: 0.4 }}>NOTE DE FRAIS</p>
        <h1 style={{ fontSize: 20, fontFamily: T.serif, fontWeight: 600, margin: "0 0 18px" }}>{etat.raisonSociale}</h1>

        {msg?.ok && (
          <div style={{ background: "#E1F5EE", border: "1px solid #B7E4D4", color: "#085041", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Note enregistrée</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>
              Référence {msg.reference}. Elle attend la validation de votre employeur.
            </div>
            {(msg.points || []).filter((p) => p.niveau === "bloquant").map((p, i) => (
              <div key={i} style={{ fontSize: 12, marginTop: 6, color: "#7A4A05" }}>À compléter : {p.texte}</div>
            ))}
          </div>
        )}
        {msg?.erreur && (
          <div style={{ background: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F", borderRadius: 10, padding: "11px 13px", marginBottom: 14, fontSize: 13 }}>
            {msg.erreur}
          </div>
        )}

        <label style={label}>Votre nom</label>
        <select value={cle} onChange={(e) => { setCle(e.target.value); setMsg(null); }} style={champ}>
          <option value="">— choisir —</option>
          {(etat.salaries || []).map((s) => <option key={s.cle} value={s.cle}>{s.prenom} {s.nom}</option>)}
        </select>

        {/* La photo, en premier : c'est elle qui remplit le reste. */}
        <label style={label}>Photo du ticket</label>
        <input ref={fichier} type="file" accept="image/*,application/pdf" capture="environment"
          onChange={(e) => photographier(e.target.files?.[0])} style={{ ...champ, padding: "10px 12px", fontSize: 14 }} />
        {lecture?.enCours && <p style={{ fontSize: 12.5, color: T.mut, margin: "-6px 0 12px" }}>Lecture du ticket…</p>}
        {lecture?.lu && (
          <p style={{ fontSize: 12.5, color: T.accent, margin: "-6px 0 12px" }}>
            Ticket lu — vérifiez les montants ci-dessous.
            {lecture.devise && ` Attention : ticket en ${lecture.devise}, convertissez le montant en euros.`}
          </p>
        )}
        {lecture && lecture.lu === false && (
          <p style={{ fontSize: 12.5, color: T.mut, margin: "-6px 0 12px" }}>
            Photo enregistrée, mais rien n'a pu être lu automatiquement — saisissez les champs ci-dessous.
          </p>
        )}
        {lecture?.erreur && <p style={{ fontSize: 12.5, color: "#791F1F", margin: "-6px 0 12px" }}>{lecture.erreur}</p>}

        <label style={label}>Nature du frais</label>
        <select value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} style={champ}>
          <option value="">— choisir —</option>
          {(etat.categories || []).map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}
        </select>
        {categorie && <p style={{ fontSize: 12, color: T.mut, margin: "-6px 0 12px", lineHeight: 1.5 }}>{categorie.aide}</p>}

        <label style={label}>Date du frais</label>
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={champ} />

        {surBareme ? (
          <>
            <label style={label}>Kilomètres parcourus</label>
            <input type="number" inputMode="numeric" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} style={champ} />
            <label style={label}>Puissance fiscale de votre véhicule (CV)</label>
            <input type="number" inputMode="numeric" placeholder="5" value={f.cv} onChange={(e) => setF({ ...f, cv: e.target.value })} style={champ} />
            <label style={label}>Objet du déplacement</label>
            <input value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })}
              placeholder="Chantier Hyères, client Durand…" style={champ} />
          </>
        ) : (
          <>
            <label style={label}>Montant payé (€)</label>
            <input type="number" inputMode="decimal" step="0.01" value={f.montant}
              onChange={(e) => setF({ ...f, montant: e.target.value })} style={champ} />
            {surForfait && (
              <>
                <label style={label}>Nombre de {categorie.unite || "unités"}</label>
                <input type="number" inputMode="numeric" min="1" value={f.quantite}
                  onChange={(e) => setF({ ...f, quantite: e.target.value })} style={champ} />
              </>
            )}
            <label style={label}>Commerçant</label>
            <input value={f.commercant} onChange={(e) => setF({ ...f, commercant: e.target.value })} style={champ} />
            <label style={label}>TVA (€) — facultatif</label>
            <input type="number" inputMode="decimal" step="0.01" value={f.tva}
              onChange={(e) => setF({ ...f, tva: e.target.value })} style={champ} />
          </>
        )}

        <button onClick={envoyer} disabled={envoi}
          style={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", textAlign: "center",
            background: T.accent, color: "#fff", fontSize: 17, fontWeight: 600, padding: "18px 0",
            borderRadius: 12, cursor: "pointer", opacity: envoi ? 0.6 : 1, marginTop: 4 }}>
          {envoi ? "Envoi…" : "Envoyer ma note de frais"}
        </button>

        <p style={{ fontSize: 11.5, color: T.mut, textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>
          Rien n'est remboursé sans la validation de votre employeur. Conservez le ticket original
          jusqu'au versement.
        </p>
      </div>
    </div>
  );
}
