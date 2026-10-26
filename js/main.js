/* main.js — cablage, boucle de simulation, interface trois zones. */

var anat = new Anatomie();
var sim = new Simulation(anat);
var $ = function (s) { return document.querySelector(s); };

/* ------------------------------------------------------------------ etape 1 */
/* Les deux dernieres lignes ne nomment plus « artere pulmonaire » et
   « aorte » : elles nomment des EMPLACEMENTS. Le joueur decide de ce qui
   sort de chaque ventricule. Poser l'aorte au-dessus du ventricule droit,
   c'est construire une transposition — il n'y a plus de case a cocher. */
var SLOTS = [
  ['cia',              'slot.cia',              'Septum interauriculaire',                 'cia'],
  ['ventriculeDroit',  'slot.ventriculeDroit',  'Ventricule droit (à gauche de l’image)',  'ventriculeDroit'],
  ['ventriculeGauche', 'slot.ventriculeGauche', 'Ventricule gauche (à droite de l’image)', 'ventriculeGauche'],
  ['voieDroite',       'slot.voieDroite',       'Voie d’éjection droite',                  'voies'],
  ['voieGauche',       'slot.voieGauche',       'Voie d’éjection gauche',                  'voies']
];

/* L'archétype de référence, pour repartir de zéro. */
var COEUR_NORMAL = {
  cia: 'intacte',
  ventriculeDroit: 'V3', ventriculeGauche: 'V4',
  voieDroite: 'P1', voieGauche: 'A1', fbv: 'ferme'
};

function construireSelecteurs() {
  var h = '';
  SLOTS.forEach(function (s) {
    h += '<label class="slot"><span>' + tr(s[1], s[2]) + '</span><select data-slot="' + s[0] + '">';
    CATALOGUE[s[3]].forEach(function (o) {
      h += '<option value="' + o.id + '"' +
           (anat[s[0]] === o.id ? ' selected' : '') + '>' +
           tr('catalogue.' + s[3] + '.' + o.id, o.nom) + '</option>';
    });
    h += '</select></label>';
    if (s[0] === 'ventriculeGauche') h += '<p class="note" id="note-av"></p>';
    if (s[0] === 'voieGauche') h += '<p class="note" id="note-voies"></p>';
  });
  h += '<label class="slot"><span>' +
       tr('slot.fbv', 'Communication interventriculaire') + '</span>' +
       '<select data-slot="fbv">';
  CATALOGUE.fbv.forEach(function (o) {
    h += '<option value="' + o.id + '"' +
         (anat.fbv === o.id ? ' selected' : '') + '>' +
         tr('catalogue.fbv.' + o.id, o.nom) + '</option>';
  });
  h += '</select></label>';
  $('#slots').innerHTML = h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-slot]'), function (el) {
    el.addEventListener('change', function () {
      anat[el.getAttribute('data-slot')] = el.value;
      recalculerConfiguration();
      dessiner();
      noteVoies();
      verdictConstruction();
    });
  });
  noteVoies();
}

/* L'atrésie auriculo-ventriculaire ne se choisit pas : elle découle du
   ventricule posé. On le dit, pour que le joueur comprenne ce qu'il vient
   de construire. */
function noteAV() {
  var n = $('#note-av');
  if (!n) return;
  var s = anat.suffixeAV();
  n.className = 'note';
  if (s === '-atrG')
    n.textContent = tr('note.av.tricuspide', 'Aucune valve d’entrée à droite : atrésie tricuspide.');
  else if (s === '-atrD')
    n.textContent = tr('note.av.mitrale', 'Aucune valve d’entrée à gauche : atrésie mitrale.');
  else
    n.textContent = tr('note.av.deuxValves', 'Deux valves auriculo-ventriculaires perméables.');
}

