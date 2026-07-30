/* anatomie.js — les 5 emplacements, les gestes, l'etat du canal.
   Construit le GRAPHE DE CIRCULATION a partir de ce que le joueur a pose.

   Convention de lateralite (figee dans CLAUDE.md) :
     colonne GAUCHE de l'image = coeur DROIT  (artere pulmonaire, ventricule droit)
     colonne DROITE de l'image = coeur GAUCHE (aorte, ventricule gauche)
*/

var INF = 1e9;                 /* resistance infinie = pas de passage */

var CATALOGUE = {

  /* ---- emplacement 1 : oreillettes ----
     Le joueur ne choisit que l'état du SEPTUM INTERAURICULAIRE. L'atrésie
     auriculo-ventriculaire, elle, ne se choisit pas ici : elle découle du
     ventricule posé en face. Une chambre bulbaire ou un ventricule croupion
     n'ont pas de valve d'entrée — poser une chambre bulbaire à droite EST
     l'atrésie tricuspide. La carte auriculaire suit automatiquement. */
  cia: [
    { id: 'large',       nom: 'CIA large' },
    { id: 'restrictive', nom: 'CIA restrictive' },
    { id: 'intacte',     nom: 'Septum interauriculaire intact' }
  ],

  /* liste complète, conservée comme source de vérité des cartes */
  oreillettes: [
    { id: 'O2',      nom: 'CIA large',                cia: 'large',      av: null },
    { id: 'O1',      nom: 'CIA restrictive',          cia: 'restrictive', av: null },
    { id: 'O3',      nom: 'Septum intact',            cia: 'intacte',    av: null },
    { id: 'O2-atrG', nom: 'CIA large + atrésie tricuspide', cia: 'large', av: 'droit' },
    { id: 'O2-atrD', nom: 'CIA large + atrésie mitrale',    cia: 'large', av: 'gauche' },
    { id: 'O1-atrG', nom: 'CIA restrictive + atrésie tricuspide', cia: 'restrictive', av: 'droit' },
    { id: 'O1-atrD', nom: 'CIA restrictive + atrésie mitrale',    cia: 'restrictive', av: 'gauche' },
    { id: 'O3-atrG', nom: 'Septum intact + atrésie tricuspide', cia: 'intacte', av: 'droit' },
    { id: 'O3-atrD', nom: 'Septum intact + atrésie mitrale',    cia: 'intacte', av: 'gauche' }
  ],

  /* ---- emplacement 2 : ventricule DROIT (colonne gauche) ---- */
  ventriculeDroit: [
    { id: 'V3', nom: 'Ventricule droit',      type: 'vd', av: true,  sortie: true },
    { id: 'V2', nom: 'Chambre bulbaire',      type: 'cb', av: false, sortie: true },
    { id: 'V1', nom: 'Ventricule croupion',   type: 'cb', av: false, sortie: false }
  ],

  /* ---- emplacement 3 : ventricule GAUCHE (colonne droite) ---- */
  ventriculeGauche: [
    { id: 'V4', nom: 'Ventricule gauche',     type: 'vg', av: true,  sortie: true },
    { id: 'V2', nom: 'Chambre bulbaire',      type: 'cb', av: false, sortie: true },
    { id: 'V1', nom: 'Ventricule croupion',   type: 'cb', av: false, sortie: false }
  ],

  /* ---- emplacements 4 et 5 : les deux VOIES D'EJECTION ----
     On ne choisit plus « l'artere pulmonaire » et « l'aorte » a des places
     imposees : on choisit ce qui sort de chaque ventricule. Poser l'aorte
     au-dessus du ventricule droit et l'artere pulmonaire au-dessus du
     ventricule gauche EST la transposition — elle n'a donc plus besoin
     d'une case a cocher, elle se construit.                              */
  voies: [
    { id: 'P1', vaisseau: 'ap',    nom: 'Artère pulmonaire de calibre normal', calibre: 'normale' },
    { id: 'P2', vaisseau: 'ap',    nom: 'Artère pulmonaire de petit calibre',  calibre: 'petite' },
    { id: 'P3', vaisseau: 'ap',    nom: 'Atrésie pulmonaire',                  calibre: 'atretique' },
    { id: 'A1', vaisseau: 'aorte', nom: 'Aorte de calibre normal',             calibre: 'normale' },
    { id: 'A2', vaisseau: 'aorte', nom: 'Aorte hypoplasique + coarctation',    calibre: 'hypoplasique' },
    { id: 'A3', vaisseau: 'aorte', nom: 'Aorte filiforme, valve imperforée',   calibre: 'filiforme' }
  ],

  /* ---- communication interventriculaire, partagee par les 2 ventricules ---- */
  fbv: [
    { id: 'large',      nom: 'FBV large'      },
    { id: 'restrictif', nom: 'FBV restrictif' },
    { id: 'ferme',      nom: 'Septum fermé'   }
  ]
};

