/* continu.js — une identité de traceur pour l'assemblage entier.

   Les petites trajectoires de render.js décrivent les mouvements locaux.
   Celles-ci passent d'une carte à l'autre par les ports anatomiques :
   veine → oreillette → valve AV → ventricule → voie d'éjection. Quand le
   modèle indique un débit à travers la CIV ou la CIA, le même traceur
   emprunte la communication. Il s'arrête à la sortie du cœur : le dessin
   ne représente ni les lits capillaires ni un circuit extracardiaque.

   La vitesse reste qualitative et le champ est bidimensionnel. */

var CONTINU_MAX = 175;

function preparerContinu(svgRoot, cache) {
  var st = { root: svgRoot, chemins: [], particules: [], pieces: {}, atria: {},
             fbv: null, cia: null, sensCIV: 0, sensCIA: 0 };
  var racine = svgRoot.getScreenCTM();
  if (!racine) return st;
  var inv = racine.inverse();
  for (var i = 0; i < cache.length; i++) {
    var item = cache[i], piece = item.node.closest('[data-piece]');
    var mat = item.node.getScreenCTM();
    if (!mat) continue;
    item.matriceCoeur = inv.multiply(mat);
    item.matriceLocale = item.matriceCoeur.inverse();
    if (item.comp === 'od' || item.comp === 'og') st.atria[item.comp] = item;
    if (item.comp === 'fbv') st.fbv = item;
    if (item.comp === 'cia') st.cia = item;
    if (piece) {
      var role = piece.getAttribute('data-piece');
      (st.pieces[role] = st.pieces[role] || []).push(item);
    }
  }
  var nodes = svgRoot.querySelectorAll('#flux-continu .flux-streamlet');
  for (var j = 0; j < nodes.length; j++) {
    var node = nodes[j];
    st.particules.push({ node: node,
      queue: node.querySelector('.flux-queue'),
      corps: node.querySelector('.flux-corps'),
      crete: node.querySelector('.flux-crete'),
      tete: node.querySelector('.flux-tete'),
      grain: node.querySelector('.flux-grain'),
      fleche: false, seed: j * 43.71 + 17.3, cycle: 0,
      trace: [], vit: [], etape: null, age: 0, repasse: false });
  }
  return st;
}

function pointCoeur(item, x, y) {
  var m = item.matriceCoeur;
  return { x: m.a * x + m.c * y + m.e,
           y: m.b * x + m.d * y + m.f };
}

function pointLocal(item, x, y) {
  var m = item.matriceLocale;
  return { x: m.a * x + m.c * y + m.e,
           y: m.b * x + m.d * y + m.f };
}

function dernierPoint(p) {
  return p.trace.length ? p.trace[p.trace.length - 1] : null;
}

function ajouterPointContinu(p, q, v) {
  var avant = dernierPoint(p);
  if (avant) {
    var dist = Math.hypot(q.x - avant.x, q.y - avant.y);
    /* Un changement de carte ne doit jamais dessiner un trait à travers
       le myocarde si deux ports ne se raccordent pas sur cette variante. */
    if (dist > 105) { p.trace = []; p.vit = []; }
    else if (dist < 12) return;
  }
  p.trace.push(q);
  p.vit.push(v);
  if (p.trace.length > CONTINU_MAX) {
    p.trace.shift(); p.vit.shift();
  }
}

function entreePres(item, ancien, p) {
  var ch = item.champ, choix = null, meilleur = Infinity;
  if (!ch) return null;
  var entrees = ch.entrees;
  for (var i = 0; i < entrees.length; i++) {
    var e = entrees[i];
    var q = { x: (e.i + 0.5) * ch.h, y: (e.j + 0.5) * ch.h };
    var g = pointCoeur(item, item.x0 + q.x, q.y);
    var d = ancien ? Math.hypot(g.x - ancien.x, g.y - ancien.y)
                   : pseudo(p.seed + p.cycle * 11.8 + i * 8.31);
    if (d < meilleur) { meilleur = d; choix = q; }
  }
  /* La CIA pénètre une oreillette par le septum, qui n'est pas une entrée
     veineuse. On reprend dans la lumière la plus proche de son abouchement. */
  if (ancien && meilleur > 85) {
    for (var k = 0; k < ch.fluide.length; k++) {
      var c = ch.fluide[k], ci = c % ch.nx, cj = (c - ci) / ch.nx;
      var cellule = { x: (ci + 0.5) * ch.h, y: (cj + 0.5) * ch.h };
      var cg = pointCoeur(item, item.x0 + cellule.x, cellule.y);
      var dc = Math.hypot(cg.x - ancien.x, cg.y - ancien.y);
      if (dc < meilleur) { meilleur = dc; choix = cellule; }
    }
  }
  return choix;
}