/* Rappelle au joueur ce que son assemblage des gros vaisseaux signifie. */
function noteVoies() {
  var d = anat.describe(), n = $('#note-voies');
  noteAV();
  if (!n) return;
  if (d.deuxAortes) {
    n.className = 'note alerte';
    n.textContent = tr('note.voies.deuxAortes', 'Deux aortes : aucune artère pulmonaire, donc aucun lit d’oxygénation.');
  } else if (d.deuxAP) {
    n.className = 'note alerte';
    n.textContent = tr('note.voies.deuxAP', 'Deux artères pulmonaires : aucune aorte, donc aucune issue systémique.');
  } else if (d.discordance) {
    n.className = 'note';
    n.textContent = tr('note.voies.discordance', 'L’aorte naît du ventricule droit : discordance ventriculo-artérielle (transposition).');
  } else {
    n.className = 'note';
    n.textContent = tr('note.voies.concordance', 'Concordance ventriculo-artérielle.');
  }
}

/* apercu pendant la construction, sans lancer la simulation */
function verdictConstruction() {
  var e = resoudre(anat, sim.env());
  var c = traduireVerdict(classer(anat, e));
  var box = $('#verdict');
  box.className = 'verdict ' + c.statut;
  box.innerHTML = '<summary>' + c.titre + '</summary><span>' + c.texte + '</span>';
  $('#btn-start').disabled = (c.statut === 'impossible');
}

/* ------------------------------------------------------------------ rendu */
/* On ne reconstruit le SVG que si l'ANATOMIE a changé. Le reste du temps on
   se contente de recolorier : sans cela, réécrire 190 Ko de balisage à
   chaque image saccaderait l'animation des flux. */
var _signature = null, _etat = null;

function signatureAnat() {
  var d = anat.describe(), g = anat.gestes;
  return [d.vsD.id, d.vsG.id, d.vd.id, d.vg.id, d.o.id, d.fbv,
          g.cerclage, g.btt, g.rashkind].join('|');
}

/* Changement demandé par le joueur : mettre à jour aussi en pause, sans
   attendre un pas d'horloge et sans réutiliser le verdict précédent. */
function recalculerConfiguration() {
  if (!sim.etat) return;
  sim.etat = resoudre(anat, sim.env());
  sim.classe = classer(anat, sim.etat);
}

function dessiner(forcer) {
  var svg = $('#coeur');
  var s = signatureAnat();
  if (forcer || s !== _signature) {
    svg.innerHTML = assembler(anat);
    svg._cacheFlux = null;
    preparerFlux(svg);
    _signature = s;
  }
  _etat = sim.etat || resoudre(anat, sim.env());
  colorier(svg, anat, _etat);
}

/* ------------------------------------------------------------------ moniteur */
/* Le scope balaie une FENETRE DE TEMPS fixe, pas un nombre d'images. Deux
   defauts se corrigent ici. Le tampon avancait de trois echantillons par
   image, donc la vitesse de balayage suivait la cadence d'affichage : le
   trace defilait plus vite sur une machine rapide. Et sa longueur etait
   figee a 320 points, etires sur toute la largeur du bandeau : au-dela de
   360 px le trace devenait un escalier. Le tampon se redimensionne
   desormais avec le canvas, en gardant environ un point tous les deux
   pixels physiques. */
var ECG_FENETRE = 3.2;                 /* secondes visibles a l'ecran */
var ecgData = new Array(360).fill(0), ecgPhase = 0, ecgReste = 0;

function ajusterTamponECG(W) {
  var n = Math.max(240, Math.min(1000, Math.round(W / 2)));
  if (n === ecgData.length) return;
  var ancien = ecgData, m = ancien.length, neuf = new Array(n);
  for (var i = 0; i < n; i++)          /* reechantillonnage lineaire */
    neuf[i] = ancien[Math.min(m - 1, Math.round(i / (n - 1) * (m - 1)))];
  ecgData = neuf;
}