/* Resistances relatives. Unites arbitraires, calees pour que le Qp/Qs
   d'une anatomie equilibree tombe autour de 1. */
var R = {
  cia:    { large: 0.02, restrictive: 0.9, intacte: INF },
  fbv:    { large: 0.03, restrictif: 1.6, ferme: INF },
  /* « absente » = le joueur n'a pose aucun vaisseau de ce type */
  ap:     { normale: 0.10, petite: 0.9, atretique: INF, absente: INF },
  aorte:  { normale: 0.10, hypoplasique: 1.1, filiforme: 11.0, absente: INF },
  cerclage: 0.55,   /* ramene le Qp/Qs vers 1, sans creer d hypoxemie */
  shunt:   0.85,
  canalOuvert: 0.45
};

function Anatomie() {
  /* defaut : atresie tricuspide, chambre bulbaire a gauche, VG dominant a
     droite — l'archetype univentriculaire. */
  this.cia = 'large';            /* l'atrésie AV, elle, découle des ventricules */
  this.ventriculeDroit = 'V2';
  this.ventriculeGauche = 'V4';
  /* voieDroite = ce qui sort de la colonne GAUCHE de l'image (coeur droit) */
  this.voieDroite = 'P1';
  this.voieGauche = 'A1';
  this.fbv = 'large';
  /* gestes et etat */
  this.gestes = { cerclage: false, btt: false, rashkind: false, pge: false,
                  o2: false, no: false, co2: false };
  this.canal = 1.0;              /* 1 = grand ouvert, 0 = ferme */
}

Anatomie.prototype.item = function (famille, id) {
  var l = CATALOGUE[famille];
  for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
  return l[0];
};

/* Vaisseau absent : on garde un descripteur, avec une resistance infinie,
   plutot qu'un null qui ferait tomber tout le reste. */
var VAISSEAU_ABSENT = {
  ap:    { id: null, vaisseau: 'ap',    nom: 'aucune artère pulmonaire', calibre: 'absente' },
  aorte: { id: null, vaisseau: 'aorte', nom: 'aucune aorte',             calibre: 'absente' }
};

/* Descripteur complet de l'anatomie courante.
   d.vsD / d.vsG = le vaisseau pose sur chaque emplacement (ce que voit le
   joueur) ; d.ap / d.ao = le meme contenu vu par vaisseau (ce dont a besoin
   le modele), quelle que soit la place occupee.                          */
Anatomie.prototype.describe = function () {
  var o  = this.item('oreillettes', this.oreillettes);
  var vd = this.item('ventriculeDroit', this.ventriculeDroit);
  var vg = this.item('ventriculeGauche', this.ventriculeGauche);
  var vsD = this.item('voies', this.voieDroite);
  var vsG = this.item('voies', this.voieGauche);

  var ap = vsD.vaisseau === 'ap' ? vsD
         : vsG.vaisseau === 'ap' ? vsG : VAISSEAU_ABSENT.ap;
  var ao = vsG.vaisseau === 'aorte' ? vsG
         : vsD.vaisseau === 'aorte' ? vsD : VAISSEAU_ABSENT.aorte;

  /* Discordance ventriculo-arterielle : l'aorte nait du ventricule droit.
     C'est desormais une CONSEQUENCE de l'assemblage, pas une case a cocher. */
  var discordance = (vsD.vaisseau === 'aorte' && vsG.vaisseau === 'ap');

  return { o: o, vd: vd, vg: vg, ap: ap, ao: ao,
           vsD: vsD, vsG: vsG, fbv: this.fbv,
           discordance: discordance,
           deuxAortes: vsD.vaisseau === 'aorte' && vsG.vaisseau === 'aorte',
           deuxAP: vsD.vaisseau === 'ap' && vsG.vaisseau === 'ap',
           gestes: this.gestes, canal: this.canal };
};

