/* Vérifie que le canal sur le cœur suit la fermeture du modèle et les cartes.
   node test-canal-schema.js */
var fs = require('fs');
var src = '';
['js/cartes.js', 'js/anatomie.js', 'js/model.js', 'js/champ.js',
 'js/vitals.js', 'js/render.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

var assert = require('assert');
function fauxSVG() {
  var noeuds = {};
  ['canal-lumiere', 'canal-bord-1', 'canal-bord-2', 'canal-ligament', 'canal-decoupe'].forEach(function (id) {
    noeuds[id] = { style: {}, attributs: {}, setAttribute: function (k, v) { this.attributs[k] = v; } };
  });
  var groupe = { querySelector: function (s) { return noeuds[s.slice(1)]; } };
  return { groupe: groupe, noeuds: noeuds,
    querySelector: function (s) { return s === '#canal-conduit' ? groupe : noeuds[s.slice(1)]; } };
}
function aire(chemin) {
  var points = [...chemin.matchAll(/(-?\d+\.\d+),(-?\d+\.\d+)/g)]
    .map(function (m) { return [+m[1], +m[2]]; });
  var somme = 0;
  for (var i = 0; i < points.length; i++) {
    var a = points[i], b = points[(i + 1) % points.length];
    somme += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(somme / 2);
}

var anatomie = new Anatomie(), sim = new Simulation(anatomie);
var balisage = assembler(anatomie);
assert(balisage.includes('id="canal-conduit"'));
assert(!balisage.includes('id="canal-conduit" transform='));
assert(/id="canal-conduit"[\s\S]*data-flux="canal" data-debit="k"/.test(balisage));
assert(balisage.includes('id="canal-decoupe"'));
anatomie.voieDroite = 'A1'; anatomie.voieGauche = 'P1';
assert(assembler(anatomie).includes('id="canal-conduit" transform="translate(1200,0) scale(-1,1)"'));
anatomie.voieGauche = 'A1';
assert(!assembler(anatomie).includes('id="canal-conduit"'));
anatomie.voieDroite = 'P1'; anatomie.voieGauche = 'A1';

assert(aire(formeCanal(1, false).lumiere) > aire(formeCanal(0.5, false).lumiere));
assert(aire(formeCanal(0.5, false).lumiere) > aire(formeCanal(0.1, false).lumiere));
var svg = fauxSVG(), etat = resoudre(anatomie, { rvpRatio: 0.8 });
assert.strictEqual(debitDe('k', etat, anatomie.describe()), etat.fluxVisuel.canal);
assert.strictEqual(etat.fluxVisuel.sensCanal, 1);
var retrograde = new Anatomie();
retrograde.voieGauche = 'A3';
retrograde.ventriculeDroit = 'V3';
retrograde.ventriculeGauche = 'V2';
var etatRetrograde = resoudre(retrograde, { rvpRatio: 0.8 });
assert(etatRetrograde.fluxVisuel.canal > 0);
assert.strictEqual(etatRetrograde.fluxVisuel.sensCanal, -1);
assert.strictEqual(sensZone({ comp: 'canal', sensFixe: false }, anatomie.describe(),
  { fluxVisuel: { sensCanal: -1 } }), -1);
assert.strictEqual(sensZone({ comp: 'canal', sensFixe: false }, anatomie.describe(),
  { fluxVisuel: { sensCanal: 1 } }), 1);
mettreAJourCanal(svg, anatomie.describe(), sim.canalA(0), etat);
assert.strictEqual(svg.noeuds['canal-lumiere'].style.display, '');
assert.strictEqual(svg.noeuds['canal-ligament'].style.display, 'none');
assert.strictEqual(svg.noeuds['canal-decoupe'].attributs.d,
  svg.noeuds['canal-lumiere'].attributs.d);
mettreAJourCanal(svg, anatomie.describe(), sim.canalA(48), etat);
assert.strictEqual(svg.noeuds['canal-lumiere'].style.display, '');
mettreAJourCanal(svg, anatomie.describe(), sim.canalA(72), etat);
assert.strictEqual(svg.noeuds['canal-lumiere'].style.display, 'none');
assert.strictEqual(svg.noeuds['canal-ligament'].style.display, '');
anatomie.gestes.pge = true;
mettreAJourCanal(svg, anatomie.describe(), sim.canalA(72), etat);
assert.strictEqual(svg.noeuds['canal-lumiere'].style.display, '');
anatomie.canal = 0;
anatomie.gestes.btt = true;
var avecBtt = resoudre(anatomie, { rvpRatio: 0.25 });
assert.strictEqual(debitDe('k', avecBtt, anatomie.describe()), 0);
assert(debitDe('x', avecBtt, anatomie.describe()) > 0);
console.log('Canal : trajet, débit propre, sens, fermeture et PGE conformes.');
