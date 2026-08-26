# Rupture d'essai, abandon de poste, avance sur salaire

Livrés le 26 août 2026 · `VERSION_API = 2026-08-26-rupture-essai-abandon-avance`

---

## 1. Deux procédures de plus dans la brique Procédures

Le catalogue passe de quatre à **six** — mêmes mécanique, écrans et alertes.

### Rupture de la période d'essai (`rupture-essai`)

Le geste le plus fréquent en TPE, et le piège est le **délai de prévenance**
(L.1221-25), qui dépend de la présence du salarié :

| Présence | Prévenance |
|---|---|
| moins de 8 jours | 24 h |
| 8 jours → 1 mois | 48 h |
| après 1 mois | 2 semaines |
| après 3 mois | 1 mois |

Le moteur des procédures sait désormais exprimer un **délai calculé** :
`jours` d'une contrainte peut être une fonction des dates déjà posées —
ici la présence (entrée → notification) choisit la durée. Deux gardes-fous
énoncés en clair :

- notifier **après la fin de l'essai** → hors délai, avec l'avertissement :
  ce n'est plus une rupture d'essai, c'est un licenciement ;
- une prévenance qui **déborde la fin de l'essai** → alerte dédiée : le
  contrat s'arrête à la fin de l'essai, le reliquat se paie en indemnité
  compensatrice (sauf faute grave).

Trame de courrier `rupture-essai` : la lettre donne la date de fin et
**interdit de motiver** — motiver ouvre un terrain disciplinaire ou
discriminatoire.

À l'ouverture, la date qui arme l'horloge est la **date d'entrée** du
salarié ; la fin d'essai se pose ensuite dans la frise.

### Abandon de poste — présomption de démission (`abandon-poste`)

Depuis 2023 (L.1237-1-1, R.1237-13) : mise en demeure de reprendre le
poste ou de justifier l'absence, délai de réponse **d'au moins 15 jours
calendaires à compter de la première présentation**, puis démission
présumée à l'expiration. La forme ratée = licenciement sans cause.

Étapes : constat de l'absence injustifiée (arme l'horloge à l'ouverture) →
envoi de la mise en demeure (trame fournie, citant les textes et la
présomption) → première présentation → expiration du délai (≥ 15 jours,
un délai raccourci est signalé en **irrégularité** — c'est le vice qui
fait tomber la présomption) → constat de la démission → documents de fin
de contrat. Les aides rappellent les cas où la présomption tombe (arrêt
maladie, grève, droit de retrait, justification).

## 2. L'avance sur salaire — le cousin de l'acompte

Dans la tuile **Acompte**, une bascule : *Acompte — travail déjà
effectué* / *Avance — prêt sur travail à venir*.

L'acompte se déduit en une fois. L'**avance** est un prêt : elle ne se
rembourse que par retenues plafonnées à **un dixième du salaire par paie**
(L.3251-3) — même si le salarié est d'accord pour plus. Le patron qui
prête 1 000 € et les retient d'un coup est en tort.

Le portail calcule l'**échéancier** (moteur pur `api/src/avance.js`) :
retenue mensuelle = net/10, nombre de mois, dernier mois qui solde au
centime, mois enchaînés à cheval sur l'année. Il s'affiche en aperçu avant
l'envoi, en détail dans la confirmation, et il est **stocké en clair**
avec la demande (colonne `Echeancier`) — le gestionnaire de paie le lit
tel quel. Le départ anticipé est prévu : le solde se retient sur le solde
de tout compte (la limite du dixième ne s'y applique pas).

Assiette dite honnêtement : le dixième est appliqué au **net mensuel
déclaré** — l'assiette usuelle en paie TPE, le gestionnaire ajuste au
bulletin près.

## À faire côté SharePoint

1. **Relancer `creer_site_rh.py`** — la colonne `TypeProcedure` de la
   liste Procédures gagne les deux nouveaux choix.
2. **Relancer `creer_listes_demarches.py`** (l'AUTRE script, celui des
   démarches standard) — la liste Acompte gagne `TypeVersement`,
   `NetMensuel`, `Echeancier`. Tant qu'il n'est pas passé, une demande
   d'AVANCE échouera à l'écriture ; les acomptes ordinaires ne sont pas
   affectés.

Aucune variable SWA, aucun changement Power Automate.

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `api/src/procedures.js` | 2 procédures, délais-fonctions dans `borne()`, avertissement `indemnite-prevenance`, 2 trames, ctx enrichi |
| `api/src/avance.js` | moteur pur de l'échéancier du dixième |
| `api/src/functions/demande.js` | démarche acompte : branche `typeVersement:"avance"` |
| `src/components/AppShell.jsx` | bascule acompte/avance + aperçu + confirmation avec échéancier ; DEPART des 2 procédures |
| `src/demo/modeDemo.js` | catalogue à 6 + échéancier d'avance en démo |
| `src/scripts/creer_site_rh.py` / `creer_listes_demarches.py` | choix et colonnes |

## Recette

- `simu-procedures2.js` — 23 vérifications : les quatre paliers de
  prévenance, absence de borne sans date d'entrée, notification hors
  essai, débordement → indemnité, les 15 jours de l'abandon (délai
  raccourci = irrégularité), trames, non-régression des quatre procédures
  d'origine (une attente du banc corrigée : le samedi est ouvrable).
- `simu-avance.js` — 16 vérifications : échéancier au centime, mois à
  cheval sur l'année, petite avance, division exacte, résumé pour la paie.
- `simu-procedures.js` (banc d'origine) — vert, catalogue passé à six.
- Playwright **18/18**, dont deux parcours neufs en démonstration.
