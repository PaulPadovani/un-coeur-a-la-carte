/* render.js — assemble les cartes SVG, colore les compartiments et anime les
   flux.

   LES FLUX. Un aplat de couleur dit la saturation mais ne dit rien du débit,
   or c'est le débit — et surtout son partage — qui est le sujet du
   simulateur. Chaque compartiment reçoit donc des PATHLINES : la trajectoire
   récente d'une particule de sang, amincie et assombrie vers sa queue,
   colorée par la vitesse le long de son propre trajet.

   Deux régimes, deux traitements honnêtes.
   — Les VAISSEAUX sont des conduits. Ligne centrale, profil de vitesse
     transverse, adhérence à la paroi : le sang court au centre et colle au
     bord, les filets se cisaillent au lieu de défiler en rails parallèles.
   — Les CAVITÉS ne suivent aucune ligne. Leur champ de vitesse est résolu
     par champ.js — advection, viscosité, projection de pression sur le
     masque anatomique. Le jet d'admission, le tourbillon de remplissage et
     les zones de stase émergent de la forme du ventricule ; ils ne sont
     plus écrits à la main.

   Le défilement n'est PAS lié à la fréquence du scope : ce n'est pas une
   pulsatilité, c'est un débit moyen. Les confondre serait une faute de sens.

   Tout est découpé (`clip-path`) sur la lumière anatomique pour ne jamais
   transformer le schéma en carte routière.                                */

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
   CHAMPS DE FLUX.

   Les vaisseaux restent des conduits : une ligne centrale et une
   demi-largeur suffisent à poser un profil de vitesse. Les cavites, elles,
   ne declarent qu'une TOPOLOGIE — traversee, convergence par le foramen,
   sortie laterale, recirculation close — dont champ.js deduit ou se
   trouvent l'entree et la sortie avant de resoudre l'ecoulement.
------------------------------------------------------------------ */
var TRONC  = 'M300,1040 L300,286';
var BR_D   = 'M300,190 C396,204 474,264 490,384';
var BR_G   = 'M300,190 C204,204 126,264 110,384';
var AORTE  = 'M300,1040 C300,768 302,566 344,432 C404,346 474,404 488,540 ' +
             'C494,644 492,706 490,792';
var AORTE_HYPO_1 = 'M300,1040 C300,806 292,610 326,476 C358,430 414,434 445,486';
var AORTE_HYPO_2 = 'M445,486 C452,514 456,548 460,580';
var AORTE_HYPO_3 = 'M460,580 C466,650 470,724 472,792';
var AP_BAS = 'M300,1040 L300,710';
var AP_JET = 'M300,710 L300,548';
var AP_HAUT = 'M300,548 L300,286';
/* Troncs supra-aortiques. Ils n'existaient tout simplement pas dans la
   cartographie : la crosse se vidait dans l'aorte descendante et les trois
   vaisseaux du cou restaient déserts. Leurs axes sont relevés sur la carte
   elle-même (lumière au sens `nonzero`), pas estimés à l'œil : le tronc
   brachio-céphalique est centré sur x=341, la carotide gauche sur x=426 et
   la sous-clavière gauche sur x=516, toutes trois se raccordant à la face
   supérieure de la crosse vers y=300. */
var TABC   = 'M370,352 C352,330 341,310 341,178';
var CAROT  = 'M406,344 C414,320 426,306 426,178';
var SUBCL  = 'M448,352 C476,326 505,300 516,198';
/* Centre exact de la prothèse générée : sous-clavière droite → face
   inférieure de la bifurcation pulmonaire. L'ancien axe finissait à
   (512,362), très loin de l'anastomose réelle (396,258). */
var BTT = 'M860.6,298.8 Q638.1,166.7 395.9,257.7';

/* [compartiment, tracé, nombre de filets, écartement, orientation,
    facteur de vitesse locale, jet]
   L'orientation dit dans quel sens décaler les filets parallèles : 'v' pour
   un vaisseau qui monte (on décale en x), 'h' pour un passage transversal.
   Le facteur local matérialise v = Q / section sans modifier le modèle. */
var ROUTES_FLUX = {
  'P1':  [['ap-tronc', TRONC, 2, 52, 'v', 1],
          ['ap-branches', BR_D, 1, 34, 'v', 1],
          ['ap-branches', BR_G, 1, 34, 'v', 1]],
  /* petit calibre : le même débit traverse une section plus faible */
  'P2':  [['ap-tronc', TRONC, 3, 34, 'v', 1.75, true],
          ['ap-branches', BR_D, 2, 34, 'v', 1],
          ['ap-branches', BR_G, 2, 34, 'v', 1]],
  /* cerclage : convergence, vena contracta, puis jet post-sténotique */
  'P1C': [['ap-tronc', AP_BAS, 4, 42, 'v', 1],
          ['ap-tronc', AP_JET, 2, 22, 'v', 2.8, true],
          ['ap-tronc', AP_HAUT, 3, 34, 'v', 1.25, true],
          ['ap-branches', BR_D, 2, 34, 'v', 1],
          ['ap-branches', BR_G, 2, 34, 'v', 1]],
  'P2C': [['ap-tronc', AP_BAS, 3, 32, 'v', 1.7],
          ['ap-tronc', AP_JET, 2, 18, 'v', 3.5, true],
          ['ap-tronc', AP_HAUT, 2, 28, 'v', 1.9, true],
          ['ap-branches', BR_D, 2, 34, 'v', 1],
          ['ap-branches', BR_G, 2, 34, 'v', 1]],
  'A1': [['aorte', AORTE, 2, 52, 'v', 1],
         ['tsa', TABC, 1, 30, 'v', 5.5, false, 'fixe'],
         ['tsa', CAROT, 1, 26, 'v', 5.5, false, 'fixe'],
         ['tsa', SUBCL, 1, 26, 'v', 4.8, false, 'fixe']],
  /* A2/A3 : crosse étroite, accélération focale à la coarctation, puis
     décélération dans la descendante redevenue plus large.
     Les troncs du cou restent alimentés — c'est même tout l'enjeu de
     l'hypoplasie : quand la crosse s'inverse, la tête continue d'être
     perfusée, mais à contre-courant, par le canal. D'où le sens FIXE :
     seule la crosse s'inverse, jamais les vaisseaux du cou. */
  'A2': [['aorte', AORTE_HYPO_1, 2, 25, 'v', 1.75, true],
         ['aorte', AORTE_HYPO_2, 1, 20, 'v', 3.15, true],
         ['aorte', AORTE_HYPO_3, 2, 30, 'v', 1.25],
         ['tsa', TABC, 1, 26, 'v', 5.5, false, 'fixe'],
         ['tsa', CAROT, 1, 22, 'v', 5.5, false, 'fixe'],
         ['tsa', SUBCL, 1, 22, 'v', 4.8, false, 'fixe']],
  'A3': [['aorte', AORTE_HYPO_1, 1, 20, 'v', 2.7, true],
         ['aorte', AORTE_HYPO_2, 1, 20, 'v', 3.8, true],
         ['aorte', AORTE_HYPO_3, 2, 28, 'v', 1.35],
         ['tsa', TABC, 1, 24, 'v', 5.5, false, 'fixe'],
         ['tsa', CAROT, 1, 20, 'v', 5.5, false, 'fixe'],
         ['tsa', SUBCL, 1, 20, 'v', 4.8, false, 'fixe']],
  'G1-BTT': [['shunt', BTT, 1, 18, 'h', 2.35, true]]
};
/* atrésie : le tronc est borgne, seules les branches peuvent couler */
ROUTES_FLUX['P3'] = [ROUTES_FLUX['P1'][1], ROUTES_FLUX['P1'][2]];

