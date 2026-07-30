/* render.js — assemble les cartes SVG, colore les compartiments et anime les
   flux.

   LES FLUX. Un aplat de couleur dit la saturation mais ne dit rien du débit,
   or c'est le débit — et surtout son partage — qui est le sujet du
   simulateur. Chaque compartiment reçoit donc des BOLUS : de larges bandes
   claires qui remontent son axe d'écoulement, découpées sur la forme
   anatomique réelle, à une vitesse proportionnelle au débit qui le traverse.
   Un poumon en hyperdébit défile vite, une aorte volée se traîne, un tronc
   borgne reste immobile.

   Le défilement n'est PAS lié à la fréquence du scope : ce n'est pas une
   pulsatilité, c'est un débit moyen. Les confondre serait une faute de sens.

   Le tracé des axes n'a pas besoin d'être exact : il est découpé
   (`clip-path`) sur la région colorée du compartiment, donc un axe
   approximatif donne un bolus parfaitement contenu dans la lumière.        */

var GRILLE = { carte: [600, 1000], double: [1200, 1000] };

/* Echelle des atlas d'anatomie (Kamina) : bleu veineux franc, mauve pour le
   sang melange, rouge arteriel. Volontairement peu lumineuse pour tenir sur
   un fond ivoire et rester lisible en projection. */
var STOPS = [[25, [ 38,  78, 140]],   /* bleu veineux profond */
             [55, [ 82,  78, 152]],   /* bleu-violet */
             [75, [124,  72, 140]],   /* mauve : sang melange */
             [88, [168,  60, 100]],   /* pourpre */
             [100,[190,  42,  46]]];  /* rouge arteriel */
function satColor(s) {
  s = Math.max(20, Math.min(100, s));
  for (var i = 0; i < STOPS.length - 1; i++) {
    var a = STOPS[i], b = STOPS[i + 1];
    if (s <= b[0]) {
      var t = (s - a[0]) / (b[0] - a[0]);
      return 'rgb(' + a[1].map(function (v, k) {
        return Math.round(v + t * (b[1][k] - v));
      }).join(',') + ')';
    }
  }
  return 'rgb(190,42,46)';
}

/* Eclaircit vers l'ivoire — la crete du bolus. */
function eclaircir(rgb, k) {
  var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgb);
  if (!m) return rgb;
  function f(i) { return Math.round(+m[i] + (248 - +m[i]) * k); }
  return 'rgb(' + f(1) + ',' + f(2) + ',' + f(3) + ')';
}

function carteSVG(id) { return CARTES[id] || { fill: '', ink: '' }; }

/* Identifiant de la carte a poser sur une voie d'ejection. */
function carteVoie(vaisseau, gestes, suffixe) {
  var id = vaisseau.id;
  if (!id) return null;
  if (vaisseau.vaisseau === 'ap' && gestes.cerclage &&
      vaisseau.calibre !== 'atretique' && CARTES[id + 'C' + suffixe])
    id += 'C';
  return id + suffixe;
}

/* ------------------------------------------------------------------
   AXES D'ECOULEMENT, en coordonnees de carte.
   Le sens du trace va de l'amont vers l'aval : le bolus remonte le
   chemin, donc les oreillettes vont vers le haut (y decroissant), les
   ventricules aussi, les arteres aussi.
------------------------------------------------------------------ */
var CAVITE = 'M300,1040 C334,900 368,752 363,558 C358,372 330,186 300,-40';
var BULBE  = 'M640,500 C512,486 398,428 332,250 C310,182 300,58 300,-40';
var TRONC  = 'M300,1040 L300,286';
var BR_D   = 'M300,190 C396,204 474,264 490,384';
var BR_G   = 'M300,190 C204,204 126,264 110,384';
var AORTE  = 'M300,1040 C300,768 302,566 344,432 C404,346 474,404 488,540 ' +
             'C494,644 492,706 490,792';

/* [compartiment, tracé, nombre de filets, écartement, orientation]
   L'orientation dit dans quel sens décaler les filets parallèles : 'v' pour
   un vaisseau qui monte (on décale en x), 'h' pour un passage transversal. */
