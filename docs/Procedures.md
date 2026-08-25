# La brique Procédures

Le cœur du métier RH n'est pas la donnée : c'est la **procédure**. Et
une procédure est une horloge — des délais qui se comptent en jours
ouvrables, ouvrés ou calendaires selon le texte, des documents
obligatoires à chaque étape, un ordre qu'on ne peut pas inverser.

C'est là que les petites entreprises se font condamner. Pas sur le fond :
sur la forme. Le motif était réel, mais la convocation est partie trop
tard, ou la notification trop tôt.

## Les quatre procédures

| Procédure | Les délais tenus |
|---|---|
| **Licenciement pour motif personnel** | Entretien au plus tôt 5 jours ouvrables après la présentation de la convocation (L.1232-2) ; notification au plus tôt 2 jours ouvrables après l'entretien (L.1232-6) |
| **Sanction disciplinaire** | 2 mois pour engager depuis la connaissance des faits (L.1332-4) ; notification entre 2 jours ouvrables et 1 mois après l'entretien (L.1332-2) |
| **Inaptitude** | 1 mois depuis l'examen médical pour reclasser ou licencier, sinon reprise du versement du salaire (L.1226-4) |
| **Rupture conventionnelle** | 15 jours calendaires de rétractation (L.1237-13) ; 15 jours ouvrables d'instruction par la DREETS (L.1237-14) |

## Ce que le client voit

Il ouvre une procédure, désigne le salarié, et saisit la date qui arme
l'horloge — les faits connus pour une sanction, l'avis du médecin pour
une inaptitude.

Le portail déroule alors les étapes. Pour chacune : son statut, la
fenêtre dans laquelle elle doit tomber, l'explication du délai et son
fondement, et la trame du courrier quand il y en a une.

> **Notification du licenciement pour inaptitude** — *À faire*
> Au plus tard le **10/10/2026**.
> À défaut de reclassement ou de licenciement dans le mois de l'examen
> médical, l'employeur reprend le versement du salaire correspondant à
> l'emploi occupé avant la suspension (L.1226-4).

Il saisit la date réelle de chaque étape ; toutes les suivantes se
recalculent.

## Trois choix de conception

**Le portail signale ce qui a déjà mal tourné.** Une étape peut avoir
été faite trop tôt ou trop tard. Plutôt que de l'ignorer, le portail
l'affiche : *« Réalisée le 10/09/2026, avant la date la plus proche
possible (12/09/2026). »* C'est exactement ce qu'un conseil de
prud'hommes regardera — mieux vaut le savoir avant lui.

**Une étape peut être sans objet.** Pas de CSE dans l'entreprise ? La
consultation se marque comme telle et cesse de bloquer la procédure.
Les étapes obligatoires, elles, ne peuvent pas être écartées.

**Une date se corrige.** Une saisie erronée fausse tout ce qui suit :
elle s'efface, et l'horloge se recale.

## Les trames de courrier

Chaque étape qui appelle un écrit en propose une, pré-remplie du dossier
et de l'en-tête du client — raison sociale, adresse, représentant, lieu
d'édition. Elles sont volontairement sobres : un modèle trop bavard se
signe sans être lu.

Ce qu'elles n'oublient pas :

- la convocation mentionne l'assistance possible **et** le conseiller
  extérieur inscrit sur la liste préfectorale, en l'absence de
  représentants du personnel ;
- la notification de licenciement rappelle que la lettre **fixe les
  limites du litige** — aucun autre motif ne pourra être invoqué ensuite ;
- la trame de recherche de reclassement avertit que son absence suffit à
  priver le licenciement de cause réelle et sérieuse, **même si aucun
  poste n'existait** ;
- la notification pour inaptitude distingue l'origine professionnelle
  (indemnité spéciale et indemnité compensatrice de préavis, L.1226-14)
  de l'origine non professionnelle ;
- la rupture conventionnelle rappelle que l'exemplaire remis au salarié
  conditionne la validité de la rupture, et que pour un salarié protégé
  il s'agit d'une **autorisation**, pas d'une homologation.

Chaque trame s'ouvre sous un avertissement : *à relire et à adapter*.

## Ce que le portail ne fait pas — et le dit

**Il tient la forme, pas le fond.** La cause réelle et sérieuse, la
proportionnalité d'une sanction, le sérieux d'une recherche de
reclassement ne se calculent pas. Ils relèvent du gestionnaire.

**Il tient le socle légal, pas la convention collective.** Les
conventions allongent souvent les délais, imposent parfois une
commission paritaire ou un entretien assisté. L'écran le rappelle sous
chaque procédure. Promettre l'inverse serait dangereux.

## Compter les jours comme le droit les compte

Un module dédié, `api/src/delais.js`, parce que la confusion coûte deux
à quatre jours — assez pour rendre un licenciement irrégulier :

- **calendaires** : tous les jours, sans exception ;
- **ouvrables** : tous sauf les dimanches et jours fériés — **le samedi
  est ouvrable**, c'est la surprise la plus fréquente ;
- **ouvrés** : les jours travaillés, lundi à vendredi hors fériés.

Le jour de départ n'est jamais compté. Une échéance « au plus tôt » qui
tomberait un dimanche ou un férié est reportée au jour ouvrable suivant :
le délai doit être entier. Les mois se comptent de date à date, le
31 janvier plus un mois donnant le 28 février.

Les jours fériés viennent de `temps.js`, qui les recalcule année par
année, Pâques comprise — une source unique pour tout le portail.

## Les alertes

Les procédures en cours alimentent le tableau `notifications` de
`/api/echeances`, avec le type `procedure`. Un délai dépassé ou à moins
de trois jours part au gestionnaire, une seule fois par palier.

> ⚠️ **Le rythme du flux compte ici.** Ces délais se comptent en jours,
> parfois deux. **Un flux hebdomadaire les manquera.** Pour que les
> alertes de procédure servent à quelque chose, le flux Power Automate
> qui appelle `/api/echeances` doit tourner **tous les jours**. Le
> portail, lui, les affiche en direct dès la connexion.

## Mise en service

1. Relancer `creer_site_rh.py` : il crée la liste **« Procédures »**.
2. La brique s'ouvre avec l'option **`embauche`**, qui couvre déjà la
   vie du contrat de son début à sa fin.
3. Passer le flux d'échéances en **quotidien** (voir ci-dessus).

Aucune variable d'environnement, aucun service externe.

## Détail technique

- `api/src/delais.js` — arithmétique des délais, calcul pur.
- `api/src/procedures.js` — définition des quatre procédures (étapes,
  contraintes, aides, documents), moteur d'état, trames de courrier, et
  accès aux données en `require` paresseux.
- Route : aucune nouvelle. `POST /api/demande { action: "procedure" }`,
  modes `lire`, `ouvrir`, `etape`, `abandonner`, `document`.
- Stockage : les étapes franchies et le contexte du dossier sont en
  **JSON** dans la liste. La forme d'une procédure évolue avec le droit ;
  une colonne par étape figerait le modèle.
- Le banc `simu-procedures.js` (108 contrôles) vérifie l'arithmétique
  des délais, les quatre procédures, la cohérence structurelle de leurs
  définitions — aucune contrainte ne peut se référer à une étape
  postérieure —, les trames, le cloisonnement, les alertes et
  l'anti-doublon. Plus un test de bout en bout.
