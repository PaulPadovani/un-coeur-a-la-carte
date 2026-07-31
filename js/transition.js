/* transition.js — le graphe de la transition circulatoire néonatale.

   Ce que le graphe raconte, et qui est le vrai sujet du jeu : à la naissance
   les résistances pulmonaires sont voisines des résistances systémiques, puis
   elles chutent sur la première semaine. Le canal artériel, lui, se ferme
   entre H12 et H72. Ces deux courbes ne bougent pas au même rythme, et c'est
   leur décalage qui fait basculer l'enfant.

   Deux tracés distincts, et il ne faut pas les confondre :

     - le TRAIT PLEIN est ce qui s'est réellement passé, avec les gestes tels
       que le joueur les a posés au fil des heures ;
     - le TRAIT POINTILLÉ est une projection : « si rien ne change à partir
       de maintenant, voilà où cela va ». Ce n'est pas une prédiction du sort
       de l'enfant, seulement le prolongement des réglages actuels.

   Le curseur se déplace avec l'horloge de la simulation.
*/

var TR = {
  /* échelles */
  T_MAX: 168,                /* J7, comme la simulation */
  Q_MAX: 5.0,                /* débit, unités du modèle */
  /* couleurs, reprises de la palette du site */
  cQs:   '#BC5B32',          /* terre cuite : débit systémique */
  cQp:   '#2E5E8A',          /* bleu marine clair : débit pulmonaire */
  cRVP:  '#3F7D4E',          /* vert : rapport des résistances */
  cGrille: '#DFDACD',
  cAxe:  '#C9C2B0',
  cTexte: '#6B665C',
  cCurseur: '#183A5A',
  cFond: '#FAF9F5',
  cCanal: 'rgba(188,91,50,.07)'
};

/* ------------------------------------------------------------------
   Projection : on rejoue le modèle heure par heure en supposant les
   réglages figés. On ne touche pas à la simulation en cours.
------------------------------------------------------------------ */
var _projCache = { cle: null, pts: null };

function _cleProjection(sim) {
  var a = sim.anat, g = a.gestes;
  return [a.oreillettes, a.ventriculeDroit, a.ventriculeGauche,
          a.voieDroite, a.voieGauche, a.fbv,
          g.pge, g.o2, g.no, g.co2, g.btt, g.cerclage, g.rashkind].join('|');
}

function projection(sim) {
  var cle = _cleProjection(sim);
  if (_projCache.cle === cle) return _projCache.pts;

  /* copie de travail : même anatomie, canal libre de suivre le temps */
  var faux = Object.create(Object.getPrototypeOf(sim.anat));
  for (var k in sim.anat)
    if (sim.anat.hasOwnProperty(k)) faux[k] = sim.anat[k];

  var pts = [];
  for (var t = 0; t <= TR.T_MAX; t += 2) {
    faux.canal = Simulation.prototype.canalA.call({ anat: faux }, t);
    var e = resoudre(faux, { rvpRatio: rapportRVP(t, faux.gestes) });
    pts.push({ t: t, rvp: rapportRVP(t, faux.gestes),
               Qp: e.Qp, Qs: e.Qs, qpqs: e.qpqs, SaO2: e.SaO2,
               canal: faux.canal });
  }
  _projCache.cle = cle;
  _projCache.pts = pts;
  return pts;
}

