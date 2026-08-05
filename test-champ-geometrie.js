/* test-champ-geometrie.js — le champ tombe-t-il juste sur la VRAIE anatomie ?

   test-flux.js éprouve le solveur sur des lumières de synthèse. Ici on lui
   donne les contours réellement dessinés dans cartes.js : c'est le seul
   moyen de vérifier, sans navigateur, que les orifices d'entrée et de
   sortie se posent au bon endroit sur chaque carte. Les tracés de cartes.js
   sont déjà aplatis en polylignes (uniquement des `L`), donc un simple test
   d'appartenance par lancer de rayon suffit — pas besoin de moteur SVG.

   node test-champ-geometrie.js            résumé
   node test-champ-geometrie.js --cartes   plans ASCII des cavités
*/
var fs = require('fs');
var src = '';
['js/cartes.js', 'js/anatomie.js', 'js/model.js', 'js/champ.js',
 'js/render.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

var echecs = [];
function attendu(cond, quoi) { if (!cond) echecs.push(quoi); }

/* ---------- appartenance à un tracé aplati ---------- */
function polygones(markup) {
  var dec = decoupe(markup), out = [];
  var re = /d="([^"]+)"/g, m;
  while ((m = re.exec(dec.corps))) {
    var pts = [], sous = null;
    var jetons = m[1].match(/[MLZz][^MLZz]*/g) || [];
    for (var i = 0; i < jetons.length; i++) {
      var t = jetons[i], c = t[0];
      if (c === 'Z' || c === 'z') { if (sous && sous.length > 2) pts.push(sous); sous = null; continue; }
      var xy = t.slice(1).trim().split(/[\s,]+/).map(Number);
      if (xy.length < 2 || isNaN(xy[0]) || isNaN(xy[1])) continue;
      if (c === 'M') { if (sous && sous.length > 2) pts.push(sous); sous = [[xy[0], xy[1]]]; }
      else if (sous) sous.push([xy[0], xy[1]]);
    }
    if (sous && sous.length > 2) pts.push(sous);
    for (var k = 0; k < pts.length; k++) out.push(pts[k]);
  }
  return out;
}

function dansPolygones(polys, x, y) {
  var dedans = false;
  for (var p = 0; p < polys.length; p++) {
    var a = polys[p];
    for (var i = 0, j = a.length - 1; i < a.length; j = i++) {
      var yi = a[i][1], yj = a[j][1];
      if ((yi > y) !== (yj > y)) {
        var xi = a[i][0] + (y - yi) / (yj - yi) * (a[j][0] - a[i][0]);
        if (x < xi) dedans = !dedans;
      }
    }
  }
  return dedans;
}

/* ---------- monter un champ sur une carte réelle ---------- */
function champSurCarte(idCarte, mode, septum, x0) {
  var c = CARTES[idCarte];
  if (!c || !c.fill) return null;
  var polys = polygones(c.fill);
  var ch = new ChampCavite(mode, septum);
  var dx = x0 || 0;
  var ok = ch.construire(function (x, y) { return dansPolygones(polys, dx + x, y); });
  return ok ? ch : null;
}

function plan(ch, titre) {
  var l = ['  ' + titre + '  (. mur  ~ lumière  E entrée  S sortie)'];
  for (var j = 0; j < ch.ny; j++) {
    var ligne = '  ';
    for (var i = 0; i < ch.nx; i++) {
      var t = ch.type[j * ch.nx + i];
      ligne += t === CH_MUR ? '.' : t === CH_ENTREE ? 'E' : t === CH_SORTIE ? 'S' : '~';
    }
    l.push(ligne);
  }
  return l.join('\n');
}

/* ------------------------------------------------------------------
   Les configurations qui comptent : ventricule dominant traversé, chambre
   bulbaire convergente, ventricule croupion, et les deux oreillettes.
------------------------------------------------------------------ */
var cas = [];
var anat = new Anatomie();
var d = anat.describe();

cas.push({ nom: 'ventricule gauche dominant (carte -D, cloison à gauche)',
           carte: d.vg.id + '-' + d.fbv + '-D',
           mode: modeVentricule(d, 'gauche'), septum: 'gauche', x0: 0,
           ports: true });
cas.push({ nom: 'chambre bulbaire (carte -G, cloison à droite)',
           carte: d.vd.id + '-' + d.fbv + '-G',
           mode: modeVentricule(d, 'droit'), septum: 'droite', x0: 0,
           ports: true });
cas.push({ nom: 'oreillette droite (moitié gauche de la carte double)',
           carte: d.o.id, mode: 'oreillette-traversante', septum: 'droite',
           x0: 0, ports: true });
