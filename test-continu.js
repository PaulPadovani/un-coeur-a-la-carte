/* Continuité des traceurs entre cartes, sans navigateur. */
var fs = require('fs');
var src = '';
['js/cartes.js', 'js/anatomie.js', 'js/model.js', 'js/champ.js',
 'js/render.js', 'js/continu.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

var erreurs = [];
function verifier(ok, message) { if (!ok) erreurs.push(message); }
function objet(comp, role, mode) {
  return { comp: comp, mode: mode || 'ventricule-traversant', matriceCoeur: {},
    visible: true, champ: { entrees: [{}] }, sens: 1, q: 1,
    node: { closest: function () { return role ? {
      getAttribute: function () { return role; }
    } : null; } } };
}
var od = objet('od', null, 'oreillette-traversante');
var og = objet('og', null, 'oreillette-traversante');
var vd = objet('vd', 'ventriculeD');
var vg = objet('vg', 'ventriculeG');
var civ = objet('fbv', null, 'route');
var cia = objet('cia', null, 'route');
var ao = objet('aorte', 'voieG', 'route');
var ap = objet('ap-tronc', 'voieD', 'route');
var st = { pieces: { ventriculeD: [vd], ventriculeG: [vg],
                    voieD: [ap], voieG: [ao] },
           atria: { od: od, og: og }, fbv: civ, cia: cia };
var choisi = null;
entrerContinu = function (p, item) { choisi = item; p.item = item; return true; };
departContinu = function () { choisi = null; };
function verifierSuite(item, d, etat, attendu, options) {
  choisi = null;
  var p = { item: item, versCIV: !!(options && options.versCIV),
            repasse: !!(options && options.repasse) };
  suiteContinu(st, p, d, etat);
  verifier(choisi === attendu, item.comp + ' doit rejoindre ' +
           (attendu ? attendu.comp : 'aucune carte'));
}

var normal = new Anatomie();
normal.ventriculeDroit = 'V3'; normal.fbv = 'ferme';
normal.canal = 0;
var dn = normal.describe(), en = resoudre(normal, { rvpRatio: 0.5 });
verifierSuite(od, dn, en, vd);
verifierSuite(og, dn, en, vg);
verifierSuite(vd, dn, en, ap);
verifierSuite(vg, dn, en, ao);

var at = new Anatomie();
at.ventriculeDroit = 'V2'; at.fbv = 'large';
var da = at.describe(), ea = resoudre(at, { rvpRatio: 0.5 });
verifierSuite(od, da, ea, cia);

/* CIV droite → gauche : le même traceur franchit le septum, pénètre le
   ventricule receveur, puis gagne sa voie d'éjection. */
var fallot = new Anatomie();
fallot.ventriculeDroit = 'V3'; fallot.voieDroite = 'P2';
fallot.fbv = 'large'; fallot.canal = 0;
var df = fallot.describe(), ef = resoudre(fallot, { rvpRatio: 0.25 });
verifier(ef.fluxVisuel.sensCIV === 1,
         'le cas Fallot choisi doit avoir une CIV droite → gauche');
verifierSuite(vd, df, ef, civ, { versCIV: true });
verifierSuite(civ, df, ef, vg);
verifierSuite(vg, df, ef, ao, { repasse: true });

var svg = assembler(fallot);
verifier(svg.indexOf('id="flux-continu"') >= 0 &&
         svg.indexOf('mask="url(#masque-flux-continu)"') >= 0,
         'l assemblage doit placer les longues trajectoires dans une lumière commune');
verifier(svg.indexOf('data-piece="ventriculeD"') >= 0 &&
         svg.indexOf('data-piece="voieG"') >= 0,
         'chaque zone doit conserver son identité anatomique');

console.log(erreurs.length ? 'ÉCHECS :\n  ' + erreurs.join('\n  ')
                           : 'trajets continus conformes : valves, CIA, CIV, voies');
process.exit(erreurs.length ? 1 : 0);
