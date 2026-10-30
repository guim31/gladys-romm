# RomM

Votre serveur [RomM](https://romm.app) (le gestionnaire auto-hébergé de votre
ludothèque rétro) dans Gladys, sur votre réseau local : les jeux, les
plateformes, la taille de la bibliothèque, les jeux encore sans métadonnées, les
derniers jeux ajoutés sur un tableau de bord, des scènes qui réagissent à
l'arrivée d'un nouveau jeu ou à la fin d'un scan, et une action de scène pour
scanner la bibliothèque.

L'intégration a été testée sur un vrai RomM 5.4.1 (l'image Docker officielle,
avec des jeux homebrew), pas encore dans une vraie installation de Gladys : vos
retours sont les bienvenus sur le
[forum Gladys](https://community.gladysassistant.com) ou dans les
[issues](https://github.com/guim31/gladys-romm/issues).

## Ce qu'il vous faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un serveur **RomM** joignable depuis Gladys (même réseau), sur le port de son
  interface web (`8080` par défaut). RomM 5.4 ou plus récent pour lancer un scan
  depuis Gladys.
- De quoi se connecter, au choix :
  - **conseillé**, un **jeton d'API client** : dans RomM, ouvrez votre profil,
    puis **Client API tokens**, créez un jeton avec les droits **View ROMs**,
    **View platforms** et, pour voir et lancer les scans, **Run tasks** (compte
    administrateur), et copiez-le (il commence par `rmm_`) ;
  - ou l'**identifiant** et le **mot de passe** d'un utilisateur RomM (un
    administrateur pour voir et lancer les scans).

## Mise en place

1. Installez l'intégration depuis le catalogue de Gladys.
2. Dans **Configuration**, saisissez l'**Adresse** de RomM (par exemple
   `192.168.1.2:8080` ; sans port, `8080` est utilisé), puis le **Jeton d'API
   client**, ou l'**Identifiant** et le **Mot de passe**.
3. Enregistrez, puis cliquez sur **Tester la connexion** : le message sous le
   bouton donne la version de RomM, les jeux et la taille de la bibliothèque,
   les plateformes et les jeux sans métadonnées.
4. Ouvrez l'onglet **Découverte** : un appareil pour le serveur. Cliquez sur
   **Ajouter**, choisissez une pièce et enregistrez.

Options :

- **Intervalle de rafraîchissement** : de 1 à 10 minutes (2 minutes par
  défaut). Chaque rafraîchissement fait cinq petites requêtes à l'API de RomM.
- **Langue des noms de fonctionnalités** : les noms donnés aux fonctionnalités à
  l'ajout de l'appareil (français par défaut) et les phrases des actions de
  scène.

L'intégration lit RomM. Elle ne change quelque chose que si vous le demandez :
le bouton **Scanner** du widget et l'action de scène **Scanner la bibliothèque
RomM**.

## L'appareil

Un appareil, **RomM** suivi de l'adresse du serveur :

| Fonctionnalité            | Ce qu'elle donne                                            |
| ------------------------- | ----------------------------------------------------------- |
| En ligne                  | 1 quand RomM répond, 0 sinon                                |
| Plateformes               | plateformes qui ont des jeux dans la bibliothèque           |
| Jeux                      | jeux de la bibliothèque                                     |
| Taille de la bibliothèque | taille des fichiers de jeux sur le disque, en Go            |
| Jeux sans métadonnées     | jeux que RomM n'a rapprochés d'aucune source de métadonnées |
| Dernier jeu ajouté        | son nom et sa plateforme, en texte                          |

Les chiffres bougent à chaque rafraîchissement.

## Tableau de bord

Le widget **RomM** affiche trois tuiles (jeux, plateformes, jeux sans
métadonnées), le scan en cours avec sa progression, la liste des derniers jeux
ajoutés (nom, plateforme et date), et un bouton **Scanner** qui lance un scan
rapide (nouveaux jeux seulement).

Ajoutez-le depuis l'éditeur du tableau de bord. Réglages : le nombre de jeux de
la liste (3, 5 ou 8), un interrupteur pour masquer les tuiles et un pour masquer
le bouton. Il fonctionne avant même l'ajout de l'appareil.

## Scènes

### Déclencheurs

- **Jeu ajouté dans RomM** : un nouveau jeu est apparu dans la bibliothèque RomM
  (après un scan ou un envoi). Filtre : **Plateforme** (le nom de la plateforme,
  exactement comme RomM l'affiche, par exemple `Game Boy Advance` ; vide :
  n'importe laquelle). Informations transmises aux actions : le nom du jeu, sa
  plateforme, son nom de fichier, le lien vers le jeu dans RomM et le nombre de
  jeux de la bibliothèque. Tant que RomM cherche encore les métadonnées d'un
  jeu, l'événement attend son nom définitif (30 minutes au plus).
- **Scan RomM terminé** : un scan de la bibliothèque est terminé, quelle que
  soit son origine (Gladys, l'interface web de RomM, sa planification).
  Informations : le type de scan tel que RomM le nomme (`Quick Scan`…), les
  nouveaux jeux, les jeux identifiés et les jeux scannés (comptés par RomM), les
  jeux de la bibliothèque et la durée en minutes. Demande un compte qui voit les
  tâches (administrateur, ou jeton avec **Run tasks**).

Chaque événement n'est annoncé qu'une fois, même après un redémarrage de
l'intégration. Ce que RomM avait déjà au démarrage de l'intégration n'est pas
annoncé.

### Actions

- **Scanner la bibliothèque RomM** : lance un scan, comme le bouton **Scan** de
  RomM. Option **Que scanner** : **Nouveaux jeux seulement (rapide)** (par
  défaut), **Jeux sans métadonnées** (pour réessayer les sources de
  métadonnées) ou **Toute la bibliothèque (complet, lent)**. Demande RomM 5.4 ou
  plus récent et un compte administrateur (ou un jeton avec **Run tasks**). Un
  scan déjà en cours fait échouer l'action.
- **Lire les derniers jeux RomM** : lit RomM maintenant et donne une phrase pour
  un message ou une annonce vocale, comme « RomM : 152 jeux sur 6 plateformes.
  Derniers ajouts : Tobu Tobu Girl (Game Boy), … », avec les chiffres à part
  (jeux, plateformes, jeux sans métadonnées, nom et plateforme du dernier jeu
  ajouté). Option : le nombre de jeux cités dans la phrase (3 par défaut).

### Idées de scènes

- Chaque nuit à 3 h, scanner la bibliothèque RomM ; quand le scan est terminé
  avec de nouveaux jeux, vous envoyer un message « {new_games} nouveau(x) jeu(x)
  dans RomM ».
- Quand un jeu est ajouté sur la plateforme **Game Boy Advance**, prévenir les
  enfants : « Nouveau jeu : {name} ».
- Le samedi matin, lire les derniers jeux RomM et annoncer la phrase sur
  l'enceinte du salon.

## Dépannage

- **« RomM ne répond pas »** : vérifiez l'adresse et le port (`8080`), et que
  Gladys peut joindre le serveur (même réseau, pare-feu).
- **« RomM a refusé la connexion »** : recopiez le jeton d'API client (un jeton
  peut expirer ou être révoqué), ou vérifiez l'identifiant et le mot de passe.
- **« Ce compte ne peut pas lire les jeux »** : il manque au jeton les droits
  **View ROMs** et **View platforms** : créez-en un nouveau avec ces droits.
- **« Un scan demande un compte administrateur »** : l'utilisateur n'est pas
  administrateur, ou le jeton n'a pas **Run tasks**. Les jeux restent lus ;
  **Scan RomM terminé** ne se déclenche pas.
- **« Lancer un scan depuis Gladys demande RomM 5.4 ou plus récent »** : mettez
  RomM à jour ; les versions plus anciennes ne lancent un scan que depuis leur
  interface web.
- **« Aucun RomM à cette adresse »** : un autre service répond sur ce port.
- **« L'adresse redirige »** : un proxy inverse renvoie vers une page de
  connexion ou vers HTTPS ; saisissez l'adresse directe de RomM sur votre
  réseau.
- Plus de détails : réglez le `LOG_LEVEL` de l'intégration sur `debug` et
  ouvrez ses logs.

## Limites

- Les chiffres et les événements sont aussi frais que l'intervalle de
  rafraîchissement.
- Seuls les 10 jeux les plus récents sont comparés à chaque rafraîchissement :
  au-delà de 10 nouveaux jeux d'un coup (un dossier entier copié), les jeux
  sont comptés, pas tous annoncés.
- Les chiffres de **Scan RomM terminé** sont ceux de RomM, qui peut compter
  moins de jeux qu'il n'en a vraiment ajouté.
- Pas de jaquette dans le widget : les jaquettes de RomM demandent une
  connexion que le tableau de bord n'a pas.
- L'intégration est écrite pour l'API de RomM 5 (testée sur la 5.4.1) : une
  future version qui la changerait pourrait demander une mise à jour.
- Sans lien avec RomM.
