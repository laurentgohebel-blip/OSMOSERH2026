# La boîte mail comme point d'entrée

Le patron de chantier ne se connecte pas à un portail. Il reçoit l'arrêt
de son salarié par SMS ou par mail, et il le **transfère**. Cette brique
accepte ce geste-là : il écrit à l'adresse de dépôt du cabinet, et le
portail fait le reste.

## Ce qui se passe

1. Le client envoie (ou transfère) un message à l'adresse de dépôt, avec
   ou sans pièce jointe.
2. Le portail reconnaît l'expéditeur — un contact portail actif — et en
   déduit le client.
3. Les pièces jointes sont **classées dans la GED du client**, puis
   lues (arrêt, RIB, carte Vitale, pièce d'identité).
4. Le corps du message est lu lui aussi : « Sophie est arrêtée du 24 au
   30 » se comprend exactement comme un certificat rédigé librement.
5. Le salarié cité est rapproché de l'effectif.
6. Si tout est réuni, **l'absence est enregistrée**. Sinon le message
   part au gestionnaire avec ce qui a été compris et ce qui manque.
7. Dans tous les cas, le client reçoit une réponse qui dit ce qui a été
   fait.

Aucune connexion, aucun mot de passe, aucune formation.

## Exemple

> **De :** patron@menuiserie-valmont.fr
> **Objet :** arrêt de Sophie Martin
> Bonjour, ci-joint l'arrêt de Sophie, elle revient début octobre.
> *(pièce jointe : photo du Cerfa)*

Réponse automatique :

> **Absence enregistrée — MARTIN Sophie**
>
> Votre message a été traité automatiquement. Voici ce qui a été
> enregistré :
>
> &nbsp;&nbsp;Salarié : MARTIN Sophie
> &nbsp;&nbsp;Motif : Maladie (arrêt de travail)
> &nbsp;&nbsp;Du 24/08/2026 au 30/09/2026
> &nbsp;&nbsp;Pièce classée : arret.pdf
>
> Si l'un de ces éléments est inexact, répondez à ce message : votre
> gestionnaire corrigera.

## Les garde-fous

**Le client ne vient jamais du message.** Il est déduit de l'adresse de
l'expéditeur, rapprochée des « Utilisateurs portail » actifs. Un
expéditeur inconnu n'écrit nulle part : il reçoit une réponse qui
l'invite à contacter son gestionnaire. Le cloisonnement par `CodeClient`
est donc le même que pour un utilisateur connecté.

**Aucune démarche n'est créée dans le doute.** L'absence n'est
enregistrée que si les quatre conditions sont réunies : salarié
identifié avec certitude, date de début, motif, et justificatif quand le
motif l'exige. Deux salariés du même nom sans prénom pour les
départager ? Aucun choix arbitraire — le gestionnaire tranche.

**Le classement prime sur la lecture.** Les pièces sont déposées
d'abord, analysées ensuite. Un document rangé vaut mieux qu'un document
lu : si l'analyse échoue, le fichier est quand même dans la GED.

**Le même message rejoué ne crée rien de plus.** Chaque message reçoit
une référence déterministe (`MAIL-XXXXXXXXXX`) calculée sur son
identifiant ; une reprise du flux après incident ne dédouble pas
l'absence. Ce préfixe trace aussi l'origine sans qu'aucune colonne
n'ait été ajoutée.

**Rien ne casse jamais.** Service d'analyse en panne, liste absente,
pièce illisible, fichier de 12 Mo : le client reçoit toujours une
réponse utile, et le gestionnaire est saisi.

**Ce qui est écrit reste corrigeable.** L'absence enregistrée est une
proposition lisible : la réponse énonce chaque élément et invite à
répondre pour corriger. Comme la lecture des pièces, rien n'est imposé.

### Réserve sur l'expéditeur

L'adresse d'expéditeur est le seul facteur d'identification. Elle peut
être falsifiée en théorie — en pratique Exchange applique SPF, DKIM et
DMARC en amont et met les messages douteux en quarantaine. Le risque
résiduel reste mesuré : la brique **crée** des lignes (absence, message)
et ne supprime ni ne modifie jamais rien, et le gestionnaire voit tout
passer. Pour un usage plus sensible qu'une déclaration d'absence, il
faudra une preuve plus forte que l'adresse.

## Mise en service

Sans `COURRIEL_SECRET`, la brique est **absente** : la route répond 503
et rien d'autre ne change. Pour l'activer :

### 1. Une boîte partagée

Dans Microsoft 365, créer une boîte aux lettres partagée, par exemple
`depot@osmoserh.fr`. **Une seule adresse pour tous les clients** —
l'expéditeur suffit à savoir de qui il s'agit, aucune adresse par client
à gérer.

### 2. Un secret

Dans la Static Web App → Configuration → Variables d'environnement :

| Variable | Valeur |
|---|---|
| `COURRIEL_SECRET` | une chaîne longue et aléatoire, générée pour l'occasion |

### 3. Un flux Power Automate

Deux actions, pas une de plus.

**Déclencheur** : « À la réception d'un nouveau message (V3) », sur la
boîte partagée, avec les pièces jointes.

**Action 1 — HTTP** :

- Méthode : `POST`
- URI : `https://espace.osmoserh.fr/api/demande`
- En-têtes : `Content-Type: application/json`, `x-courriel-secret: <le secret>`
- Corps :

```json
{
  "action": "courriel",
  "de": "@{triggerOutputs()?['body/from']}",
  "objet": "@{triggerOutputs()?['body/subject']}",
  "corps": "@{triggerOutputs()?['body/bodyPreview']}",
  "messageId": "@{triggerOutputs()?['body/internetMessageId']}",
  "pieces": "@{triggerOutputs()?['body/attachments']}"
}
```

Les pièces jointes doivent arriver sous la forme
`[{ "nom": …, "type": …, "contenu": <base64> }]` ; si le connecteur
nomme ses champs autrement (`name`, `contentType`, `contentBytes`), les
remapper avec une action « Sélectionner ».

**Action 2 — Répondre** : « Répondre au message » avec
`@{body('HTTP')?['reponse']?['corps']}`, **à condition** que
`reponse` ne soit pas vide (un doublon détecté ne renvoie rien : il ne
faut pas répondre deux fois au même message).

### Recommandations

- Limiter la boîte de dépôt aux expéditeurs externes légitimes, ou
  activer le filtrage anti-spam standard : les messages non reconnus
  reçoivent une réponse, ce qui peut alimenter du bruit.
- Ne pas mettre l'adresse de dépôt en copie des alertes du portail :
  le portail se répondrait à lui-même.

## Détail technique

- Module : `api/src/courriel.js`.
- Route : `POST /api/demande` avec `{ "action": "courriel" }` — aucune
  route nouvelle, doctrine respectée.
- Traité avant le verrou jeton, comme les leads du site vitrine et
  l'onboarding salarié : le secret d'en-tête et l'annuaire tiennent
  lieu d'authentification.
- Réponse : `{ reconnu, client, reference, cree, champs, deposees,
  refusees, manque, reponse: { objet, corps } }`. L'API calcule, le flux
  envoie — comme les alertes et les rappels de paie.
- Banc de vérification : `simu-courriel.js` (56 contrôles — lecture
  d'adresse, classement des pièces, rapprochement de salarié,
  cloisonnement, doublons, pièces hors normes, secret, pannes).