/* Quel debit traverse quel compartiment.
   p = suit Qp, s = suit Qs, c = traverse la chambre, x = le shunt. */
var DEBIT = { od: 's', og: 'p', vd: 'c', vg: 'c', cb: 'c',
              aorte: 's', 'ap-tronc': 'p', 'ap-branches': 'p', shunt: 'x',
              cia: 'a', fbv: 'f', tsa: 't' };

var _zoneFlux = 0;

/* ------------------------------------------------------------------
   RÉGLAGE UNIQUE DE LA DENSITÉ.

   Le seul bouton à tourner si le rendu est trop chargé ou trop clairsemé,
   ou si la machine de projection peine. 1 est le réglage de référence ;
   0,7 allège nettement, 1,3 remplit davantage. Il agit à la fois sur le
   nombre de traceurs créés et sur le nombre rendu actif, donc il change le
   coût par image dans la même proportion.

   À vérifier sur la machine qui projettera, pas sur un poste de
   développement : le coût dominant n'est pas le calcul mais le tracé de
   quelques centaines de chemins SVG, et il dépend beaucoup du navigateur.
------------------------------------------------------------------ */
var FLUX_DENSITE = 1;
function dose(n) { return Math.max(4, Math.round(n * FLUX_DENSITE)); }

/* Un traceur = une pathline. Elle s'AMINCIT vers sa queue : c'est ce
   gradient de largeur, plus que la vitesse elle-même, qui dit à l'œil dans
   quel sens le sang va. L'ancien découpage faisait l'inverse — une queue
   large et floue, une tête fine — et produisait une bavure. */
function balisesStreamlets(n) {
  var o = [];
  for (var i = 0; i < n; i++) {
    o.push('<g class="flux-streamlet" data-rang="' + i + '" opacity="0">' +
           '<path class="flux-queue"/>' +
           '<path class="flux-corps"/>' +
           '<path class="flux-crete"/>' +
           '<circle class="flux-tete" r="5.2"/>' +
           '</g>');
  }
  return o.join('');
}

/* Une route est un conduit : ligne centrale, demi-largeur, et surtout un
   PROFIL de vitesse transverse. Le sang colle à la paroi et court au
   centre ; les filets se cisaillent au lieu de défiler en rails
   parallèles. Exposant 2 pour un écoulement établi, 7 pour un jet
   post-sténotique à cœur plat et couche de cisaillement mince. */
function routeFlux(a) {
  var comp = a[0], d = a[1], n = a[2] || 1, e = a[3] || 30;
  var vitesse = a[5] || 1, jet = !!a[6], mode = a[7] || '';
  var id = 'flux-zone-' + (_zoneFlux++);
  var largeur = Math.max(8, n > 1 ? (n - 1) * e * 0.72 + 12 : e * 0.34);
  /* Densité. L'ancien rendu remplissait le volume avec une trame de
     hachures : c'était illisible comme écoulement, mais ça OCCUPAIT la
     lumière. En passant aux pathlines on a gagné en sens et perdu en
     présence. On compense par le nombre : deux fois plus de traceurs,
     puisqu'un traceur coûte désormais bien moins cher qu'un segment de
     trame reconstruit à chaque image. */
  var np = dose(Math.max(16, Math.min(44, 12 + n * 8 + (jet ? 8 : 0))));
  return '<g id="' + id + '" class="flux-zone" data-mode="route" ' +
         'data-flux="' + comp + '" data-debit="' + (DEBIT[comp] || 'c') +
         '" data-vitesse="' + vitesse + '" data-largeur="' +
         largeur.toFixed(1) + '" data-profil="' + (jet ? 7 : 2) + '"' +
         (jet ? ' data-jet="1"' : '') +
         (mode === 'fixe' ? ' data-sens-fixe="1"' : '') +
         (mode === 'orifice' ? ' data-orifice="1"' : '') + '>' +
         '<path class="flux-route" d="' + d + '"/>' +
         balisesStreamlets(np) + '</g>';
}

/* `septum` dit de quel côté de la CARTE se trouve la cloison. Les deux
   ventricules sont deux cartes distinctes, chacune dans son propre repère
   0-600 : le cœur droit a sa cloison à droite, le cœur gauche à gauche.
   L'ancien code supposait « à droite » dans les deux cas, si bien que le
   ventricule gauche vidait son foramen vers sa paroi libre. */
function zoneChamp(comp, mode, debit, n, x0, septum) {
  var id = 'flux-zone-' + (_zoneFlux++);
  return '<g id="' + id + '" class="flux-zone" data-mode="' + mode +
         '" data-flux="' + comp + '" data-debit="' + debit +
         '" data-x0="' + (x0 || 0) + '" data-septum="' +
         (septum || 'droite') + '" data-vitesse="1">' +
         balisesStreamlets(n) + '</g>';
}

function voiePermetEjection(v) {
  return !!(v && v.id && v.calibre !== 'absente' &&
            v.calibre !== 'atretique' && v.calibre !== 'filiforme');
}

