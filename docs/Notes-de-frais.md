# Notes de frais

Livrée le 25 août 2026 · `VERSION_API = 2026-08-25-notes-de-frais`

---

## Ce que la brique remplace

L'enveloppe de tickets et le tableur de fin de mois. Le salarié photographie
son ticket avec son téléphone, la lecture automatique en tire l'enseigne, la
date, le montant et la TVA, et la note arrive dans le portail de l'employeur.
Celui-ci valide en lot, et le récapitulatif part directement en variables de
paie.

## Ce qui la distingue d'un simple remboursement

Rembourser un ticket, n'importe quel tableur le fait. Ce qui se paie cher,
c'est la **qualification** du frais — premier motif de redressement URSSAF
dans les petites entreprises. Trois questions à chaque ligne :

1. le frais est-il professionnel ?
2. est-il remboursé **au réel** (justificatif obligatoire, montant libre) ou
   **au forfait** (pas de justificatif, mais limite d'exonération) ?
3. et surtout : **la part qui dépasse la limite d'exonération n'est pas un
   frais, c'est du salaire.** Soumise à cotisations, à porter en brut.

Un employeur qui rembourse 30 € un repas au restaurant ne fait pas une
générosité : il verse 8,90 € de complément de salaire non déclaré, et il le
découvre trois ans plus tard.

Le portail ne décide de rien : il calcule les deux parts, les nomme, et les
envoie **séparément** en paie — `FraisPro` pour le remboursement net,
`PrimeMontant` libellé « Frais au-delà du plafond (soumis) » pour le reste.
L'employeur reste libre de rembourser au-delà ; il sait simplement ce que ça
coûte.

---

## ⚠ Les barèmes sont datés — à actualiser chaque année

Les plafonds d'exonération et le barème kilométrique vivent dans **une seule
table**, `BAREMES` en tête de `api/src/frais.js`, indexée par millésime. Les
valeurs enregistrées sont **celles du millésime 2025**.

**Avant de retenir un millésime 2026, chaque ligne doit être confrontée à la
publication officielle de l'année** (plafonds URSSAF pour les frais
professionnels, barème kilométrique de l'administration fiscale). Ces montants
n'ont aucune valeur s'ils ne sont pas vérifiés à la source.

Le code est honnête là-dessus : quand l'année demandée dépasse le dernier
millésime connu, le calcul se fait sur le dernier connu **et le dit** —
`baremeAVerifier: true`. L'écran affiche alors un bandeau d'avertissement, et
la note porte un point de vigilance. Personne ne signe un chiffre périmé sans
le savoir.

La mise à jour annuelle est **une seule modification**, au même endroit :
ajouter une clé `2026: { … }` dans `BAREMES`.

### Ce que la table contient (millésime 2025)

| Poste | Limite journalière |
|---|---|
| Repas au restaurant (déplacement) | 21,10 € |
| Repas hors des locaux, sans restaurant | 10,30 € |
| Repas sur le lieu de travail (panier) | 7,40 € |
| Nuitée — Paris et 92 / 93 / 94 | 74,30 € |
| Nuitée — autres départements | 55,10 € |
| Allocation télétravail | 2,70 €/jour, 59,40 €/mois |

Barème kilométrique voitures, par puissance fiscale (3 à 7 CV et plus) et par
tranche annuelle (≤ 5 000 km, 5 001–20 000 km, > 20 000 km).

---

## Les douze catégories et leur régime

| Régime | Ce qu'il implique | Catégories |
|---|---|---|
| **réel** | montant libre, **justificatif obligatoire**, aucune limite | hébergement, transport, carburant, fournitures, autre |
| **forfait** | allocation sans justificatif, **plafonnée** par jour ou par nuitée | les trois repas, les deux nuitées, le télétravail |
| **barème** | le montant n'est pas déclaré, il est **calculé** | indemnité kilométrique |

---

## Les contrôles

Trois familles, et elles n'ont pas le même poids. Aucun contrôle ne refuse
tout seul : l'employeur décide, toujours.

**Bloquants** — la note ne peut pas être validée en l'état :
date absente ou dans le futur · catégorie non qualifiée · montant nul ·
justificatif manquant sur un frais au réel · objet du déplacement non précisé
sur une indemnité kilométrique.

**Vigilance** — la note peut être validée, l'employeur doit savoir :
dépassement du plafond, annoncé en euros · barème périmé · indemnité
kilométrique **et** carburant le même jour (le barème couvre déjà le
carburant — c'est un double remboursement) · doublon probable (même salarié,
même jour, même catégorie, même montant) · frais engagé il y a plus de trois
mois · **repas ou déplacement un jour sans aucun temps de travail enregistré**
(croisement avec la brique Planning, muet quand rien n'y est saisi).

**Information** — pour le comptable : TVA non déductible sur cette catégorie.

Une note bloquée peut toujours être **refusée** — c'est même la sortie normale
d'une note incomplète que personne ne complétera.

---

## Le cumul kilométrique, et pourquoi il compte

Le barème n'est pas progressif par tranche : c'est une formule unique choisie
d'après la distance **annuelle** totale (« d × 0,340 + 1 330 » pour 4 CV entre
5 001 et 20 000 km). Le moteur reconstitue donc le cumul **dans l'ordre des
dates** et calcule chaque trajet comme la différence entre l'indemnité annuelle
avant et après. C'est la seule manière d'obtenir la bonne somme quand un
salarié franchit un seuil en cours d'année — et le seuil se franchit :
5 000 km, c'est une tournée de trois mois.

---

## Les deux entrées

### Le salarié, depuis un lien public

`https://espace.osmoserh.fr/?frais=<jeton>` — un SMS, ou un QR code affiché au
vestiaire. Aucun compte, aucune application, comme le pointage. Le jeton est
**dérivé du code client par HMAC**, jamais stocké, et se révoque en changeant
le secret.

Le parcours : je choisis mon nom → je photographie le ticket → l'OCR remplit
date, montant, TVA et commerçant → je choisis la nature du frais → j'envoie.

**Ce que le lien vaut, dit franchement.** Quelqu'un pourrait déposer une note
au nom d'un collègue. C'est sans portée : rien n'est payé sans validation
explicite de l'employeur, note par note, et chaque dépôt est daté à la
seconde. Un garde-fou limite à 60 notes en attente par salarié.

**L'OCR pré-remplit, il ne décide pas.** Tout reste modifiable, et un ticket
illisible n'empêche jamais d'envoyer la note : on saisit alors les trois champs
à la main. Une lecture ratée fait perdre dix secondes, pas la note de frais.

### L'employeur, depuis le portail

Tout le monde n'a pas de smartphone, et une note se rattrape parfois à la
main. Le circuit est le même, la source est simplement notée (`Employeur` au
lieu de `Salarié`).

---

## Le circuit

```
Nouvelle ──valider──> Validée ──transmettre──> En paie
    │
    └──refuser──> Refusée (motif conservé)
```

Le passage en paie est en deux temps : **aperçu** — le client voit les lignes
calculées, salarié par salarié, net et brut séparés — puis **transmission**.
On ne transmet jamais un chiffre que le client n'a pas vu. Les notes basculent
en « En paie » **après** l'envoi : si la transmission échoue, elles restent
validées et l'envoi se rejoue sans rien perdre.

---

## Alerte des notes oubliées

Une note de frais oubliée, c'est un salarié qui a avancé son argent et qui
attend. Au bout de **14 jours**, `/api/echeances` produit **une** alerte par
client — pas une par note : le geste attendu est d'ouvrir l'écran et de passer
la pile, et douze courriels pour douze tickets, personne ne les lit.

Type de notification : `frais`. Elle rejoint le tableau `notifications`
unifié — **aucune modification du flux Power Automate n'est nécessaire**, la
boucle « Pour chaque `notifications` » existante la traite.

Contrairement aux procédures, ce délai se compte en semaines : **le flux
hebdomadaire suffit.**

---

## À faire côté Azure / SharePoint

1. **Relancer `creer_site_rh.py`** — il crée la liste **« Notes de frais »** :

   ```bash
   export GRAPH_TENANT_ID='…'
   export GRAPH_CLIENT_ID='…'
   export RH_SITE_ID='…'
   python3 creer_site_rh.py
   ```

2. **Variable de la Static Web App** (facultative) :

   | Variable | Effet |
   |---|---|
   | `FRAIS_SECRET` | secret propre au lien des notes de frais |

   **À défaut, `POINTAGE_SECRET` est utilisé** — les deux briques s'adressent
   au même public, et n'exiger qu'une variable évite qu'une moitié de la maison
   reste fermée. Le préfixe interne (`frais:` / `pointage:`) garantit qu'un
   jeton de pointage ne vaut pas pour les frais, et réciproquement, même quand
   le secret est commun.

   Sans aucun des deux, la brique fonctionne en saisie employeur : seul le lien
   public est absent.

3. **`OCR_ENDPOINT` / `OCR_CLE`** — sans elles, la photo est bien déposée et
   conservée, mais rien n'est lu automatiquement : le salarié saisit les trois
   champs. La brique n'est pas en panne, elle est simplement moins rapide.

---

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `api/src/frais.js` | **calcul pur** — barèmes, qualification, contrôles. Aucun réseau, éprouvable au banc. |
| `api/src/notesdefrais.js` | accès aux données, circuit de validation, jeton public, alertes |
| `api/src/ocr.js` | type de pièce `frais` → modèle `prebuilt-receipt` |
| `api/src/functions/demande.js` | `{action:"frais"}` (client) et `{action:"fraisDepot"}` (public) |
| `api/src/functions/depot.js` | `?frais=<jeton>` — la photo du ticket |
| `api/src/functions/echeances.js` | alerte des notes oubliées |
| `src/components/AppShell.jsx` | écran client `NotesDeFrais` + tuile |
| `src/components/FraisSalarie.jsx` | page publique du salarié |
| `src/demo/modeDemo.js` | trois notes fictives : une nette, une qui dépasse, une bloquée |
| `src/scripts/creer_site_rh.py` | liste « Notes de frais » |

**Doctrine des routes respectée** : aucune route nouvelle. Tout passe par
`POST /api/demande` et `POST /api/depot`.

---

## Recette

- `simu-frais.js` — 54 vérifications du calcul pur : barèmes, franchissement
  de seuil kilométrique, part exonérée / part soumise, contrôles, passage en
  variables, extraction OCR du ticket.
- `simu-notesdefrais.js` — 54 vérifications de l'accès aux données : jetons,
  cloisonnement par `CodeClient`, dépôt public, validation en lot, passage en
  paie, alerte groupée.
- `tests/demo.spec.js` — parcours complet en mode démonstration, zéro appel
  réseau.
