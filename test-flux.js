/* test-flux.js — régressions de la cartographie hémodynamique et du champ
   de vitesse. Sans DOM : on teste le balisage produit et le solveur, pas le
   rendu SVG lui-même.
   node test-flux.js */
var fs = require('fs');
var src = '';
['js/cartes.js', 'js/anatomie.js', 'js/model.js', 'js/champ.js',
 'js/render.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

var echecs = [];
function attendu(cond, quoi) { if (!cond) echecs.push(quoi); }

/* ------------------------------------------------------------------
   1. Cartographie : le balisage porte-t-il la bonne hémodynamique ?
------------------------------------------------------------------ */
var a = new Anatomie();
a.voieDroite = 'P3';
a.voieGauche = 'A1';
a.canal = 0;
a.gestes.btt = true;
var e = resoudre(a, { rvpRatio: 0.25 });
var svg = assembler(a);

attendu(e.fluxVisuel && e.fluxVisuel.shunt > 0.06,
        'le BTT salvateur doit porter un débit visible');

var aH0 = new Anatomie();
aH0.gestes.btt = true;
var eH0 = resoudre(aH0, { rvpRatio: 0.85 });
attendu(eH0.fluxVisuel && eH0.fluxVisuel.shunt > 0.008,
        'le BTT doit rester perceptible a H0 malgre un canal encore ouvert');
attendu(svg.indexOf('M860.6,298.8 Q638.1,166.7 395.9,257.7') >= 0,
        'l axe du BTT doit relier ses deux anastomoses');
attendu(/data-flux="shunt"[^>]+data-vitesse="2.35"/.test(svg),
        'le BTT doit porter son facteur de vitesse local');
attendu(svg.indexOf('class="flux-streamlet"') >= 0 &&
        svg.indexOf('class="flux-crete"') >= 0,
        'les flux doivent conserver une histoire lagrangienne');
attendu(svg.indexOf('stroke-dasharray') < 0 &&
        svg.indexOf('flux-guide') < 0 && svg.indexOf('flux-particule') < 0 &&
        svg.indexOf('flux-volume') < 0 && svg.indexOf('flux-memoire') < 0,
        'aucun ancien rail, chapelet de pilules ni nuage de hachures ne doit subsister');
attendu(svg.indexOf('flux-lueur') < 0,
        'plus de filtre de flou : il coûtait trop cher en projection');

var b = new Anatomie();
b.gestes.cerclage = true;
var svgBand = assembler(b);
attendu(/data-flux="ap-tronc"[^>]+data-vitesse="2.8"[^>]+data-largeur="[^"]+"[^>]+data-profil="7"[^>]+data-jet="1"/
          .test(svgBand),
        'le cerclage doit produire un jet accéléré à profil plat');

var c = new Anatomie();
c.fbv = 'restrictif';
var svgFbv = assembler(c);
attendu(/data-flux="fbv"[^>]+data-vitesse="3"[^>]+data-largeur="[^"]+"[^>]+data-profil="7"[^>]+data-jet="1"/
          .test(svgFbv),
        'le FBV restrictif doit produire un jet accéléré');

/* La cloison n'est pas du même côté des deux cartes ventriculaires. */
var svgN = assembler(new Anatomie());
var reVent = /data-mode="(?:ventricule-|bulbe-|cavite-)[^"]*"[^>]*data-septum="(droite|gauche)"/g;
var cotes = (svgN.match(reVent) || []).map(function (s) {
  return /data-septum="(\w+)"/.exec(s)[1];
});
attendu(cotes.length === 2 && cotes.indexOf('droite') >= 0 &&
        cotes.indexOf('gauche') >= 0,
        'les deux ventricules doivent déclarer des cloisons opposées (obtenu : ' +
        cotes.join(', ') + ')');
attendu(/data-flux="od"[^>]*data-septum="droite"/.test(svgN) &&
        /data-flux="og"[^>]*data-septum="gauche"/.test(svgN),
        'les deux oreillettes doivent déclarer des cloisons opposées');

var d = new Anatomie();
d.ventriculeDroit = 'V1';
var dd = d.describe();
var svgBorgne = assembler(d);
attendu(modeVentricule(dd, 'droit') === 'cavite-borgne',
        'un ventricule croupion communicant doit être reconnu comme borgne');
attendu(svgBorgne.indexOf('data-mode="cavite-borgne"') >= 0,
        'une cavité borgne doit recevoir une recirculation fermée');
attendu(svgBorgne.indexOf('data-flux="fbv"') < 0,
        'aucun filet net ne doit être dirigé vers une cavité borgne');

d.fbv = 'ferme';
dd = d.describe();
attendu(modeVentricule(dd, 'droit') === 'cavite-isolee',
        'un ventricule croupion au septum fermé doit rester immobile');

/* ------------------------------------------------------------------
   2. Le solveur. Lumière rectangulaire de synthèse, ouverte en haut et en
   bas : on vérifie les invariants physiques, pas l'esthétique.
------------------------------------------------------------------ */
function lumiereTube(x, y) {
  return x > 150 && x < 450 && y > 20 && y < 980;
}

var ch = new ChampCavite('ventricule-traversant', 'droite');
attendu(ch.construire(lumiereTube), 'le masque doit être exploitable');
attendu(ch.entrees.length > 0 && ch.sorties.length > 0,
        'un ventricule traversant doit trouver une entrée et une sortie');
ch.definirDebit(1.8);
for (var k = 0; k < 260; k++) ch.pas(0.045);