/* ------------------------------------------------------------------
   Compatibilite : les scenarios de test et le rapport parlent encore en
   termes de « ap », « aorte » et « discordance ». On les expose comme des
   proprietes calculees sur les deux emplacements, pour n'avoir qu'une
   seule source de verite.
------------------------------------------------------------------ */
function _vaisseauDe(id) {
  var l = CATALOGUE.voies;
  for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].vaisseau;
  return null;
}
function _poser(anat, id) {
  var type = _vaisseauDe(id);
  if (!type) return;
  if (_vaisseauDe(anat.voieDroite) === type) anat.voieDroite = id;
  else if (_vaisseauDe(anat.voieGauche) === type) anat.voieGauche = id;
  else if (type === 'ap') anat.voieDroite = id;
  else anat.voieGauche = id;
}
Object.defineProperty(Anatomie.prototype, 'ap', {
  get: function () { return this.describe().ap.id; },
  set: function (id) { _poser(this, id); },
  enumerable: true, configurable: true
});
Object.defineProperty(Anatomie.prototype, 'aorte', {
  get: function () { return this.describe().ao.id; },
  set: function (id) { _poser(this, id); },
  enumerable: true, configurable: true
});
/* ------------------------------------------------------------------
   Les oreillettes, vues comme deux décisions séparées.
   O2 = CIA large, O1 = CIA restrictive, O3 = septum intact ;
   suffixe -atrG = jonction AV droite atrésique (atrésie tricuspide),
           -atrD = jonction AV gauche atrésique (atrésie mitrale).
------------------------------------------------------------------ */
var CIA_CODE = { large: 'O2', restrictive: 'O1', intacte: 'O3' };

/* Suffixe de la carte auriculaire, DÉDUIT des ventricules : une chambre sans
   valve d'entrée en face d'une oreillette, c'est une atrésie de la jonction
   auriculo-ventriculaire. Il n'y a donc rien à choisir. */
Anatomie.prototype.suffixeAV = function () {
  if (!this.item('ventriculeDroit', this.ventriculeDroit).av) return '-atrG';
  if (!this.item('ventriculeGauche', this.ventriculeGauche).av) return '-atrD';
  return '';
};

Object.defineProperty(Anatomie.prototype, 'oreillettes', {
  get: function () { return CIA_CODE[this.cia] + this.suffixeAV(); },
  set: function (v) {
    /* on n'accepte que la partie septale : le reste est déduit */
    var base = String(v).split('-')[0];
    for (var k in CIA_CODE) if (CIA_CODE[k] === base) { this.cia = k; return; }
  },
  enumerable: true, configurable: true
});

Object.defineProperty(Anatomie.prototype, 'discordance', {
  get: function () { return this.describe().discordance; },
  set: function (v) {
    var d = this.describe();
    var voulu = !!v;
    if (voulu === d.discordance) return;
    if (voulu) {
      /* l'aorte passe au-dessus du ventricule droit */
      if (d.ao.id && d.ap.id) {
        this.voieDroite = d.ao.id; this.voieGauche = d.ap.id;
      }
    } else if (d.ao.id && d.ap.id) {
      this.voieDroite = d.ap.id; this.voieGauche = d.ao.id;
    }
  },
  enumerable: true, configurable: true
});

/* ------------------------------------------------------------------
   Construction du graphe. Noeuds = compartiments, aretes = resistances.
   On garde le graphe explicite pour pouvoir faire un test de connexite
   AVANT de resoudre quoi que ce soit.
------------------------------------------------------------------ */
Anatomie.prototype.graphe = function () {
  var d = this.describe();
  var E = [];   /* {a, b, r, nom} — non oriente sauf mention */

  function lien(a, b, r, nom) { E.push({ a: a, b: b, r: r, nom: nom }); }

  /* retours veineux */
  lien('vp', 'og', 0.02, 'veines pulmonaires');
  lien('vs', 'od', 0.02, 'veines caves');

  /* septum interauriculaire */
  lien('od', 'og', R.cia[d.o.cia], 'CIA');

  /* jonctions auriculo-ventriculaires.
     od alimente le ventricule de la colonne GAUCHE (coeur droit),
     og alimente celui de la colonne DROITE (coeur gauche).            */
  var avD = d.vd.av && d.o.av !== 'droit';
  var avG = d.vg.av && d.o.av !== 'gauche';
  lien('od', 'VD', avD ? 0.02 : INF, 'valve AV droite');
  lien('og', 'VG', avG ? 0.02 : INF, 'valve AV gauche');

  /* communication interventriculaire */
  lien('VD', 'VG', R.fbv[d.fbv], 'foramen bulbo-ventriculaire');

  /* voies d'ejection.
     Chaque ventricule ejecte dans le vaisseau que le joueur a pose au-dessus
     de lui. Le nom de l'arete designe la DESTINATION (« voie systémique » =
     route vers l'aorte), pas le ventricule d'origine : c'est ce dont le
     modele a besoin, et cela reste vrai en transposition.                */
  function rVaisseau(v) {
    if (v.vaisseau === 'ap')
      return R.ap[v.calibre] +
             (d.gestes.cerclage && v.calibre !== 'atretique' ? R.cerclage : 0);
    return R.aorte[v.calibre];
  }
  function ejection(ventricule, vaisseau, sortie) {
    var pulm = vaisseau.vaisseau === 'ap';
    lien(ventricule, pulm ? 'ap-tronc' : 'aorte',
         sortie ? rVaisseau(vaisseau) : INF,
         pulm ? 'voie pulmonaire' : 'voie systémique');
  }
  ejection('VD', d.vsD, d.vd.sortie);
  ejection('VG', d.vsG, d.vg.sortie);

  /* tronc -> branches : interrompu si atresie, inexistant si aucune AP */
  var apPresente = d.ap.calibre !== 'absente';
  lien('ap-tronc', 'ap-branches',
       (!apPresente || d.ap.calibre === 'atretique') ? INF : 0.05,
       'tronc → branches');

  /* lits capillaires (resistances physiologiques, pilotees par le modele) */
  lien('aorte', 'vs', 1.0, 'RVS');
  lien('ap-branches', 'vp', 1.0, 'RVP');

  /* Canal arteriel et shunt : sources alternatives de debit pulmonaire.
     Ils s'abouchent sur les BRANCHES pulmonaires — s'il n'y a aucune artere
     pulmonaire, ils n'ont nulle part ou se brancher.                      */
  var rCanal = (apPresente && d.canal > 0.02) ? R.canalOuvert / d.canal : INF;
  lien('aorte', 'ap-branches', rCanal, 'canal artériel');
  if (d.gestes.btt && apPresente) lien('aorte', 'ap-branches', R.shunt, 'shunt BTT');

  return { aretes: E, d: d };
};

