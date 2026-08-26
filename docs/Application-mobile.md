# Application mobile Osmose RH — étude d'opportunité (26/08/2026)

Question posée : faut-il faire une application mobile de la plateforme ?

Réponse courte : **oui pour l'usage mobile, non pour les magasins
d'applications.** Ce qui manque aujourd'hui — l'icône sur l'écran
d'accueil et la notification qui arrive sans ouvrir le portail —
s'obtient en PWA, avec le code existant et le déploiement existant.
Une application native (App Store / Play Store) coûterait un second
produit à maintenir pour un gain marginal, et casserait la promesse qui
fait vendre la brique salarié : *rien à installer*.

Le détail ci-dessous, population par population, puis le chiffrage des
trois voies possibles et l'ordre des gestes.

---

## 1. Qui utiliserait cette application ?

La plateforme sert trois populations, et elles n'ont pas du tout le
même besoin.

### Les gestionnaires du cabinet — aucun besoin

Leur écran, c'est `AdminActivation.jsx` (1 500 lignes) : tableaux
d'échéances, dossiers salariés, activation des accès, abonnements,
exports CSV. Du travail de bureau, sur grand écran, avec du
copier-coller vers la paie. Une application mobile ne leur apporterait
rien qu'un ordinateur ne fasse mieux. Cas d'usage résiduel : consulter
une alerte en déplacement — c'est de la notification, pas une
application.

### Les clients (dirigeants de TPE/PME) — besoin réel, déjà partiellement servi

C'est eux qui ouvrent le portail depuis une camionnette, un chantier ou
entre deux rendez-vous. Leurs gestes courts sont déjà tous mobiles par
nature :

- déclarer une absence en photographiant l'arrêt de travail
  (`capture="environment"`, l'appareil photo s'ouvre directement —
  `AppShell.jsx:4386`) ;
- valider une note de frais, un congé, une demande d'acompte ;
- répondre au gestionnaire dans le fil de discussion ;
- regarder les échéances qui approchent.

Le portail est **déjà adapté au mobile** : les media queries à 760 px
de `AppShell.jsx` transforment la barre latérale en barre horizontale
collante, passent les grilles et les formulaires en une colonne, et
rendent les tableaux défilants. Ce n'est donc pas l'affichage qui
manque. Ce qui manque, c'est :

1. **la notification** — aujourd'hui tout passe par l'e-mail (flux
   Power Automate, `courriel.js`, `messages.js`, `echeances.js`), donc
   par une boîte de réception déjà saturée ;
2. **l'icône** — il faut se souvenir de `espace.osmoserh.fr`, l'ouvrir
   dans un navigateur, retrouver l'onglet ;
3. **la reconnexion** — `cacheLocation: "sessionStorage"`
   (`authConfig.js:25`) : fermer l'onglet, c'est se reconnecter. Sur
   mobile, où le système ferme les onglets sans prévenir, c'est le
   principal irritant.

Ces trois manques sont exactement ce qu'une PWA installée corrige.

### Les salariés — surtout ne rien leur faire installer

C'est le point le plus important de cette note, et c'est un point de
doctrine, pas de technique.

Les trois parcours salariés — pointage (`PointageSalarie.jsx`), note de
frais (`FraisSalarie.jsx`), onboarding (`OnboardingSalarie.jsx`) —
fonctionnent **sans compte, sans mot de passe, sans installation** :
un lien à jeton, ouvert par un QR code près de la porte ou reçu par
message. `main.jsx` les rend même *avant* d'initialiser MSAL, pour que
rien de l'authentification ne démarre.

C'est un choix produit, écrit noir sur blanc en tête de
`FraisSalarie.jsx` : *« Pas de compte, pas de mot de passe, pas
d'application à installer »*. Et c'est un avantage concurrentiel réel
face aux logiciels de paie classiques : dans une entreprise de six
personnes, on ne fait pas installer une application à un maçon pour
qu'il pointe. Le QR code, lui, marche du premier coup, pour tout le
monde, y compris l'intérimaire arrivé le matin même.

**Demander aux salariés d'installer une application, ce serait
réintroduire exactement la friction que la plateforme a été construite
pour supprimer.** Quel que soit le reste de cette étude, cette
brique-là ne doit pas bouger.

---

## 2. Ce qu'une application native apporterait vraiment

En retirant ce que le web fait déjà, la liste est courte :

| Apport | Valeur réelle | Le web le fait-il ? |
|---|---|---|
| Notifications poussées | **Forte** — le seul vrai manque | Oui, en PWA installée (Android depuis toujours, iOS depuis 16.4) |
| Icône sur l'écran d'accueil, plein écran | Moyenne | Oui, en PWA (manifest) |
| Session persistante / Face ID | Moyenne | Partiellement (`localStorage` + MSAL, sans biométrie) |
| Appareil photo | Nulle | Oui, déjà (`capture="environment"`) |
| Fonctionnement hors ligne | Faible à moyenne (chantiers en zone blanche) | Oui, en partie (service worker) |
| Géolocalisation du pointage | **Piège** | Oui — mais la CNIL encadre strictement le pointage géolocalisé ; à ne pas ouvrir sans besoin explicite |
| Présence dans les magasins | Faible — nos clients ne cherchent pas leur cabinet social sur l'App Store | Non |