/* Fonction volontairement pure : elle est testee sans DOM. */
function modeVentricule(d, cote) {
  var droit = cote === 'droit';
  var v = droit ? d.vd : d.vg;
  var voie = droit ? d.vsD : d.vsG;
  var av = !!v.av && d.o.av !== (droit ? 'droit' : 'gauche');
  var sortie = !!v.sortie && voiePermetEjection(voie);
  var fbv = d.fbv !== 'ferme';
  if (av && sortie) return 'ventricule-traversant';
  if (av && !sortie && fbv) return 'ventricule-lateral';
  if (!av && sortie && fbv) return 'bulbe-convergent';
  if (fbv) return 'cavite-borgne';
  return 'cavite-isolee';
}

function champsVentricule(d, cote) {
  var droit = cote === 'droit';
  var v = droit ? d.vd : d.vg;
  var voie = droit ? d.vsD : d.vsG;
  var mode = modeVentricule(d, cote);
  var debit = mode === 'ventricule-traversant'
    ? (voie.vaisseau === 'ap' ? 'p' : 's')
    : (mode === 'cavite-borgne' || mode === 'cavite-isolee' ? 'r' : 'f');
  var n = dose(mode === 'cavite-isolee' ? 16 : mode === 'cavite-borgne' ? 30 : 58);
  return zoneChamp(v.type, mode, debit, n, 0,
                   droit ? 'droite' : 'gauche');
}

function champsOreillettes(d) {
  var avD = !!d.vd.av && d.o.av !== 'droit';
  var avG = !!d.vg.av && d.o.av !== 'gauche';
  var cia = d.o.cia !== 'intacte';
  var mD = avD ? 'oreillette-traversante' :
           cia ? 'oreillette-transseptale' : 'oreillette-borgne';
  var mG = avG ? 'oreillette-traversante' :
           cia ? 'oreillette-transseptale' : 'oreillette-borgne';
  return zoneChamp('od', mD, avD ? 's' : (cia ? 'a' : 'r'), dose(46), 0, 'droite') +
         zoneChamp('og', mG, avG ? 'p' : (cia ? 'a' : 'r'), dose(46), 600, 'gauche');
}

function champsCarte(base, role, d) {
  if (role === 'ventriculeD') return champsVentricule(d, 'droit');
  if (role === 'ventriculeG') return champsVentricule(d, 'gauche');
  if (role === 'oreillettes') return champsOreillettes(d);
  var routes = ROUTES_FLUX[base] || [];
  return routes.map(routeFlux).join('');
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
  /* Un ventricule croupion communique anatomiquement mais n'est pas une
     destination de débit net. Son faible mouvement résiduel est rendu par
     une boucle fermée dans la cavité, jamais par un filet qui s'y jette. */
  var fbvVersCulDeSac = (!d.vd.av && !d.vd.sortie) ||
                        (!d.vg.av && !d.vg.sortie);
  if (hf > 4 && !fbvVersCulDeSac) {
    var n = hf > 100 ? 3 : 1, e = hf * 0.9 / n;
    o.push(routeFlux(['fbv', 'M424,' + FBV_Y + ' L776,' + FBV_Y,
                   n, e, 'h', d.fbv === 'restrictif' ? 3.0 : 1,
                   d.fbv === 'restrictif', 'orifice']));
  }
  var hc = CIA_H[d.o.cia] || 0;
  if (hc > 4) {
    var m = hc > 100 ? 3 : 1, f = hc * 0.9 / m;
    o.push(routeFlux(['cia', 'M470,' + CIA_Y + ' L730,' + CIA_Y,
                   m, f, 'h', d.o.cia === 'restrictive' ? 2.7 : 1,
                   d.o.cia === 'restrictive', 'orifice']));
  }
  return o.join('');
}

function debitDe(cle, etat, d) {
  var Qp = etat.Qp, Qs = etat.Qs;
  if (cle === 'p') return Qp;
  if (cle === 's') return Qs;
  /* Troncs supra-aortiques. Chez le nouveau-né la part céphalique et
     brachiale du débit systémique est élevée — de l'ordre du tiers, réparti
     entre les trois vaisseaux. On en donne une fraction à chacun, ce qui
     suffit à les faire vivre sans prétendre à une répartition mesurée. */
  if (cle === 't') return Qs * 0.11;
  if (cle === 'x') return etat.fluxVisuel ? etat.fluxVisuel.shunt
                                         : Math.abs(Qp - Qs);
  if (cle === 'a') {                       /* communication interauriculaire */
    if (!d) return Math.abs(Qp - Qs);
    if (d.o.av === 'droit') return Qs;     /* tout le retour cave doit passer */
    if (d.o.av === 'gauche') return Qp;    /* tout le retour pulmonaire aussi */
    return Math.abs(Qp - Qs);
  }
  if (cle === 'f') {                       /* foramen bulbo-ventriculaire */
    if (!d) return Math.abs(Qp - Qs);
    if ((!d.vd.av && !d.vd.sortie) || (!d.vg.av && !d.vg.sortie))
      return 0;
    if ((!d.vd.av && d.vd.sortie) || (!d.vg.av && d.vg.sortie))
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
    if (!d.vd.av && d.vd.sortie) return -1;/* VG dominant → bulbe à gauche */
    if (!d.vg.av && d.vg.sortie) return +1;
    var sortieD = d.vd.sortie && voiePermetEjection(d.vsD);
    var sortieG = d.vg.sortie && voiePermetEjection(d.vsG);
    if (!sortieD && sortieG) return +1;
    if (sortieD && !sortieG) return -1;
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
  _zoneFlux = 0;

  function pose(id, dx, dy, miroir, role) {
    if (!id) return;
    var c = carteSVG(id);
    var t = 'translate(' + dx + ',' + dy + ')';
    if (miroir) t += ' translate(' + miroir + ',0) scale(-1,1)';
    if (c.fill) fills.push('<g transform="' + t + '">' + c.fill + '</g>');
    if (c.ink) inks.push('<g transform="' + t + '">' + c.ink + '</g>');

    /* Champ local de cette carte, decoupe sur sa lumiere anatomique. */
    var base = id.replace(/-(G|D)$/, '').replace(/-(ferme|restrictif|large)$/, '');
    var contenu = champsCarte(base, role, d);
    if (!contenu || !c.fill) return;
    var dec = decoupe(c.fill);
    var cid = 'clip-' + (n++);
    clips.push('<clipPath id="' + cid + '" clipPathUnits="userSpaceOnUse">' +
               dec.corps + '</clipPath>');
    flux.push('<g transform="' + t + dec.t + '" clip-path="url(#' + cid + ')">' +
              contenu + '</g>');
  }

  /* rangee 1 : arteres */
  pose(carteVoie(d.vsD, d.gestes, '-G'), 0, 0, false, 'voieD');
  pose(carteVoie(d.vsG, d.gestes, '-D'), 600, 0, false, 'voieG');

  /* rangee 2 : ventricules — coeur droit a gauche, coeur gauche a droite */
  pose(d.vd.id + '-' + d.fbv + '-G', 0, 1000, false, 'ventriculeD');
  pose(d.vg.id + '-' + d.fbv + '-D', 600, 1000, false, 'ventriculeG');

  /* rangee 3 : oreillettes (carte double) */
  pose(d.o.id, 0, 2000, false, 'oreillettes');

  /* gestes superposables */
  if (d.gestes.btt && d.ap.id && d.ao.id)
    pose('G1-BTT', 0, 0, d.discordance ? 1200 : 0, 'btt');
  if (d.gestes.rashkind) pose('G3-Rashkind', 0, 2000, false, 'geste');

  /* Plus de filtre de flou : un `feGaussianBlur` appliqué à quelques
     dizaines d'éléments coûtait plusieurs millisecondes par image en
     projection. La lueur est désormais obtenue par empilement de traits,
     ce qui ne coûte rien. */
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
    /* Les vaisseaux du cou portent le sang de la crosse, y compris quand
       celle-ci est perfusée à contre-courant par le canal. */
    'tsa': sm,
    'shunt': (etat.fluxVisuel && etat.fluxVisuel.sensShunt < 0)
             ? etat.SapO2 : sm,
    /* En transposition l'artere pulmonaire est PLUS saturee que l'aorte :
       elle porte donc sa propre valeur. Un tronc atresique reste gris. */
    'ap-branches': etat.Qp > 0.05 ? etat.SapO2 : etat.SvO2,
    'ap-tronc': (d.ap.calibre === 'atretique' ||
                 d.ap.calibre === 'absente') ? null : etat.SapO2
  };
}

