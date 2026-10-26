/* Régressions identifiées pendant la révision JMIR : retour pulmonaire et
   indépendance du bilan d'oxygène vis-à-vis du plafond d'affichage. */
'use strict';
var fs = require('fs'), vm = require('vm'), path = require('path');
var dossier = process.argv[2] || path.join(__dirname, 'js');
var moteur = vm.createContext({ console: console });
['anatomie.js', 'model.js', 'vitals.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(dossier, f), 'utf8'), moteur);
});
var echecs = [], total = 0;
function verifier(condition, message) { total++; if (!condition) echecs.push(message); }
function mesurer(cia, t, gestes) {
  var a = new moteur.Anatomie();
  a.ventriculeDroit = 'V3'; a.ventriculeGauche = 'V2';
  a.voieDroite = 'P1'; a.voieGauche = 'A3'; a.cia = cia;
  Object.assign(a.gestes, gestes || {});
  var s = new moteur.Simulation(a); a.canal = s.canalA(t);
  var e = moteur.resoudre(a, { rvpRatio: moteur.rapportRVP(t, a.gestes) });
  return { a: a, e: e, c: moteur.classer(a, e) };
}
[0, 12, 24, 48, 72, 120, 168].forEach(function (t) {
  [{}, {pge:true}, {btt:true}].forEach(function (g) {
    var b = mesurer('intacte', t, g);
    verifier(b.e.Qp === 0 && b.e.Qs === 0,
      'Retour pulmonaire bloqué : débit stationnaire inventé à H' + t);
    verifier(b.c.cause === 'retour-pulmonaire-bloque',
      'Retour pulmonaire bloqué : classification incorrecte à H' + t);
  });
  var large = mesurer('large', t), restr = mesurer('restrictive', t);
  verifier(large.e.Qp > restr.e.Qp && restr.e.Qp > 0 && large.e.Qs > restr.e.Qs,
    'Élargissement septal : remplissage non restauré à H' + t);
});
[72, 120, 168].forEach(function (t) {
  var e = mesurer('large', t).e;
  verifier(e.Qp / e.Qs > 15 && e.qpqs === 15, 'Cas de rapport plafonné absent à H' + t);
  var saturation = e.SpvO2 - moteur.CFG.VO2 * 100 / e.Qp;
  verifier(Math.abs(e.SaO2 - saturation) < 1e-9,
    'Le plafond du rapport modifie le bilan d’oxygène à H' + t);
});
console.log((total - echecs.length) + '/' + total + ' assertions conformes');
if (echecs.length) console.error(echecs.join('\n'));
process.exitCode = echecs.length ? 1 : 0;