Autrement dit : **une seule ligne de ce tableau justifie à elle seule
un chantier — les notifications — et elle ne réclame pas d'application
native.**

---

## 3. Ce qu'une application native coûterait

### Le code n'est pas portable

Le front, c'est 14 300 lignes de React, dont 5 850 pour le seul
`AppShell.jsx`, écrites en **styles inline** avec des media queries
`!important` par-dessus. Aucune de ces lignes ne survit à un passage en
React Native : ni les `<div>`, ni les `style={{}}` CSS, ni les
`<input type="file">`, ni les media queries, ni le rendu HTML des
courriers. Ce ne serait pas un portage, ce serait **une réécriture
complète de l'interface** — et ensuite deux interfaces à faire évoluer
en parallèle, à chaque brique.

Or le rythme de la plateforme, c'est une brique métier par jour ou
presque (Procédures, Planning et pointage, Réembauche, Notes de frais,
Accident du travail, OCR — tous livrés en trois jours d'après le
backlog). Ce rythme ne survit pas au doublement.

### L'authentification est à refaire

`@azure/msal-browser` / `@azure/msal-react` ne fonctionnent pas en
natif. Il faudrait passer à `react-native-app-auth` (ou MSAL natif),
redéclarer des URI de redirection à schéma personnalisé dans
l'inscription d'application Entra External ID, et retester tout le
parcours d'inscription client — celui-là même qui vient d'être
reconstruit dans le nouveau tenant.

### Le déploiement perd sa vitesse

Aujourd'hui : un `git push` sur `main`, GitHub Actions, Azure Static
Web Apps, en ligne en quelques minutes — d'où les neuf déploiements en
une journée du 23/08. Demain, avec les magasins : chaque correctif
attend une revue Apple (24 h à 72 h, parfois davantage), et il faut
gérer les versions, les captures d'écran, les fiches de confidentialité,
les comptes de test pour les évaluateurs. La capacité à corriger un bug
client dans l'heure — qui est un argument de vente du cabinet —
disparaît.

### Les coûts directs

- Compte Apple Developer : ≈ 99 $/an.
- Compte Google Play : 25 $ une fois.
- Deux jeux d'icônes, captures d'écran, fiches magasin, politique de
  confidentialité dédiée (le registre RGPD est à compléter).
- Le temps : sur une base de code de cette taille, une réécriture
  native honnête, c'est **plusieurs semaines à temps plein**, puis un
  entretien permanent.

À comparer à l'infrastructure actuelle, qui tourne à 40-50 €/mois et
vise 20 (`Infra-couts.md`). Ce serait le poste le plus cher de la
plateforme, pour la fonctionnalité la moins différenciante.

---

## 4. La voie recommandée — la PWA

Une **Progressive Web App**, c'est le portail actuel, tel quel, plus
trois fichiers : un manifeste, des icônes, un service worker. Résultat
pour le client :

- « Ajouter à l'écran d'accueil » → une icône Osmose RH parmi ses
  applications, qui s'ouvre en plein écran, sans barre de navigateur ;
- des notifications poussées (Android nativement ; iOS 16.4+ **à
  condition que la PWA ait été ajoutée à l'écran d'accueil** — c'est
  la limite à connaître) ;
- une page d'attente propre quand le réseau tombe, au lieu du dinosaure
  du navigateur ;
- **le même code, le même dépôt, le même déploiement, aucun magasin,
  aucune revue.**

Ce que la PWA ne donne pas, et qu'il faut assumer : pas de Face ID, pas
de présence en magasin, une synchronisation en arrière-plan limitée sur
iOS, et un stockage local qu'iOS peut purger après plusieurs semaines
sans usage. Aucun de ces points ne touche un usage réel identifié.

### Où brancher les notifications

Le circuit d'alerte existe déjà, il est simplement en e-mail. Les
points d'accroche naturels sont ceux qui envoient déjà un courriel :

- `functions/echeances.js` — échéance qui approche, visite de reprise,
  retard de procédure ;
- `messages.js` — réponse du gestionnaire dans le fil ;
- `notesdefrais.js` — note de frais déposée par un salarié, à valider ;
- `functions/demande.js` — accusé de traitement d'une démarche ;
- côté cabinet : nouvelle demande d'accès, DPAE à traiter.

Il faudrait y ajouter : une paire de clés VAPID en variables de la SWA,
une liste SharePoint des abonnements push (attention au nom :
`api/src/abonnements.js` désigne déjà les **abonnements commerciaux**
aux options — prendre un autre terme, par exemple « Alertes push »), et
un petit module d'envoi appelé aux mêmes endroits que le courriel.

**Règle à poser dès le départ : la notification ne remplace jamais
l'e-mail, elle le double.** Une notification qui n'arrive pas (téléphone
éteint, abonnement expiré, PWA désinstallée) ne doit jamais faire perdre
l'information. Même doctrine que l'OCR : ça pré-remplit, ça ne décide
pas.