function dessinerECG() {
  var p = ecgParams(sim);
  var cvs = $('#ecg'), ctx = cvs.getContext('2d');
  var W = cvs.width, H = cvs.height;
  ajusterTamponECG(W);
  /* Mouvement réduit : un battement statique, jamais une fausse asystolie. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (var j = 0; j < ecgData.length; j++) {
      var phase = (j / (ecgData.length - 1) * ECG_FENETRE * p.fc / 60) % 1;
      ecgData[j] = p.plat ? 0 : ecgBattement(phase, p.ampl);
    }
  }
  ctx.clearRect(0, 0, W, H);
  /* grille discrete facon papier ECG, calee sur la densite de l'ecran */
  var dpr = window.devicePixelRatio || 1, pas = 18 * dpr;
  ctx.strokeStyle = 'rgba(48,92,66,.065)'; ctx.lineWidth = dpr;
  ctx.beginPath();
  for (var gx = 0; gx < W; gx += pas) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
  for (var gy = 0; gy < H; gy += pas) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
  ctx.stroke();
  ctx.strokeStyle = p.plat ? '#A8332A' : '#3F7650';
  ctx.lineWidth = 2 * dpr;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (var i = 0; i < ecgData.length; i++) {
    var x = i / (ecgData.length - 1) * W;
    var y = H / 2 - ecgData[i] * H * 0.36;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

/* Le balayage avance en SECONDES, pas en images : un poste rapide ne doit
   pas dérouler l'ECG plus vite qu'un poste lent. Le reliquat fractionnaire
   est reporté d'une image à l'autre pour ne pas perdre de temps. */
function avancerECG(dtms) {
  var p = ecgParams(sim);
  var dt = Math.min(0.12, (dtms || 0) / 1000);
  ecgReste += dt * ecgData.length / ECG_FENETRE;
  var n = Math.floor(ecgReste);
  if (n <= 0) return;
  if (n > ecgData.length) n = ecgData.length;   /* apres une longue pause */
  ecgReste -= n;
  var dtParPoint = dt / n;
  for (var k = 0; k < n; k++) {
    var v = 0;
    if (!p.plat && p.fc > 0) {
      ecgPhase += (p.fc / 60) * dtParPoint;
      if (ecgPhase >= 1) ecgPhase -= 1;
      v = ecgBattement(ecgPhase, p.ampl);
    }
    ecgData.push(v);
    ecgData.shift();
  }
}

/* ------------------------------------------------------------------ canal */
function etatCanal(p) {
  if (p > 0.95) return tr('canal.wide', 'largement ouvert');
  if (p > 0.6) return tr('canal.closing', 'en cours de fermeture');
  if (p > 0.2) return tr('canal.restrictive', 'restrictif');
  if (p > 0.02) return tr('canal.nearlyClosed', 'quasi fermé');
  return tr('canal.closed', 'fermé — ligament artériel');
}

function majMoniteur() {
  var e = sim.etat || resoudre(anat, sim.env());
  function set(id, v) { var el = $(id); if (el.textContent !== String(v)) el.textContent = v; }
  set('#v-sao2', sim.mort ? '—' : Math.round(e.SaO2));
  set('#v-svo2', sim.mort ? '--' : Math.round(e.SvO2) + ' %');
  set('#v-do2', sim.mort ? '—' : nombreLecture(e.DO2, 1));
  set('#v-canal', Math.round(anat.canal * 100) + ' %');
  set('#v-canal-etat', etatCanal(anat.canal));
  set('#v-temps', 'H' + Math.floor(sim.t) +
      (sim.pause ? ' · ' + tr('time.pause', 'pause') : ''));
  $('#reserve').style.width = Math.round(sim.reserve * 100) + '%';
  $('#reserve').className = 'jauge-in ' +
    (sim.reserve > 0.55 ? 'ok' : sim.reserve > 0.25 ? 'alerte' : 'critique');
  $('#v-sao2').style.color = satColor(e.SaO2);

  var c = traduireVerdict(sim.classe || classer(anat, e));
  var box = $('#verdict');
  if (sim.mort) {
    var mort = traduireDeces(sim.mort);
    box.className = 'verdict letal';
    var contenuMort = '<summary>' + mort.titre + '</summary><span>' + mort.texte + '</span>';
    if (box.innerHTML !== contenuMort) box.innerHTML = contenuMort;
  } else if (sim.enCours) {
    box.className = 'verdict ' + c.statut;
    var contenu = '<summary>' + c.titre + '</summary><span>' + c.texte + '</span>';
    if (box.innerHTML !== contenu) box.innerHTML = contenu;
  }
  $('#lecture-transition').textContent = lectureTransition(sim, e);
  majLecture(e);
}

/* ------------------------------------------------------------------ boucle */
var dernier = null;
function boucle(ts) {
  if (dernier === null) dernier = ts;
  var dtms = Math.min(80, ts - dernier);
  dernier = ts;
  var actif = sim.enCours && !sim.pause && !sim.mort;
  if (actif) {
    sim.pas((dtms / 1000) * (sim.vitesse / 60));   /* vitesse = min/s */
    if (sim.etat) sim.echantillonner(sim.etat);
    dessiner();
  }
  /* Les flux coulent même à l'arrêt : ils décrivent le montage courant.
     Ils se figent en pause et à la mort. */
  animerFlux($("#coeur"), anat, _etat, (sim.pause || sim.mort) ? 0 : dtms / 1000);

  if (!sim.pause && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) avancerECG(dtms);
  dessinerECG();
  if (!document.body.classList.contains('graphe-replie'))
    dessinerTransition($('#transition'), sim);
  majMoniteur();
  majTransport();
  requestAnimationFrame(boucle);
}

/* ------------------------------------------------------------------ gestes */
var GESTES = [
  ['pge',      'Prostaglandine E1', 'maintient le canal artériel ouvert'],
  ['o2',       'Oxygène',           'baisse les résistances pulmonaires'],
  ['no',       'NO inhalé',         'baisse fortement les résistances pulmonaires'],
  ['co2',      'CO₂ / hypercapnie', 'augmente les résistances pulmonaires'],
  ['btt',      'Shunt de Blalock-Taussig-Thomas', 'source de débit pulmonaire'],
  ['cerclage', 'Cerclage de l’AP',  'freine le débit pulmonaire'],
  ['rashkind', 'Atrioseptostomie de Rashkind', 'ouvre le septum interauriculaire']
];

function construireGestes() {
  var h = '';
  GESTES.forEach(function (g) {
    h += '<button class="geste" data-geste="' + g[0] + '" title="' +
         tr('gesture.' + g[0] + '.title', g[2]) + '" aria-pressed="false">' +
         tr('gesture.' + g[0] + '.name', g[1]) + '</button>';
  });
  $('#gestes').innerHTML = h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-geste]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-geste');
      anat.gestes[k] = !anat.gestes[k];
      b.classList.toggle('on', anat.gestes[k]);
      b.setAttribute('aria-pressed', String(anat.gestes[k]));
      if (k === 'rashkind' && anat.gestes[k]) {
        anat.oreillettes = anat.oreillettes.replace(/^O[13]/, 'O2');
        construireSelecteurs();
      }
      if (sim.enCours) sim.noter(k, anat.gestes[k]);
      recalculerConfiguration();
      dessiner();
      if (!sim.enCours) verdictConstruction();
    });
  });
}

