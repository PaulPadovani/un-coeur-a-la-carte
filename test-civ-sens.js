/* Régression : sens de la CIV et teinte du VG dans une obstruction droite.
   node test-civ-sens.js */
'use strict';
var fs = require('fs'), vm = require('vm'), path = require('path');
var contexte = vm.createContext({ console: console });
['anatomie.js', 'model.js', 'render.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', f), 'utf8'), contexte);
});
var echecs = [];
function verifier(ok, message) { if (!ok) echecs.push(message); }
function coeur(ap, cerclage, fbv) {
  var a = new contexte.Anatomie();
  a.oreillettes = 'O3';
  a.ventriculeDroit = 'V3';
  a.ventriculeGauche = 'V4';
  a.voieDroite = ap;
  a.voieGauche = 'A1';
  a.fbv = fbv;
  a.canal = 0;
  a.gestes.cerclage = cerclage;
  var e = contexte.resoudre(a, { rvpRatio: contexte.rapportRVP(142, a.gestes) });
  return { a: a, e: e, teintes: contexte.teintes(a, e),
    sens: contexte.sensZone({ comp: 'fbv' }, a.describe(), e) };
}

var fallot = coeur('P2', true, 'large');
verifier(fallot.e.qpqs < 1 && fallot.e.SaO2 < fallot.e.SpvO2,
  'L’obstacle pulmonaire avec CIV large doit diminuer Qp/Qs et la SaO₂');
verifier(fallot.e.fluxVisuel.sensCIV === 1 && fallot.sens === 1,
  'Le flux de la CIV doit aller du VD vers le VG');
verifier(fallot.teintes.vg === fallot.teintes.aorte &&
         fallot.teintes.vg === fallot.e.SaO2,
  'Le VG doit avoir la même teinte mélangée que l’aorte');

var simple = coeur('P1', false, 'large');
verifier(simple.e.fluxVisuel.sensCIV === -1 && simple.sens === -1,
  'Une CIV large sans obstacle droit doit garder son sens gauche-droite');
verifier(simple.teintes.vg === contexte.CFG.SpvO2,
  'Le VG sans shunt droit-gauche doit rester oxygéné');

var intact = coeur('P2', true, 'ferme');
verifier(intact.e.fluxVisuel.sensCIV === 0 && intact.teintes.vg === contexte.CFG.SpvO2,
  'Un septum fermé ne doit pas mélanger le sang du VG');

var univentriculaire = new contexte.Anatomie();
var eu = contexte.resoudre(univentriculaire, { rvpRatio: 0.25 });
verifier(eu.fluxVisuel.sensCIV === 0 &&
         contexte.sensZone({ comp: 'fbv' }, univentriculaire.describe(), eu) ===
         contexte.sensPassage('fbv', univentriculaire.describe()),
  'Le foramen bulbo-ventriculaire conserve son sens anatomique');

verifier(contexte.CATALOGUE.fbv[0].nom === 'CIV large' &&
         contexte.CATALOGUE.fbv[1].nom === 'CIV restrictive',
  'Les deux libellés français de la liste doivent dire CIV');

console.log(echecs.length ? 'ÉCHECS :\n  ' + echecs.join('\n  ') :
  'CIV conforme : shunt inversé, teintes, cas témoins et libellés');
process.exitCode = echecs.length ? 1 : 0;
