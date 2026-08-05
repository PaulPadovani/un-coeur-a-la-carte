/* vitals.js — horloge physiologique, degradation, ECG, typage du deces.

   Le moment dramatique n'est PAS la construction : c'est la fermeture du
   canal arteriel entre H24 et H72. L'enfant est rose a la naissance et se
   degrade si le joueur n'agit pas.
*/

function Simulation(anat) {
  this.anat = anat;
  this.t = 0;                 /* heures */
  this.vitesse = 60;          /* minutes de temps physiologique par seconde */
  this.enCours = false;
  this.pause = false;         /* suspend l'horloge sans effacer l'etat */
  this.mort = null;           /* {cause, titre, texte, t} */
  this.reserve = 1.0;         /* reserve physiologique, 1 -> 0 */
  this.journal = [];
  /* Trajectoire REELLEMENT parcourue, avec les gestes tels qu'ils ont ete
     poses. A distinguer de la projection, qui suppose les reglages figes. */
  this.histoire = [];
  this.evenements = [];       /* {t, cle, actif} — bascule d'un geste */
  this._dernierEchantillon = -1;
}

Simulation.T_FIN = 168;       /* J7 */

/* Enregistre un point de la trajectoire, au plus un par demi-heure. */
Simulation.prototype.echantillonner = function (etat) {
  var k = Math.floor(this.t * 2);
  if (k === this._dernierEchantillon) return;
  this._dernierEchantillon = k;
  this.histoire.push({ t: this.t,
                       rvp: rapportRVP(this.t, this.anat.gestes),
                       Qp: etat.Qp, Qs: etat.Qs, qpqs: etat.qpqs,
                       SaO2: etat.SaO2, canal: this.anat.canal });
};

/* Journalise une bascule de geste, pour la reporter sur le graphe. */
Simulation.prototype.noter = function (cle, actif) {
  this.evenements.push({ t: this.t, cle: cle, actif: actif });
};

/* Perméabilité du canal en fonction du temps et de la prostaglandine.
   Sans PGE1 : fermeture progressive amorcée à H12, quasi complète à H72. */
Simulation.prototype.canalA = function (t) {
  if (this.anat.gestes.pge) return 1.0;
  if (t <= 12) return 1.0;
  if (t >= 72) return 0.0;
  var u = (t - 12) / 60;
  return 1 - u * u * (3 - 2 * u);     /* smoothstep */
};

Simulation.prototype.env = function () {
  /* la chute des RVP est portee par model.js (rapportRVP) : ici on ne fait
     que transmettre l'instant et les gestes en cours */
  return { rvpRatio: rapportRVP(this.t, this.anat.gestes) };
};

/* Un pas de simulation. dt en heures. */
Simulation.prototype.pas = function (dt) {
  if (!this.enCours || this.mort) return;
  this.t += dt;
  this.anat.canal = this.canalA(this.t);

  var etat = resoudre(this.anat, this.env());
  var cls = classer(this.anat, etat);
  this.etat = etat;
  this.classe = cls;

  /* --- consommation de la reserve physiologique --- */
  /* Seuils cales sur le modele : un coeur normal delivre DO2 ~ 13,
     un ventricule unique equilibre ~ 12. En dessous de 7,5 l'enfant
     consomme sa reserve ; en dessous de 55 % de saturation aussi.      */
  /* Seuils cales sur Di Filippo : un debit systemique effondre ou une
     SpO2 sous 75 % ne sont pas tolerables durablement.                  */
  var stress = 0;
  if (etat.DO2 < 9.0) stress += (9.0 - etat.DO2) / 9.0;
  if (etat.SaO2 < 72) stress += (72 - etat.SaO2) / 72 * 1.2;
  if (etat.congestion > 0.5) stress += etat.congestion * 1.6;
  if (etat.congestionSystemique > 0.5)
    stress += etat.congestionSystemique * 1.6;
  if (cls.statut === 'letal' || cls.statut === 'impossible') stress += 3;
  if (cls.cause === 'obstacle-sous-aortique') stress += 0.35;
  /* Di Filippo : « l'hyperdebit est cause d'augmentation du travail
     myocardique et retentit a terme sur la fonction systolique ». Au-dela
     d'un Qp/Qs de 2, la surcharge volumetrique use le ventricule en
     quelques jours, meme si la saturation est belle.                     */
  if (etat.qpqs > 2.0) stress += (etat.qpqs - 2.0) * 0.45;

  if (stress > 0) this.reserve -= stress * dt * 0.045;
  else this.reserve = Math.min(1, this.reserve + dt * 0.02);
  this.reserve = Math.max(0, this.reserve);

  if (this.reserve <= 0) this.declarerDeces(etat, cls);
  if (this.t >= Simulation.T_FIN) { this.enCours = false; }
};