function reinitGestes() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-geste]'),
    function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  for (var k in anat.gestes) anat.gestes[k] = false;
}

/* ------------------------------------------------------------------ transport */
function majTransport() {
  var b = $('#btn-pause');
  b.disabled = !sim.enCours || !!sim.mort;
  var voulu = sim.pause ? tr('transport.resume', 'Reprendre') :
                          tr('transport.pause', 'Pause');
  if (b.textContent !== voulu) b.textContent = voulu;
  b.classList.toggle('on', !!sim.pause);
  document.body.classList.toggle('en-pause', !!sim.pause);
}

function basculerPause() {
  if (!sim.enCours || sim.mort) return;
  sim.pause = !sim.pause;
  majTransport();
}

/* Remet l'horloge à la naissance et efface les gestes, sans toucher à
   l'anatomie construite. */
function remettreAZero() {
  sim = new Simulation(anat);
  anat.canal = 1;
  reinitGestes();
  document.body.classList.remove('en-cours');
  $('#btn-start').textContent = tr('transport.start', 'Démarrer');
  dessiner(); verdictConstruction(); majTransport();
}

function demarrer() {
  sim = new Simulation(anat);
  sim.vitesse = +$('#vitesse').value;
  sim.enCours = true;
  document.body.classList.add('en-cours');
  $('#btn-start').textContent = tr('transport.restart', 'Recommencer');
  majTransport();
}