function entrerContinu(p, item) {
  if (!item || !item.visible || !item.matriceCoeur) return false;
  var ancien = dernierPoint(p);
  p.item = item;
  p.age = 0;
  if (item.mode === 'route') {
    /* La route locale inclut la convergence au sein des deux chambres.
       Le traceur continu a déjà parcouru la chambre amont : il rejoint
       le conduit près du septum, sans saut arrière de 120–170 unités. */
    p.s = item.orifice ? item.longueur * (item.sens < 0 ? 0.68 : 0.32)
                       : (item.sens < 0 ? item.longueur : 0);
    p.decalage = (pseudo(p.seed + p.cycle * 19.1) - 0.5) * item.rayon * 0.65;
    var pt = pointRoute(item, p.s, p.decalage);
    ajouterPointContinu(p, pointCoeur(item, pt.x, pt.y), item.vmax || 80);
  } else {
    var q = entreePres(item, ancien, p);
    if (!q) return false;
    p.x = q.x; p.y = q.y;
    ajouterPointContinu(p, pointCoeur(item, item.x0 + q.x, q.y), item.champ.U || 60);
  }
  return true;
}

function premierActif(liste) {
  if (!liste) return null;
  for (var i = 0; i < liste.length; i++)
    if (liste[i].visible && liste[i].matriceCoeur &&
        (liste[i].mode === 'route' || liste[i].champ)) return liste[i];
  return null;
}

function departContinu(st, p) {
  p.cycle++;
  p.trace = []; p.vit = []; p.repasse = false; p.versCIV = false; p.age = 0;
  var cote = p.seed % 2 < 1 ? 'od' : 'og';
  var item = st.atria[cote];
  if (!item || !item.visible || !item.champ)
    item = st.atria[cote === 'od' ? 'og' : 'od'];
  if (!item || !item.visible || !item.champ) { p.item = null; return; }
  /* Quelques traceurs commencent déjà dans les ventricules pour que
     l'instantané figé montre immédiatement la traversée des trois rangées. */
  if (p.cycle === 1 && item.mode === 'oreillette-traversante' &&
      Math.floor(p.seed) % 4 === 0) {
    var v = premierActif(st.pieces[item.comp === 'od' ? 'ventriculeD' : 'ventriculeG']);
    if (v) item = v;
  }
  entrerContinu(p, item);
}

function voieDuCote(st, cote) {
  var liste = st.pieces[cote === 'D' ? 'voieD' : 'voieG'] || [];
  for (var i = 0; i < liste.length; i++)
    if ((liste[i].comp === 'aorte' || liste[i].comp === 'ap-tronc') &&
        liste[i].visible) return liste[i];
  return null;
}

function suiteContinu(st, p, d, etat) {
  var item = p.item, piece = item.node.closest('[data-piece]');
  var role = piece && piece.getAttribute('data-piece');
  var suivant = null, comp = item.comp;
  if (comp === 'od' || comp === 'og') {
    var avPermise = comp === 'od' ? !!d.vd.av && d.o.av !== 'droit'
                                 : !!d.vg.av && d.o.av !== 'gauche';
    suivant = avPermise
      ? premierActif(st.pieces[comp === 'od' ? 'ventriculeD' : 'ventriculeG'])
      : null;
    if (!suivant || !suivant.champ || !suivant.champ.entrees.length) {
      var bonSens = comp === 'od' ? 1 : -1;
      suivant = st.cia && st.cia.visible && sensZone(st.cia, d, etat) === bonSens
                 ? st.cia : null;
    }
  } else if (comp === 'cia') {
    suivant = st.atria[item.sens > 0 ? 'og' : 'od'];
  } else if (comp === 'fbv') {
    suivant = premierActif(st.pieces[item.sens > 0 ? 'ventriculeG' : 'ventriculeD']);
    p.repasse = true;
  } else if (role === 'ventriculeD' || role === 'ventriculeG') {
    var cote = role === 'ventriculeD' ? 'D' : 'G';
    var vaCIV = st.fbv && st.fbv.visible && !p.repasse &&
      sensZone(st.fbv, d, etat) === (cote === 'D' ? 1 : -1) &&
      (item.mode === 'ventricule-lateral' || p.versCIV);
    suivant = vaCIV ? st.fbv : voieDuCote(st, cote);
  } else if (role === 'voieD' || role === 'voieG') {
    var liste = st.pieces[role] || [], position = liste.indexOf(item);
    for (var n = position + 1; n < liste.length; n++) {
      if (liste[n].comp === comp && liste[n].visible) { suivant = liste[n]; break; }
    }
  }
  if (!suivant || !entrerContinu(p, suivant)) departContinu(st, p);
  else if (suivant !== item && suivant.mode !== 'route' &&
           (role === 'ventriculeD' || role === 'ventriculeG')) p.versCIV = false;
}