function fraction(x) { return x - Math.floor(x); }
function pseudo(seed) {
  return fraction(Math.sin(seed * 12.9898 + 78.233) * 43758.5453);
}
function limite(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ------------------------------------------------------------------
   ÉCHELLE DE VITESSE.

   Deux informations doivent cohabiter sans se confondre : l'aplat dit
   l'OXYGÉNATION, les traceurs disent la VITESSE. C'est pourquoi la rampe
   de vitesse évite soigneusement le bleu-pourpre-rouge des saturations et
   court du bleu ardoise à l'orange en passant par le cyan, la menthe et
   l'ambre. Elle est continue, et non plus découpée en cinq paliers dont
   quatre étaient inatteignables : avec CO_MAX = 3,6 la quasi-totalité des
   configurations tombait dans la même bande turquoise, si bien que le
   canal « vitesse » ne disait plus rien.

   La couleur varie aussi LE LONG de la pathline : la queue porte la
   vitesse d'il y a quelques dixièmes de seconde, la crête la vitesse
   actuelle. Un traceur qui franchit un cerclage vire donc du cyan à
   l'orange sur sa propre longueur, comme sur un rendu de vélocimétrie.
------------------------------------------------------------------ */
var FLUX_STOPS = [[0.00, [0x33, 0x62, 0x8E]],   /* bleu ardoise : quasi stase */
                  [0.26, [0x3E, 0xA6, 0xCE]],   /* cyan                        */
                  [0.50, [0x55, 0xD6, 0xBC]],   /* menthe                      */
                  [0.72, [0xE3, 0xC7, 0x58]],   /* ambre                       */
                  [0.88, [0xF7, 0x9A, 0x45]],   /* orange                      */
                  [1.00, [0xFF, 0x71, 0x33]]];  /* jet                         */
var FLUX_NIVEAUX = 40;
var FLUX_VMAX = 620;          /* unités SVG par seconde en butée de rampe */

var FLUX_PALETTE = (function () {
  var o = [];
  for (var k = 0; k < FLUX_NIVEAUX; k++) {
    var t = k / (FLUX_NIVEAUX - 1), c = FLUX_STOPS[FLUX_STOPS.length - 1][1];
    for (var i = 0; i < FLUX_STOPS.length - 1; i++) {
      var a = FLUX_STOPS[i], b = FLUX_STOPS[i + 1];
      if (t <= b[0]) {
        var f = (t - a[0]) / (b[0] - a[0]);
        c = [Math.round(a[1][0] + f * (b[1][0] - a[1][0])),
             Math.round(a[1][1] + f * (b[1][1] - a[1][1])),
             Math.round(a[1][2] + f * (b[1][2] - a[1][2]))];
        break;
      }
    }
    o.push('rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
  }
  return o;
})();

/* Exposant 0,38 plutôt qu'une racine carrée. Les vitesses en cavité (60 à
   280 unités/s) et en conduit (100 à 700) ne vivent pas dans la même
   décade : avec une échelle trop plate, toutes les chambres tombaient dans
   le bas sombre de la rampe et devenaient illisibles sur l'aplat. Cette
   compression relève le bas de gamme sans écraser le haut, et réserve le
   bleu profond à ce qui est vraiment en stase. */
function niveauVitesse(v) {
  return Math.round(Math.pow(limite(v / FLUX_VMAX, 0, 1), 0.38) *
                    (FLUX_NIVEAUX - 1));
}

/* Écrire un attribut coûte ; le comparer ne coûte rien. Les teintes ne
   changent que lorsque le niveau quantifié change vraiment. */
function poserTrait(el, cle, val) {
  if (el._v === val) return;
  el._v = val;
  el.setAttribute(cle, val);
}

/* ------------------------------------------------------------------
   PATHLINES.

   La trace vise une LONGUEUR, pas un nombre d'images. Avec un pas fixe, un
   traceur lent n'accumulait que quelques dizaines d'unités et se réduisait
   à un tiret : le ventricule dominant, qui coule lentement parce que son
   anneau auriculo-ventriculaire est large, en devenait illisible. La
   longueur reste proportionnelle à la vitesse — un jet laisse une traînée
   plus longue, ce qui est un bon indice de vélocimétrie — mais avec un
   plancher qui garantit un filet visible même en bas débit.
------------------------------------------------------------------ */
var TRACE_MAX = 30;
function pasTrace(v) { return limite(v * 0.42, 122, 300) / TRACE_MAX; }

/* ------------------------------------------------------------------
   PULSATILITÉ.

   Le simulateur calcule un DÉBIT MOYEN : il n'a pas de systole ni de
   diastole, et c'est un choix qui tient. Mais un écoulement qui défile à
   vitesse rigoureusement constante ne ressemble à rien de cardiaque, et
   l'œil d'un clinicien le refuse avant même d'y penser.

   On module donc la VITESSE DE TRANSPORT des traceurs par une onde calée
   sur la phase du scope, en imposant que la moyenne temporelle de cette
   onde vaille exactement 1. Le débit moyen reste donc rigoureusement celui
   du modèle : on ne fabrique pas de flux, on redistribue dans le temps
   celui qui existe déjà. C'est l'approximation quasi-stationnaire — on
   admet que le champ de vitesse garde sa FORME et ne change que
   d'amplitude au cours du cycle. Elle est grossière en toute rigueur, elle
   est parfaitement suffisante pour ce qu'on montre ici.

   Deux ondes, parce que les deux versants ne battent pas ensemble :
   éjection systolique pour les artères et les shunts ventriculaires,
   remplissage E/A pour les voies d'admission et les cavités.

   La COULEUR, elle, n'est pas modulée : elle continue de porter la vitesse
   moyenne, donc Q/section. Sinon tout le cœur virerait à l'orange en
   systole et au bleu en diastole, et l'échelle de vitesse perdrait son
   sens comparatif d'un compartiment à l'autre.
------------------------------------------------------------------ */
/* DÉSACTIVÉE. Essayée, regardée, écartée : avec un rapport pic sur moyenne
   de l'ordre de cinq, les traceurs s'arrêtent presque complètement en
   diastole et le rendu devient haché. Ce qui est physiologiquement juste
   n'est pas lisible ici — le simulateur montre un partage de débit, pas un
   cycle, et l'œil a besoin d'un défilement continu pour comparer deux
   versants.

   Le mécanisme reste en place et vérifié : mettre cette constante à 1
   rétablit la pulsatilité pleine, 0,3 en donne une suggestion très douce.
   La moyenne temporelle des ondes vaut exactement 1 quelle que soit la
   valeur choisie, donc le débit moyen affiché reste celui du modèle. */
var PULSE_AMPLITUDE = 0;      /* 0 = défilement lisse, 1 = pulsatilité pleine */
var PULSE_N = 128;

function tablePulse(noyau, plancher) {
  var brut = new Array(PULSE_N), somme = 0, i;
  for (i = 0; i < PULSE_N; i++) { brut[i] = noyau(i / PULSE_N); somme += brut[i]; }
  var moy = somme / PULSE_N || 1;
  var t = new Array(PULSE_N);
  for (i = 0; i < PULSE_N; i++)
    t[i] = plancher + (1 - plancher) * brut[i] / moy;   /* moyenne = 1 */
  return t;
}

function bosse(x, c, w) { var d = (x - c) / w; return Math.exp(-d * d); }

/* Éjection : montée raide juste après le QRS (phase 0,33 sur le tracé),
   pic protosystolique, décroissance jusqu'à la fermeture sigmoïdienne. */
var PULSE_EJECTION = tablePulse(function (x) {
  var u = (x - 0.31) / 0.30;
  if (u < 0 || u > 1) return 0;
  return Math.pow(Math.sin(Math.PI * u), 1.4) * (1 - 0.25 * u);
}, 0.16);

/* Remplissage : onde E protodiastolique dominante, onde A télédiastolique
   après l'onde P. */
var PULSE_REMPLISSAGE = tablePulse(function (x) {
  return bosse(x, 0.70, 0.075) + 0.5 * bosse(x, 0.13, 0.055);
}, 0.20);

/* La phase vient du scope, qui vit dans main.js. En dehors du navigateur
   — dans les tests — elle n'existe pas : on retombe alors sur un
   défilement lisse, ce qui est le comportement voulu. */
function phaseCardiaque() {
  return (typeof ecgPhase === 'number' && isFinite(ecgPhase)) ? ecgPhase : -1;
}

function ondePulse(table) {
  if (PULSE_AMPLITUDE <= 0) return 1;
  var ph = phaseCardiaque();
  if (ph < 0) return 1;
  var w = table[Math.floor(ph * PULSE_N) % PULSE_N];
  return 1 + (w - 1) * PULSE_AMPLITUDE;
}

function chemin(pts, a, b) {
  if (b - a < 2) return '';
  var d = 'M' + pts[a].x.toFixed(1) + ',' + pts[a].y.toFixed(1);
  for (var i = a + 1; i < b; i++)
    d += ' L' + pts[i].x.toFixed(1) + ',' + pts[i].y.toFixed(1);
  return d;
}

function pousserTrace(p, x, y, vit) {
  var n = p.trace.length;
  if (n) {
    var pas = pasTrace(vit);
    var q = p.trace[n - 1], dx = x - q.x, dy = y - q.y;
    if (dx * dx + dy * dy < pas * pas) return;
  }
  p.trace.push({ x: x, y: y });
  p.vit.push(vit);
  if (p.trace.length > TRACE_MAX) {
    p.trace.splice(0, p.trace.length - TRACE_MAX);
    p.vit.splice(0, p.vit.length - TRACE_MAX);
  }
}

function rendreStreamlet(p) {
  var n = p.trace.length;
  if (n < 3) {
    poserTrait(p.queue, 'd', ''); poserTrait(p.corps, 'd', '');
    poserTrait(p.crete, 'd', '');
    return;
  }
  var i1 = Math.floor(n * 0.42), i2 = Math.floor(n * 0.76);
  p.queue.setAttribute('d', chemin(p.trace, 0, i1 + 1));
  p.corps.setAttribute('d', chemin(p.trace, i1, i2 + 1));
  p.crete.setAttribute('d', chemin(p.trace, i2, n));
  var h = p.trace[n - 1];
  p.tete.setAttribute('cx', h.x.toFixed(1));
  p.tete.setAttribute('cy', h.y.toFixed(1));
  poserTrait(p.queue, 'stroke', FLUX_PALETTE[niveauVitesse(p.vit[0])]);
  poserTrait(p.corps, 'stroke', FLUX_PALETTE[niveauVitesse(p.vit[i1])]);
  var teinte = FLUX_PALETTE[niveauVitesse(p.vit[n - 1])];
  poserTrait(p.crete, 'stroke', teinte);
  poserTrait(p.tete, 'fill', teinte);
}

/* ------------------------------------------------------------------
   ROUTES : les conduits.

   La vitesse suit un profil transverse v(r) = vmax (1 - |r/R|^n). La
   condition d'adhérence est donc exacte à la paroi, et le débit imposé
   fixe vmax sans réglage : pour un profil d'exposant n, vmax vaut
   (n+1)/n fois la vitesse moyenne. Les filets ne peuvent plus défiler en
   rangs serrés — ils se cisaillent, ce qui est le seul aspect crédible
   d'un écoulement en conduite.
------------------------------------------------------------------ */
var VIT_ROUTE = 190;          /* unités par seconde et par unité de débit */

function pointRoute(item, s, decalage) {
  s = limite(s, 0, item.longueur);
  var p = item.route.getPointAtLength(s);
  var e = Math.min(8, item.longueur * 0.025);
  var a = item.route.getPointAtLength(Math.max(0, s - e));
  var b = item.route.getPointAtLength(Math.min(item.longueur, s + e));
  var angle = Math.atan2(b.y - a.y, b.x - a.x);
  return { x: p.x - Math.sin(angle) * decalage,
           y: p.y + Math.cos(angle) * decalage };
}

function vitesseRoute(item, decalage) {
  var r = item.rayon > 0 ? Math.abs(decalage) / item.rayon : 0;
  var f = 1 - Math.pow(Math.min(1, r), item.profil);
  return item.vmax * Math.max(0.04, f);
}

function semerRoute(item, p, initial) {
  p.cycle++;
  var r1 = pseudo(p.seed + p.cycle * 17.31);
  var r2 = pseudo(p.seed + p.cycle * 29.17);
  p.s = initial ? r1 * item.longueur : (item.sens < 0 ? item.longueur : 0);
  /* semis uniforme dans la SECTION : la densité de traceurs reste
     homogène, seule leur vitesse varie. Semer selon le profil aurait
     entassé les filets au centre et menti sur le volume transporté. */
  p.decalage = (r2 * 2 - 1) * item.rayon * 0.94;
  p.trace = []; p.vit = []; p.fondu = 1;
  var v = vitesseRoute(item, p.decalage);
  var pas = pasTrace(v);
  for (var k = 6; k >= 0; k--) {
    var sk = p.s - item.sens * k * pas;
    if (sk < 0 || sk > item.longueur) continue;
    var q = pointRoute(item, sk, p.decalage);
    pousserTrace(p, q.x, q.y, v);
  }
}

/* Évasement d'un orifice. Un foramen ou une communication interauriculaire
   n'est pas un tuyau : le sang CONVERGE depuis la cavité amont, se
   contracte à l'ouverture, puis s'épanouit en jet dans la cavité aval. Sans
   cela les filets démarrent et s'arrêtent net, en rangs parallèles, et rien
   ne paraît naturel. L'ouverture est au milieu du tracé — c'est là que se
   trouve la cloison. */
function evasement(item, u) {
  if (!item.orifice) return 1;
  return u < 0.5 ? 1 + 1.5 * Math.pow(1 - 2 * u, 1.6)
                 : 1 + 1.2 * Math.pow(2 * u - 1, 1.3);
}

/* Les extrémités d'un passage se fondent dans la cavité qu'elles
   rejoignent, au lieu d'être tranchées net. */
function fonduOrifice(item, u) {
  if (!item.orifice) return 1;
  var bord = item.sens < 0 ? 1 - u : u;
  return limite(Math.min(bord * 5.5, (1 - bord) * 3.2 + 0.15), 0, 1);
}

function avancerRoute(item, p, dt) {
  var v = vitesseRoute(item, p.decalage);
  var u = item.longueur > 0 ? p.s / item.longueur : 0;
  p.s += item.sens * v * ondePulse(item.onde) * dt;
  if (p.s < 0 || p.s > item.longueur) { semerRoute(item, p, false); return; }
  var q = pointRoute(item, p.s, p.decalage * evasement(item, u));
  /* On colore avec la vitesse MOYENNE, pas la vitesse instantanée : voir la
     note sur la pulsatilité. */
  pousserTrace(p, q.x, q.y, v);
  if (item.orifice) p.fondu = fonduOrifice(item, u);
}

/* ------------------------------------------------------------------
   CAVITÉS : advection dans le champ résolu par champ.js.
   Aucune formule de trajectoire ici. On intègre, et c'est tout.
------------------------------------------------------------------ */
function semerChamp(item, p, initial) {
  p.cycle++;
  var ch = item.champ;
  var r1 = pseudo(p.seed + p.cycle * 13.7);
  var r2 = pseudo(p.seed + p.cycle * 21.3);
  var r3 = pseudo(p.seed + p.cycle * 31.9);
  var pos = null;
  /* Sept traceurs sur dix naissent à l'orifice d'admission : c'est ce qui
     donne des pathlines longues, continues de l'entrée à la sortie. Les
     trois autres sont semés dans la lumière, faute de quoi les zones de
     stase — qui sont une information clinique — resteraient vides et
     passeraient pour un défaut de rendu. */
  if (ch.entrees.length && r3 < 0.7) pos = ch.pointEntree(r1, r2);
  if (!pos) pos = ch.pointLumiere(r1);
  if (!pos) pos = { x: 300, y: 520 };
  p.x = pos.x; p.y = pos.y;
  p.trace = []; p.vit = [];
  /* L'âge n'est PAS le mécanisme de renouvellement : dans une cavité
     ouverte, une particule doit vivre assez longtemps pour aller de la
     valve d'admission jusqu'à la voie d'éjection, soit près de dix
     secondes quand le ventricule est large et le débit modeste. C'est la
     sortie qui la retire, ou la stase. L'âge n'est qu'un garde-fou contre
     les particules piégées à jamais dans un tourbillon. */
  p.maxAge = (ch.entrees.length ? 16 : 9) * (0.75 + r2 * 0.5);
  p.age = initial ? r1 * p.maxAge : 0;
}

function avancerChamp(item, p, dt) {
  var ch = item.champ;
  p.age += dt;
  if (p.age > p.maxAge) { semerChamp(item, p, false); return; }
  var w = ondePulse(item.onde);
  var v1 = ch.vitesse(p.x, p.y, item.tampon);
  var mx = p.x + v1.x * w * dt * 0.5, my = p.y + v1.y * w * dt * 0.5;
  var v2 = ch.vitesse(mx, my, item.tampon);
  var nx = p.x + v2.x * w * dt, ny = p.y + v2.y * w * dt;
  /* Sorti par un orifice, ou échoué contre le myocarde faute de vitesse :
     dans les deux cas la particule a fini sa vie, on la ressème. Il n'y a
     plus de « rebond » latéral, qui était une invention pure. */
  if (ch.estSortie(nx, ny) || !ch.dedans(nx, ny)) {
    semerChamp(item, p, false); return;
  }
  p.x = nx; p.y = ny;
  var m = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (m < 3) { p.stase = (p.stase || 0) + dt;
               if (p.stase > 2.5) { semerChamp(item, p, false); return; } }
  else p.stase = 0;
  /* Le solveur travaille dans SON repère, de 0 à 600 ; le tracé, lui, est
     posé dans le repère de la carte. Les deux oreillettes partagent une
     carte double : sans ce décalage, l'oreillette gauche dessinerait ses
     pathlines par-dessus l'oreillette droite. */
  pousserTrace(p, item.x0 + nx, ny, m);
}

/* ------------------------------------------------------------------
   Le masque anatomique du solveur est bâti une seule fois par assemblage,
   en interrogeant le `clipPath` de la carte.
------------------------------------------------------------------ */
function pointBrutDansClip(item, svgRoot, x, y) {
  if (!item.clip || !item.geometries.length || !svgRoot.createSVGPoint) return true;
  for (var i = 0; i < item.geometries.length; i++) {
    var el = item.geometries[i];
    if (!el.isPointInFill) continue;
    try {
      var pt = svgRoot.createSVGPoint(); pt.x = x; pt.y = y;
      var cm = item.clip.getCTM && item.clip.getCTM();
      var gm = el.getCTM && el.getCTM();
      if (cm && gm) pt = pt.matrixTransform(cm).matrixTransform(gm.inverse());
      if (el.isPointInFill(pt)) return true;
    } catch (e) { return true; }
  }
  return false;
}

function preparerFlux(svgRoot) {
  if (!svgRoot) return [];
  var zones = svgRoot.querySelectorAll('#flux .flux-zone');
  var cache = [];
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i], mode = z.getAttribute('data-mode');
    var parent = z.parentNode, clip = null;
    while (parent && parent !== svgRoot) {
      var ref = parent.getAttribute && parent.getAttribute('clip-path');
      var m = ref && /#([^\)]+)/.exec(ref);
      if (m) { clip = svgRoot.querySelector('#' + m[1]); break; }
      parent = parent.parentNode;
    }
    var largeur = +(z.getAttribute('data-largeur') || 0);
    var item = {
      node: z, mode: mode, comp: z.getAttribute('data-flux'),
      debit: z.getAttribute('data-debit') || 'c',
      facteur: +(z.getAttribute('data-vitesse') || 1),
      profil: +(z.getAttribute('data-profil') || 2),
      rayon: largeur * 0.5,
      x0: +(z.getAttribute('data-x0') || 0),
      septum: z.getAttribute('data-septum') || 'droite',
      jet: z.getAttribute('data-jet') === '1',
      sensFixe: z.getAttribute('data-sens-fixe') === '1',
      orifice: z.getAttribute('data-orifice') === '1',
      route: z.querySelector('.flux-route'), clip: clip,
      geometries: clip ? Array.prototype.slice.call(
        clip.querySelectorAll('path,rect,circle,ellipse,polygon')) : [],
      champ: null, tampon: { x: 0, y: 0, m: 0 },
      q: 0, vmax: 0, visible: false, sens: 1, cleCouleur: '',
      particules: []
    };
    item.longueur = item.route ? Math.max(1, item.route.getTotalLength()) : 0;
    /* Quelle onde bat dans ce compartiment. Les oreillettes et la
       communication interauriculaire se vident en diastole ; tout le reste
       suit l'éjection. Pour un ventricule c'est un compromis assumé : son
       admission est diastolique et son éjection systolique, alors que le
       champ résolu est unique — on retient l'événement dominant à l'œil. */
    item.onde = (item.comp === 'od' || item.comp === 'og' ||
                 item.comp === 'cia') ? PULSE_REMPLISSAGE : PULSE_EJECTION;

    if (mode !== 'route') {
      var champ = new ChampCavite(mode, item.septum);
      var x0 = item.x0;
      var ok = champ.construire(function (x, y) {
        return pointBrutDansClip(item, svgRoot, x0 + x, y);
      });
      item.champ = ok ? champ : null;
    }

    var streamlets = z.querySelectorAll('.flux-streamlet');
    for (var j = 0; j < streamlets.length; j++) {
      var node = streamlets[j];
      var p = { node: node,
        queue: node.querySelector('.flux-queue'),
        corps: node.querySelector('.flux-corps'),
        crete: node.querySelector('.flux-crete'),
        tete: node.querySelector('.flux-tete'),
        seed: (i + 1) * 97.13 + (j + 1) * 31.77,
        cycle: 0, trace: [], vit: [], stase: 0, actif: false };
      item.particules.push(p);
      if (mode === 'route') semerRoute(item, p, true);
      else if (item.champ) semerChamp(item, p, true);
      rendreStreamlet(p);
    }
    cache.push(item);
  }
  svgRoot._cacheFlux = cache;
  svgRoot._fluxFige = '';
  return cache;
}