var AXES = {
  'V3': [['vd', CAVITE, 5, 62, 'v']],
  'V4': [['vg', CAVITE, 5, 62, 'v']],
  'V2': [['cb', BULBE, 3, 52, 'v']],
  'V1': [],
  'P1':  [['ap-tronc', TRONC, 4, 42, 'v'],
          ['ap-branches', BR_D, 2, 34, 'v'], ['ap-branches', BR_G, 2, 34, 'v']],
  'A1': [['aorte', AORTE, 4, 40, 'v']],
  'O':  [['od', 'M186,742 C238,600 292,394 300,-40', 5, 58, 'v'],
         ['og', 'M1014,742 C962,600 908,394 900,-40', 5, 58, 'v']],
  'G1-BTT': [['shunt', 'M842,300 C740,268 604,300 512,362', 2, 22, 'h']]
};
AXES['P2'] = AXES['P1C'] = AXES['P2C'] = AXES['P1'];
/* atrésie : le tronc est borgne, seules les branches peuvent couler */
AXES['P3'] = [AXES['P1'][1], AXES['P1'][2]];
AXES['A2'] = AXES['A3'] = AXES['A1'];

/* Quel debit traverse quel compartiment.
   p = suit Qp, s = suit Qs, c = traverse la chambre, x = le shunt. */
var DEBIT = { od: 's', og: 'p', vd: 'c', vg: 'c', cb: 'c',
              aorte: 's', 'ap-tronc': 'p', 'ap-branches': 'p', shunt: 'x',
              cia: 'a', fbv: 'f' };

var PERIODE = 190;             /* longueur d'un filet + son intervalle */
var EPAISSEUR = 26;            /* un filet de courant, pas une bande */

/* Un axe donne plusieurs filets parallèles, décalés et déphasés : c'est ce
   qui produit l'impression de lignes de courant plutôt que de bande unique. */
function filets(a) {
  var comp = a[0], d = a[1], n = a[2] || 3, e = a[3] || 40, sens = a[4] || 'v';
  var o = [], i, k, dx, dy;
  for (i = 0; i < n; i++) {
    k = (i - (n - 1) / 2) * e;
    dx = sens === 'v' ? k : 0;
    dy = sens === 'v' ? 0 : k;
    o.push('<path data-flux="' + comp + '" data-filet="' + i +
           '" transform="translate(' + dx.toFixed(1) + ',' + dy.toFixed(1) + ')" ' +
           'd="' + d + '" fill="none" stroke="none" stroke-width="' + EPAISSEUR +
           '" stroke-linecap="round"/>');
  }
  return o.join('');
}

/* ------------------------------------------------------------------
   LES COMMUNICATIONS.
   Le sang qui franchit un foramen ou une communication interauriculaire
   doit se voir passer PAR ce trou. Ces passages ne sont pas portés par une
   carte : ils sont dessinés dans le repère de l'assemblage, à l'aplomb
   exact de l'ouverture, et calibrés sur elle.
------------------------------------------------------------------ */
var FBV_H = { large: 150, restrictif: 56, ferme: 0 };
var CIA_H = { large: 168, restrictive: 64, intacte: 0 };   /* demi-ouverture */
var CIA_Y = 2000 + 290;      /* milieu du septum interauriculaire, assemblé */
var FBV_Y = 1000 + 500;      /* foramen bulbo-ventriculaire, assemblé */

function passages(d) {
  var o = [];
  var hf = FBV_H[d.fbv] || 0;
  if (hf > 4) {
    var n = hf > 100 ? 3 : 2, e = hf * 0.9 / n;
    for (var i = 0; i < n; i++) {
      var y = FBV_Y + (i - (n - 1) / 2) * e;
      o.push('<path data-flux="fbv" d="M424,' + y.toFixed(0) + ' L776,' +
             y.toFixed(0) + '" fill="none" stroke="none" stroke-width="' +
             EPAISSEUR + '" stroke-linecap="round"/>');
    }
  }
  var hc = CIA_H[d.o.cia] || 0;
  if (hc > 4) {
    var m = hc > 100 ? 3 : 2, f = hc * 0.9 / m;
    for (var j = 0; j < m; j++) {
      var yy = CIA_Y + (j - (m - 1) / 2) * f;
      o.push('<path data-flux="cia" d="M470,' + yy.toFixed(0) + ' L730,' +
             yy.toFixed(0) + '" fill="none" stroke="none" stroke-width="' +
             EPAISSEUR + '" stroke-linecap="round"/>');
    }
  }
  return o.join('');
}

