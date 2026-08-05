/* champ.js — le champ de vitesse dans les cavités.

   POURQUOI UN SOLVEUR. Le rendu précédent posait un champ ANALYTIQUE :
   une formule donnait directement le vecteur en tout point de la cavité.
   C'était économique mais faux sur quatre points qui se voyaient à l'écran.
   La vitesse ne s'annulait pas à la paroi, si bien que les traceurs
   butaient perpendiculairement sur le contour. Le champ n'était pas à
   divergence nulle : du sang apparaissait et disparaissait au milieu de la
   chambre. Le champ était stationnaire et déterministe, donc toutes les
   trajectoires s'effondraient sur une même ligne de courant. Et le
   tourbillon de remplissage était écrit à la main, indépendamment de la
   forme réelle du ventricule.

   Ici on résout l'écoulement. Advection semi-lagrangienne, diffusion
   visqueuse, puis projection de pression sur une grille MAC découpée par le
   masque anatomique. Les seules données imposées sont les PORTS — où le
   sang entre, où il sort, avec quel débit. Le jet d'entrée, la couche
   limite pariétale, le tourbillon de remplissage et la recirculation d'une
   chambre borgne en sont des CONSÉQUENCES, pas des décorations.

   CE QUE CE N'EST PAS. Ce n'est pas une CFD patient-spécifique : la grille
   est grossière, l'écoulement est bidimensionnel, la paroi est rigide et il
   n'y a pas de pulsatilité. Le simulateur montre un DÉBIT MOYEN, choix
   assumé depuis l'origine. Ce qui est garanti, c'est la conservation de la
   masse, l'adhérence à la paroi et l'absence de sortie là où l'anatomie
   n'en offre pas.

   COÛT. Le champ n'est jamais recalculé de zéro. Il est relaxé de quelques
   pas par image à partir de l'état précédent, puis entretenu au ralenti une
   fois convergé. Effet secondaire heureux : après un changement d'anatomie
   on VOIT l'écoulement se réorganiser, ce qui est exactement le propos du
   simulateur.                                                             */

/* Grille : 30 x 50 mailles de 20 unités SVG, soit la carte 600 x 1000. */
var CH_NX = 30, CH_NY = 50, CH_H = 20;

var CH_MUR = 0, CH_FLUIDE = 1, CH_ENTREE = 2, CH_SORTIE = 3;

/* Viscosité numérique. Elle fixe l'épaisseur de la couche limite : trop
   faible, les traceurs frôlent la paroi à pleine vitesse ; trop forte,
   l'écoulement devient un sirop sans tourbillon. */
var CH_VISCO = 0.11;
var CH_DT = 0.045;          /* pas de temps du solveur, découplé de l'image */
var CH_ITER = 12;           /* balayages de Gauss-Seidel ; la pression est repartie
                               de l'image precedente, donc peu d'iterations
                               suffisent une fois le champ etabli.          */
var CH_RELAX = 150;         /* pas à brûler après un changement d'anatomie  */

/* Convertit un débit du modèle (L/min/m², CO_MAX = 3.6) en vitesse
   d'entrée en unités SVG par seconde. Calibré pour qu'un ventricule
   traversant à Qs = 1,8 place son jet d'admission autour de 260 u/s. */
var CH_ECHELLE = 44000;
var CH_UMAX = 560;          /* plafond graphique, voir definirDebit */

/* Ports par topologie de cavité.
   'bas'    = valve auriculo-ventriculaire (les oreillettes sont sous les
              ventricules dans l'assemblage, le sang monte) ;
   'haut'   = voie d'éjection ;
   'septal' = foramen bulbo-ventriculaire ou communication interauriculaire,
              avec la hauteur de l'ouverture dans le repère de la carte.
   Une cavité borgne n'a AUCUN port : c'est ce qui garantit qu'aucun filet
   ne pourra s'en échapper, quelle que soit la suite du calcul.            */
var CH_PORTS = {
  'ventricule-traversant':   [{ bord: 'bas', role: CH_ENTREE },
                              { bord: 'haut', role: CH_SORTIE }],
  'ventricule-lateral':      [{ bord: 'bas', role: CH_ENTREE },
                              { bord: 'septal', role: CH_SORTIE, y: 500 }],
  'bulbe-convergent':        [{ bord: 'septal', role: CH_ENTREE, y: 500 },
                              { bord: 'haut', role: CH_SORTIE }],
  /* 'veines' = toutes les embouchures veineuses, trouvées une à une dans le
     dessin. Une oreillette reçoit deux caves ou quatre veines pulmonaires,
     pas une seule ouverture. */
  'oreillette-traversante':  [{ bord: 'veines', role: CH_ENTREE },
                              { bord: 'haut', role: CH_SORTIE }],
  'oreillette-transseptale': [{ bord: 'veines', role: CH_ENTREE },
                              { bord: 'septal', role: CH_SORTIE, y: 290 }],
  'cavite-borgne':           [],
  'cavite-isolee':           [],
  'oreillette-borgne':       []
};