/* ------------------------------------------------------------------
   Coloration des compartiments et consignes de débit.
------------------------------------------------------------------ */
function colorier(svgRoot, anat, etat) {
  var d = anat.describe();
  var c = teintes(anat, etat);
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

  var cache = svgRoot._cacheFlux || preparerFlux(svgRoot);
  for (var j = 0; j < cache.length; j++) {
    var item = cache[j], vv = c[item.comp], q;
    if (item.debit === 'r') {
      if (item.mode === 'cavite-isolee') q = 0;
      else if (item.mode === 'cavite-borgne')
        q = d.fbv === 'ferme' ? 0 : 0.052;
      else q = 0.032;
    } else q = debitDe(item.debit, etat, d);
    item.q = (vv === null || vv === undefined) ? 0 : q;

    var seuil = item.comp === 'shunt' ? 0.008 : item.debit === 'r' ? 0.015 : 0.035;
    /* Le nombre de traceurs actifs suit √Q : il faut qu'un lit hyperperfusé
       se voie plus peuplé qu'un lit hypoperfusé, sans que le rapport soit
       linéaire — sinon un Qp/Qs de 4 viderait complètement le versant
       systémique. Le plancher garantit qu'un compartiment qui coule reste
       lisible même à bas débit. */
    var actifs = item.q < seuil ? 0 : Math.min(item.particules.length,
      Math.max(15, Math.round(19 + Math.sqrt(Math.min(item.q, 4)) * 21)));
    if (item.mode === 'cavite-borgne' || item.mode === 'oreillette-borgne')
      actifs = Math.min(actifs, 16);
    if (item.mode !== 'route' && !item.champ) actifs = 0;
    item.visible = actifs > 0;

    if (item.mode === 'route') {
      /* v = Q / section. Le facteur local matérialise le rétrécissement du
         dessin sans toucher au modèle ; le profil s'en déduit. */
      var vmoy = limite(VIT_ROUTE * item.q * item.facteur, 20, 700);
      item.vmax = vmoy * (item.profil + 1) / item.profil;
    } else if (item.champ) {
      /* Le champ ne reçoit qu'un débit : il en déduit lui-même sa vitesse
         d'entrée à partir de la section de l'orifice qu'il a mesurée. */
      var qq = Math.round(item.q * 40) / 40;
      if (qq !== item.qImpose) {
        item.qImpose = qq;
        item.champ.definirDebit(qq);
        item.champ.reveiller();
      }
    }

    var cle = actifs + '|' + Math.round(item.q * 20);
    if (cle === item.cleCouleur) continue;
    item.cleCouleur = cle;
    for (var n = 0; n < item.particules.length; n++) {
      var p = item.particules[n], actif = n < actifs;
      p.actif = actif;
      p.node.setAttribute('opacity', actif ? '1' : '0');
    }
  }
}

