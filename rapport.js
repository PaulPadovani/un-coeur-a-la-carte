/* rapport.js — balaye anatomies x interventions et produit rapport-moteur.html
   Usage :  node rapport.js
   Aucun rendu graphique : on lit le moteur, on ecrit un rapport lisible.     */

var fs = require('fs'), src = '';
['js/anatomie.js', 'js/model.js', 'js/vitals.js'].forEach(function (f) {
  src += fs.readFileSync(f, 'utf8') + '\n';
});
(0, eval)(src);

/* ---------------------------------------------------------------- corpus */
var ANATOMIES = [
  ['Cœur normal', { oreillettes: 'O3', ventriculeDroit: 'V3', ventriculeGauche: 'V4',
                    ap: 'P1', aorte: 'A1', fbv: 'ferme' }],
  ['Ventricule unique équilibré', {}],
  ['Atrésie tricuspide, AP normale',
   { oreillettes: 'O2-atrG', ventriculeDroit: 'V2' }],
  ['Atrésie tricuspide, AP petite',
   { oreillettes: 'O2-atrG', ventriculeDroit: 'V2', ap: 'P2' }],
  ['Atrésie tricuspide + atrésie pulmonaire',
   { oreillettes: 'O2-atrG', ventriculeDroit: 'V2', ap: 'P3' }],
  ['Atrésie tricuspide, CIA restrictive',
   { oreillettes: 'O1-atrG', ventriculeDroit: 'V2' }],
  ['HypoVG (atrésie mitrale, aorte filiforme)',
   { oreillettes: 'O2-atrD', ventriculeDroit: 'V3', ventriculeGauche: 'V2',
     aorte: 'A3' }],
  ['HypoVG + septum interauriculaire intact',
   { oreillettes: 'O3-atrD', ventriculeDroit: 'V3', ventriculeGauche: 'V2',
     aorte: 'A3' }],
  ['HypoVG + CIA restrictive',
   { oreillettes: 'O1-atrD', ventriculeDroit: 'V3', ventriculeGauche: 'V2',
     aorte: 'A3' }],
  ['Aorte hypoplasique + coarctation', { aorte: 'A2' }],
  ['FBV restrictif, aorte de la chambre bulbaire',
   { oreillettes: 'O2', ventriculeDroit: 'V3', ventriculeGauche: 'V2',
     fbv: 'restrictif' }],
  ['FBV fermé, aorte de la chambre bulbaire',
   { oreillettes: 'O2', ventriculeDroit: 'V3', ventriculeGauche: 'V2',
     fbv: 'ferme' }],
  ['Ventricule croupion des deux côtés',
   { ventriculeDroit: 'V1', ventriculeGauche: 'V1' }],
  ['CIA isolée', { oreillettes: 'O2', ventriculeDroit: 'V3',
                   ventriculeGauche: 'V4', fbv: 'ferme' }],
  ['CIV large isolée', { oreillettes: 'O3', ventriculeDroit: 'V3',
                         ventriculeGauche: 'V4', fbv: 'large' }],
  ['CIV large + cerclage', { oreillettes: 'O3', ventriculeDroit: 'V3',
                             ventriculeGauche: 'V4', fbv: 'large' }],
  ['Transposition, septum intact',
   { oreillettes: 'O3', ventriculeDroit: 'V3', ventriculeGauche: 'V4',
     fbv: 'ferme', discordance: true }],
  ['Transposition + CIA large',
   { oreillettes: 'O2', ventriculeDroit: 'V3', ventriculeGauche: 'V4',
     fbv: 'ferme', discordance: true }],
  ['Sténose pulmonaire modérée (AP petite)',
   { oreillettes: 'O2-atrG', ventriculeDroit: 'V2', ap: 'P2' }]
];

var INTERVENTIONS = [
  ['Aucune', {}],
  ['PGE1', { pge: 1 }],
  ['O₂', { o2: 1 }],
  ['NO', { no: 1 }],
  ['CO₂', { co2: 1 }],
  ['BTT', { btt: 1 }],
  ['Cerclage', { cerclage: 1 }],
  ['Rashkind', { rashkind: 1 }],
  ['PGE1 + BTT', { pge: 1, btt: 1 }],
  ['PGE1 + cerclage', { pge: 1, cerclage: 1 }]
];

