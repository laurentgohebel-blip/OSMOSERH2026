# Le planning d'équipe et le pointage

Tous vos clients font un planning. Sur un cahier, un tableau blanc, un
tableur refait chaque semaine. Puis quelqu'un recompte les heures à la
main pour la paie. Le même travail deux fois, et deux occasions de se
tromper.

Ici, **le planning est la source des heures**.

## Ce que le client fait

Une tuile **Planning d'équipe**, dans le bloc Paie. Une grille : les
salariés en lignes, les sept jours de la semaine en colonnes. Il clique
« + ajouter », pose un début, une fin, une pause. C'est tout.

À droite de chaque ligne, le total de la semaine et sa décomposition :
heures normales, heures à +25 %, à +50 %, complémentaires, de nuit.
En bas, un bouton : **« Voir les heures du mois »**, puis
**« Transmettre ces heures à mon gestionnaire »** — qui écrit
directement dans les variables de paie.

Un service qui passe minuit se saisit `18:00 → 02:00`. Une coupure de
restauration, c'est deux créneaux le même jour.

## Le pointage sans matériel

Pas de badgeuse, pas d'installation, pas d'abonnement. Le client affiche
près de la porte un lien — un QR code suffit :

```
https://espace.osmoserh.fr/?pointage=<jeton>
```

Le salarié l'ouvre sur son téléphone, choisit son nom dans une liste, et
appuie sur **« J'arrive »** ou **« Je pars »**. Aucun compte, aucun mot
de passe, rien à installer. Les créneaux pointés apparaissent dans le
planning, dans une couleur différente de ceux prévus.

**L'heure retenue est celle du serveur**, calée sur Paris : le téléphone
ne décide de rien, et une horloge déréglée ne fabrique pas des heures.

### Ce que ça vaut, dit franchement

C'est un registre **déclaratif**, comme le cahier qu'il remplace :
quelqu'un peut pointer pour un collègue. Il apporte deux choses que le
cahier n'a pas — l'heure vient du serveur, et la ligne est datée à la
seconde, donc invérifiable après coup. L'employeur garde la main : il
voit tout et corrige.

Ce n'est pas anodin : depuis l'arrêt de la Cour de justice de l'Union
européenne du 14 mai 2019, l'employeur doit pouvoir **prouver** le temps
de travail effectif. En cas de litige sur des heures supplémentaires,
l'absence de relevé se retourne contre lui.

## Ce que le portail calcule

Des **quantités** d'heures, jamais des montants : les taux de majoration
dépendent de la convention collective, c'est le métier de la paie.

| Catégorie | Règle appliquée |
|---|---|
| Heures normales | Jusqu'à 35 h par semaine civile, ou jusqu'à la durée contractuelle pour un temps partiel |
| Heures supplémentaires +25 % | De la 36ᵉ à la 43ᵉ heure (L.3121-36) |
| Heures supplémentaires +50 % | À partir de la 44ᵉ |
| Heures complémentaires | Temps partiel uniquement, au-delà de la durée contractuelle — **jamais** des heures supplémentaires |
| Heures de nuit | Intersection avec la plage 21 h – 6 h (L.3122-2) |
| Dimanche et jours fériés | Les onze fériés légaux, Pâques et Pentecôte calculées année par année |

**Le décompte est hebdomadaire, jamais mensuel.** 45 h une semaine et
25 h la suivante, ce ne sont pas 70 h normales : ce sont 10 heures
supplémentaires. C'est l'erreur la plus fréquente du calcul à la main.

Les heures de nuit et du dimanche sont des **compteurs de majoration** :
elles sont déjà comprises dans les colonnes précédentes, elles ne s'y
ajoutent pas.

## Ce que le portail signale

Les contrôles sont faits sur le planning **prévu** — le seul moment où
corriger coûte encore un déplacement de créneau plutôt qu'un rappel de
salaire.

