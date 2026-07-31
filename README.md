# Un cœur à la carte

**Documentation : Français · [English](README.en.md)**

**Simulateur de physiologie cardiaque congénitale.** On compose un cœur en
empilant des cartes anatomiques, on lance l'horloge à la naissance, et on
regarde la circulation se réorganiser. Cœur normal, CIA, CIV, transposition,
coarctation, ventricule unique : c'est le même moteur.

**Simulateur en ligne :**
[▶ Français](https://paulpadovani.github.io/un-coeur-a-la-carte/) ·
[▶ English](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)

Cette version autonome constitue le dépôt public officiel. Elle peut aussi être
utilisée hors ligne en ouvrant `index.html` par double-clic : aucune dépendance,
aucun build et aucune connexion ne sont nécessaires.

**Dépôt officiel :**
[github.com/PaulPadovani/un-coeur-a-la-carte](https://github.com/PaulPadovani/un-coeur-a-la-carte)

> **Avertissement médical.** Cet outil est exclusivement pédagogique. Il
> n'est ni un dispositif médical, ni un modèle prédictif validé, ni une aide au
> diagnostic ou à la décision thérapeutique. Ses paramètres privilégient la
> directionnalité physiologique et la clarté conceptuelle.

## Contenu du dépôt public

Le dépôt contient uniquement :

- le moteur et son interface bilingue (`index.html`, `en/`, `css/`, `js/` et
  les ressources indispensables dans `assets/`) ;
- les quatre tests directionnels et le générateur du rapport de comportement ;
- ce README et une bibliographie physiologique courte dans `REFERENCES.md` ;
- les fichiers nécessaires à la licence, à la citation et aux contributions.

Il ne contient aucun manuscrit, article en préparation, lettre de soumission,
présentation, classeur bibliographique, PDF scientifique, source Adobe, ancien
moteur ou contenu du site pédagogique global.

## Licence et réutilisation

Le logiciel est mis à disposition sous la
**PolyForm Noncommercial License 1.0.0** :

- téléchargement, utilisation, modification et redistribution autorisés pour
  des finalités non commerciales ;
- utilisation pédagogique, académique, scientifique et par les établissements
  de santé autorisée dans les conditions de la licence ;
- utilisation commerciale interdite sans autorisation écrite distincte de
  Paul Padovani ;
- contributions et *pull requests* possibles selon `CONTRIBUTING.md`.

Cette restriction commerciale signifie que le projet est **source
disponible**, mais qu'il ne relève pas de l'« open source » au sens de l'Open
Source Initiative.

Les fichiers `assets/logo.svg`, `assets/marque.svg` et `assets/serveur.png`,
ainsi que le nom et l'identité visuelle « Un cœur à la carte », sont exclus de
la licence logicielle. Aucune licence de réutilisation n'est accordée sur ces
éléments. Voir `NOTICE` : toute réimplémentation doit les retirer ou les
remplacer, sauf autorisation écrite séparée.

---

## Ce qui a changé dans le moteur, et pourquoi

Le modèle précédent avait une **erreur de principe** : il appliquait la formule
de mélange à toutes les anatomies. Un cœur normal ressortait donc à 73 % de
saturation. L'erreur était de **poser** la saturation au lieu de la **calculer**.

La nouvelle architecture procède dans l'ordre :

1. **topologie** — chambre de mélange commune ou circuits séparés, concordance
   ou discordance ventriculo-artérielle ;
2. **débits** — Qp et Qs ;
3. **saturations** — par bilan de masse en oxygène.

La relation de Barnea n'est plus imposée : `SaO₂ = SpvO₂ − DAV/(Qp/Qs)`
**émerge** du bilan quand le mélange est complet. Et la formule de Di Filippo
`Qp/Qs = (SaO₂ − SvO₂)/(SvpO₂ − SaO₂)` est vérifiée par construction.

### Deux notions distinctes, et c'est le cœur de la correction

- **Pression ventriculaire commune** : le foramen est large, les deux
  ventricules sont à la même pression. Cela fixe la répartition des **débits**
  (Qp/Qs = Rsys/Rpulm). Une CIV large suffit.
- **Mélange complet** : tout le retour veineux converge dans une seule chambre
  fonctionnelle. Cela fixe les **saturations**. Une CIV large ne suffit pas —
  dans une CIV le sang cave va à droite, le sang pulmonaire à gauche, et le
  shunt gauche-droite ne désature pas l'aorte.

C'est cette distinction qui permet au même moteur de traiter une CIV, une CIA,
une transposition et un ventricule unique sans les confondre.

### Les oreillettes : un seul choix, le septum

La liste croisée de neuf lignes (« CIA restrictive + atrésie tricuspide »…) a
disparu. Il ne reste qu'un sélecteur, l'état du **septum interauriculaire**
(large, restrictif, intact).

L'atrésie auriculo-ventriculaire ne se choisit plus, parce qu'elle ne se
choisit pas : une chambre bulbaire ou un ventricule croupion n'ont pas de valve
d'entrée, donc **poser une chambre bulbaire à droite EST l'atrésie
tricuspide**. La carte auriculaire suit automatiquement — `anat.oreillettes`
est désormais calculé, `anat.cia` porte le septum et `anat.suffixeAV()` déduit
le reste des ventricules. Un rappel sous les sélecteurs dit au joueur ce qu'il
vient de construire.

Un bouton **Cœur normal** remet l'assemblage à l'archétype — septum intact,
deux ventricules, concordance — et remet l'horloge à la naissance. C'est le
point de comparaison de tout le reste.

### La transposition, désormais construite

Il n'y a plus de case « discordance ». Les deux derniers emplacements ne
s'appellent plus « artère pulmonaire » et « aorte » mais **voie d'éjection
droite** et **voie d'éjection gauche**, et chacun accepte indifféremment une
artère pulmonaire ou une aorte. Poser l'aorte au-dessus du ventricule droit et
l'artère pulmonaire au-dessus du ventricule gauche, **c'est** la transposition :
le moteur la déduit de l'assemblage.

Deux assemblages sont refusés parce qu'ils ne correspondent à rien : deux aortes
(aucun lit d'oxygénation) et deux artères pulmonaires (aucune issue systémique).
Le simulateur le dit et bloque le démarrage.

L'ancienne écriture reste valable dans les scripts : `anat.ap`, `anat.aorte` et
`anat.discordance` sont maintenant des propriétés calculées sur les deux
emplacements. Les scénarios de `rapport.js` et des tests n'ont pas eu à changer.

La discordance inverse les destinations : l'aorte reçoit le sang cave. La
saturation systémique devient alors
`SaO₂ = SpvO₂ − DAV × Qs / Qeff`, où **Qeff** est le débit de mélange
effectif. Sans communication efficace, Qeff s'effondre et la saturation avec.
Le moteur donne 12 % à une transposition à septum intact, 84 % après
atrioseptostomie.

### La transition néonatale

Le rapport RVP/RVS part de 0,85 à la naissance et tombe à 0,20 en une semaine
(exponentielle, τ = 40 h). C'est cette chute qui fait monter le Qp/Qs et qui
provoque la défaillance « en quelques jours » décrite par Di Filippo.

---

## Le bandeau de transition circulatoire

Sous les trois colonnes, un graphe montre ce qui se joue réellement pendant la
première semaine : le rapport **RVP/RVS** (axe de droite) et les deux débits
**Qp** et **Qs** (axe de gauche), de la naissance à J7. Sous l'axe court le
canal artériel, dessiné comme un vaisseau dont le calibre décroît.

Deux tracés, à ne pas confondre :

- le **trait plein** est la trajectoire réellement parcourue, avec les gestes
  posés au fil des heures — chaque geste est reporté sur le graphe à l'heure
  où il a été fait ;
- le **trait pointillé** est une projection à réglages constants : « si rien ne
  change à partir de maintenant, voilà où cela va ». Ce n'est pas un pronostic,
  seulement le prolongement des réglages actuels.

Un curseur suit l'horloge. Le bouton **Pause** (ou la barre d'espace) suspend la
simulation sans rien effacer : c'est fait pour commenter une courbe en salle.
Le bouton **Replier** réduit le bandeau à une ligne et rend toute la hauteur au
schéma — le cœur mesure 1200 × 2800 unités, c'est la hauteur disponible qui
décide de sa taille, jamais la largeur.

### Le canal artériel

Un pourcentage qui descend de 100 à 0 ne dit rien. Le canal est donc **dessiné**,
à deux endroits :

- dans le moniteur, comme un vaisseau vu de face entre l'aorte et l'artère
  pulmonaire, dont la lumière se resserre heure après heure. Les deux ostiums
  sont réellement ouverts dans la paroi ; quand le canal est fermé il ne reste
  qu'un **cordon plein — le ligament artériel**, même convention graphique que
  l'atrésie pulmonaire. La couleur suit la saturation du sang qui l'emprunte ;
- sur le graphe, comme un vaisseau **couché sur l'axe du temps**, de calibre
  décroissant. Sous prostaglandine il garde son calibre d'un bout à l'autre :
  la différence se voit d'un coup d'œil.

La **fréquence cardiaque** a quitté la liste des constantes pour le tracé ECG,
où elle est à sa place.

---

## Les flux dans le schéma

Un aplat de couleur dit la saturation mais ne dit rien du débit — or c'est le
débit, et surtout son **partage**, qui est le sujet du simulateur. Chaque
compartiment porte donc des **particules** qui remontent son axe d'écoulement,
découpées (`clip-path`) sur la forme anatomique réelle. Leur **vitesse** et
leur **densité** suivent le débit qui les porte : l'artère pulmonaire suit Qp,
l'aorte suit Qs, les ventricules ce qui les traverse. On voit le déséquilibre
avant de lire le chiffre.

**Les communications portent leur propre flux.** Le foramen bulbo-ventriculaire
et la communication interauriculaire ont leurs particules, posées à l'aplomb
exact de l'ouverture et calibrées sur elle : un foramen restrictif n'en laisse
passer que deux rangées, un foramen large trois. Le sens est déduit de
l'anatomie — en atrésie tricuspide tout le retour cave franchit la CIA vers la
gauche de l'image, en atrésie mitrale c'est l'inverse, et dans une
communication interventriculaire isolée le shunt va du cœur gauche vers le cœur
droit.

Le bouton **Flux** de l'en-tête éteint la visualisation ; les aplats de
saturation restent.

Ce n'est **pas** une IRM de flux 4D et cela n'y prétend pas : il n'y a aucun
champ de vitesses, aucun modèle de fluide. Le moteur connaît un débit par
compartiment, pas un écoulement. C'est une évocation stylisée des lignes de
courant, honnête comme pédagogie, muette sur les recirculations.

Le défilement n'est **pas** lié à la fréquence cardiaque du scope. Ce n'est pas
une pulsatilité, c'est un débit moyen ; les confondre serait une faute de sens.

Deux détails qui portent une information :

- un compartiment sans débit **se fige** et sa teinte redevient plate — un
  tronc pulmonaire borgne doit se voir immobile ;
- quand franchir la voie systémique coûte bien plus cher que de passer par le
  poumon puis le canal, **l'onde descend la crosse aortique au lieu de la
  monter** : le remplissage rétrograde se voit (`etat.retrogradeAorte`).

L'animation est coupée si `prefers-reduced-motion` est actif, et gelée en
pause comme à la mort. Le SVG n'est reconstruit que si l'anatomie change ;
sinon on se contente de recolorier, sans quoi réécrire 190 Ko de balisage à
chaque image saccaderait le tout.

Limite connue : les axes d'écoulement sont approximatifs. Le découpage sur la
région colorée les rend visuellement corrects, mais ils ne décrivent pas la
géométrie réelle de l'écoulement.

---

## Comportements vérifiés

| Anatomie | H0 | H72 | J7 | Sans intervention |
|---|---|---|---|---|
| Cœur normal | SaO₂ 99 %, Qp/Qs 1,1 | 99 %, 1,00 | 99 %, 1,00 | survie |
| Atrésie tricuspide + FBV large + AP normale | 85 %, 1,12 | 88 %, **2,40** | 89 %, **3,06** | mort H136, collapsus |
| … + cerclage | 81 %, 0,99 | 74 %, 1,09 | 76 %, 1,21 | survie |
| Atrésie tricuspide + atrésie pulmonaire | 64 %, 0,79 | débit pulmonaire nul | — | mort H64, hypoxémie |
| HypoVG | 76 %, 1,53 | 88 %, 3,21 | — | mort H57, collapsus |
| HypoVG + septum intact | 54 % | — | — | mort H12, œdème pulmonaire |
| CIA isolée | 99 %, 1,25 | 99 %, 1,50 | — | survie |
| CIV large isolée | 99 %, 1,12 | 99 %, **2,40** | — | hyperdébit |
| Transposition, septum intact | **12 %** | — | — | urgence absolue |
| Transposition + CIA large | 84 %, 1,25 | — | — | survie |

L'atrésie tricuspide avec foramen large et artère pulmonaire normale donne bien
ce que tu décrivais : **saturation excellente, Qp/Qs très élevé après la période
de transition, et le geste qui sauve est le cerclage.**

---

## Le rapport

`rapport-moteur.html` — **190 simulations** (19 anatomies × 10 interventions),
matrice de résultats et fiche détaillée par anatomie avec SaO₂, SvO₂, différence
artério-veineuse, Qp/Qs, mélange complet, pression commune, connexité des deux
voies, et quatre courbes sur sept jours.

Régénérer : `node rapport.js`. Tests directionnels : `node test.js`,
`node test2.js`, `node test3.js`, `node test4.js` (voies d'éjection libres,
transposition construite, assemblages refusés).

---

## Source des ancrages chiffrés

Di Filippo S. **Ventricule unique.** EMC — Cardiologie 2010;11-940-E-60.

La bibliographie succincte et les identifiants vérifiés sont regroupés dans
`REFERENCES.md`. Aucun texte intégral ni PDF d'article n'est redistribué.

Valeurs reprises : Qp/Qs = 1 en circulation normale ; équilibre univentriculaire
entre 1 et 1,5 (jusqu'à 2) pour une SpO₂ de 75 à 85 % ; ventricule unique sans
obstacle → SpO₂ > 90 % et défaillance en quelques jours ; obstacle droit →
cyanose réfractaire, débit suffisant tant que SpO₂ > 75 %, sténose modérée =
SpO₂ 80–90 % durable ; obstacle gauche → dévie le flux vers le poumon ;
SvO₂ croissante jusqu'à Qp/Qs = 2 puis décroissante.

---

## Limites qui restent

- Les résistances de `anatomie.js` (objet `R`) restent des unités relatives.
  Elles sont maintenant contraintes par les comportements ci-dessus, mais
  elles ne sont pas exprimées en unités Wood.
- Le Glenn et le Fontan ne sont pas modélisés. Le moteur est néonatal.
- En transposition, la carte du shunt de Blalock est simplement retournée pour
  suivre l'inversion des gros vaisseaux. Le tracé reste cohérent, mais il n'a
  pas été redessiné spécifiquement pour cette configuration.
- Le cerclage n'existe en carte que pour l'artère pulmonaire de calibre normal
  (`P1C`) et de petit calibre (`P2C`). Cercler une atrésie n'a pas de sens :
  la carte reste alors inchangée et le geste n'a aucun effet.
- Le retour veineux pulmonaire anormal, l'hétérotaxie et la fuite
  auriculo-ventriculaire ne sont pas représentés.