---

## 5. Les trois voies, chiffrées

| | PWA | Enveloppe native (Capacitor) | Natif complet (React Native) |
|---|---|---|---|
| Code à écrire | Manifeste + service worker + module push | Idem + projet d'enveloppe | Réécriture complète de l'interface |
| Base de code | **Une** | **Une** | Deux |
| Effort initial | ≈ 1 jour (coquille) + 3-5 jours (push) | + ≈ 2 semaines | Plusieurs semaines |
| Entretien | Nul | Faible (deux magasins à alimenter) | Doublé, à perpétuité |
| Coût annuel | 0 € | ≈ 100 €/an | ≈ 100 €/an + le temps |
| Délai de correctif | Minutes | Minutes pour le contenu web, jours pour l'enveloppe | Jours |
| Magasins | Non | Oui | Oui |
| Face ID, hors-ligne poussé | Non | Partiellement | Oui |

L'enveloppe **Capacitor** mérite d'être gardée en réserve : elle
embarque le portail web existant dans une coquille native publiable sur
les magasins, sans réécrire l'interface. C'est la porte de sortie si un
jour un client exige « une vraie application » ou si les notifications
iOS en PWA s'avèrent trop peu fiables. Elle ne coûte rien tant qu'on ne
l'ouvre pas — mais elle n'a de sens qu'**après** la PWA, jamais à sa
place.

---

## 6. Ordre des gestes proposé

**Étape 0 — la coquille installable (≈ 1 jour).**
`manifest.webmanifest` (nom, couleurs Osmose `#061840`, mode
`standalone`, orientation libre), un jeu d'icônes 192/512 + icône
masquable, les balises iOS dans `index.html`, un service worker minimal
qui met en cache la coquille et sert une page hors-ligne. Plus une
invitation discrète « Installer l'application » quand le navigateur le
propose. Zéro régression possible : un navigateur qui ignore tout ça
affiche le portail exactement comme aujourd'hui.

**Étape 0 bis — la revue mobile (≈ 1 jour).**
Reprendre au téléphone, écran par écran, les parcours réellement
mobiles : les trois pages salarié, les tuiles Absences, Notes de frais,
Variables de paie, le fil « Mon gestionnaire ». Chercher les zones
tactiles trop petites, les tableaux qui débordent, les champs qui
déclenchent le mauvais clavier (`inputmode`), et le zoom automatique
d'iOS sur les champs sous 16 px. C'est le meilleur rapport
effort/bénéfice de toute cette note, et ça ne dépend d'aucune décision.

**Étape 0 ter — la reconnexion (≈ 2 heures).**
Passer MSAL de `sessionStorage` à `localStorage` (avec la contrepartie
de sécurité à peser : poste partagé). Sur mobile, c'est ce qui
transforme « je dois me reconnecter à chaque fois » en « ça s'ouvre ».

**Étape 1 — les notifications (≈ 3-5 jours).**
VAPID, liste d'abonnements, module d'envoi, opt-in explicite côté
client, e-mail conservé en doublure. Commencer par **deux** événements
seulement — la réponse du gestionnaire et l'échéance qui approche —
et n'élargir qu'après retour d'usage. Une notification de trop et le
client coupe tout.

**Étape 2 — l'enveloppe native.** Conditionnelle. À n'ouvrir que si un
client la réclame explicitement, ou si l'installation PWA sur iPhone
s'avère trop peu adoptée pour que les notifications atteignent leur
cible.

**Étape 3 — le natif complet.** À écarter tant que rien n'a changé dans
l'analyse ci-dessus.

---

## 7. Ce qu'il ne faut pas faire

- **Une application pour les salariés.** Voir § 1. Le lien à jeton et
  le QR code sont un avantage, pas un pis-aller.
- **Une application pour « faire sérieux ».** Une fiche App Store à
  trois téléchargements dessert davantage qu'une absence.
- **Géolocaliser le pointage** parce que le natif le permettrait. Le
  sujet est encadré, il exige une base légale, une information des
  salariés et une inscription au registre RGPD. Il se traite pour
  lui-même, s'il se traite un jour — pas comme effet de bord d'un
  changement de technologie.
- **Faire dépendre une information légale d'une notification.** Délais
  de procédure, visites de reprise, échéances : l'e-mail et le portail
  restent les canaux de référence.

---

## En un paragraphe

La plateforme est déjà mobile — elle est même **développée** depuis un
téléphone (journaux des 23 et 24/08). Ce qui lui manque pour ressembler
à une application, c'est une icône et une notification, pas un magasin
d'applications. La PWA donne les deux avec le code existant, sans coût
récurrent, sans revue, sans seconde base de code, et laisse Capacitor
ouvert si un client réclame un jour la vitrine des magasins. Le natif
complet coûterait le poste le plus cher de l'infrastructure pour la
fonctionnalité la moins différenciante, et ralentirait le seul rythme
qui distingue vraiment ce produit : corriger dans l'heure.
