# Accident du travail — le volet des 48 heures

Livré le 25 août 2026 · `VERSION_API = 2026-08-25-accident-du-travail`

---

## Le moment

Un salarié se blesse. Le patron a la tête à l'accident, pas au droit — et
c'est maintenant que tout se joue, sur les délais les plus courts de tout le
droit du travail :

| Qui | Quoi | Délai | Texte |
|---|---|---|---|
| Le salarié | informe l'employeur | dans la journée, au plus tard 24 h | R.441-2 |
| **L'employeur** | **déclare à la CPAM (DAT)** | **48 h, dimanches et fériés non compris** | **R.441-3** |
| L'employeur | remet la feuille d'accident (S6201) au salarié | tout de suite | L.441-5 |
| L'employeur | réserves **motivées** s'il doute | 10 jours francs après la déclaration | R.441-6 |

DAT en retard : amende, et la CPAM peut faire supporter à l'employeur les
dépenses de l'accident. Réserves hors délai ou non motivées : écartées sans
examen — et le taux de cotisation AT de l'entreprise hérite du sinistre.

## Le choix d'intégration (décision du 25/08)

**Pas de nouvelle tuile, pas de nouvelle procédure.** Le volet vit dans la
brique **Absences**, là où le geste commence : le client déclare une absence,
choisit « Accident du travail » ou « Accident de trajet », et le formulaire
se déplie.

Le volet capte les faits **à chaud** — dans six mois, plus personne ne s'en
souviendra, et la DAT les reprend mot pour mot :

- date et heure de l'accident, **lieu précis**, **circonstances** (requis) ;
- siège et nature des lésions, témoins, tiers impliqué (facultatifs — on ne
  renvoie pas un patron secoué chercher le numéro d'un témoin) ;
- le moment où l'employeur **a eu connaissance** de l'accident : c'est lui
  qui fait courir les 48 h. Vide = maintenant, l'hypothèse la plus favorable.

Le champ « tiers impliqué » n'est pas décoratif : un tiers responsable ouvre
un recours qui allège le taux AT.

**La maladie professionnelle est exclue du volet**, volontairement : c'est le
salarié qui la déclare à la CPAM, pas l'employeur. L'écran le dit quand ce
motif est choisi — pour éviter une déclaration à tort.

## Ce qui se passe à l'envoi

1. **La ligne d'absence** est écrite avec le volet (colonnes `Accident*`,
   `Connaissance*`, `DatEcheance` dans la liste Absences).
2. **Le gestionnaire est prévenu dans la minute** par le fil « Mon
   gestionnaire » : objet 🔴 avec la date limite, corps complet (lieu,
   circonstances, lésions, témoins, tiers, les deux horloges). Sur un délai
   de 48 h, le flux d'échéances hebdomadaire arriverait après la bataille —
   c'est le message immédiat qui est le vrai signal.
3. **L'écran affiche les gestes**, dans l'ordre : la feuille S6201 tout de
   suite, la DAT avant sa date limite calculée, les réserves dans les dix
   jours. Un délai déjà dépassé s'annonce en clair (« déclarez sans
   attendre ») — il ne se cache pas.

## Le calcul des 48 heures

48 h à compter de la connaissance, **dimanches et jours fériés non
compris** : chaque jour exclu traversé étend l'échéance d'une journée, et le
report peut atterrir sur un nouveau jour exclu (veille de Noël → le 25 puis
le dimanche 27 sont sautés → lundi 28). Le calcul est à point fixe, en
calendrier naïf (aucune conversion de fuseau — l'heure saisie est l'heure de
Paris, le serveur tourne en UTC).

Les réserves : 10 jours **francs** — le jour de la déclaration ne compte
pas, et une échéance qui tombe un samedi, dimanche ou férié est reportée au
premier jour ouvrable.

## La trame des réserves motivées

`courrierReserves()` (api/src/accident.js) produit la lettre pré-remplie du
dossier — en-tête, salarié, date d'accident — avec un corps qui **force la
motivation** : il demande des faits datés et circonstanciés, pas des
soupçons. Disponible pour le gestionnaire ; non exposée côté client pour
l'instant (les réserves sont un geste du cabinet).

## Le registre des accidents bénins

Sans arrêt ni soins médicaux, l'accident peut être inscrit au registre des
accidents bénins **au lieu** d'être déclaré — uniquement si l'entreprise
tient ce registre (secouriste + poste de secours, L.441-4). Le portail le
signale comme alternative quand `benin: true` et pas de date de fin ; au
moindre doute, la consigne est de déclarer.

## À faire côté SharePoint

**Relancer `creer_site_rh.py`** — il ajoute les colonnes du volet à la liste
Absences existante : `AccidentDate`, `AccidentHeure`, `AccidentLieu`,
`AccidentCirconstances`, `AccidentLesions`, `AccidentTemoins`,
`AccidentTiers`, `ConnaissanceDate`, `ConnaissanceHeure`, `DatEcheance`.

Aucune variable SWA, aucun changement Power Automate : la notification
urgente passe par le fil « Mon gestionnaire » existant.

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `api/src/accident.js` | calcul pur : échéances, validation, dossier, message, trame des réserves |
| `api/src/delais.js` | expose désormais `estFerie` et `estDimanche` |
| `api/src/functions/demande.js` | branche le volet dans la démarche `absences` |
| `src/components/AppShell.jsx` | volet dépliant + panneau « Ce qu'il faut faire maintenant » |
| `src/demo/modeDemo.js` | échéances simplifiées en démonstration |
| `src/scripts/creer_site_rh.py` | colonnes du volet sur la liste Absences |

## Recette

- `simu-accident.js` — 48 vérifications : échéance DAT (dimanche, férié,
  cascade veille de Noël), réserves franches avec report, validation,
  colonnes, message, trame, branchement complet dans la démarche absences
  (AT sans volet refusé, maladie ordinaire inchangée).
- `tests/demo.spec.js` — le volet se déplie en démo, la déclaration affiche
  les trois gestes. 15/15.