| Signalé | Règle |
|---|---|
| Journée de plus de 10 heures | L.3121-18 |
| Semaine de plus de 48 heures | L.3121-20 |
| Semaine de plus de 44 heures | Moyenne sur douze semaines (L.3121-22) — à compenser |
| **Temps partiel porté à 35 heures** | Des heures complémentaires ne peuvent pas porter la durée au niveau légal : le contrat serait requalifié en temps plein (L.3123-9) |
| Heures complémentaires au-delà du dixième | Accord collectif requis, majoration qui passe de 10 % à 25 % |
| Repos quotidien inférieur à 11 heures | L.3131-1 — la coupure du soir au lendemain matin |
| Plus de six jours consécutifs | L.3132-1 et L.3132-2 |
| Travail le 1er mai | Seul jour férié chômé par la loi, régime propre (L.3133-6) |

**On informe, on ne bloque pas.** Un planning peut légitimement dépasser
— dérogation, astreinte, accord d'entreprise. Le créneau est enregistré
et le point s'affiche : c'est l'employeur qui décide, pas le portail.

## Mise en service

### Le planning

1. Relancer `creer_site_rh.py` : il crée la liste **« Temps de travail »**
   et ajoute la colonne **`DureeMensuelle`** à « Salariés ».
2. Renseigner `DureeMensuelle` pour les salariés à temps partiel
   (151,67 = temps plein). Sans elle, le portail retient la durée légale
   et ne signale pas le risque de requalification — mieux vaut ne rien
   dire que d'inventer un temps partiel.
3. La brique s'ouvre avec l'option **`paie`** du contrat client.

### Le pointage

Une variable dans la Static Web App :

| Variable | Valeur |
|---|---|
| `POINTAGE_SECRET` | une chaîne longue et aléatoire, générée pour l'occasion |

Le jeton de chaque client en est **dérivé** (HMAC-SHA256) : rien n'est
stocké, aucune colonne, aucun lien à créer. Changer le secret révoque
tous les liens d'un coup.

Sans cette variable, le pointage est **absent** : le planning fonctionne
normalement, la section « Pointage sans matériel » ne s'affiche pas.

## Garde-fous

- **Cloisonnement** : le `CodeClient` vient du jeton résolu. Un créneau
  ne peut être posé que pour un salarié de son propre effectif, et la
  suppression vérifie l'appartenance avant d'agir.
- **Le jeton de pointage n'ouvre que le pointage** de son client : la
  page ne renvoie que les noms et prénoms de l'effectif, rien du
  dossier. La comparaison du jeton se fait à temps constant.
- **Pas de double arrivée** ni de départ sans arrivée : le pointage
  refuse, avec l'heure déjà enregistrée dans le message.
- **Salariés sortis exclus** du planning comme du pointage.
- **Les variables ne partent pas toutes seules** : le client voit les
  lignes calculées, puis valide.

## Détail technique

- `api/src/temps.js` — calcul pur : durées, nuit, répartition
  hebdomadaire, jours fériés (Meeus/Jones/Butcher), contrôles légaux,
  conversion en variables de paie. Aucun accès réseau, aucun jeton :
  vérifiable de bout en bout.
- `api/src/planning.js` — lecture, écriture, jeton de pointage,
  pointage public.
- Routes : aucune nouvelle. `POST /api/demande { action: "planning" }`
  (modes `lire`, `poser`, `supprimer`, `apercu`, `variables`) et
  `POST /api/demande { action: "pointage" }` (public, modes `info`,
  `arrivee`, `depart`).
- Front : `PlanningEquipe` dans AppShell.jsx, `PointageSalarie.jsx`
  monté avant MSAL sur `?pointage=<jeton>`.
- Bancs : `simu-temps.js` (57 contrôles — droit du travail) et
  `simu-planning.js` (49 contrôles — API, cloisonnement, pointage),
  plus un test de bout en bout.
