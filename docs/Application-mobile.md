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
trois voies possibles et l'ordre des gestes. Le **§ 3 bis** traite à
part la question posée ensuite — *une application réservée aux clients,
aurait-elle un intérêt ?* : intérêt réel, mais conditionné à une
fréquence d'usage qu'on ne peut pas encore mesurer, avec un test de
décision à reposer trois mois après le lancement.

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

Le front vivant — celui que `main.jsx` atteint réellement — c'est
6 200 lignes de React côté client (`AppShell.jsx` à lui seul en pèse
5 850), plus 1 500 pour l'écran gestionnaire et 620 pour les trois pages
salarié. (Les 5 700 lignes restantes du dossier `components/` — le
sous-arbre `Adminrh.jsx` : `FormBuilder`, `ValidationConges`,
`Onboarding`, `ATraiter`, `Workflows`, `Conges`, `Documents`,
`Formations`, `Production`, `Home`, `Dashboard`, `Login` — ne sont plus
importées par personne : code mort d'une version antérieure, à retirer
un jour de calme.) Le tout est écrit en **styles inline** avec des media
queries `!important` par-dessus. Aucune de ces lignes ne survit à un passage en
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

## 3 bis. Le cas particulier de l'application client

Question posée séparément le 26/08 : *et une application réservée aux
clients, elle aurait un intérêt ?*

Intérêt réel, mais **conditionnel — et pas maintenant**. Quatre raisons,
dans l'ordre de poids.

### a) La fréquence d'usage décide de tout, et elle est faible

Une application vit ou meurt sur la fréquence. Voici, geste par geste,
ce qu'un dirigeant de TPE fait réellement dans le portail :