function debitDe(cle, etat, d) {
  var Qp = etat.Qp, Qs = etat.Qs;
  if (cle === 'p') return Qp;
  if (cle === 's') return Qs;
  if (cle === 'x') return Math.abs(Qp - Qs);
  if (cle === 'a') {                       /* communication interauriculaire */
    if (!d) return Math.abs(Qp - Qs);
    if (d.o.av === 'droit') return Qs;     /* tout le retour cave doit passer */
    if (d.o.av === 'gauche') return Qp;    /* tout le retour pulmonaire aussi */
    return Math.abs(Qp - Qs);
  }
  if (cle === 'f') {                       /* foramen bulbo-ventriculaire */
    if (!d) return Math.abs(Qp - Qs);
    if (d.vd.type === 'cb' || d.vg.type === 'cb')
      return Math.max(Qp, Qs) * 0.85;      /* toute l'éjection le franchit */
    return Math.abs(Qp - Qs);
  }
  return etat.melange ? (Qp + Qs) / 2 : Math.max(Qp, Qs) * 0.6;
}

/* Sens du passage : +1 = de la gauche de l'image vers la droite,
   c'est-à-dire du cœur droit vers le cœur gauche.                         */
function sensPassage(cle, d) {
  if (cle === 'cia') {
    if (d.o.av === 'droit') return +1;      /* atrésie tricuspide : OD → OG */
    if (d.o.av === 'gauche') return -1;     /* atrésie mitrale : OG → OD */
    return -1;                              /* shunt physiologique gauche-droite */
  }
  if (cle === 'fbv') {
    if (d.vd.type === 'cb') return -1;      /* la chambre borgne est à gauche */
    if (d.vg.type === 'cb') return +1;
    return -1;
  }
  return +1;
}

/* Le balisage de remplissage des cartes miroir est enveloppé dans un <g>.
   Un <clipPath> n'accepte pas de <g> : on sort donc la transformation pour
   la porter sur le groupe qui référence le découpage. */
function decoupe(markup) {
  var m = /^\s*<g transform="([^"]+)">([\s\S]*)<\/g>\s*$/.exec(markup);
  return m ? { t: ' ' + m[1], corps: m[2] } : { t: '', corps: markup };
}

/* ------------------------------------------------------------------
   Construit le SVG complet de l'anatomie assemblee.
------------------------------------------------------------------ */
function assembler(anat) {
  var d = anat.describe();
  var fills = [], inks = [], clips = [], flux = [], n = 0;

  function pose(id, dx, dy, miroir) {
    if (!id) return;
    var c = carteSVG(id);
    var t = 'translate(' + dx + ',' + dy + ')';
    if (miroir) t += ' translate(' + miroir + ',0) scale(-1,1)';
    if (c.fill) fills.push('<g transform="' + t + '">' + c.fill + '</g>');
    if (c.ink) inks.push('<g transform="' + t + '">' + c.ink + '</g>');

    /* axes d'ecoulement de cette carte, decoupes sur son remplissage */
    var base = id.replace(/-(G|D)$/, '').replace(/-(ferme|restrictif|large)$/, '');
    var ax = AXES[base] || AXES[base.replace(/^(O[123]).*/, 'O')] || null;
    if (!ax || !ax.length || !c.fill) return;
    var dec = decoupe(c.fill);
    var cid = 'clip-' + (n++);
    clips.push('<clipPath id="' + cid + '" clipPathUnits="userSpaceOnUse">' +
               dec.corps + '</clipPath>');
    flux.push('<g transform="' + t + dec.t + '" clip-path="url(#' + cid + ')">' +
              ax.map(filets).join('') + '</g>');
  }

  /* rangee 1 : arteres */
  pose(carteVoie(d.vsD, d.gestes, '-G'), 0, 0);
  pose(carteVoie(d.vsG, d.gestes, '-D'), 600, 0);

  /* rangee 2 : ventricules — coeur droit a gauche, coeur gauche a droite */
  pose(d.vd.id + '-' + d.fbv + '-G', 0, 1000);
  pose(d.vg.id + '-' + d.fbv + '-D', 600, 1000);

  /* rangee 3 : oreillettes (carte double) */
  pose(d.o.id, 0, 2000);

  /* gestes superposables */
  if (d.gestes.btt && d.ap.id && d.ao.id)
    pose('G1-BTT', 0, 0, d.discordance ? 1200 : 0);
  if (d.gestes.rashkind) pose('G3-Rashkind', 0, 2000);

  return '<defs>' + clips.join('') + '</defs>' +
         '<g id="fill" stroke="none">' + fills.join('') + '</g>' +
         '<g id="flux" fill="none">' + flux.join('') + passages(d) + '</g>' +
         '<g id="ink" fill="none" stroke="currentColor" stroke-width="17" ' +
         'stroke-linecap="round" stroke-linejoin="round">' + inks.join('') + '</g>';
}

