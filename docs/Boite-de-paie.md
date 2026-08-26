# La boîte de réception de la paie

Livrée le 26 août 2026 · `VERSION_API = 2026-08-26-boite-de-paie`

---

## Le problème réglé

La liste « Variables de paie » était écrite par **quatre briques** — la
grille du client, le planning (heures), les notes de frais (net + brut
soumis), les saisies sur salaire (retenues) — et **relue par personne** :
pour traiter la paie du mois, le gestionnaire ouvrait SharePoint.

C'est terminé : l'onglet **« Paie du mois »** de l'écran gestionnaire est
la lecture qui manquait. Le portail devient l'écran de travail du mois ;
SharePoint redevient ce qu'il est — le stockage.

## Ce que l'écran montre

`GET /api/me?vue=admin&onglet=paie&mois=AAAA-MM` (verrou ADMIN_EMAILS par
me.js, comme les autres onglets) :

- **Un bloc par client actif** — y compris ceux qui n'ont **rien envoyé**
  (« rien reçu — à relancer ») : ce sont eux qu'on relance avant la
  clôture. Les clients ayant transmis passent devant.
- **Chaque ligne avec sa nature**, déduite de ses colonnes remplies :
  `heures`, `absence`, `prime`, `acompte`, `titres-resto`, `frais`,
  `avantage-nature`, `saisie` — une ligne peut en cumuler plusieurs. Un
  résumé lisible (« 155,67 h (dont 4 sup) », « Saisie 234,78 € »), le
  commentaire complet au survol.
- **L'étape du cycle de paie** du client (« Variables reçues », « Saisie
  Cegid »…) quand la liste Cycle de paie la porte.
- **Les compteurs du mois** : X/Y clients ont transmis, N lignes à
  intégrer, M intégrées. Navigation mois précédent / suivant.

## Le pointage d'avancement

Sélection de lignes → **« Marquer intégrées »** (ou « Intégrer le
client » d'un clic sur tout son bloc). Retour arrière possible — une
erreur de clic se corrige. Une ligne intégrée reste visible, grisée : on
voit ce qui est fait, pas seulement ce qui reste.

Écriture via `POST /api/demande { action: "adminPaie", ids: [...],
statut: "Intégrée" | "Nouvelle" }` — le module **revérifie lui-même** le
jeton et ADMIN_EMAILS (la route demande est publique, le verrou ne se
délègue pas), et chaque id est contrôlé contre la liste avant écriture.

## Ce qui n'a pas changé

- **Aucune colonne nouvelle, aucun script à relancer, aucun Power
  Automate** : de la lecture pure sur des données déjà en place.
- Le statut « Intégrée » existait déjà dans la liste (choix
  Nouvelle/Intégrée) — il devient simplement actionnable depuis le
  portail.
- Doctrine des routes respectée : `?vue=admin&onglet=paie` + action
  `adminPaie` sur la route demande.

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `api/src/paie.js` | lecture regroupée + natures + pointage en lot |
| `api/src/functions/me.js` | branchement `onglet=paie` |
| `api/src/functions/demande.js` | action `adminPaie` (détour gestionnaire) |
| `api/src/admin.js` | `exigerAdmin` désormais exporté |
| `src/components/AdminActivation.jsx` | onglet « Paie du mois » (`SectionPaie`) |

## Recette

`simu-paievue.js` — 23 vérifications : regroupement par client actif,
exclusion des mois voisins et des clients fermés, natures (dont ligne à
double nature frais + prime), client silencieux présent à zéro ligne,
compteurs, mois par défaut et mois invalide, pointage en lot avec retour
arrière, id inconnu → 404 sans écriture, non-gestionnaire → 403.

L'écran vit derrière MSAL : pas de parcours Playwright (comme les autres
onglets gestionnaire) — la logique serveur est entièrement couverte au
banc.
