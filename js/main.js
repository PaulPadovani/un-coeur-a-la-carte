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
  var e = resoudre(anat, { });
  var c = traduireVerdict(classer(anat, e));
  var box = $('#verdict');
  box.className = 'verdict ' + c.statut;
  box.innerHTML = '<strong>' + c.titre + '</strong><span>' + c.texte + '</span>';
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

function dessiner(forcer) {
  var svg = $('#coeur');
  var s = signatureAnat();
  if (forcer || s !== _signature) { svg.innerHTML = assembler(anat); _signature = s; }
  _etat = sim.etat || resoudre(anat, sim.env());
  colorier(svg, anat, _etat);
}

/* ------------------------------------------------------------------ moniteur */
var ecgX = 0, ecgData = new Array(320).fill(0), ecgPhase = 0;

function dessinerECG() {
  var p = ecgParams(sim);
  var cvs = $('#ecg'), ctx = cvs.getContext('2d');
  var W = cvs.width, H = cvs.height;
  ctx.clearRect(0, 0, W, H);
  /* grille discrete facon papier ECG */
  ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (var gx = 0; gx < W; gx += 18) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
  for (var gy = 0; gy < H; gy += 18) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
  ctx.stroke();
  ctx.strokeStyle = p.plat ? '#D9584A' : '#5FD08A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var i = 0; i < ecgData.length; i++) {
    var x = i / (ecgData.length - 1) * W;
    var y = H / 2 - ecgData[i] * H * 0.36;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();

  /* La fréquence cardiaque appartient au scope, pas à la liste des
     constantes : sur un moniteur elle est toujours posée sur le tracé. */
  ctx.textAlign = 'left';
  ctx.fillStyle = p.plat ? '#D9584A' : '#5FD08A';
  ctx.font = 'bold 30px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  var fcTxt = p.plat ? '0' : String(p.fc);
  ctx.fillText(fcTxt, 10, 32);
  var largeur = ctx.measureText(fcTxt).width;
  ctx.font = '12px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText('bpm', 14 + largeur, 32);
  ctx.globalAlpha = 1;
}

function avancerECG(dtms) {
  var p = ecgParams(sim);
  var n = 3;
  for (var k = 0; k < n; k++) {
    var v = 0;
    if (!p.plat && p.fc > 0) {
      ecgPhase += (p.fc / 60) * (dtms / 1000) / n;
      if (ecgPhase >= 1) ecgPhase -= 1;
      v = ecgBattement(ecgPhase, p.ampl);
    }
    ecgData.push(v);
    ecgData.shift();
  }
}

/* ------------------------------------------------------------------ canal */
/* Le canal artériel dessiné, pas chiffré : deux vaisseaux, un ostium
   réellement ouvert dans chaque paroi, et entre les deux une lumière qui se
   resserre heure après heure. Fermé, il ne reste qu'un cordon — le ligament
   artériel. Le trait suit les conventions du jeu de cartes : tout en stroke,
   extrémités arrondies, aucun aplat d'encre. */