/* ------------------------------------------------------------------ canvas */
/* Les deux canvas s'etirent en CSS : il faut redimensionner leur MEMOIRE a
   la densite de l'ecran, sinon le navigateur etire une image de 360 px sur
   toute la largeur du bandeau et le trace part en escalier.
   Le scope etait oublie ici : il gardait ses 360x110 d'origine, ce qui
   ecrasait l'ECG horizontalement et le rendait flou des que la fenetre
   depassait cette largeur. */
function redimensionnerCanvas(sel) {
  var c = $(sel);
  if (!c) return false;
  var r = c.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  if (r.width < 10) return false;
  var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (c.width === w && c.height === h) return false;   /* eviter d'effacer */
  c.width = w; c.height = h;
  return true;
}

function redimensionner() {
  redimensionnerCanvas('#transition');
  if (redimensionnerCanvas('#ecg')) dessinerECG();
}

/* ------------------------------------------------------------------ init */
window.addEventListener('DOMContentLoaded', function () {
  construireLecture();
  construireSelecteurs();
  construireGestes();
  dessiner();
  verdictConstruction();
  redimensionner();

  $('#btn-start').addEventListener('click', function () {
    if (sim.enCours || sim.mort) remettreAZero();
    else demarrer();
  });

  /* Repartir d'un cœur normal : le point de comparaison de tout le reste. */
  $('#btn-normal').addEventListener('click', function () {
    for (var k in COEUR_NORMAL) anat[k] = COEUR_NORMAL[k];
    construireSelecteurs();
    remettreAZero();
  });
  $('#btn-pause').addEventListener('click', basculerPause);

  /* La visualisation des flux s'allume et s'éteint : elle sert à montrer le
     partage des débits, elle n'a pas à rester en permanence. */
  $('#btn-flux').addEventListener('click', function () {
    var coupe = document.body.classList.toggle('sans-flux');
    this.classList.toggle('on', !coupe);
    this.setAttribute('aria-pressed', String(!coupe));
  });

  /* Le schéma est très haut : replier le bandeau lui rend toute la place. */
  $('#btn-graphe').addEventListener('click', function () {
    var replie = document.body.classList.toggle('graphe-replie');
    this.textContent = replie ? tr('graph.expand', 'Déplier') :
                               tr('graph.collapse', 'Replier');
    setTimeout(redimensionner, 220);
  });

  $('#vitesse').addEventListener('input', function () {
    sim.vitesse = +this.value;
    $('#v-vitesse').textContent = this.value + ' min/s';
  });

  /* barre d'espace : pause. Pratique quand on commente en salle. */
  window.addEventListener('keydown', function (ev) {
    if (ev.code !== 'Space' && ev.key !== ' ') return;
    var t = ev.target.tagName;
    if (t === 'SELECT' || t === 'INPUT' || t === 'BUTTON' || t === 'SUMMARY' || t === 'A') return;
    ev.preventDefault();
    basculerPause();
  });

  window.addEventListener('resize', redimensionner);
  majTransport();
  requestAnimationFrame(boucle);
});