/* Test de connexite : le sang peut-il boucler ?
   Renvoie {systemique:bool, pulmonaire:bool, melange:bool, chemins:{}}  */
Anatomie.prototype.connexite = function () {
  var g = this.graphe();
  var adj = {};
  g.aretes.forEach(function (e) {
    if (e.r >= INF) return;
    (adj[e.a] = adj[e.a] || []).push(e.b);
    (adj[e.b] = adj[e.b] || []).push(e.a);
  });
  function atteignables(src) {
    var vus = {}, pile = [src];
    vus[src] = true;
    while (pile.length) {
      var n = pile.pop();
      (adj[n] || []).forEach(function (m) {
        if (!vus[m]) { vus[m] = true; pile.push(m); }
      });
    }
    return vus;
  }
  /* Les tests de voie doivent se faire par la route ARTERIELLE : sans cela,
     on rejoint l'artere pulmonaire a rebours a travers le lit capillaire. */
  function adjSauf(exclus) {
    var a = {};
    g.aretes.forEach(function (e) {
      if (e.r >= INF || exclus.indexOf(e.nom) >= 0) return;
      (a[e.a] = a[e.a] || []).push(e.b);
      (a[e.b] = a[e.b] || []).push(e.a);
    });
    return a;
  }
  function depuis(src, adj) {
    var vus = {}, pile = [src]; vus[src] = true;
    while (pile.length) {
      var n = pile.pop();
      (adj[n] || []).forEach(function (m) { if (!vus[m]) { vus[m] = true; pile.push(m); } });
    }
    return vus;
  }
  var sysOK = !!depuis('vp', adjSauf(['RVS']))['aorte'];
  var pulmOK = !!depuis('vs', adjSauf(['RVP']))['ap-branches'];
  /* L'aorte est-elle atteinte par la voie ANTÉGRADE, sans emprunter le canal
     ni le shunt ? Si non, elle se remplit à rebours — c'est ce que le schéma
     doit montrer, le flux qui descend la crosse au lieu de la monter. */
  var sysDirect = !!depuis('vp', adjSauf(['RVS', 'canal artériel', 'shunt BTT']))['aorte'];
  var depuisVP = atteignables('vp');

  /* Le MELANGE est un court-circuit : CIA, FBV, canal ou shunt.
     Il ne doit pas etre confondu avec la connexite globale du circuit,
     qui passe forcement par les lits capillaires. */
  var adjC = {};
  g.aretes.forEach(function (e) {
    if (e.r >= INF || e.nom === 'RVS' || e.nom === 'RVP') return;
    (adjC[e.a] = adjC[e.a] || []).push(e.b);
    (adjC[e.b] = adjC[e.b] || []).push(e.a);
  });
  function joignables(src, adj) {
    var vus = {}, pile = [src];
    vus[src] = true;
    while (pile.length) {
      var n = pile.pop();
      (adj[n] || []).forEach(function (m) { if (!vus[m]) { vus[m] = true; pile.push(m); } });
    }
    return vus;
  }
  var courtCircuit = joignables('og', adjC);

  return {
    systemique: sysOK,
    sysDirect: sysDirect,
    pulmonaire: pulmOK,
    melange: !!courtCircuit['od'],
    atteints: depuisVP
  };
};