var CH_DEMI_PORT = 130;     /* demi-hauteur de la bande septale explorée */

function chLimite(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* ------------------------------------------------------------------
   Une cavité : grille MAC.
     u  aux faces verticales   (nx+1) x ny   — u[i,j] sépare (i-1,j) et (i,j)
     v  aux faces horizontales  nx x (ny+1)  — v[i,j] sépare (i,j-1) et (i,j)
     p  au centre des mailles   nx x ny
   `septum` dit de quel côté de la CARTE se trouve la cloison : 'droite'
   pour le cœur droit (posé à gauche de l'image), 'gauche' pour le cœur
   gauche. L'ancien code supposait la cloison toujours à droite, si bien
   que le ventricule gauche vidait son foramen vers sa paroi libre.
------------------------------------------------------------------ */
function ChampCavite(mode, septum) {
  var nx = CH_NX, ny = CH_NY, nu = (nx + 1) * ny, nv = nx * (ny + 1);
  this.mode = mode;
  this.septum = septum === 'gauche' ? 'gauche' : 'droite';
  this.nx = nx; this.ny = ny; this.h = CH_H;
  this.type = new Int8Array(nx * ny);
  this.u = new Float32Array(nu);   this.v = new Float32Array(nv);
  this.ua = new Float32Array(nu);  this.va = new Float32Array(nv);
  this.uFixe = new Int8Array(nu);  this.vFixe = new Int8Array(nv);
  this.uCons = new Float32Array(nu); this.vCons = new Float32Array(nv);
  this.p = new Float32Array(nx * ny);
  this.div = new Float32Array(nx * ny);
  this.entrees = [];
  this.sorties = [];
  this.fluide = [];
  this.cx = nx * CH_H / 2; this.cy = ny * CH_H / 2;
  this.rayon = 1;
  this.swirl = 0;
  this.U = 0;
  this.relax = CH_RELAX;
  this.horloge = 0;
  this.tic = 0;
}

ChampCavite.prototype.cellule = function (x, y) {
  var i = Math.floor(x / this.h), j = Math.floor(y / this.h);
  if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return CH_MUR;
  return this.type[j * this.nx + i];
};

ChampCavite.prototype.dedans = function (x, y) {
  return this.cellule(x, y) !== CH_MUR;
};

/* `dansLumiere(x, y)` est fourni par render.js : il interroge le clip SVG
   de la carte. On échantillonne au CENTRE des mailles, jamais aux nœuds. */
ChampCavite.prototype.construire = function (dansLumiere) {
  var nx = this.nx, ny = this.ny, h = this.h, n = 0, sx = 0, sy = 0;
  for (var j = 0; j < ny; j++) {
    for (var i = 0; i < nx; i++) {
      var x = (i + 0.5) * h, y = (j + 0.5) * h;
      var ok = dansLumiere(x, y) ? CH_FLUIDE : CH_MUR;
      this.type[j * nx + i] = ok;
      if (ok) { n++; sx += x; sy += y; this.fluide.push(j * nx + i); }
    }
  }
  if (n < 8) { this.type.fill(CH_MUR); this.fluide = []; return false; }
  this.cx = sx / n; this.cy = sy / n;
  /* rayon caractéristique : sert à normaliser le forçage tourbillonnaire */
  var r = 0;
  for (var k = 0; k < this.fluide.length; k++) {
    var c = this.fluide[k], ci = c % nx, cj = (c - ci) / nx;
    var dx = (ci + 0.5) * h - this.cx, dy = (cj + 0.5) * h - this.cy;
    r += Math.sqrt(dx * dx + dy * dy);
  }
  this.rayon = Math.max(40, r / this.fluide.length);
  this.marquerPorts();
  return true;
};

/* ------------------------------------------------------------------
   Détection des ports.

   On ne code AUCUNE coordonnée d'ouverture en dur : on cherche dans le
   masque la maille de fluide la plus extrême du côté demandé. Le port se
   place donc tout seul, quelle que soit la carte (V1 à V4, calibres,
   variantes de foramen), et suit le dessin si celui-ci change.
------------------------------------------------------------------ */
ChampCavite.prototype.marquerPorts = function () {
  var defs = (CH_PORTS[this.mode] || []).slice();
  /* Les sorties d'abord : la recherche des embouchures veineuses a besoin
     de savoir ce qui est déjà pris pour ne pas confondre un orifice de
     sortie avec une veine. */
  defs.sort(function (a, b) { return (a.role === CH_SORTIE ? 0 : 1) -
                                     (b.role === CH_SORTIE ? 0 : 1); });
  for (var k = 0; k < defs.length; k++) {
    if (defs[k].bord === 'veines') this.marquerVeines(defs[k]);
    else this.marquerPort(defs[k]);
  }
};

/* ------------------------------------------------------------------
   EMBOUCHURES VEINEUSES.

   Une oreillette ne reçoit pas son sang par une seule ouverture : deux
   veines caves à droite, quatre veines pulmonaires à gauche, dessinées à
   des hauteurs différentes. La règle précédente ne retenait que les
   mailles situées à moins de deux rangs de l'extrême basse : une seule
   veine était alimentée, les autres restaient mortes à l'écran.

   On distingue donc la CHAMBRE de ses APPENDICES par la finesse : une
   maille est « mince » si la lumière qui la contient ne fait pas plus de
   trois mailles de large, horizontalement ou verticalement. Les veines
   sont minces, la chambre ne l'est pas. Chaque groupe connexe de mailles
   minces est une veine ; sa maille la plus éloignée du corps de
   l'oreillette est son embouchure.

   Rien n'est codé en dur : si le dessin des cartes change, les
   embouchures suivent.
------------------------------------------------------------------ */
ChampCavite.prototype.marquerVeines = function (def) {
  var nx = this.nx, ny = this.ny, t = this.type, n = nx * ny;
  var mince = new Int8Array(n), i, j, c;

  function estFluide(ii, jj) {
    return ii >= 0 && jj >= 0 && ii < nx && jj < ny && t[jj * nx + ii] !== CH_MUR;
  }
  for (j = 0; j < ny; j++) {
    for (i = 0; i < nx; i++) {
      if (!estFluide(i, j)) continue;
      var a = 1, b = 1, k;
      for (k = i - 1; estFluide(k, j); k--) a++;
      for (k = i + 1; estFluide(k, j); k++) a++;
      for (k = j - 1; estFluide(i, k); k--) b++;
      for (k = j + 1; estFluide(i, k); k++) b++;
      if (Math.min(a, b) <= 3) mince[j * nx + i] = 1;
    }
  }

  /* Distance géodésique depuis le corps de la chambre, à travers le mince */
  var dist = new Int16Array(n); dist.fill(-1);
  var file = [];
  for (c = 0; c < n; c++)
    if (t[c] !== CH_MUR && !mince[c]) { dist[c] = 0; file.push(c); }
  if (!file.length) return;                 /* cavité entièrement mince */
  for (var f = 0; f < file.length; f++) {
    c = file[f];
    var ci = c % nx, cj = (c - ci) / nx;
    var vois = [[ci - 1, cj], [ci + 1, cj], [ci, cj - 1], [ci, cj + 1]];
    for (var v = 0; v < 4; v++) {
      var vi = vois[v][0], vj = vois[v][1];
      if (!estFluide(vi, vj)) continue;
      var vc = vj * nx + vi;
      if (dist[vc] >= 0) continue;
      dist[vc] = dist[c] + 1; file.push(vc);
    }
  }

  /* Groupes connexes de mailles minces = une veine chacun */
  var vu = new Int8Array(n), bouches = [];
  for (c = 0; c < n; c++) {
    if (!mince[c] || vu[c] || t[c] === CH_MUR) continue;
    var pile = [c], groupe = [], touche = false;
    vu[c] = 1;
    while (pile.length) {
      var g = pile.pop(); groupe.push(g);
      if (t[g] === CH_SORTIE) touche = true;
      var gi = g % nx, gj = (g - gi) / nx;
      var w = [[gi - 1, gj], [gi + 1, gj], [gi, gj - 1], [gi, gj + 1]];
      for (var q = 0; q < 4; q++) {
        var wi = w[q][0], wj = w[q][1];
        if (!estFluide(wi, wj)) continue;
        var wc = wj * nx + wi;
        if (mince[wc] && !vu[wc]) { vu[wc] = 1; pile.push(wc); }
      }
    }
    if (touche || groupe.length < 2) continue;   /* c'est la sortie, pas une veine */
    var loin = groupe[0];
    for (var m = 1; m < groupe.length; m++)
      if (dist[groupe[m]] > dist[loin]) loin = groupe[m];
    if (dist[loin] < 2) continue;                /* simple renfoncement */
    bouches.push(loin);
  }

  /* Repli : aucune veine identifiable, on retombe sur l'ancienne règle. */
  if (!bouches.length) { this.marquerPort({ bord: 'bas', role: CH_ENTREE }); return; }

  for (var z = 0; z < bouches.length; z++) {
    var bc = bouches[z], bi = bc % nx, bj = (bc - bi) / nx;
    /* On cherche le voisin le PLUS PROCHE de la chambre : c'est de ce côté
       que le sang doit repartir.

       La vitesse s'impose alors sur la face OPPOSÉE — celle du cul-de-sac,
       au fond de la veine — et surtout pas sur la face qui donne vers la
       chambre. Imposer la seule face libre ferait de cette maille une pure
       source de masse que la projection de pression passerait son temps à
       combattre : c'est ce qui tuait le jet en cinq mailles et laissait
       l'oreillette entière immobile. En injectant par le fond, la maille
       redevient une simple traversée, avec une entrée imposée et une
       sortie libre que la projection équilibre. */
    var meilleur = null, dmin = 1e9;
    var cand = [[bi - 1, bj, 'u', bj * (nx + 1) + bi + 1, -1],
                [bi + 1, bj, 'u', bj * (nx + 1) + bi, 1],
                [bi, bj - 1, 'v', (bj + 1) * nx + bi, -1],
                [bi, bj + 1, 'v', bj * nx + bi, 1]];
    for (var y = 0; y < 4; y++) {
      var ni = cand[y][0], nj = cand[y][1];
      if (!estFluide(ni, nj)) continue;
      var nd = dist[nj * nx + ni];
      if (nd >= 0 && nd < dmin) { dmin = nd; meilleur = cand[y]; }
    }
    if (!meilleur) continue;
    t[bc] = CH_ENTREE;
    var e = { i: bi, j: bj, axe: meilleur[2], idx: meilleur[3],
              signe: meilleur[4] };
    this.entrees.push(e);
    if (e.axe === 'u') this.uFixe[e.idx] = 1; else this.vFixe[e.idx] = 1;
  }
};

ChampCavite.prototype.marquerPort = function (def) {
  var nx = this.nx, ny = this.ny, h = this.h;
  var vers = this.septum === 'droite' ? 1 : -1;
  var cellules = [];

  if (def.bord === 'haut' || def.bord === 'bas') {
    /* Sur chaque colonne, la maille de fluide la plus haute (ou la plus
       basse). On ne retient que celles qui affleurent réellement le bord :
       ailleurs la cavité est fermée par le myocarde. */
    var extreme = def.bord === 'haut' ? ny : -1;
    var col = new Array(nx);
    for (var i = 0; i < nx; i++) {
      col[i] = -1;
      for (var j = 0; j < ny; j++) {
        var jj = def.bord === 'haut' ? j : ny - 1 - j;
        if (this.type[jj * nx + i] === CH_FLUIDE) { col[i] = jj; break; }
      }
      if (col[i] < 0) continue;
      extreme = def.bord === 'haut' ? Math.min(extreme, col[i])
                                    : Math.max(extreme, col[i]);
    }
    for (var i2 = 0; i2 < nx; i2++) {
      if (col[i2] < 0) continue;
      if (Math.abs(col[i2] - extreme) > 2) continue;   /* pas l'orifice */
      /* signe = sens de la vitesse imposée si ce port est une ENTRÉE.
         y croît vers le bas : entrer par le bas, c'est monter (v < 0). */
      cellules.push({ i: i2, j: col[i2],
                      axe: 'v',
                      idx: def.bord === 'haut' ? col[i2] * nx + i2
                                               : (col[i2] + 1) * nx + i2,
                      signe: def.bord === 'haut' ? 1 : -1 });
    }

  } else {
    /* bande septale : on prend, ligne à ligne, la maille de fluide la plus
       proche de la cloison, dans une fenêtre centrée sur l'ouverture. */
    var yc = def.y == null ? this.cy : def.y;
    var j0 = Math.max(0, Math.floor((yc - CH_DEMI_PORT) / h));
    var j1 = Math.min(ny - 1, Math.floor((yc + CH_DEMI_PORT) / h));
    var bord = vers > 0 ? -1 : nx;
    var lig = {};
    for (var jr = j0; jr <= j1; jr++) {
      var trouve = -1;
      for (var ic = 0; ic < nx; ic++) {
        var i3 = vers > 0 ? nx - 1 - ic : ic;
        if (this.type[jr * nx + i3] === CH_FLUIDE) { trouve = i3; break; }
      }
      if (trouve < 0) continue;
      lig[jr] = trouve;
      bord = vers > 0 ? Math.max(bord, trouve) : Math.min(bord, trouve);
    }
    for (var jk in lig) {
      if (!Object.prototype.hasOwnProperty.call(lig, jk)) continue;
      var jn = +jk, iv = lig[jk];
      if (Math.abs(iv - bord) > 2) continue;
      cellules.push({ i: iv, j: jn, axe: 'u',
                      idx: jn * (nx + 1) + (vers > 0 ? iv + 1 : iv),
                      signe: vers > 0 ? -1 : 1 });
    }
  }

  for (var m = 0; m < cellules.length; m++) {
    var c = cellules[m];
    this.type[c.j * nx + c.i] = def.role;
    if (def.role === CH_ENTREE) {
      this.entrees.push(c);
      if (c.axe === 'u') this.uFixe[c.idx] = 1; else this.vFixe[c.idx] = 1;
    } else {
      this.sorties.push(c);
    }
  }
};

/* Un port peut avoir été mal placé si la carte n'offre pas d'orifice de ce
   côté. Sans entrée, une cavité censée être traversée resterait figée : on
   bascule alors sur le régime tourbillonnaire, qui reste honnête (rien
   n'en sort) plutôt que d'inventer une ouverture. */
ChampCavite.prototype.ouverte = function () {
  return this.entrees.length > 0 && this.sorties.length > 0;
};

/* ------------------------------------------------------------------
   Débit imposé.
   La vitesse d'entrée n'est PAS un réglage esthétique : c'est Q divisé par
   la section de l'orifice mesurée sur le dessin. Un foramen restrictif
   accélère donc son jet tout seul, sans facteur ad hoc.
------------------------------------------------------------------ */
ChampCavite.prototype.definirDebit = function (q) {
  var n = this.entrees.length;
  if (!n) {
    /* chambre close : vitesse de recirculation visée, en unités par seconde */
    this.swirl = Math.max(0, q) * 1600;
    this.U = 0;
    return;
  }
  this.swirl = 0;
  /* section de l'orifice, mesurée sur le dessin, en unités SVG.
     Le plafond n'est pas physique, il est graphique : les calibres du
     schéma ne sont pas à l'échelle anatomique — une veine cave y est
     dessinée bien plus fine qu'un anneau auriculo-ventriculaire — si bien
     qu'un orifice minuscule produirait une vitesse d'entrée absurde. */
  var U = Math.min(CH_UMAX, CH_ECHELLE * Math.max(0, q) / (n * this.h));
  this.U = U;
  for (var k = 0; k < n; k++) {
    var e = this.entrees[k];
    if (e.axe === 'u') this.uCons[e.idx] = e.signe * U;
    else this.vCons[e.idx] = e.signe * U;
  }
};

/* ------------------------------------------------------------------
   Conditions aux limites.
   Toute face qui touche une maille solide est mise à zéro : c'est à la
   fois la non-pénétration et, de proche en proche avec la diffusion,
   l'adhérence. Les faces d'entrée sont réimposées ensuite.
------------------------------------------------------------------ */
ChampCavite.prototype.murs = function () {
  var nx = this.nx, ny = this.ny, t = this.type, u = this.u, v = this.v;
  for (var j = 0; j < ny; j++) {
    var l0 = j * nx, lu = j * (nx + 1);
    for (var i = 0; i <= nx; i++) {
      var g = i > 0 ? t[l0 + i - 1] : CH_MUR;
      var d = i < nx ? t[l0 + i] : CH_MUR;
      if (g === CH_MUR || d === CH_MUR) u[lu + i] = 0;
    }
  }
  for (var j2 = 0; j2 <= ny; j2++) {
    for (var i2 = 0; i2 < nx; i2++) {
      var h1 = j2 > 0 ? t[(j2 - 1) * nx + i2] : CH_MUR;
      var b1 = j2 < ny ? t[j2 * nx + i2] : CH_MUR;
      if (h1 === CH_MUR || b1 === CH_MUR) v[j2 * nx + i2] = 0;
    }
  }
  for (var k = 0; k < this.entrees.length; k++) {
    var e = this.entrees[k];
    if (e.axe === 'u') u[e.idx] = this.uCons[e.idx];
    else v[e.idx] = this.vCons[e.idx];
  }
};

ChampCavite.prototype.faceU = function (i, j) {
  var nx = this.nx, t = this.type;
  var g = i > 0 ? t[j * nx + i - 1] : CH_MUR;
  var d = i < nx ? t[j * nx + i] : CH_MUR;
  return g !== CH_MUR && d !== CH_MUR;
};

ChampCavite.prototype.faceV = function (i, j) {
  var nx = this.nx, ny = this.ny, t = this.type;
  var h1 = j > 0 ? t[(j - 1) * nx + i] : CH_MUR;
  var b1 = j < ny ? t[j * nx + i] : CH_MUR;
  return h1 !== CH_MUR && b1 !== CH_MUR;
};

/* Interpolations bilinéaires sur les deux grilles décalées. */
ChampCavite.prototype.echU = function (a, x, y) {
  var nx = this.nx, ny = this.ny, h = this.h;
  var gi = chLimite(x / h, 0, nx), gj = chLimite(y / h - 0.5, 0, ny - 1);
  var i = Math.min(nx - 1, Math.floor(gi)), j = Math.min(ny - 2, Math.floor(gj));
  if (j < 0) j = 0;
  var fx = gi - i, fy = gj - j, w = nx + 1;
  var a00 = a[j * w + i], a10 = a[j * w + i + 1];
  var a01 = a[(j + 1) * w + i], a11 = a[(j + 1) * w + i + 1];
  return (a00 * (1 - fx) + a10 * fx) * (1 - fy) +
         (a01 * (1 - fx) + a11 * fx) * fy;
};

ChampCavite.prototype.echV = function (a, x, y) {
  var nx = this.nx, ny = this.ny, h = this.h;
  var gi = chLimite(x / h - 0.5, 0, nx - 1), gj = chLimite(y / h, 0, ny);
  var i = Math.min(nx - 2, Math.floor(gi)), j = Math.min(ny - 1, Math.floor(gj));
  if (i < 0) i = 0;
  var fx = gi - i, fy = gj - j;
  var a00 = a[j * nx + i], a10 = a[j * nx + i + 1];
  var a01 = a[(j + 1) * nx + i], a11 = a[(j + 1) * nx + i + 1];
  return (a00 * (1 - fx) + a10 * fx) * (1 - fy) +
         (a01 * (1 - fx) + a11 * fx) * fy;
};

/* Advection semi-lagrangienne : on remonte la trajectoire d'un pas et on
   va lire la vitesse là d'où la particule vient. Inconditionnellement
   stable, ce qui autorise un pas de temps confortable. */
ChampCavite.prototype.advecter = function (dt) {
  var nx = this.nx, ny = this.ny, h = this.h;
  this.ua.set(this.u); this.va.set(this.v);
  var ua = this.ua, va = this.va;
  for (var j = 0; j < ny; j++) {
    var lu = j * (nx + 1), y = (j + 0.5) * h;
    for (var i = 0; i <= nx; i++) {
      var idx = lu + i;
      if (this.uFixe[idx]) continue;
      if (!this.faceU(i, j)) { this.u[idx] = 0; continue; }
      var x = i * h;
      var vy = this.echV(va, x, y);
      this.u[idx] = this.echU(ua, x - ua[idx] * dt, y - vy * dt);
    }
  }
  for (var j2 = 0; j2 <= ny; j2++) {
    var lv = j2 * nx, y2 = j2 * h;
    for (var i2 = 0; i2 < nx; i2++) {
      var id2 = lv + i2;
      if (this.vFixe[id2]) continue;
      if (!this.faceV(i2, j2)) { this.v[id2] = 0; continue; }
      var x2 = (i2 + 0.5) * h;
      var vx = this.echU(ua, x2, y2);
      this.v[id2] = this.echV(va, x2 - vx * dt, y2 - va[id2] * dt);
    }
  }
};

/* Diffusion explicite. Les voisins hors lumière comptent pour zéro : c'est
   ce qui construit la couche limite et fait que le sang RALENTIT contre le
   myocarde au lieu d'y rebondir. */
ChampCavite.prototype.diffuser = function () {
  var nx = this.nx, ny = this.ny, a = CH_VISCO;
  this.ua.set(this.u); this.va.set(this.v);
  var ua = this.ua, va = this.va, w = nx + 1;
  for (var j = 0; j < ny; j++) {
    for (var i = 0; i <= nx; i++) {
      var idx = j * w + i;
      if (this.uFixe[idx] || !this.faceU(i, j)) continue;
      var s = (i > 0 && this.faceU(i - 1, j) ? ua[idx - 1] : 0) +
              (i < nx && this.faceU(i + 1, j) ? ua[idx + 1] : 0) +
              (j > 0 && this.faceU(i, j - 1) ? ua[idx - w] : 0) +
              (j < ny - 1 && this.faceU(i, j + 1) ? ua[idx + w] : 0);
      this.u[idx] = ua[idx] + a * (s - 4 * ua[idx]);
    }
  }
  for (var j2 = 0; j2 <= ny; j2++) {
    for (var i2 = 0; i2 < nx; i2++) {
      var id2 = j2 * nx + i2;
      if (this.vFixe[id2] || !this.faceV(i2, j2)) continue;
      var s2 = (i2 > 0 && this.faceV(i2 - 1, j2) ? va[id2 - 1] : 0) +
               (i2 < nx - 1 && this.faceV(i2 + 1, j2) ? va[id2 + 1] : 0) +
               (j2 > 0 && this.faceV(i2, j2 - 1) ? va[id2 - nx] : 0) +
               (j2 < ny && this.faceV(i2, j2 + 1) ? va[id2 + nx] : 0);
      this.v[id2] = va[id2] + a * (s2 - 4 * va[id2]);
    }
  }
};

/* Chambre close : le seul moteur est le mouvement du myocarde. On rappelle
   doucement le champ vers une rotation d'ensemble PLAFONNÉE — un rappel,
   pas un couple, sinon la vitesse diverge jusqu'à ce que la viscosité
   l'équilibre, très au-delà de ce qu'on veut montrer. C'est
   phénoménologique et assumé comme tel ; ce qui est garanti en revanche,
   c'est que le résultat reste confiné, puisqu'aucune sortie n'existe. */
ChampCavite.prototype.forcerTourbillon = function (dt) {
  if (this.swirl <= 0) return;
  var nx = this.nx, ny = this.ny, h = this.h, w = nx + 1;
  var k = Math.min(1, 2.6 * dt), r = this.rayon, s = this.swirl;
  for (var j = 0; j < ny; j++) {
    for (var i = 0; i <= nx; i++) {
      if (!this.faceU(i, j)) continue;
      var idx = j * w + i;
      var cible = -chLimite(((j + 0.5) * h - this.cy) / r, -1, 1) * s;
      this.u[idx] += k * (cible - this.u[idx]);
    }
  }
  for (var j2 = 0; j2 <= ny; j2++) {
    for (var i2 = 0; i2 < nx; i2++) {
      if (!this.faceV(i2, j2)) continue;
      var id2 = j2 * nx + i2;
      var c2 = chLimite(((i2 + 0.5) * h - this.cx) / r, -1, 1) * s;
      this.v[id2] += k * (c2 - this.v[id2]);
    }
  }
};

/* Projection de pression : on retire du champ sa partie divergente.
   Neumann à la paroi (la maille solide est exclue de la moyenne),
   Dirichlet p = 0 aux sorties — c'est cette basse pression qui aspire
   l'écoulement vers l'orifice de sortie plutôt qu'une force inventée. */
ChampCavite.prototype.projeter = function (dt) {
  var nx = this.nx, ny = this.ny, h = this.h, t = this.type;
  var u = this.u, v = this.v, p = this.p, div = this.div;
  var w = nx + 1, hh = h * h / dt;

  for (var k = 0; k < this.fluide.length; k++) {
    var c = this.fluide[k];
    if (t[c] === CH_MUR) continue;
    var i = c % nx, j = (c - i) / nx;
    if (t[c] === CH_SORTIE) { p[c] = 0; div[c] = 0; continue; }
    div[c] = (u[j * w + i + 1] - u[j * w + i] +
              v[(j + 1) * nx + i] - v[j * nx + i]) / h;
  }

  for (var it = 0; it < CH_ITER; it++) {
    for (var m = 0; m < this.fluide.length; m++) {
      var c2 = this.fluide[m];
      if (t[c2] === CH_MUR || t[c2] === CH_SORTIE) continue;
      var i2 = c2 % nx, j2 = (c2 - i2) / nx, s = 0, nf = 0;
      if (i2 > 0 && t[c2 - 1] !== CH_MUR) { s += p[c2 - 1]; nf++; }
      if (i2 < nx - 1 && t[c2 + 1] !== CH_MUR) { s += p[c2 + 1]; nf++; }
      if (j2 > 0 && t[c2 - nx] !== CH_MUR) { s += p[c2 - nx]; nf++; }
      if (j2 < ny - 1 && t[c2 + nx] !== CH_MUR) { s += p[c2 + nx]; nf++; }
      if (!nf) { p[c2] = 0; continue; }
      p[c2] = (s - div[c2] * hh) / nf;
    }
  }

  var g = dt / h;
  for (var j3 = 0; j3 < ny; j3++) {
    var lu = j3 * w, l0 = j3 * nx;
    for (var i3 = 1; i3 < nx; i3++) {
      var idx = lu + i3;
      if (this.uFixe[idx] || !this.faceU(i3, j3)) continue;
      u[idx] -= g * (p[l0 + i3] - p[l0 + i3 - 1]);
    }
  }
  for (var j4 = 1; j4 < ny; j4++) {
    for (var i4 = 0; i4 < nx; i4++) {
      var id4 = j4 * nx + i4;
      if (this.vFixe[id4] || !this.faceV(i4, j4)) continue;
      v[id4] -= g * (p[j4 * nx + i4] - p[(j4 - 1) * nx + i4]);
    }
  }
};

ChampCavite.prototype.pas = function (dt) {
  this.murs();
  this.advecter(dt);
  this.forcerTourbillon(dt);
  this.diffuser();
  this.murs();
  this.projeter(dt);
  this.horloge += dt;
};

/* Relaxation amortie. On brûle les pas de convergence sur quelques images
   après un changement, puis on entretient au ralenti : l'écoulement est
   moyen, donc quasi stationnaire, et le coût par image retombe à presque
   rien pour tenir la projection en congrès. */
ChampCavite.prototype.entretenir = function () {
  if (!this.fluide.length) return;
  if (this.relax > 0) {
    var n = Math.min(2, this.relax);
    for (var k = 0; k < n; k++) this.pas(CH_DT);
    this.relax -= n;
    return;
  }
  this.tic = ((this.tic || 0) + 1) % 8;
  if (this.tic === 0) this.pas(CH_DT);
};

ChampCavite.prototype.reveiller = function () { this.relax = CH_RELAX; };

ChampCavite.prototype.typeIJ = function (i, j) {
  if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return CH_MUR;
  return this.type[j * this.nx + i];
};

/* Vitesse en un point quelconque de la carte, en unités SVG par seconde.

   L'interpolation bilinéaire lit les deux grilles décalées ; près d'un
   contour oblique elle peut rendre une composante qui pointe LÉGÈREMENT
   dans le myocarde, alors que les faces solides sont bien à zéro. Sur
   quelques centaines de pas d'intégration, cette erreur suffisait à faire
   traverser la paroi à trois ou quatre traceurs sur cent. On annule donc
   explicitement la composante sortante à mesure qu'on approche de la face
   solide : c'est la non-pénétration, imposée au moment où on échantillonne
   et non par un rebond inventé.                                          */
ChampCavite.prototype.vitesse = function (x, y, out) {
  out = out || {};
  var ux = this.echU(this.u, x, y), vy = this.echV(this.v, x, y);
  var h = this.h;
  var i = Math.floor(x / h), j = Math.floor(y / h);
  var fx = x / h - i, fy = y / h - j;
  if (ux > 0 && this.typeIJ(i + 1, j) === CH_MUR)
    ux *= 1 - chLimite((fx - 0.5) * 2, 0, 1);
  else if (ux < 0 && this.typeIJ(i - 1, j) === CH_MUR)
    ux *= 1 - chLimite((0.5 - fx) * 2, 0, 1);
  if (vy > 0 && this.typeIJ(i, j + 1) === CH_MUR)
    vy *= 1 - chLimite((fy - 0.5) * 2, 0, 1);
  else if (vy < 0 && this.typeIJ(i, j - 1) === CH_MUR)
    vy *= 1 - chLimite((0.5 - fy) * 2, 0, 1);
  /* Coin rentrant : les deux voisins orthogonaux sont dans la lumière mais
     la diagonale ne l'est pas. Sans garde, une trajectoire oblique coupe le
     coin et se retrouve dans le myocarde. On rabat alors le mouvement sur
     la direction dominante — un glissement, pas un rebond. */
  var di = ux > 0 ? 1 : (ux < 0 ? -1 : 0);
  var dj = vy > 0 ? 1 : (vy < 0 ? -1 : 0);
  if (di && dj && this.typeIJ(i + di, j + dj) === CH_MUR) {
    if (Math.abs(ux) > Math.abs(vy)) vy *= 0.25; else ux *= 0.25;
  }
  out.x = ux; out.y = vy;
  out.m = Math.sqrt(ux * ux + vy * vy);
  return out;
};

/* Un point de semis tiré au hasard près d'une entrée : c'est ce qui donne
   des pathlines longues et continues, de l'orifice d'admission jusqu'à la
   sortie, au lieu de traits épars sans amont. */
ChampCavite.prototype.pointEntree = function (r1, r2) {
  var n = this.entrees.length;
  if (!n) return null;
  var e = this.entrees[Math.min(n - 1, Math.floor(r1 * n))];
  var h = this.h;
  if (e.axe === 'u')
    return { x: (e.i + 0.5) * h, y: (e.j + (0.15 + r2 * 0.7)) * h };
  return { x: (e.i + (0.15 + r2 * 0.7)) * h, y: (e.j + 0.5) * h };
};

/* Un point de semis tiré au hasard dans la lumière. */
ChampCavite.prototype.pointLumiere = function (r1) {
  var n = this.fluide.length;
  if (!n) return null;
  var c = this.fluide[Math.min(n - 1, Math.floor(r1 * n))];
  var i = c % this.nx, j = (c - i) / this.nx;
  return { x: (i + 0.5) * this.h, y: (j + 0.5) * this.h };
};

ChampCavite.prototype.estSortie = function (x, y) {
  return this.cellule(x, y) === CH_SORTIE;
};

if (typeof module !== 'undefined' && module.exports)
  module.exports = { ChampCavite: ChampCavite };