| Geste | Cadence réelle | Forme mobile ? |
|---|---|---|
| Planning d'équipe, pointage | **Hebdomadaire** | Oui |
| Variables de paie | Mensuelle (autour de la clôture) | Moyen (saisie longue) |
| Notes de frais à valider | Mensuelle à hebdomadaire | **Oui** |
| Déclarer une absence (photo de l'arrêt) | Quelques-unes par mois | **Oui** |
| Fil « Mon gestionnaire » | Réactive | **Oui** |
| Échéances | Consultation — devrait être poussée, pas tirée | **Oui** |
| Embauche, avenant, fin de contrat, DPAE | Quelques fois par an | Non (formulaire long) |
| Acompte, attestation, visite médicale, mutuelle | Épisodique | Moyen |

Sans l'option Planning, cela fait **deux à six ouvertures par mois**.
C'est en dessous du seuil où une icône gagne sa place sur un écran
d'accueil : une application ouverte deux fois par mois est oubliée, puis
désinstallée quand le téléphone manque de place. Avec Planning +
pointage + notes de frais, on passe à un usage hebdomadaire — et là,
la question devient légitime.

**Donc : l'intérêt d'une application client dépend d'une seule variable,
le taux de souscription à l'option Planning.** C'est mesurable —
l'onglet Abonnements le donne déjà — mais pas avant d'avoir des clients.

Et surtout : ce qui ramène quelqu'un dans un outil ouvert deux fois par
mois, ce n'est pas l'icône, c'est **la notification**. Qui ne réclame
pas de magasin d'applications.

### b) Ce que le client voudrait sur son téléphone n'est pas le portail

Le portail client, c'est 17 tuiles réparties en 4 blocs, plus un tableau
de bord, une page Production, une page Échéances et une GED. Porter cela
sur un écran de cinq pouces produirait un moins bon portail.

Ce qu'un dirigeant veut sur son téléphone tient en une file d'attente et
trois gestes : **ce qui vous attend** (à valider, à signer, échéance qui
approche), **déclarer une absence en photo**, **répondre au
gestionnaire**. Le reste — embaucher, faire un avenant, saisir les
variables du mois — se fait au bureau, et c'est très bien ainsi.

Autrement dit, la vraie valeur n'est pas « le portail dans une
application », c'est **un écran d'accueil mobile réduit**. C'est une
décision de conception, pas de technologie : elle se construit dans
l'application web existante, en quelques jours, et elle profite aussi à
ceux qui ouvrent le portail dans leur navigateur.

### c) Ce que le natif ajouterait pour un client, une fois la PWA faite

- **Face ID / empreinte** à la reconnexion : le seul apport franc, et il
  est réel — c'est aujourd'hui l'irritant n° 1 (`sessionStorage`). Mais
  `localStorage` + une PWA installée en règlent l'essentiel.
- **Hors ligne** : marginal ici. Les gestes mobiles du client passent
  presque tous par une photo qui doit monter au serveur pour être lue
  (OCR) et rangée dans la GED. Sans réseau, il n'y a pas grand-chose à
  faire de plus qu'une file d'envoi différé — que la PWA sait aussi
  tenir.
- **La vitrine des magasins** : voir ci-dessous.

Rien d'autre. La photo, les notifications, l'icône, le plein écran : le
web les fait déjà.

### d) L'argument commercial, à son juste prix

Il est le plus sérieux des arguments en faveur, et il faut le regarder
en face : face à un confrère qui envoie un tableur par courriel, « nos
clients ont une application » se dit bien en rendez-vous. Un dirigeant
de six salariés juge le sérieux d'un cabinet à ces signaux-là.

Deux réserves, cependant :

1. **Une PWA installée est visuellement indiscernable d'une
   application** : icône sur l'écran d'accueil, écran de démarrage,
   plein écran, aucune barre de navigateur. En démonstration, l'effet
   est le même — et on peut la faire installer devant le client en dix
   secondes, sans magasin, sans compte Apple, sans mise à jour à
   attendre. L'argument de vente s'obtient donc à 95 % sans le magasin.
2. **Une fiche vide dessert.** Une application à trente téléchargements
   et deux avis, dont la dernière mise à jour date de huit mois, dit
   l'inverse de ce qu'on voulait dire.

À noter aussi, factuellement : Apple refuse au titre de la règle 4.2
(*minimum functionality*) les applications qui ne sont qu'un site web
emballé. Une enveloppe Capacitor passe généralement **si** elle apporte
du natif visible — notifications, appareil photo, biométrie. « On a
emballé le portail » est le motif de rejet classique. Ce n'est pas
rédhibitoire, c'est une contrainte de conception à connaître avant de
s'engager.

### e) Le calendrier : la plateforme n'est pas encore lancée

C'est l'argument qui tranche. Le reste-à-faire de la synthèse de session
porte encore « Communication clients + reprise des clients réels », le
bêta-test n'a qu'un testeur, et l'annexe RGPD des contrats clients reste
à rédiger — explicitement « prioritaire avant les clients réels ».

Construire une application de magasin avant d'avoir des clients qui
utilisent le portail web, c'est inverser l'ordre : une application est
un **outil de rétention**, et la rétention suppose des utilisateurs.
Pire, cela dépenserait des semaines sur la seule question qu'on ne peut
pas encore trancher — la fréquence d'usage réelle — alors que trois mois
d'exploitation la répondront gratuitement.

### f) Le test de décision, à reposer plus tard

Rouvrir la question le jour où **l'une** de ces trois conditions est
vérifiée :

1. la moitié des clients actifs ouvrent le portail au moins une fois par
   semaine sur un mois glissant ;
2. l'option Planning/pointage dépasse la moitié du parc — c'est le seul
   geste hebdomadaire, donc le seul qui justifie une icône ;
3. les notifications PWA n'atteignent pas leur cible sur iPhone (mesuré,
   pas supposé : part des clients iOS ayant réellement ajouté le portail
   à leur écran d'accueil).

Dans ce cas, la réponse ne serait de toute façon pas « une application
native » mais **l'enveloppe Capacitor** : même code, même rythme de
correctifs, la vitrine des magasins en plus.

En attendant : la PWA, l'écran « ce qui vous attend », et deux
notifications bien choisies. C'est 90 % du bénéfice pour 1 % du coût, et
cela ne ferme aucune porte.

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

**Étape 0 quater — l'écran « ce qui vous attend » (≈ 2-3 jours).**
Une page d'accueil mobile réduite à la file d'attente du client : ce
qu'il doit valider ou signer, l'échéance qui approche, le dernier
message du gestionnaire, et trois boutons — déclarer une absence en
photo, valider les notes de frais, écrire au gestionnaire. Le reste du
portail continue d'exister, on ne le retire pas ; on cesse simplement
d'obliger un dirigeant à traverser 17 tuiles sur un écran de cinq
pouces pour faire le geste de deux minutes qui l'amenait. C'est ce
qu'une application client apporterait vraiment — et cela se construit
dans l'application web existante (voir § 3 bis b).

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