cas.push({ nom: 'oreillette gauche (moitié droite de la carte double)',
           carte: d.o.id, mode: 'oreillette-traversante', septum: 'gauche',
           x0: 600, ports: true });

/* atrésie tricuspide : oreillette droite borgne sauf CIA, ventricule droit
   croupion. C'est le cas où l'ancien champ inventait des sorties. */
var at = new Anatomie();
at.ventriculeDroit = 'V1';
var dat = at.describe();
cas.push({ nom: 'ventricule croupion (cavité borgne)',
           carte: dat.vd.id + '-' + dat.fbv + '-G',
           mode: modeVentricule(dat, 'droit'), septum: 'droite', x0: 0,
           ports: false });
cas.push({ nom: 'oreillette droite transseptale (CIA)',
           carte: dat.o.id, mode: 'oreillette-transseptale', septum: 'droite',
           x0: 0, ports: true });

var montrer = process.argv.indexOf('--cartes') >= 0;

for (var n = 0; n < cas.length; n++) {
  var k = cas[n];
  var ch = champSurCarte(k.carte, k.mode, k.septum, k.x0);
  if (!ch) { echecs.push('carte introuvable ou masque vide : ' + k.carte); continue; }
  var lumen = ch.fluide.length;
  attendu(lumen > 120,
          k.nom + ' : la lumière doit être substantielle (' + lumen + ' mailles)');

  if (k.ports) {
    attendu(ch.entrees.length > 0,
            k.nom + ' : aucune entrée trouvée sur la carte ' + k.carte);
    attendu(ch.sorties.length > 0,
            k.nom + ' : aucune sortie trouvée sur la carte ' + k.carte);
    /* entrée et sortie doivent être distinctes et éloignées, sinon le
       solveur court-circuiterait la cavité. */
    if (ch.entrees.length && ch.sorties.length) {
      var ye = 0, ys = 0, i;
      for (i = 0; i < ch.entrees.length; i++) ye += ch.entrees[i].j;
      for (i = 0; i < ch.sorties.length; i++) ys += ch.sorties[i].j;
      ye = ye / ch.entrees.length * ch.h; ys = ys / ch.sorties.length * ch.h;
      var xe = 0, xs = 0;
      for (i = 0; i < ch.entrees.length; i++) xe += ch.entrees[i].i;
      for (i = 0; i < ch.sorties.length; i++) xs += ch.sorties[i].i;
      xe = xe / ch.entrees.length * ch.h; xs = xs / ch.sorties.length * ch.h;
      var dist = Math.sqrt((ye - ys) * (ye - ys) + (xe - xs) * (xe - xs));
      attendu(dist > 250,
              k.nom + ' : entrée et sortie trop proches (' + dist.toFixed(0) +
              ' unités) — la cavité serait court-circuitée');
    }
  } else {
    attendu(ch.entrees.length === 0 && ch.sorties.length === 0,
            k.nom + ' : une cavité borgne ne doit ouvrir aucun port');
  }

  /* Le champ résolu doit traverser la cavité sans jamais la percer. */
  ch.definirDebit(k.ports ? 1.6 : 0.052);
  for (var s = 0; s < 240; s++) ch.pas(0.045);

  var fuites = 0, immobiles = 0, essais = 0;
  for (var e = 0; e < ch.fluide.length; e += 7) {
    var cc = ch.fluide[e], ci = cc % ch.nx, cj = (cc - ci) / ch.nx;
    var px = (ci + 0.5) * ch.h, py = (cj + 0.5) * ch.h, parcours = 0;
    essais++;
    for (var t = 0; t < 600; t++) {
      var vv = ch.vitesse(px, py);
      px += vv.x / 60; py += vv.y / 60; parcours += vv.m / 60;
      if (ch.estSortie(px, py)) break;
      if (!ch.dedans(px, py)) { fuites++; break; }
    }
    if (parcours < 5) immobiles++;
  }
  attendu(fuites === 0,
          k.nom + ' : ' + fuites + ' traceur(s) sur ' + essais +
          ' ont traversé le myocarde');
  attendu(immobiles < essais * 0.45,
          k.nom + ' : trop de zones mortes (' + immobiles + '/' + essais + ')');

  if (montrer) console.log('\n' + plan(ch, k.nom + '  [' + k.carte + ' / ' + k.mode + ']'));
}

console.log(echecs.length
  ? '\nECHECS :\n  ' + echecs.join('\n  ')
  : '\nchamp conforme sur les cartes réelles : ports placés, ' +
    'myocarde étanche, cavités traversées');
process.exit(echecs.length ? 1 : 0);
