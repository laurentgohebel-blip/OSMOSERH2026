# Saisie sur salaire

Livrée le 26 août 2026 · `VERSION_API = 2026-08-26-saisie-sur-salaire`

---

## Le moment

Un courrier de commissaire de justice arrive : procès-verbal de saisie des
rémunérations pour un salarié. Le patron n'y est pour rien, mais c'est lui
qui doit tout faire :

| Obligation | Délai / règle | Risque |
|---|---|---|
| **Répondre** au commissaire de justice (contrat, rémunération, autres saisies) | **15 jours** | amende civile jusqu'à 10 000 €, et être déclaré personnellement débiteur |
| **Retenir** la quotité saisissable — ni plus, ni moins | chaque mois | trop : responsable envers le salarié ; pas assez : envers le créancier |
| **Verser** au commissaire de justice répartiteur | chaque mois | — |
| Ne **jamais** sanctionner le salarié pour ce motif | toujours | discrimination interdite |

Depuis la réforme du **1ᵉʳ juillet 2025**, la procédure est conduite par les
commissaires de justice (plus par le tribunal). Le barème de fond n'a pas
changé : il reste fixé par décret, revalorisé chaque année.

Aucun SIRH du marché TPE ne fait ce calcul. C'est un geste de cabinet — et
c'est pour ça qu'il est dans le portail.

## Le barème est daté — millésime 2026 chargé et vérifié

Une seule table, `BAREMES` en tête de `api/src/saisie.js`, indexée par
millésime. **Le millésime 2026 est chargé et vérifié à la source**
(décret n° 2025-1299 du 24 décembre 2025, JORF du 26/12/2025, confronté à
Légifrance le 26/08/2026) :

| Tranche annuelle | Fraction saisissable |
|---|---|
| jusqu'à 4 480 € | 1/20 |
| 4 480 → 8 730 € | 1/10 |
| 8 730 → 13 000 € | 1/5 |
| 13 000 → 17 230 € | 1/4 |
| 17 230 → 21 470 € | 1/3 |
| 21 470 → 25 810 € | 2/3 |
| au-delà | totalité |

Majoration de **1 740 €/an** par personne à charge · plancher RSA
**651,69 €/mois** (revalorisation d'avril 2026). Le millésime 2025 reste en
table pour les calculs rétroactifs (écrit de mémoire, non confronté).

Comme pour les notes de frais : une année sans millésime chargé s'affiche
avec un bandeau d'avertissement et `aVerifier: true`. Personne ne signe un
chiffre périmé sans le savoir. La mise à jour annuelle = ajouter une clé
`2026: {…}` dans la table.

## Le calcul

- **Saisie ordinaire** : quotité par **tranches mensuelles** (barème annuel
  /12), seuils décalés par personne à charge, détaillée **ligne par ligne**
  dans l'écran — le patron vérifie au centime, pas de boîte noire. Chaque
  part de tranche est arrondie avant cumul : le total est la somme exacte
  des lignes affichées.
- **Plancher absolu** : quoi qu'il arrive, le montant du RSA pour une
  personne seule reste au salarié. Un net sous ce plancher → retenue nulle,
  et l'écran le dit.
- **Pension alimentaire (paiement direct)** : hors barème — tout ce qui
  dépasse le plancher RSA peut être pris, dans la limite de la mensualité.
  Pas d'échéancier : elle est due chaque mois. Si le salaire ne couvre pas
  la mensualité, l'insuffisance est annoncée (à signaler au commissaire).
- **Échéancier** (saisie) : restant dû ÷ retenue mensuelle → nombre de mois
  et montant du dernier mois, qui solde exactement.

## Le circuit

1. **Déclarer** : salarié, nature (saisie / pension), montant, net mensuel,
   personnes à charge, date de réception. Le **gestionnaire est prévenu dans
   la minute** par le fil « Mon gestionnaire » (objet 🔴 avec la date limite
   des 15 jours) — c'est lui qui prépare la réponse.
2. **Chaque mois, un clic** : la retenue part en variables de paie
   (nouvelle colonne `SaisieArret`), avec le restant dû en commentaire. Un
   même mois ne part jamais deux fois. Le cumul avance ; le dernier mois
   retient exactement le restant, et le dossier passe **Soldée** tout seul.
3. **Actualiser** : le net change, une personne à charge de plus — la
   quotité suit la vie réelle.
4. **Clore** : mainlevée, départ du salarié.

**V1, dit honnêtement** : un dossier actif par salarié. Le cumul de
plusieurs saisies obéit à des règles de rang (la pension prime, la saisie se
calcule sur le reste) : le portail refuse le second dossier et renvoie au
gestionnaire au lieu de calculer faux.

## Confidentialité

Une saisie en dit long sur la vie d'un salarié. Cloisonnée par `CodeClient`,
visible nulle part ailleurs dans le portail, et l'écran rappelle qu'elle ne
regarde que ceux qui traitent la paie — et qu'on ne sanctionne jamais un
salarié pour ce motif.

## À faire côté SharePoint

**Relancer `creer_site_rh.py`** — il crée la liste **« Saisies sur
salaire »** et ajoute la colonne **`SaisieArret`** à « Variables de paie ».
Rien d'autre : ni variable SWA, ni changement Power Automate (le signal
urgent passe par le fil « Mon gestionnaire » existant).

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `api/src/saisie.js` | calcul pur : barème daté, quotité par tranches, pension, échéancier, obligations |
| `api/src/saisies.js` | accès données : déclarer, transmettre, actualiser, clore |
| `api/src/functions/demande.js` | `{action:"saisie"}` (option paie) + export de `creerMessageGestionnaire` |
| `api/src/annuaire.js` | `creerVariablesPaie` porte `SaisieArret` |
| `src/components/AppShell.jsx` | tuile « Saisie sur salaire » (bloc paie) + écran `SaisieSalaire` |
| `src/demo/modeDemo.js` | dossier fictif avec calcul détaillé |
| `src/scripts/creer_site_rh.py` | liste + colonne |

Doctrine des routes respectée : aucune route nouvelle.

## Recette

- `simu-saisie.js` — 43 vérifications du calcul pur : tranches (vérifiées à
  la main), majoration par charge, plancher RSA, pension plafonnée,
  échéancier qui solde au centime, horloge des 15 jours avec report du
  15 août. Un vrai bug attrapé : un restant dû de zéro était traité comme
  une dette absente (retenue jamais nulle).
- `simu-saisies.js` — 35 vérifications de l'accès données : cloisonnement,
  message gestionnaire, refus du doublon de mois, extinction automatique,
  pension jamais soldée, refus du second dossier actif.
- `tests/demo.spec.js` — 16/16, dont le parcours complet en démonstration.