Simulation.prototype.declarerDeces = function (etat, cls) {
  var cause = cls.cause, titre = cls.titre, texte = cls.texte;
  /* on affine : la cause affichee doit etre le mecanisme, pas un verdict vague */
  if (cls.statut === 'letal' || cls.statut === 'impossible') {
    /* deja typee */
  } else if (etat.congestion > 0.6) {
    cause = 'oedeme-pulmonaire';
    titre = 'Œdème pulmonaire par restriction auriculaire';
    texte = 'Le retour veineux pulmonaire n’avait pas d’issue. Une atrioseptostomie en urgence était le seul geste utile.';
  } else if (etat.congestionSystemique > 0.6) {
    cause = 'restriction-retour-cave';
    titre = 'Collapsus par obstruction du retour cave';
    texte = 'Le sang cave ne pouvait pas quitter efficacement l’oreillette droite. Il fallait ouvrir largement le septum interauriculaire.';
  } else if (etat.SaO2 < 55) {
    cause = 'hypoxemie';
    titre = 'Hypoxémie réfractaire';
    texte = 'Le débit pulmonaire s’est effondré à la fermeture du canal. Il fallait maintenir le canal ouvert ou créer une source de débit pulmonaire.';
  } else if (etat.qpqs > 2.0) {
    cause = 'collapsus';
    titre = 'Collapsus systémique par vol diastolique';
    texte = 'La saturation était belle mais le sang partait au poumon. Il fallait freiner le débit pulmonaire, pas l’augmenter.';
  } else if (etat.obstacleSousAortique) {
    cause = 'obstacle-sous-aortique';
    titre = 'Obstacle sous-aortique';
    texte = 'Tout le débit systémique traversait le foramen bulbo-ventriculaire restrictif.';
  } else {
    cause = 'defaillance';
    titre = 'Défaillance circulatoire';
    texte = 'L’apport systémique en oxygène est resté durablement insuffisant.';
  }
  this.mort = { cause: cause, titre: titre, texte: texte, t: this.t };
  this.enCours = false;
};

/* ------------------------------------------------------------------ ECG */
/* Trace pilote par l'etat : rythme normal -> tachycardie -> bradycardie ->
   asystolie. Le trace plat se merite, il ne tombe pas d'un coup.        */
function ecgParams(sim) {
  if (sim.mort) return { fc: 0, ampl: 0, plat: true };
  var r = sim.reserve;
  var fc, ampl = 1;
  if (r > 0.65)      { fc = 140; }
  else if (r > 0.35) { fc = 140 + (0.65 - r) * 260; ampl = 0.95; }   /* tachycardie */
  else if (r > 0.12) { fc = 190 - (0.35 - r) * 420; ampl = 0.7; }    /* bradycardie */
  else               { fc = 60 - (0.12 - r) * 350; ampl = 0.4; }
  return { fc: Math.max(0, Math.round(fc)), ampl: ampl, plat: false };
}

/* Un battement d'ECG normalise, echantillonne sur [0,1] */
function ecgBattement(x, ampl) {
  function g(c, w, h) { var d = (x - c) / w; return h * Math.exp(-d * d); }
  return ampl * (g(0.14, 0.030, 0.13)      /* P */
               - g(0.30, 0.011, 0.22)      /* Q */
               + g(0.33, 0.012, 1.00)      /* R */
               - g(0.37, 0.014, 0.30)      /* S */
               + g(0.62, 0.055, 0.26));    /* T */
}
