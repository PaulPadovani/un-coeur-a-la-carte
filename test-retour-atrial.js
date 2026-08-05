/* test-retour-atrial.js — issue des retours veineux en cas d'atresie AV.
   node test-retour-atrial.js */
var fs = require('fs');
var src = '';
['js/anatomie.js', 'js/model.js', 'js/vitals.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

function anatomie(cia) {
  var a = new Anatomie();
  a.cia = cia;
  a.ventriculeDroit = 'V2';       /* atrésie tricuspide */
  a.ventriculeGauche = 'V4';
  return a;
}

function mesurer(a) {
  var e = resoudre(a, { rvpRatio: rapportRVP(0, a.gestes) });
  return { e: e, c: classer(a, e) };
}

function courir(a, heures) {
  var s = new Simulation(a);
  s.enCours = true;
  for (var t = 0; t < heures && !s.mort; t += 0.5) s.pas(0.5);
  return s;
}

var large = mesurer(anatomie('large'));
var restrictive = mesurer(anatomie('restrictive'));
var intacte = mesurer(anatomie('intacte'));

var pge = anatomie('intacte');
pge.gestes.pge = true;
var avecPGE = mesurer(pge);

var btt = anatomie('intacte');
btt.gestes.btt = true;
var avecBTT = mesurer(btt);

/* Le geste est irreversible dans l'interface : il transforme le septum en
   CIA large, puis reste visible dans l'anatomie comme geste effectue. */
var rashkind = anatomie('intacte');
rashkind.gestes.rashkind = true;
rashkind.cia = 'large';
var apresRashkind = mesurer(rashkind);

var decesIntact = courir(anatomie('intacte'), 24);
var survieRashkind = courir(rashkind, 24);

var echecs = [];
function attendu(cond, texte) { if (!cond) echecs.push(texte); }

attendu(large.e.Qs > 0.8 && large.e.congestionSystemique === 0,
        'la CIA large doit permettre le remplissage');
attendu(restrictive.e.Qs < large.e.Qs * 0.5,
        'la CIA restrictive doit diminuer nettement le debit systemique');
attendu(restrictive.c.cause === 'restriction-retour-cave',
        'la CIA restrictive doit etre reconnue comme obstruction du retour cave');
attendu(intacte.e.Qs < 0.01 && intacte.e.Qp < 0.01,
        'le septum intact ne doit pas inventer de debit stationnaire');
attendu(intacte.c.statut === 'letal' && intacte.c.cause === 'retour-cave-bloque',
        'atresie tricuspide + septum intact doit etre letale');
attendu(avecPGE.c.cause === 'retour-cave-bloque',
        'la PGE1 ne doit pas liberer le retour cave');
attendu(avecBTT.c.cause === 'retour-cave-bloque',
        'un BTT ne doit pas liberer le retour cave');
attendu(apresRashkind.e.Qs > 0.8 && apresRashkind.c.cause !== 'retour-cave-bloque',
        'le Rashkind doit restaurer le remplissage');
attendu(decesIntact.mort && decesIntact.mort.t <= 12,
        'le septum intact doit provoquer un deces rapide sans geste');
attendu(!survieRashkind.mort,
        'le Rashkind doit franchir les 24 premieres heures');

console.log('CIA large       :', large.c.cause,
            'Qs=' + large.e.Qs.toFixed(2), 'SaO2=' + large.e.SaO2.toFixed(0) + '%');
console.log('CIA restrictive :', restrictive.c.cause,
            'Qs=' + restrictive.e.Qs.toFixed(2), 'SaO2=' + restrictive.e.SaO2.toFixed(0) + '%');
console.log('Septum intact   :', intacte.c.cause,
            'Qs=' + intacte.e.Qs.toFixed(2), decesIntact.mort
              ? 'deces H' + decesIntact.mort.t.toFixed(1) : 'aucun deces');
console.log('Apres Rashkind  :', apresRashkind.c.cause,
            'Qs=' + apresRashkind.e.Qs.toFixed(2), 'survie H24');
console.log(echecs.length ? 'ECHECS :\n  ' + echecs.join('\n  ')
                           : 'tout est conforme');
process.exit(echecs.length ? 1 : 0);