function dessinerCanal(p, etat) {
  var svg = document.getElementById('canal-svg');
  if (!svg) return;
  var T = 4.4;                       /* épaisseur de trait */
  var yc = 46, xA = 56, xP = 144;    /* aorte à gauche, AP à droite */
  var h = 3 + 15 * Math.max(0, Math.min(1, p));   /* demi-lumière du canal */
  var couleur = etat ? satColor(etat.qpqs > 1 ? etat.SaO2 : etat.SapO2) : '#CFC9BA';
  var o = [];

  function tube(x, hv) {              /* vaisseau vertical, paroi coupée */
    return '<path d="M' + x + ',6 L' + x + ',' + (yc - hv) + '"/>' +
           '<path d="M' + x + ',' + (yc + hv) + ' L' + x + ',86"/>';
  }
  /* remplissage : les deux vaisseaux et, si le canal est ouvert, sa lumière */
  o.push('<g fill="' + couleur + '" opacity="0.88" stroke="none">');
  o.push('<rect x="20" y="6" width="36" height="80"/>');
  o.push('<rect x="144" y="6" width="36" height="80"/>');
  if (p > 0.04)
    o.push('<rect x="' + xA + '" y="' + (yc - h) + '" width="' + (xP - xA) +
           '" height="' + (2 * h) + '"/>');
  o.push('</g>');

  o.push('<g fill="none" stroke="currentColor" stroke-width="' + T +
         '" stroke-linecap="round" stroke-linejoin="round">');
  o.push('<path d="M20,6 L20,86"/>');                    /* paroi externe Ao */
  o.push('<path d="M180,6 L180,86"/>');                  /* paroi externe AP */
  if (p > 0.04) {
    o.push(tube(xA, h));                                 /* ostium aortique */
    o.push(tube(xP, h));                                 /* ostium pulmonaire */
    o.push('<path d="M' + xA + ',' + (yc - h) + ' L' + xP + ',' + (yc - h) + '"/>');
    o.push('<path d="M' + xA + ',' + (yc + h) + ' L' + xP + ',' + (yc + h) + '"/>');
  } else {
    /* ligament artériel : cordon plein, aucune lumière — même convention
       graphique que l'atrésie pulmonaire */
    o.push('<path d="M' + xA + ',6 L' + xA + ',86"/>');
    o.push('<path d="M' + xP + ',6 L' + xP + ',86"/>');
    o.push('<path d="M' + xA + ',' + yc + ' L' + xP + ',' + yc +
           '" stroke-width="3"/>');
  }
  o.push('</g>');

  o.push('<g fill="#6B665C" stroke="none" font-size="11" ' +
         'font-family="ui-sans-serif,-apple-system,Helvetica,Arial,sans-serif" ' +
         'text-anchor="middle">');
  o.push('<text x="38" y="96">Ao</text><text x="162" y="96">' +
         tr('vessel.pulmonaryAbbr', 'AP') + '</text>');
  o.push('</g>');
  svg.innerHTML = o.join('');
}

function etatCanal(p) {
  if (p > 0.95) return tr('canal.wide', 'largement ouvert');
  if (p > 0.6) return tr('canal.closing', 'en cours de fermeture');
  if (p > 0.2) return tr('canal.restrictive', 'restrictif');
  if (p > 0.04) return tr('canal.nearlyClosed', 'quasi fermé');
  return tr('canal.closed', 'fermé — ligament artériel');
}

function majMoniteur() {
  var e = sim.etat || resoudre(anat, sim.env());
  function set(id, v) { $(id).textContent = v; }
  set('#v-sao2', sim.mort ? '--' : Math.round(e.SaO2) + ' %');
  set('#v-qpqs', e.qpqs >= 99 ? '∞' : e.qpqs.toFixed(2));
  set('#v-svo2', sim.mort ? '--' : Math.round(e.SvO2) + ' %');
  set('#v-do2', sim.mort ? '--' : Math.round(e.DO2));
  set('#v-canal', Math.round(anat.canal * 100) + ' %');
  set('#v-canal-etat', etatCanal(anat.canal));
  dessinerCanal(anat.canal, e);
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
    box.innerHTML = '<strong>' + mort.titre + '</strong><span>' +
                    mort.texte + '</span>';
  } else if (sim.enCours) {
    box.className = 'verdict ' + c.statut;
    box.innerHTML = '<strong>' + c.titre + '</strong><span>' + c.texte + '</span>';
  }
  $('#lecture-transition').textContent = lectureTransition(sim, e);
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

  if (!sim.pause) avancerECG(dtms);
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
         tr('gesture.' + g[0] + '.title', g[2]) + '">' +
         tr('gesture.' + g[0] + '.name', g[1]) + '</button>';
  });
  $('#gestes').innerHTML = h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-geste]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-geste');
      anat.gestes[k] = !anat.gestes[k];
      b.classList.toggle('on', anat.gestes[k]);
      if (k === 'rashkind' && anat.gestes[k]) {
        anat.oreillettes = anat.oreillettes.replace(/^O[13]/, 'O2');
        construireSelecteurs();
      }
      if (sim.enCours) sim.noter(k, anat.gestes[k]);
      dessiner();
      if (!sim.enCours) verdictConstruction();
    });
  });
}

function reinitGestes() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-geste]'),
    function (b) { b.classList.remove('on'); });
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
/* Le bandeau bas s'etire : on redimensionne le canvas a la densite de
   l'ecran, sinon le trait est flou en projection. */
function redimensionner() {
  var c = $('#transition');
  var r = c.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  if (r.width < 10) return;
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
}

/* ------------------------------------------------------------------ init */
window.addEventListener('DOMContentLoaded', function () {
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
    if (t === 'SELECT' || t === 'INPUT' || t === 'BUTTON') return;
    ev.preventDefault();
    basculerPause();
  });

  window.addEventListener('resize', redimensionner);
  majTransport();
  requestAnimationFrame(boucle);
});