/* ---------------------------------------------------------------- moteur */
function courir(conf, gestes) {
  var a = new Anatomie();
  for (var k in conf) a[k] = conf[k];
  for (var g in (gestes || {})) a.gestes[g] = !!gestes[g];
  if (a.gestes.rashkind) a.oreillettes = a.oreillettes.replace(/^O[13]/, 'O2');

  var s = new Simulation(a);
  s.enCours = true;
  var serie = [];
  var e0 = resoudre(a, s.env()), c0 = classer(a, e0);
  for (var t = 0; t < Simulation.T_FIN && !s.mort; t += 0.5) {
    s.pas(0.5);
    if (Math.round(t * 2) % 4 === 0)
      serie.push({ t: t, sa: s.etat.SaO2, do2: s.etat.DO2,
                   q: s.etat.qpqs, r: s.reserve, canal: a.canal });
  }
  return {
    h0: { classe: c0, etat: e0 },
    mort: s.mort, reserve: s.reserve, serie: serie,
    fin: s.mort ? s.mort.t : Simulation.T_FIN
  };
}

/* ---------------------------------------------------------------- rendu */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

function cellule(r) {
  if (r.h0.classe.statut === 'impossible')
    return '<td class="c-imp">impossible</td>';
  if (r.mort)
    return '<td class="c-mort"><b>H' + Math.round(r.mort.t) + '</b><br>' +
           '<span>' + court(r.mort.cause) + '</span></td>';
  var cls = (r.reserve > 0.85) ? 'c-ok' : 'c-limite';
  return '<td class="' + cls + '"><b>survie J7</b><br><span>réserve ' +
         r.reserve.toFixed(2) + '</span></td>';
}

var COURT = {
  'hypoxemie': 'hypoxémie',
  'collapsus': 'collapsus systémique',
  'oedeme-pulmonaire': 'œdème pulmonaire',
  'obstacle-sous-aortique': 'obstacle sous-aortique',
  'sans-issue-systemique': 'sans issue systémique',
  'sans-melange': 'sans mélange',
  'restriction-auriculaire': 'restriction auriculaire',
  'defaillance': 'défaillance',
  'aucun-remplissage': 'aucun remplissage'
};
function court(c) { return COURT[c] || c; }

