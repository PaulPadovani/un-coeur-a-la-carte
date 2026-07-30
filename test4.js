/* test4.js — les voies d'ejection librement placees.
   node test4.js

   Ce que l'on verifie : la transposition n'est plus une case a cocher, elle
   se CONSTRUIT en posant l'aorte au-dessus du ventricule droit. Et les
   assemblages qui n'ont pas de sens anatomique doivent etre refuses, pas
   simules en silence.                                                     */
var fs = require('fs');
var src = '';
['js/anatomie.js', 'js/model.js', 'js/vitals.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

function A(o) {
  var a = new Anatomie();
  for (var k in o) { if (k === 'gestes') continue; a[k] = o[k]; }
  if (o.gestes) for (var g in o.gestes) a.gestes[g] = o.gestes[g];
  return a;
}
function pad(s, n) { s = '' + s; while (s.length < n) s += ' '; return s; }
function ligne(nom, a, env) {
  var e = resoudre(a, env || {}), c = classer(a, e);
  console.log(pad(nom, 44), pad(c.statut, 13),
              'SaO2 ' + pad(e.SaO2.toFixed(0) + '%', 5),
              'SapO2 ' + pad(e.SapO2.toFixed(0) + '%', 5),
              'Qp/Qs ' + e.qpqs.toFixed(2), '|', c.titre);
  return { e: e, c: c };
}

var CONCORD = { oreillettes: 'O3', ventriculeDroit: 'V3',
                ventriculeGauche: 'V4', fbv: 'ferme' };
function tga(extra) {
  var o = { voieDroite: 'A1', voieGauche: 'P1' };
  for (var k in CONCORD) o[k] = CONCORD[k];
  for (var j in (extra || {})) o[j] = extra[j];
  return A(o);
}

console.log('=== transposition construite : aorte au-dessus du VD ===');
var t1 = ligne('septum intact', tga());
var t2 = ligne('+ CIA large', tga({ oreillettes: 'O2' }));
var t3 = ligne('+ CIV large', tga({ fbv: 'large' }));
var t4 = ligne('+ Rashkind', tga({ gestes: { rashkind: true }, oreillettes: 'O2' }));

console.log('\n=== assemblages sans issue ===');
var d1 = ligne('deux aortes', A({ voieDroite: 'A1', voieGauche: 'A1' }));
var d2 = ligne('deux artères pulmonaires', A({ voieDroite: 'P1', voieGauche: 'P1' }));

console.log('\n=== compatibilite de l ancienne API ===');
var a = A({ oreillettes: 'O3', ventriculeDroit: 'V3', ventriculeGauche: 'V4',
            fbv: 'ferme', discordance: true });
console.log('discordance:true  ->  voieDroite=' + a.voieDroite +
            '  voieGauche=' + a.voieGauche +
            '  ap=' + a.ap + '  aorte=' + a.aorte);

/* ------------------------------------------------------------------ */
var echecs = [];
function attendu(cond, quoi) { if (!cond) echecs.push(quoi); }

attendu(t1.e.SaO2 < 40, 'TGA a septum intact doit etre profondement desaturee');
attendu(t1.e.SapO2 > t1.e.SaO2,
        'en transposition l artere pulmonaire est PLUS saturee que l aorte');
attendu(t2.e.SaO2 > 75, 'TGA + CIA large doit remonter au-dessus de 75 %');
attendu(t3.e.SaO2 > 75, 'TGA + CIV large doit remonter au-dessus de 75 %');
attendu(t4.e.SaO2 > 75, 'le Rashkind doit sauver la TGA');
attendu(d1.c.statut === 'impossible', 'deux aortes = assemblage impossible');
attendu(d2.c.statut === 'impossible', 'deux AP = assemblage impossible');
attendu(a.voieDroite === 'A1' && a.voieGauche === 'P1',
        'discordance:true doit poser l aorte sur la voie droite');

console.log('\n' + (echecs.length ? 'ECHECS :\n  ' + echecs.join('\n  ')
                                  : 'tout est conforme'));
process.exit(echecs.length ? 1 : 0);