/* ------------------------------------------------------------------
   Couleurs
------------------------------------------------------------------ */
function teintes(anat, etat) {
  var d = anat.describe();
  var sm = etat.SaO2;
  return {
    'od': etat.SvO2,
    'og': CFG.SpvO2,
    'vd': etat.melange ? sm : etat.SvO2,
    'vg': etat.melange ? sm : CFG.SpvO2,
    'cb': etat.melange ? sm : etat.SvO2,
    'aorte': sm,
    'shunt': sm,
    /* En transposition l'artere pulmonaire est PLUS saturee que l'aorte :
       elle porte donc sa propre valeur. Un tronc atresique reste gris. */
    'ap-branches': etat.Qp > 0.05 ? etat.SapO2 : etat.SvO2,
    'ap-tronc': (d.ap.calibre === 'atretique' ||
                 d.ap.calibre === 'absente') ? null : etat.SapO2
  };
}

function colorier(svgRoot, anat, etat) {
  var d = anat.describe();
  var c = teintes(anat, etat);
  /* le sang qui franchit un passage garde la couleur de sa provenance */
  c.cia = (d.o.av === 'gauche') ? CFG.SpvO2 : etat.SvO2;
  c.fbv = etat.melange ? etat.SaO2
        : (d.vd.type === 'cb' ? CFG.SpvO2 : etat.SvO2);

  var noeuds = svgRoot.querySelectorAll('#fill [data-comp]');
  for (var i = 0; i < noeuds.length; i++) {
    var k = noeuds[i].getAttribute('data-comp');
    var v = c[k];
    noeuds[i].setAttribute('fill', (v === null || v === undefined)
                           ? '#CFC9BA' : satColor(v));
    noeuds[i].setAttribute('opacity', '0.9');
  }

  var bol = svgRoot.querySelectorAll('#flux [data-flux]');
  for (var j = 0; j < bol.length; j++) {
    var f = bol[j].getAttribute('data-flux');
    var vv = c[f];
    var q = debitDe(DEBIT[f] || 'c', etat, d);
    if (vv === null || vv === undefined || q < 0.06) {
      /* pas de débit : pas de filet. Un tronc borgne se voit immobile. */
      bol[j].setAttribute('stroke', 'none');
      continue;
    }
    bol[j].setAttribute('stroke', eclaircir(satColor(vv), 0.52));
    bol[j].setAttribute('opacity', Math.min(0.92, 0.58 + q * 0.12).toFixed(2));
    /* Des particules, pas des tirets : un tiret de longueur nulle avec une
       extrémité arrondie donne un point. Elles se resserrent quand le débit
       monte — la densité informe autant que la vitesse. */
    var ecart = Math.max(50, 112 - q * 22);
    bol[j].setAttribute('stroke-dasharray', '1 ' + ecart.toFixed(0));
    bol[j].setAttribute('data-per', (ecart + 1).toFixed(0));
  }
}

/* ------------------------------------------------------------------
   Animation : on fait glisser les bolus. dt en secondes de temps reel.
------------------------------------------------------------------ */
var _phase = 0;

function animerFlux(svgRoot, anat, etat, dt) {
  if (!svgRoot || !etat) return;
  /* visualisation coupée : inutile de calculer quoi que ce soit */
  if (document.body.classList.contains('sans-flux')) return;
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) dt = 0;
  _phase += dt;
  var d = anat.describe();
  var bol = svgRoot.querySelectorAll('#flux [data-flux]');
  for (var i = 0; i < bol.length; i++) {
    var f = bol[i].getAttribute('data-flux');
    var q = debitDe(DEBIT[f] || 'c', etat, d);
    var v = Math.min(520, q * 190);                  /* unites par seconde */
    var sens = 1;
    /* l'aorte remplie a rebours : le filet descend la crosse */
    if (f === 'aorte' && etat.retrogradeAorte) sens = -1;
    if (f === 'cia' || f === 'fbv') sens = sensPassage(f, d);
    /* les filets d'un meme faisceau sont dephases : c'est ce decalage qui
       donne l'impression d'un ecoulement et non d'un clignotement */
    var per = +(bol[i].getAttribute('data-per') || PERIODE);
    var k = +(bol[i].getAttribute('data-filet') || 0);
    var o = (-sens * v * _phase + k * per / 3) % per;
    bol[i].setAttribute('stroke-dashoffset', o.toFixed(1));
  }
}