function sensZone(item, d, etat) {
  /* Un tronc du cou ne s'inverse jamais : même quand la crosse est
     perfusée à contre-courant par le canal, la tête reste irriguée dans le
     bon sens. C'est précisément ce qu'il faut montrer dans une hypoplasie
     du cœur gauche. */
  if (item.sensFixe) return 1;
  if (item.comp === 'aorte' && etat.retrogradeAorte) return -1;
  if (item.comp === 'cia' || item.comp === 'fbv') return sensPassage(item.comp, d);
  if (item.comp === 'shunt' && etat.fluxVisuel) return etat.fluxVisuel.sensShunt;
  return 1;
}

/* ------------------------------------------------------------------
   ANIMATION.
   dt reste du temps réel ; le scope ne pilote jamais le champ. Le
   simulateur montre un débit moyen, pas une pulsatilité — les confondre
   serait une faute de sens.
------------------------------------------------------------------ */
function animerFlux(svgRoot, anat, etat, dt) {
  if (!svgRoot || !etat || document.body.classList.contains('sans-flux')) return;
  var reduit = !!(window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  dt = limite(dt || 0, 0, 0.06);
  var d = anat.describe();
  var cache = svgRoot._cacheFlux || preparerFlux(svgRoot);

  /* Mouvement réduit : on ne fige pas une image vide. On calcule une fois
     l'écoulement établi, on laisse les pathlines se former, puis on
     s'arrête. L'utilisateur voit un instantané lisible plutôt que des
     points isolés. */
  if (reduit) {
    var sig = etatSignatureFlux(cache);
    if (svgRoot._fluxFige === sig) return;
    svgRoot._fluxFige = sig;
    for (var b = 0; b < 150; b++) avancerCache(cache, d, etat, 1 / 60, true);
    for (var b2 = 0; b2 < 60; b2++) avancerCache(cache, d, etat, 1 / 60, false);
    rendreCache(cache);
    return;
  }
  avancerCache(cache, d, etat, dt, dt > 0);
  rendreCache(cache);
}

function etatSignatureFlux(cache) {
  var o = [];
  for (var i = 0; i < cache.length; i++)
    o.push(cache[i].visible ? Math.round(cache[i].q * 40) : 'x');
  return o.join(',');
}

function avancerCache(cache, d, etat, dt, relaxer) {
  for (var i = 0; i < cache.length; i++) {
    var item = cache[i];
    if (!item.visible) continue;
    var nouveauSens = sensZone(item, d, etat);
    if (nouveauSens !== item.sens) {
      item.sens = nouveauSens;
      for (var r = 0; r < item.particules.length; r++) {
        item.particules[r].trace = [];
        item.particules[r].vit = [];
      }
    }
    if (item.mode !== 'route' && item.champ && relaxer)
      item.champ.entretenir();
    if (dt <= 0) continue;
    for (var p = 0; p < item.particules.length; p++) {
      var part = item.particules[p];
      if (!part.actif) continue;
      if (item.mode === 'route') avancerRoute(item, part, dt);
      else avancerChamp(item, part, dt);
    }
  }
}

function rendreCache(cache) {
  for (var i = 0; i < cache.length; i++) {
    var item = cache[i];
    if (!item.visible) continue;
    for (var p = 0; p < item.particules.length; p++) {
      var part = item.particules[p];
      if (!part.actif) continue;
      rendreStreamlet(part);
      /* Fondu d'entrée et de sortie d'un orifice : le filet naît dans la
         cavité amont et se dissout dans l'aval, au lieu d'être coupé net.
         Quantifié pour ne pas réécrire l'attribut à chaque image. */
      if (item.orifice) {
        var o = Math.round(limite(part.fondu == null ? 1 : part.fondu, 0, 1) * 8) / 8;
        if (part.opac !== o) { part.opac = o; part.node.setAttribute('opacity', o); }
      }
    }
  }
}