var vCentre = ch.vitesse(300, 500);
var vParoi = ch.vitesse(158, 500);
attendu(vCentre.y < -20,
        'le sang doit monter de la valve auriculo-ventriculaire vers la voie ' +
        'd éjection (obtenu : ' + vCentre.y.toFixed(1) + ')');
attendu(vParoi.m < vCentre.m * 0.55,
        'adhérence : la vitesse doit chuter contre le myocarde (' +
        vParoi.m.toFixed(1) + ' contre ' + vCentre.m.toFixed(1) + ')');

/* Conservation de la masse : la divergence résiduelle doit rester petite
   devant le flux qui traverse une maille. */
var pire = 0, ref = Math.max(1e-6, Math.abs(vCentre.y)) / ch.h;
for (var m = 0; m < ch.fluide.length; m++) {
  var cc = ch.fluide[m];
  if (ch.type[cc] !== CH_FLUIDE) continue;
  var ci = cc % ch.nx, cj = (cc - ci) / ch.nx;
  var dv = (ch.u[cj * (ch.nx + 1) + ci + 1] - ch.u[cj * (ch.nx + 1) + ci] +
            ch.v[(cj + 1) * ch.nx + ci] - ch.v[cj * ch.nx + ci]) / ch.h;
  pire = Math.max(pire, Math.abs(dv));
}
attendu(pire < ref * 0.35,
        'le champ doit rester quasi à divergence nulle (résidu ' +
        pire.toFixed(3) + ' pour une référence de ' + ref.toFixed(3) + ')');

/* La vitesse d entrée suit la section de l orifice : un orifice plus étroit
   accélère le jet, sans facteur ad hoc. */
var large = new ChampCavite('ventricule-traversant', 'droite');
large.construire(function (x, y) { return x > 100 && x < 500 && y > 20 && y < 980; });
var etroit = new ChampCavite('ventricule-traversant', 'droite');
etroit.construire(function (x, y) { return x > 260 && x < 340 && y > 20 && y < 980; });
large.definirDebit(1.5); etroit.definirDebit(1.5);
attendu(etroit.U > large.U * 2,
        'à débit égal, un orifice plus étroit doit imposer une vitesse plus ' +
        'élevée (' + etroit.U.toFixed(0) + ' contre ' + large.U.toFixed(0) + ')');

/* Cavité borgne : rien ne doit en sortir, jamais. */
var borgne = new ChampCavite('cavite-borgne', 'droite');
borgne.construire(function (x, y) {
  var dx = (x - 300) / 130, dy = (y - 500) / 210;
  return dx * dx + dy * dy < 1;
});
attendu(borgne.entrees.length === 0 && borgne.sorties.length === 0,
        'une cavité borgne ne doit déclarer aucun port');
borgne.definirDebit(0.052);
for (var k2 = 0; k2 < 260; k2++) borgne.pas(0.045);
var px = 300, py = 560, evade = false, bouge = 0;
for (var t = 0; t < 900; t++) {
  var vv = borgne.vitesse(px, py);
  px += vv.x / 60; py += vv.y / 60;
  bouge += vv.m / 60;
  if (!borgne.dedans(px, py)) { evade = true; break; }
}
attendu(!evade, 'aucune particule ne doit s échapper d une cavité borgne');
attendu(bouge > 40,
        'une cavité borgne doit tout de même recirculer (' + bouge.toFixed(0) + ')');

/* Le foramen s ouvre du côté de la cloison, et il change de côté selon la
   carte. C est le bogue que portait l ancien champ analytique : le
   ventricule gauche vidait son foramen vers sa paroi libre. */
function lumiereLarge(x, y) { return x > 60 && x < 540 && y > 20 && y < 980; }
var latD = new ChampCavite('ventricule-lateral', 'droite');
latD.construire(lumiereLarge);
var latG = new ChampCavite('ventricule-lateral', 'gauche');
latG.construire(lumiereLarge);
function moyenneI(ch2) {
  var s = 0;
  for (var i = 0; i < ch2.sorties.length; i++) s += ch2.sorties[i].i;
  return ch2.sorties.length ? s / ch2.sorties.length : -1;
}
attendu(latD.sorties.length > 0 && latG.sorties.length > 0,
        'un ventricule à sortie latérale doit trouver son foramen');
attendu(moyenneI(latD) > CH_NX * 0.7 && moyenneI(latG) < CH_NX * 0.3,
        'le foramen doit s ouvrir du côté de la cloison, et en changer selon ' +
        'la carte (droite : ' + moyenneI(latD).toFixed(1) +
        ', gauche : ' + moyenneI(latG).toFixed(1) + ')');

/* Le foramen se cherche à la hauteur de l ouverture, pas n importe où. */
var sortiesY = latD.sorties.map(function (s) { return (s.j + 0.5) * latD.h; });
var yMin = Math.min.apply(null, sortiesY), yMax = Math.max.apply(null, sortiesY);
attendu(yMin > 500 - CH_DEMI_PORT - 20 && yMax < 500 + CH_DEMI_PORT + 20,
        'le foramen bulbo-ventriculaire doit se placer à sa hauteur anatomique');

console.log(echecs.length ? 'ECHECS :\n  ' + echecs.join('\n  ')
                          : 'flux conformes : BTT, jets, cavités borgnes, ' +
                            'solveur (adhérence, masse, ports)');
process.exit(echecs.length ? 1 : 0);