function avancerUnContinu(st, p, d, etat, dt) {
  if (!p.item || !p.item.visible) { departContinu(st, p); return; }
  var item = p.item;
  p.age += dt;
  if (p.age > 24) { departContinu(st, p); return; }
  if (item.mode === 'route') {
    var v = vitesseRoute(item, p.decalage);
    p.s += item.sens * v * dt;
    if (p.s < 0 || p.s > item.longueur) { suiteContinu(st, p, d, etat); return; }
    var pos = pointRoute(item, p.s, p.decalage * evasement(item, p.s / item.longueur));
    ajouterPointContinu(p, pointCoeur(item, pos.x, pos.y), v);
    return;
  }
  var ch = item.champ;
  if (!ch) { departContinu(st, p); return; }
  var piece = item.node.closest('[data-piece]');
  var role = piece && piece.getAttribute('data-piece');
  if (role === 'ventriculeD' || role === 'ventriculeG') {
    var sens = role === 'ventriculeD' ? 1 : -1;
    var qCIV = st.fbv && st.fbv.visible ? st.fbv.q : 0;
    var part = qCIV / Math.max(0.2, qCIV + (voieDuCote(st, sens > 0 ? 'D' : 'G') || {q: 0}).q);
    p.versCIV = !p.repasse && st.fbv && sensZone(st.fbv, d, etat) === sens &&
      (item.mode === 'ventricule-lateral' ||
       pseudo(p.seed + p.cycle * 7.71) < Math.min(0.78, part));
    /* Un ventricule à deux issues porte aussi une sortie septale. Le champ
       local résout l'éjection principale ; on oriente seulement la fraction
       attribuée à la CIV vers l'ouverture à sa hauteur réelle. */
    if (p.versCIV && item.mode === 'ventricule-traversant' &&
        p.y < 650 && p.y > 360) {
      var bout = pointRoute(st.fbv, st.fbv.longueur * (sens > 0 ? 0.32 : 0.68), 0);
      var cible = pointLocal(item, pointCoeur(st.fbv, bout.x, bout.y).x,
                            pointCoeur(st.fbv, bout.x, bout.y).y);
      var dx = cible.x - item.x0 - p.x, dy = cible.y - p.y;
      var distance = Math.hypot(dx, dy);
      if (distance < 24) { suiteContinu(st, p, d, etat); return; }
      var pas = Math.min(distance, 170 * dt);
      p.x += dx / distance * pas; p.y += dy / distance * pas;
      ajouterPointContinu(p, pointCoeur(item, item.x0 + p.x, p.y), 170);
      return;
    }
  }
  var v1 = ch.vitesse(p.x, p.y, item.tampon);
  var mx = p.x + v1.x * dt * 0.5, my = p.y + v1.y * dt * 0.5;
  var v2 = ch.vitesse(mx, my, item.tampon);
  var nx = p.x + v2.x * dt, ny = p.y + v2.y * dt;
  if (ch.estSortie(nx, ny)) { suiteContinu(st, p, d, etat); return; }
  if (!ch.dedans(nx, ny)) { departContinu(st, p); return; }
  p.x = nx; p.y = ny;
  ajouterPointContinu(p, pointCoeur(item, item.x0 + nx, ny), v2.m);
}

function avancerContinu(st, d, etat, dt) {
  if (!st) return;
  var sensCIV = etat.fluxVisuel ? etat.fluxVisuel.sensCIV : 0;
  var sensCIA = st.cia ? sensZone(st.cia, d, etat) : 0;
  if (st.sensCIV !== sensCIV || st.sensCIA !== sensCIA) {
    st.sensCIV = sensCIV; st.sensCIA = sensCIA;
    st.particules.forEach(function (p) { p.item = null; p.trace = []; p.vit = []; });
  }
  for (var i = 0; i < st.particules.length; i++)
    avancerUnContinu(st, st.particules[i], d, etat, dt);
}

function rendreContinu(st) {
  for (var i = 0; i < st.particules.length; i++) {
    var p = st.particules[i];
    p.node.setAttribute('opacity', p.item && p.trace.length > 3 ? '0.82' : '0');
    rendreStreamlet(p);
  }
}