/* courbe SVG simple */
function courbe(serie, champ, min, max, couleur) {
  if (!serie.length) return '';
  var W = 300, H = 66;
  var pts = serie.map(function (p, i) {
    var x = (p.t / Simulation.T_FIN) * W;
    var v = Math.max(min, Math.min(max, p[champ]));
    var y = H - ((v - min) / (max - min)) * H;
    return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var fin = serie[serie.length - 1];
  var xf = (fin.t / Simulation.T_FIN) * W;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="spark">' +
    '<rect width="' + W + '" height="' + H + '" fill="#FAF9F5"/>' +
    /* reperes H24 / H72 */
    '<line x1="' + (24 / 168 * W) + '" y1="0" x2="' + (24 / 168 * W) + '" y2="' + H +
      '" stroke="#DFDACD"/>' +
    '<line x1="' + (72 / 168 * W) + '" y1="0" x2="' + (72 / 168 * W) + '" y2="' + H +
      '" stroke="#DFDACD"/>' +
    '<path d="' + pts + '" fill="none" stroke="' + couleur + '" stroke-width="2"/>' +
    (fin.t < Simulation.T_FIN - 1
      ? '<line x1="' + xf + '" y1="0" x2="' + xf + '" y2="' + H +
        '" stroke="#A8332A" stroke-width="1.5" stroke-dasharray="3 3"/>' : '') +
    '</svg>';
}

/* ---------------------------------------------------------------- sortie */
var lignes = '', detail = '';

ANATOMIES.forEach(function (A, ia) {
  var nom = A[0], conf = A[1];
  lignes += '<tr><th>' + esc(nom) + '</th>';
  var forcer = /cerclage$/.test(nom) ? { cerclage: 1 } : null;
  var resultats = INTERVENTIONS.map(function (I) {
    var gg = {}; for (var k in I[1]) gg[k] = I[1][k];
    if (forcer) for (var k2 in forcer) gg[k2] = forcer[k2];
    return courir(conf, gg);
  });
  resultats.forEach(function (r) { lignes += cellule(r); });
  lignes += '</tr>';

  /* detail : sans intervention */
  var r0 = resultats[0];
  var e = r0.h0.etat, c = r0.h0.classe;
  detail += '<section class="fiche">' +
    '<h3>' + esc(nom) + '</h3>' +
    '<div class="etiq ' + c.statut + '">' + esc(c.titre) + '</div>' +
    '<p class="expl">' + esc(c.texte) + '</p>' +
    '<table class="mini"><tr><td>SaO₂ à H0</td><td>' + e.SaO2.toFixed(0) + ' %</td></tr>' +
    '<tr><td>SvO₂ à H0</td><td>' + e.SvO2.toFixed(0) + ' %</td></tr>' +
    '<tr><td>Différence artério-veineuse</td><td>' + e.DAV.toFixed(0) + ' pts</td></tr>' +
    '<tr><td>Qp/Qs à H0</td><td>' + (e.qpqs >= 99 ? '∞' : e.qpqs.toFixed(2)) + '</td></tr>' +
    '<tr><td>Apport systémique en O₂</td><td>' + e.DO2.toFixed(1) + '</td></tr>' +
    '<tr><td>Mélange complet</td><td>' + (e.melangeComplet ? 'oui' : 'non') + '</td></tr>' +
    '<tr><td>Pression ventriculaire commune</td><td>' + (e.pressionCommune ? 'oui' : 'non') + '</td></tr>' +
    '<tr><td>Voie systémique</td><td>' + (e.connexite.systemique ? 'ouverte' : 'absente') + '</td></tr>' +
    '<tr><td>Voie pulmonaire</td><td>' + (e.connexite.pulmonaire ? 'ouverte' : 'absente') + '</td></tr>' +
    '</table>' +
    '<div class="courbes">' +
      '<div><span>SaO₂ 20 → 100 %</span>' + courbe(r0.serie, 'sa', 20, 100, '#BE2A2E') + '</div>' +
      '<div><span>Apport en O₂ 0 → 16</span>' + courbe(r0.serie, 'do2', 0, 16, '#183A5A') + '</div>' +
      '<div><span>Qp/Qs 0 → 6</span>' + courbe(r0.serie, 'q', 0, 6, '#7C488C') + '</div>' +
      '<div><span>Réserve 0 → 1</span>' + courbe(r0.serie, 'r', 0, 1, '#BC5B32') + '</div>' +
      '<div><span>Canal artériel 0 → 1</span>' + courbe(r0.serie, 'canal', 0, 1, '#6B665C') + '</div>' +
    '</div>' +
    (r0.mort ? '<p class="issue mort">Sans intervention : décès à H' +
        Math.round(r0.mort.t) + ' — ' + esc(r0.mort.titre) + '</p>'
             : '<p class="issue vie">Sans intervention : survie à J7.</p>') +
    '</section>';
});

var entete = '<tr><th>Anatomie</th>' +
  INTERVENTIONS.map(function (I) { return '<th>' + esc(I[0]) + '</th>'; }).join('') +
  '</tr>';

var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
'<title>Comportement du moteur — ventricule unique</title><style>' +
':root{--fond:#F0EEE6;--panneau:#FAF9F5;--bord:#DFDACD;--texte:#1F1E1B;' +
'--doux:#6B665C;--marine:#183A5A;--terre:#BC5B32;--ok:#3F7D4E;--critique:#A8332A}' +
'*{box-sizing:border-box}body{margin:0;background:var(--fond);color:var(--texte);' +
'font:14px/1.5 ui-serif,Georgia,serif;padding:34px 40px}' +
'h1,h2,h3,th,.etiq,.val{font-family:ui-sans-serif,-apple-system,"Segoe UI",Helvetica,sans-serif}' +
'h1{font-size:23px;color:var(--marine);margin:0 0 4px;font-weight:600}' +
'p.sous{color:var(--doux);margin:0 0 26px;font-size:14px;max-width:76ch}' +
'h2{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:var(--doux);' +
'margin:34px 0 12px;font-weight:600}' +
'table.matrice{border-collapse:separate;border-spacing:0;width:100%;background:var(--panneau);' +
'border:1px solid var(--bord);border-radius:9px;overflow:hidden;font-size:12px}' +
'table.matrice th{background:var(--marine);color:#F7F5EF;padding:9px 8px;font-size:11px;' +
'font-weight:600;text-align:center}' +
'table.matrice th:first-child{text-align:left;min-width:230px}' +
'table.matrice td{padding:7px 6px;text-align:center;border-top:1px solid var(--bord);' +
'line-height:1.25}' +
'table.matrice tr th:first-child{background:#20486E;text-align:left}' +
'td b{font-size:12.5px;display:block}td span{font-size:10.5px;color:var(--doux)}' +
'.c-ok{background:#E8F1E9}.c-ok b{color:var(--ok)}' +
'.c-limite{background:#FBF3E2}.c-limite b{color:#8A6114}' +
'.c-mort{background:#FBEDEB}.c-mort b{color:var(--critique)}' +
'.c-imp{background:#EFEDE6;color:var(--doux);font-style:italic}' +
'.fiches{display:grid;grid-template-columns:repeat(auto-fill,minmax(370px,1fr));gap:18px}' +
'.fiche{background:var(--panneau);border:1px solid var(--bord);border-radius:9px;padding:16px 18px}' +
'.fiche h3{margin:0 0 8px;font-size:15px;color:var(--marine);font-weight:600}' +
'.etiq{display:inline-block;font-size:11px;padding:2px 9px;border-radius:20px;' +
'background:#EFEDE6;color:var(--doux);margin-bottom:8px}' +
'.etiq.equilibre{background:#E8F1E9;color:var(--ok)}' +
'.etiq.normal{background:#E7EEF5;color:var(--marine)}' +
'.etiq.ducto-dependant,.etiq.instable{background:#FBF3E2;color:#8A6114}' +
'.etiq.critique,.etiq.letal,.etiq.impossible{background:#FBEDEB;color:var(--critique)}' +
'.expl{margin:0 0 12px;color:var(--doux);font-size:13px}' +
'table.mini{width:100%;font-size:12.5px;margin-bottom:12px;border-collapse:collapse}' +
'table.mini td{padding:3px 0;border-bottom:1px solid var(--bord)}' +
'table.mini td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}' +
'.courbes{display:grid;grid-template-columns:1fr 1fr;gap:9px}' +
'.courbes span{display:block;font-size:10.5px;color:var(--doux);margin-bottom:2px;' +
'font-family:ui-sans-serif,sans-serif}' +
'.spark{width:100%;height:auto;border:1px solid var(--bord);border-radius:5px;display:block}' +
'.issue{margin:12px 0 0;font-size:12.5px;padding:7px 10px;border-radius:6px}' +
'.issue.mort{background:#FBEDEB;color:var(--critique)}' +
'.issue.vie{background:#E8F1E9;color:var(--ok)}' +
'.note{margin-top:30px;padding:15px 18px;background:var(--panneau);border:1px solid var(--bord);' +
'border-radius:9px;font-size:13px;color:var(--doux);max-width:90ch}' +
'.note b{color:var(--texte)}' +
'</style></head><body>' +
'<h1>Comportement du moteur — ventricule unique</h1>' +
'<p class="sous">Chaque case est une simulation complète de H0 à J7. Le canal artériel ' +
'se ferme progressivement entre H12 et H72 sauf sous prostaglandine. ' +
'Généré le ' + new Date().toISOString().slice(0, 10) + ' par <code>node rapport.js</code>.</p>' +
'<h2>Matrice anatomie × intervention</h2>' +
'<table class="matrice">' + entete + lignes + '</table>' +
'<h2>Fiches détaillées — sans intervention</h2>' +
'<div class="fiches">' + detail + '</div>' +
'<div class="note"><b>Comment lire les courbes.</b> Les deux traits verticaux gris ' +
'marquent H24 et H72. Le trait rouge pointillé, quand il existe, marque le décès. ' +
'La courbe du canal artériel montre la fermeture progressive : c’est elle qui déclenche ' +
'la dégradation, pas la construction.<br><br>' +
'<b>Ce qu’il faut regarder en priorité.</b> Sur la ligne HypoVG, la saturation ' +
'<i>monte</i> pendant que l’apport systémique en oxygène s’effondre : c’est le ' +
'contre-sens que le jeu doit faire vivre. Sur la ligne « FBV restrictif », le cerclage ' +
'aggrave au lieu d’aider — c’est le piège documenté par la littérature.<br><br>' +
'<b>Limites connues.</b> Les résistances de <code>anatomie.js</code> sont des unités ' +
'arbitraires réglées à la main. Le piège de l’oxygène ne tue pas encore. Le Glenn et ' +
'le Fontan ne sont pas modélisés : le moteur est purement néonatal.</div>' +
'</body></html>';

fs.writeFileSync('rapport-moteur.html', html);
console.log('rapport-moteur.html ecrit — ' + ANATOMIES.length + ' anatomies x ' +
            INTERVENTIONS.length + ' interventions = ' +
            (ANATOMIES.length * INTERVENTIONS.length) + ' simulations');
