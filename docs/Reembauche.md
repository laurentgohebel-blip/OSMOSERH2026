# Réembaucher quelqu'un qui a déjà travaillé ici

L'extra qui revient chaque service, le saisonnier de la station, le
vacataire de l'association, le remplaçant du cabinet, l'ouvrier repris
au chantier suivant : dans tous les secteurs, ce sont souvent les mêmes
personnes qui reviennent.

Et pourtant la deuxième embauche coûtait aussi cher que la première :
on redemandait l'identité, le numéro de sécurité sociale, l'adresse, la
banque, et on redéposait les trois pièces justificatives. Tout cela est
déjà dans le dossier du salarié sorti.

## Ce que le client fait

Dans **Embauche**, un troisième parcours apparaît dès qu'il existe au
moins un ancien salarié : **« Il a déjà travaillé chez nous »**.

1. Il choisit la personne dans la liste des salariés sortis.
2. Il saisit **uniquement le nouveau contrat** : type, poste, dates,
   durée mensuelle.
3. Le portail affiche ce qui est repris — « Repris du dossier, rien à
   ressaisir : numéro de sécurité sociale, état civil, adresse,
   coordonnées bancaires » — et **ce que cette réembauche implique**.
4. Il valide. Aucune pièce à redéposer : elles sont déjà dans son espace
   documents.

Une quarantaine de minutes ramenées à trois.

## Ce que le portail vérifie

C'est le vrai travail de cette brique. Réembaucher n'est pas embaucher.

| Point | Ce qui est dit |
|---|---|
| **Délai de carence** (L.1244-3-1) | Entre deux CDD sur le même poste : un tiers de la durée du contrat précédent s'il durait 14 jours ou plus, la moitié sinon. Chiffré, daté, avec la mention que le décompte se fait en jours d'**ouverture de l'entreprise** — la date affichée est donc la plus optimiste possible. |
| **Titre de séjour** | Un titre valable au précédent contrat peut être périmé. L'employeur doit s'assurer du droit au travail à **chaque** embauche (L.8251-1). Vérifié à la date du jour **et** à la date d'embauche. L'authentification préfectorale est à refaire. |
| **Période d'essai** | Un CDI conclu à l'issue d'un CDD impute la durée du CDD sur l'essai (L.1221-24). Après interruption, ce n'est plus automatique : le portail signale sans calculer. Et sur un poste déjà tenu, une nouvelle période d'essai de pleine durée est difficilement justifiable. |
| **Visite médicale** | Une visite de moins de cinq ans (deux ans en suivi renforcé) peut dispenser de la suivante, si l'emploi est identique aux mêmes risques et qu'aucune inaptitude n'est intervenue. Formulé au conditionnel, à confirmer avec le service de santé au travail. |
| **Ancienneté** | La durée du contrat précédent est rappelée : elle peut devoir être reprise (CDD poursuivi en CDI, reconduction saisonnière prévue par la convention). |
| **DPAE** | Toujours due, sans exception, au plus tôt huit jours avant la prise de poste. |

## On avertit, on ne bloque pas

Le délai de carence connaît **sept exceptions légales** (L.1244-4-1) que
seul le client connaît : emploi saisonnier, CDD d'usage, nouvelle
absence du salarié remplacé, rupture à l'initiative du salarié, refus de
renouvellement… Refuser la saisie serait juridiquement faux.

Alors quand un point bloquant est soulevé, le portail demande **le motif
qui permet de passer outre**, dans une liste fermée. Ce motif part avec
la demande et déclenche un message au gestionnaire :

> **Réembauche en dérogation — PEREZ Manon (EMB-XXXX)**
> Motif invoqué : Emploi saisonnier
> Points signalés et passés outre :
> — Délai de carence non respecté : …

C'est ce qui distingue une dérogation assumée d'un oubli — et ce qu'on
veut retrouver en cas de contrôle.

## Garde-fous

- **Cloisonnement** : le `CodeClient` vient du jeton résolu, jamais de la
  requête. Un client ne peut pas réembaucher l'ancien salarié d'un autre
  (404, sans révéler que la fiche existe).
- **Salarié encore en poste** : refusé avec l'explication — « un avenant
  convient mieux qu'une réembauche ».
- **Double vérification** : les points affichés à l'écran ne prouvent
  rien ; le serveur les recalcule à la soumission. Un client qui
  contournerait l'écran se heurterait au même refus.
- **Rien de sensible ne transite inutilement** : le navigateur n'envoie
  que le contrat. L'identité, le NIR, l'adresse et la banque sont
  recomposés côté serveur depuis le dossier.
- **Un champ vide n'efface rien** : « non renseigné » n'est pas « à
  supprimer ».
- **Ce qui appartient au contrat n'est jamais repris** : poste, dates,
  type, durée, salaire sont toujours saisis. Seule la personne est
  reprise.

## Détail technique

- Module : `api/src/reembauche.js` — calculs purs (`carence`,
  `vigilance`, `reprendre`, `reembauchable`) séparés des accès aux
  données (`ficheAncien`, `controles`, `preparer`), pour être
  vérifiables sans annuaire, sans jeton et sans réseau.
- Routes : aucune nouvelle. `POST /api/demande { action:
  "reembaucheControles" }` pour l'écran de contrôle (lecture seule),
  `POST /api/demande { demarche: "embauche", reprise, motifDerogation }`
  pour la soumission.
- Aucune colonne SharePoint ajoutée : tout existe déjà au référentiel
  « Salariés ».
- Front : troisième parcours dans `DemandeEmbauche` (AppShell.jsx). Les
  points de vigilance sont demandés au serveur à chaque changement de
  type, de date ou de poste — le calcul vit d'un seul côté, le dupliquer
  serait le voir diverger.
- Bancs : `simu-reembauche.js` (68 contrôles — droit, reprise du
  dossier, cloisonnement, dérogation tracée) et un test de bout en bout
  dans `tests/demo.spec.js`.
