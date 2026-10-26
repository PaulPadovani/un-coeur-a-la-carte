# Schémas, flux et repères pédagogiques

## Lecture de l’interface

La SaO₂ est la mesure principale. La plage sombre sous sa valeur représente le
repère du contexte courant, et le trait indique la valeur calculée. Ce repère
n’est pas un diagnostic : une saturation élevée peut coexister avec un Qs faible.

- Mélange complet : SaO₂ 75–85 %, Qp/Qs 1–1,5.
- Circulation en série : SaO₂ de référence du modèle 99 %, Qp/Qs = 1 sans shunt.
- Discordance ventriculo-artérielle sans mélange complet : aucune plage de
  saturation cible affichée ; le rapport Qp/Qs ne suffit pas à lire le mélange.

Ces ancrages sont documentés dans [REFERENCES.md](REFERENCES.md). Les seuils
internes de réserve et d’hyperdébit sont explicités dans « Comprendre les
repères ». Ils partagent les constantes `REPERES` de `model.js` avec le moteur.
Qp, Qs et DO₂ sont affichés en unités du modèle.

La barre Qp/Qs représente les parts Qp/(Qp + Qs) et Qs/(Qp + Qs). Son trait
central correspond à l’égalité des débits ; il ne représente pas une limite
clinique. Qp et Qs sont lus dans le moniteur, sans répétition autour du cœur.

## Conventions graphiques

L’aplat bleu–mauve–rouge indique l’oxygénation. Les filets clairs suivent les
trajets existants ; leur chevron indique la direction. Le déplacement et la
densité sont qualitatifs, sans échelle de vitesse clinique. Le bouton
« Figer les flux » conserve une lecture statique sans suspendre l’horloge.
Un changement anatomique recalcule cette lecture. La préférence système de
mouvement réduit produit un instantané des flux et désactive le balayage ECG.

Le canal artériel est dessiné directement entre la crosse aortique et la
branche pulmonaire. Il reprend le langage graphique du BTT, avec des raccords
distincts : son calibre diminue selon la perméabilité calculée par le moteur,
puis il devient un ligament sans lumière. Son trajet est réfléchi dans les
anatomies avec discordance ventriculo-artérielle ; il n’est pas montré si
l’aorte ou l’artère pulmonaire manque.
Les filets dans le canal suivent son débit propre et son sens calculés par le
modèle. Ils sont découpés dans sa lumière, se resserrent avec elle et
disparaissent à la fermeture, indépendamment d’un éventuel BTT.

Les contours générés dans `cartes.js` restent la référence anatomique.
Les tracés sont masqués par les lumières existantes ; les cavités conservent
leurs ports et le champ de `champ.js`. `lecture.js` gère uniquement les
repères du moniteur ; il ne calcule pas les débits.

## Préparer les montages chirurgicaux

`MONTAGES_SCHEMA`, dans `render.js`, déclare les couches des gestes actuels.
Le BTT possède deux raccords nommés (`sous-claviere` et
`bifurcation-pulmonaire`) et un contrôle de courbure. Son axe de flux est
construit depuis ces raccords, puis réfléchi avec le dessin en cas de discordance.
L’atrioseptostomie utilise sa couche superposée ; le cerclage conserve sa carte
de voie pulmonaire spécifique.

Pour un nouveau montage, prévoir ensemble :

1. les connexions et résistances dans `anatomie.js`, puis leur résolution dans
   `model.js` ;
2. les raccords et contours dans les sources de génération des cartes ;
3. une couche de montage, les compartiments perfusés et le sens de chaque flux ;
4. des contrôles de conservation, de connexité et de direction après intervention.

Glenn, Fontan et Norwood complet ne sont pas ajoutés par cette refonte. Ils
nécessitent une extension explicite du graphe et du modèle ; une surimpression
sur le dessin ne suffit pas. Les futurs raccords caves devront être séparés
pour distinguer VCS et VCI.

## Vérification

Les quatre scripts directionnels `test.js` à `test4.js`, ainsi que
`test-flux.js`, `test-champ-geometrie.js`, `test-retour-atrial.js` et
`test-canal-schema.js`, vérifient le moteur, les ports et la fermeture dessinée
du canal. Contrôler également dans le navigateur les
versions française et anglaise, les formats de projection et de téléphone,
le gel des flux, le retour au cœur normal, le BTT et la transposition.