/* ------------------------------------------------------------------ tracé */
function dessinerTransition(cvs, sim) {
  var ctx = cvs.getContext('2d');
  /* Le canvas est dimensionne en pixels physiques pour rester net en
     projection ; on redresse le repere pour raisonner en pixels CSS. */
  var dpr = (cvs.clientWidth > 0) ? cvs.width / cvs.clientWidth : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var W = cvs.width / dpr, H = cvs.height / dpr;
  /* marges : à gauche les débits, à droite le rapport des résistances,
     en bas le ruban du canal artériel puis les heures */
  var mG = 26, mD = 30, mH = 9, mB = 32;
  var x0 = mG, x1 = W - mD, y0 = mH, y1 = H - mB;
  var lx = x1 - x0, ly = y1 - y0;

  function X(t) { return x0 + (t / TR.T_MAX) * lx; }
  function Yq(q) { return y1 - Math.max(0, Math.min(TR.Q_MAX, q)) / TR.Q_MAX * ly; }
  function Yr(r) { return y1 - Math.max(0, Math.min(1, r)) * ly; }

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = TR.cFond;
  ctx.fillRect(0, 0, W, H);

  /* grille et graduations horaires */
  ctx.font = '10.5px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  ctx.textAlign = 'center';
  var jour = tr('graph.dayPrefix', 'J');
  var reperes = [[0, tr('graph.birth', 'naissance')], [12, 'H12'], [24, 'H24'], [48, 'H48'],
                 [72, 'H72'], [96, jour + '4'], [120, jour + '5'],
                 [144, jour + '6'], [168, jour + '7']];
  ctx.strokeStyle = TR.cGrille; ctx.lineWidth = 1;
  reperes.forEach(function (r) {
    var x = Math.round(X(r[0])) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillStyle = TR.cTexte;
    ctx.fillText(r[1], Math.min(W - 20, Math.max(20, x)), H - 4);
  });

  /* axes */
  ctx.strokeStyle = TR.cAxe; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, y0); ctx.lineTo(x0 + 0.5, y1); ctx.lineTo(x1 + 0.5, y1);
  ctx.stroke();

  /* Graduations : débit à gauche, rapport des résistances à droite.
     Les titres d'axes tenaient trop de place — ils sont passés dans la
     légende, au-dessus du graphe. */
  ctx.textAlign = 'right';
  for (var q = 0; q <= TR.Q_MAX; q += 1) {
    ctx.fillStyle = TR.cTexte;
    ctx.fillText(String(q), x0 - 5, Yq(q) + 3.5);
    if (q > 0) {
      ctx.strokeStyle = TR.cGrille;
      ctx.beginPath();
      ctx.moveTo(x0, Math.round(Yq(q)) + 0.5);
      ctx.lineTo(x1, Math.round(Yq(q)) + 0.5);
      ctx.stroke();
    }
  }
  ctx.textAlign = 'left';
  [0, 0.5, 1].forEach(function (r) {
    ctx.fillStyle = TR.cRVP;
    ctx.fillText(r.toFixed(2), x1 + 5, Yr(r) + 3.5);
  });

  /* ---------------- le canal artériel, dessiné comme un vaisseau ----------
     Un pourcentage qui descend de 100 à 0 ne dit rien à personne. Ici le
     canal est un vaisseau couché sur l'axe du temps, dont la lumière se
     resserre au fil des heures et finit en cordon : le ligament artériel.
     Sous prostaglandine il garde son calibre — on le voit d'un coup d'œil. */
  var ycCanal = y1 + 12, hMax = 5.2;
  function calibre(p) { return 0.9 + hMax * Math.max(0, Math.min(1, p)); }

  function vaisseauCanal(pts, vecu) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    var i;
    for (i = 0; i < pts.length; i++) {
      var x = X(pts[i].t), h = calibre(pts[i].canal);
      i ? ctx.lineTo(x, ycCanal - h) : ctx.moveTo(x, ycCanal - h);
    }
    for (i = pts.length - 1; i >= 0; i--)
      ctx.lineTo(X(pts[i].t), ycCanal + calibre(pts[i].canal));
    ctx.closePath();
    ctx.fillStyle = vecu ? 'rgba(188,91,50,.30)' : 'rgba(188,91,50,.12)';
    ctx.fill();
    ctx.strokeStyle = '#8C6A4A';
    ctx.lineWidth = vecu ? 1.4 : 1;
    ctx.globalAlpha = vecu ? 1 : 0.45;
    ctx.stroke();
    ctx.restore();
  }

  var projTout = projection(sim);
  vaisseauCanal(projTout.filter(function (p) { return p.t >= sim.t - 2; }), false);
  vaisseauCanal(sim.histoire, true);
  /* canal fermé : il ne reste que le ligament, un cordon plein */
  var canalNow = sim.anat.canal;
  if (canalNow < 0.04) {
    ctx.save();
    ctx.strokeStyle = '#8C6A4A'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X(sim.t), ycCanal); ctx.lineTo(X(TR.T_MAX), ycCanal);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- courbes ---------------- */
  function trace(pts, champ, Y, couleur, pointille, epaisseur) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.lineJoin = 'round';
    if (pointille) { ctx.setLineDash([4, 5]); ctx.globalAlpha = 0.5; }
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = X(pts[i].t), y = Y(pts[i][champ]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* projection : à partir de l'instant courant seulement */
  var proj = projTout.filter(function (p) { return p.t >= sim.t - 2; });
  trace(proj, 'rvp', Yr, TR.cRVP, true, 2);
  trace(proj, 'Qp', Yq, TR.cQp, true, 2);
  trace(proj, 'Qs', Yq, TR.cQs, true, 2);

  /* trajectoire réellement parcourue */
  var h = sim.histoire;
  trace(h, 'rvp', Yr, TR.cRVP, false, 2);
  trace(h, 'Qp', Yq, TR.cQp, false, 2.6);
  trace(h, 'Qs', Yq, TR.cQs, false, 2.6);

  /* ---------------- gestes posés ---------------- */
  ctx.font = '9.5px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  ctx.textAlign = 'center';
  (sim.evenements || []).forEach(function (ev, i) {
    var x = X(ev.t);
    ctx.strokeStyle = ev.actif ? TR.cCurseur : TR.cAxe;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
    /* on decale une etiquette sur deux : deux gestes rapproches ne doivent
       pas se recouvrir */
    ctx.fillStyle = ev.actif ? TR.cCurseur : TR.cTexte;
    ctx.fillText((ev.actif ? '' : '– ') + LIBELLE_GESTE(ev.cle),
                 x, y0 + 10 + (i % 2) * 11);
  });

  /* ---------------- curseur ---------------- */
  var xc = X(Math.min(sim.t, TR.T_MAX));
  ctx.strokeStyle = TR.cCurseur; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xc, y0); ctx.lineTo(xc, ycCanal + 8); ctx.stroke();
  ctx.fillStyle = TR.cCurseur;
  ctx.beginPath();
  ctx.moveTo(xc, y0); ctx.lineTo(xc - 4.5, y0 - 7); ctx.lineTo(xc + 4.5, y0 - 7);
  ctx.closePath(); ctx.fill();

  /* mort : on barre la suite */
  if (sim.mort) {
    ctx.fillStyle = 'rgba(168,51,42,.07)';
    ctx.fillRect(xc, y0, x1 - xc, ly);
  }
}

var _NOMS_GESTES = { pge: 'PGE1', o2: 'O₂', no: 'NO', co2: 'CO₂',
                     btt: 'shunt', cerclage: 'cerclage', rashkind: 'Rashkind' };
function LIBELLE_GESTE(k) {
  return k === 'cerclage' ? tr('gesture.short.cerclage', _NOMS_GESTES[k]) :
                            (_NOMS_GESTES[k] || k);
}

/* Ligne de lecture sous le titre : la valeur exacte à l'instant du curseur. */
function lectureTransition(sim, etat) {
  var r = rapportRVP(sim.t, sim.anat.gestes);
  return 'H' + Math.floor(sim.t) +
         ' · ' + tr('graph.resistanceLabel', 'RVP/RVS') + ' ' + r.toFixed(2) +
         ' · Qp ' + etat.Qp.toFixed(2) +
         ' · Qs ' + etat.Qs.toFixed(2) +
         ' · Qp/Qs ' + (etat.qpqs >= 99 ? '∞' : etat.qpqs.toFixed(2));
}
