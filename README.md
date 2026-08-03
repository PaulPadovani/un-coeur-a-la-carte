# Un cœur à la carte

**Documentation : Français · [English](README.en.md)**

Simulateur interactif de physiopathologie cardiaque congénitale, centré sur la
transition néonatale et les circulations fonctionnellement univentriculaires.

[Ouvrir le simulateur en français](https://paulpadovani.github.io/un-coeur-a-la-carte/)
·
[Open the simulator in English](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)

> **Avertissement médical**
>
> Ce logiciel est un outil pédagogique. Il ne constitue ni un dispositif
> médical, ni un modèle prédictif validé, ni une aide au diagnostic ou à la
> décision thérapeutique. Il ne doit pas être utilisé pour la prise en charge
> d'un patient.

## Présentation

« Un cœur à la carte » permet de construire une anatomie à partir de cartes,
de lancer la circulation à la naissance et d'observer son évolution pendant la
première semaine de vie. Le même moteur représente notamment le cœur normal,
les communications interauriculaire et interventriculaire, la transposition
des gros vaisseaux, les obstacles pulmonaires ou systémiques et plusieurs
configurations de ventricule unique.

Le simulateur met en relation l'anatomie, les débits et l'oxygénation. Il
affiche en temps réel :

- les saturations artérielle et veineuse en oxygène ;
- le rapport des débits pulmonaire et systémique (Qp/Qs) ;
- le transport systémique en oxygène et la réserve physiologique ;
- la fermeture du canal artériel et la chute des résistances vasculaires
  pulmonaires ;
- la trajectoire circulatoire observée et sa projection à réglages constants ;
- les conséquences de sept interventions médicales ou chirurgicales.

Les flux animés donnent une représentation qualitative de la direction et de
la répartition des débits. Ils ne constituent pas une simulation de mécanique
des fluides.

## Utilisation

### En ligne

- [Interface française](https://paulpadovani.github.io/un-coeur-a-la-carte/)
- [English interface](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)

### Hors ligne

1. Télécharger ou cloner le dépôt.
2. Ouvrir `index.html` pour l'interface française ou `en/index.html` pour
   l'interface anglaise.

Aucune installation, compilation, dépendance ou connexion réseau n'est
nécessaire. Les deux interfaces utilisent le même moteur physiologique en
HTML, CSS et JavaScript natifs.

## Modèle physiologique

Le moteur traduit l'anatomie sélectionnée en un graphe circulatoire, vérifie
la connexité des voies, résout les débits puis calcule les saturations par
bilan de masse en oxygène.

Deux mécanismes sont traités séparément :

1. la **pression ventriculaire commune**, qui détermine le partage entre Qp et
   Qs ;
2. le **mélange complet**, qui détermine les saturations systémique et
   pulmonaire.

Cette distinction permet de représenter avec un seul moteur des circuits
séparés, des shunts intracardiaques, une discordance ventriculo-artérielle et
des circulations fonctionnellement univentriculaires.

Pendant la transition néonatale, la baisse des résistances vasculaires
pulmonaires et la fermeture du canal artériel évoluent indépendamment. Les
paramètres sont calibrés pour préserver la directionnalité physiologique et
la cohérence pédagogique ; ils ne sont pas destinés à produire des
prédictions individuelles.

Les principaux ancrages scientifiques sont documentés dans
[`REFERENCES.md`](REFERENCES.md).

## Validation du comportement

Quatre scripts vérifient les comportements directionnels essentiels :

```text
node test.js
node test2.js
node test3.js
node test4.js
```

Ils couvrent notamment la circulation normale, les ducto-dépendances
pulmonaire et systémique, l'hyperdébit pulmonaire, la restriction auriculaire,
la transposition avec mélange insuffisant et le rejet des assemblages sans
issue anatomique.

Le rapport de comportement présente une matrice de 190 simulations — 19
anatomies et 10 stratégies d'intervention — ainsi que leur évolution pendant
sept jours :

- consulter [`rapport-moteur.html`](rapport-moteur.html) ;
- le régénérer avec `node rapport.js`.

Ces contrôles évaluent la cohérence interne et la directionnalité du modèle.
Ils ne constituent pas une validation clinique.

## Architecture du dépôt

| Élément | Rôle |
|---|---|
| `index.html`, `en/index.html` | Interfaces française et anglaise |
| `css/vu.css` | Mise en page, projection et accessibilité visuelle |
| `js/anatomie.js` | Catalogue anatomique, résistances et graphe circulatoire |
| `js/model.js` | Calcul des débits, saturations et classifications |
| `js/vitals.js` | Horloge, canal artériel, réserve physiologique et événements |
| `js/render.js` | Assemblage, rendu et visualisation des flux |
| `js/transition.js` | Graphe de transition néonatale |
| `js/i18n.js` | Terminologie de l'interface anglaise |
| `js/main.js` | Coordination de l'interface |
| `test*.js`, `rapport.js` | Contrôles directionnels et rapport de comportement |

## Portée et limites

- Le modèle couvre la période néonatale, de la naissance à J7.
- Les résistances vasculaires et anatomiques sont exprimées en unités
  relatives, et non en unités cliniques.
- Les circulations de Glenn et de Fontan ne sont pas modélisées.
- Le retour veineux pulmonaire anormal, l'hétérotaxie et la fuite
  auriculo-ventriculaire ne sont pas représentés.
- Les axes de flux sont des indications visuelles et non des champs de
  vitesse calculés.

## Contribuer et citer

Les propositions portant sur la justesse physiologique, la pédagogie,
l'accessibilité ou la robustesse sont les bienvenues. Les règles techniques et
les modalités de contribution sont précisées dans
[`CONTRIBUTING.md`](CONTRIBUTING.md).

Les informations de citation sont disponibles dans
[`CITATION.cff`](CITATION.cff). GitHub permet également de les exporter depuis
la rubrique **Cite this repository**.

## Licence et identité visuelle

Le logiciel est mis à disposition sous la
[PolyForm Noncommercial License 1.0.0](LICENSE). Il s'agit d'un logiciel
**source disponible** et non d'un logiciel open source au sens de l'Open
Source Initiative. Toute utilisation commerciale nécessite une autorisation
écrite distincte de Paul Padovani.

Les fichiers `assets/logo.svg`, `assets/marque.svg` et `assets/serveur.png`,
ainsi que le nom et l'identité visuelle « Un cœur à la carte », sont exclus de
la licence logicielle. Aucun droit de réutilisation n'est accordé sur ces
éléments. Voir [`NOTICE`](NOTICE) pour le périmètre complet.

Copyright © 2026 Paul Padovani.
