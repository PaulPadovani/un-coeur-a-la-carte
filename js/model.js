/* model.js — hemodynamique et transport d'oxygene.

   REECRITURE. Le modele precedent appliquait la formule de melange a toutes
   les anatomies, ce qui donnait une saturation de 73 % a un coeur normal.
   L'erreur etait de poser la saturation au lieu de la CALCULER.

   Principe maintenant :
     1. on determine la TOPOLOGIE (chambre de melange commune ou circuits
        separes, concordance ou discordance ventriculo-arterielle) ;
     2. on calcule les DEBITS Qp et Qs ;
     3. on calcule les SATURATIONS par bilan de masse en oxygene.
   La relation de Barnea/Fick n'est plus imposee : elle EMERGE du bilan.

   Ancrages (Di Filippo S. Ventricule unique. EMC Cardiologie 2010;11-940-E-60) :
     - circulation normale : Qp/Qs = 1, saturation systemique normale ;
     - equilibre univentriculaire : Qp/Qs entre 1 et 1,5 (jusqu'a 2),
       SpO2 entre 75 et 85 % ; au-dela, hyperdebit delehere ;
     - ventricule unique SANS obstacle : la baisse des RVP apres la naissance
       majore le debit pulmonaire et provoque une defaillance cardiaque en
       quelques jours, avec une SpO2 > 90 % — l'enfant n'est PAS desature ;
     - obstacle droit : cyanose refractaire a l'oxygene ; debit suffisant
       tant que SpO2 > 75 % ; stenose moderee = SpO2 80-90 %, situation
       favorable et durable ;
     - obstacle gauche : devie le flux vers le poumon, donc AUGMENTE le Qp ;
     - Qp/Qs = (SaO2 - SvO2) / (SvpO2 - SaO2) ;
     - la SvO2 augmente jusqu'a un Qp/Qs de 2 puis diminue au-dela.
*/

var CFG = {
  SpvO2: 99,        /* saturation des veines pulmonaires */
  VO2: 0.26,        /* consommation d'oxygene, en unites de (debit x points) */
  CO_MAX: 3.6,      /* debit ventriculaire maximal */
  Hb: 15,
  /* rapport RVP/RVS : eleve a la naissance, chute sur la premiere semaine */
  RVP_RVS_naissance: 0.85,
  RVP_RVS_plancher: 0.20,
  tau: 40           /* constante de temps de la chute des RVP, en heures */
};

function serie(l) { var r = 0; for (var i = 0; i < l.length; i++) r += l[i]; return r; }
function parallele(a, b) {
  if (a >= 1e9) return b;
  if (b >= 1e9) return a;
  return 1 / (1 / a + 1 / b);
}

/* rapport RVP/RVS a l'instant t, module par les gestes */
function rapportRVP(t, gestes) {
  var r = CFG.RVP_RVS_plancher +
          (CFG.RVP_RVS_naissance - CFG.RVP_RVS_plancher) * Math.exp(-t / CFG.tau);
  if (gestes) {
    /* Di Filippo : O2 et hyperventilation baissent les RVP ; hypoxie et
       hypoventilation les augmentent. */
    if (gestes.o2) r *= 0.70;
    if (gestes.no) r *= 0.55;
    if (gestes.co2) r *= 1.60;
  }
  return Math.max(0.06, r);
}

/* ------------------------------------------------------------------ */
function resoudre(anat, env) {
  env = env || {};
  var d = anat.describe();
  var cx = anat.connexite();
  var g = anat.graphe();
  function rA(nom) {
    for (var i = 0; i < g.aretes.length; i++)
      if (g.aretes[i].nom === nom) return g.aretes[i].r;
    return 1e9;
  }

  var RVS = 1.0;
  var RVP = RVS * (env.rvpRatio !== undefined ? env.rvpRatio : rapportRVP(0, d.gestes));

  /* ---------------- voies d'ejection ---------------- */
  var rFBV = rA('foramen bulbo-ventriculaire');
  var rVoieSys = rA('voie systémique');
  var rVoiePulm = serie([rA('voie pulmonaire'), rA('tronc → branches')]);

  /* Obstacle sous-aortique : si l'aorte nait de la chambre non dominante,
     le sang doit franchir le foramen. Di Filippo : « un tel obstacle
     favorise la deviation du flux vers la voie pulmonaire ». Le raisonnement
     porte sur la CHAMBRE QUI PORTE L'AORTE, quelle que soit sa place : en
     transposition, c'est le ventricule droit.                             */
  var aorteADroite = (d.vsD.vaisseau === 'aorte');
  var chambreAorte = aorteADroite ? d.vd : d.vg;
  var chambrePulm  = aorteADroite ? d.vg : d.vd;

  var obstacleSousAortique = false;
  if (chambreAorte.type === 'cb' && chambrePulm.av && rFBV > 0.5) {
    rVoieSys += rFBV; obstacleSousAortique = true;
  }
  /* symetrique : obstacle sous-pulmonaire */
  var obstacleSousPulm = false;
  if (chambrePulm.type === 'cb' && chambreAorte.av && rFBV > 0.5) {
    rVoiePulm += rFBV; obstacleSousPulm = true;
  }

  var rPont = parallele(rA('canal artériel'), rA('shunt BTT'));

  /* ---------------- topologie ----------------
     Deux notions DISTINCTES, et c'est essentiel :

     - PRESSION COMMUNE : le foramen est non restrictif, les deux ventricules
       sont a la meme pression. Cela fixe la repartition des DEBITS
       (Qp/Qs = Rsys/Rpulm). Une communication interventriculaire large suffit.

     - MELANGE COMPLET : tout le retour veineux converge dans une seule
       chambre fonctionnelle. Cela fixe les SATURATIONS. Une CIV large ne
       suffit PAS : dans une CIV le sang cave va a droite, le sang pulmonaire
       a gauche, et le shunt gauche-droite ne desature pas l'aorte.
       Le melange n'est obligatoire que s'il n'y a qu'une valve AV, ou si
       l'un des deux ventricules est une chambre rudimentaire.            */
  var uneSeuleValveAV = !(d.vd.av && d.o.av !== 'droit') ||
                        !(d.vg.av && d.o.av !== 'gauche');
  var univentriculaire = (d.vd.type === 'cb') || (d.vg.type === 'cb');
  var pressionCommune = (rFBV < 0.3) || uneSeuleValveAV;
  var melangeComplet = uneSeuleValveAV || univentriculaire;
  var ventCommun = pressionCommune;
  var atrCommun = (rA('CIA') < 0.3);

  /* ---------------- debits ---------------- */
  var Rsys = serie([rVoieSys, RVS]);
  var Rpulm = serie([rVoiePulm, RVP]);
  var Qs, Qp, qpqs;
  /* Dans l'atresie tricuspide, tout le retour cave doit traverser la CIA
     avant d'atteindre l'unique valve AV permeable. Une CIA restrictive
     limite donc le remplissage ; un septum intact l'annule. Cette contrainte
     de PRECHARGE est distincte du partage Qp/Qs calcule plus bas. */
  var congestionSystemique = congestionSys(d, rA);
  /* Décomposition du pont aorto-pulmonaire pour le rendu. Elle ne change
     pas la résolution : elle répartit seulement le débit déjà calculé entre
     canal et BTT, afin que chaque trajet puisse être animé honnêtement. */
  var fluxPontNet = 0;
  function conductance(r) { return r >= 1e9 ? 0 : 1 / r; }

  if (ventCommun) {
    /* Une seule chambre ejecte dans les deux troncs. Chaque lit peut etre
       atteint par SA voie propre OU par l'autre voie via le canal :
         systemique  = valve aortique  |  valve pulmonaire + canal
         pulmonaire  = valve pulmonaire|  valve aortique + canal
       C'est ce second chemin qui fait vivre l'hypoplasie du coeur gauche. */
    var gsDirect = conductance(serie([rVoieSys, RVS]));
    var gsPont = conductance(serie([rVoiePulm, rPont, RVS]));
    var gpDirect = conductance(serie([rVoiePulm, RVP]));
    var gpPont = conductance(serie([rVoieSys, rPont, RVP]));
    var gs = gsDirect + gsPont;
    var gp = gpDirect + gpPont;
    var tot = gs + gp;
    var debit = Math.min(CFG.CO_MAX, tot * 1.05);
    Qs = tot > 0 ? debit * gs / tot : 0;
    Qp = tot > 0 ? debit * gp / tot : 0;
    /* positif = aorte vers branches pulmonaires ; négatif = sens inverse */
    fluxPontNet = tot > 0 ? debit * (gpPont - gsPont) / tot : 0;
  } else {
    /* Deux pompes en serie. Par conservation, Qp = Qs, SAUF shunt.
       C'est la correction majeure : sans communication, les resistances
       determinent les PRESSIONS, pas la repartition des debits.          */
    var Qbase = CFG.CO_MAX * 0.52;
    Qs = Qbase; Qp = Qbase;
    /* shunts gauche -> droite, additifs sur le debit pulmonaire */
    /* Le shunt gauche-droite n'existe que si les RVP sont INFERIEURES aux
       RVS : a la naissance elles sont voisines, le shunt est donc minime.
       C'est ce qui donne un Qp/Qs de 1 a un coeur normal a H0.           */
    var moteur = Math.max(0, (RVS - RVP) / RVS);
    var fCIA = rA('CIA') < 1e9 ? 0.75 / (1 + rA('CIA') * 2.2) * moteur : 0;
    var fFBV = rFBV < 1e9 ? 1.80 / (1 + rFBV * 1.6) * moteur : 0;
    var fPont = rPont < 1e9 ? 1.60 / (1 + rPont * 1.5) * moteur : 0;
    var f = fCIA + fFBV + fPont;
    Qp = Qs * (1 + f);
    var somme = Qs + Qp;
    if (somme > CFG.CO_MAX * 1.6) { var k = CFG.CO_MAX * 1.6 / somme; Qs *= k; Qp *= k; }
    fluxPontNet = f > 1e-9 ? Math.max(0, Qp - Qs) * fPont / f : 0;
  }

  /* La resistance interauriculaire agit ici comme limite de remplissage.
     Le seuil et la pente sont partages avec l'obstruction du retour
     pulmonaire : CIA large = aucune penalite, restrictive = bas debit,
     septum intact = aucun regime stationnaire possible. */
  var facteurRemplissage = 1 - congestionSystemique;
  Qs *= facteurRemplissage;
  Qp *= facteurRemplissage;
  fluxPontNet *= facteurRemplissage;

  qpqs = Qs > 1e-6 ? Qp / Qs : (Qp > 1e-6 ? 99 : 0);
  qpqs = Math.min(qpqs, 15);

  /* ---------------- saturations par bilan de masse ---------------- */
  var SpvO2 = CFG.SpvO2;
  /* congestion veineuse pulmonaire : le sang qui stagne s'oxygene moins */
  var congestion = congestionPulm(d, rA, cx);
  SpvO2 -= 22 * congestion;

  var SaO2, SapO2, SvO2;
  var Ea = Qs > 1e-6 ? (CFG.VO2 / Qs) * 100 : 100;   /* difference arterioveineuse */

  /* la discordance ventriculo-arterielle inverse les destinations */
  var disc = !!d.discordance;

  if (!cx.systemique || Qs <= 1e-6) {
    SaO2 = 20; SapO2 = 20; SvO2 = 10;
  } else if (melangeComplet) {
    /* melange complet : aorte et AP recoivent le meme sang.
       SaO2 = SpvO2 - Ea/(Qp/Qs)  — la relation de Barnea EMERGE ici.    */
    SaO2 = qpqs > 1e-3 ? SpvO2 - Ea / qpqs : 20;
    SapO2 = SaO2;
  } else {
    /* Circuits separes. La saturation systemique ne depend PAS du Qp/Qs mais
       du DEBIT DE MELANGE EFFECTIF Qeff, c'est-a-dire du volume de sang qui
       passe reellement d'un circuit a l'autre.

         SaO2 = SpvO2 - Ea x Qs / Qeff

       Si Qeff = Qs, on retrouve le melange complet. Si Qeff s'effondre, la
       saturation s'effondre : c'est exactement la transposition a septum
       intact, ou seul un shunt efficace permet de survivre.               */
    var rCIA = rA('CIA');
    function eff(r, poids) { return r >= 1e9 ? 0 : poids / (1 + r * 3); }
    var Qeff = Qs * (eff(rCIA, 0.95) + eff(rFBV, 0.95) +
                     eff(rPont, disc ? 0.14 : 0.03));
    Qeff = Math.min(Qeff, Qs * 1.4);

    if (disc) {
      /* DISCORDANCE : l'aorte recoit le sang cave. Sans melange efficace,
         c'est incompatible avec la vie. */
      SaO2 = Qeff > 1e-6 ? SpvO2 - Ea * Qs / Qeff : 12;
      SapO2 = Qeff > 1e-6 ? SpvO2 - (SpvO2 - SaO2) * 0.25 : SpvO2;
    } else {
      /* CONCORDANCE : le shunt physiologique va de gauche a droite. Il
         n'abaisse PAS la saturation aortique — il recircule du sang deja
         oxygene dans le poumon. La saturation ne chute que si le shunt
         s'inverse (resistances pulmonaires ou obstacle droit).            */
      var RpulmTot = serie([rVoiePulm, RVP]);
      var RsysTot = serie([rVoieSys, RVS]);
      var invers = Math.max(0, (RpulmTot - RsysTot) / Math.max(RpulmTot, 1e-6));
      SaO2 = (invers > 0.02 && Qeff > 1e-6)
             ? SpvO2 - Ea * Qs / Qeff * invers
             : SpvO2;
      /* saut oxymetrique dans l'artere pulmonaire : signature du shunt G-D */
      var shuntGD = Math.max(0, Qp - Qs);
      SapO2 = (Qs * (SpvO2 - Ea) + shuntGD * SpvO2) / Math.max(Qs + shuntGD, 1e-6);
    }
  }
  SaO2 = Math.max(12, Math.min(100, SaO2));
  SvO2 = Math.max(3, SaO2 - Ea);
  SapO2 = Math.max(12, Math.min(100, SapO2));

  var DO2 = Qs * CFG.Hb * 1.34 * (SaO2 / 100);

  /* Le canal et le BTT sont en parallèle : leur part relative suit leur
     conductance. Conserver le signe permet aussi d'animer un remplissage
     rétrograde sans inventer un second sens dans le renderer. */
  var gCanal = conductance(rA('canal artériel'));
  var gShunt = conductance(rA('shunt BTT'));
  var gPont = gCanal + gShunt;
  var fluxCanal = gPont > 0 ? fluxPontNet * gCanal / gPont : 0;
  var fluxShunt = gPont > 0 ? fluxPontNet * gShunt / gPont : 0;

  return {
    qpqs: qpqs, Qp: Qp, Qs: Qs, debitTotal: Qs + Qp,
    SaO2: SaO2, SvO2: SvO2, SapO2: SapO2, SpvO2: SpvO2, DAV: Ea,
    DO2: DO2, Rsys: Rsys, Rpulm: Rpulm, RVP: RVP,
    pressionCommune: pressionCommune, melangeComplet: melangeComplet,
    univentriculaire: univentriculaire, atrCommun: atrCommun,
    melange: melangeComplet, connexite: cx,
    /* L'aorte se remplit-elle à rebours ? Le test n'est pas la connexité
       — une aorte filiforme reste perméable — mais la COMPARAISON des deux
       routes : si franchir la voie systémique coûte bien plus cher que de
       passer par le poumon puis le canal, la crosse se remplit à l'envers.
       C'est ce que le schéma doit montrer. */
    retrogradeAorte: (rPont < 1e9) && (rVoieSys > 2.5 * (rVoiePulm + rPont)),
    obstacleSousAortique: obstacleSousAortique,
    obstacleSousPulm: obstacleSousPulm,
    fluxVisuel: {
      canal: Math.abs(fluxCanal),
      shunt: Math.abs(fluxShunt),
      sensCanal: fluxCanal < 0 ? -1 : 1,
      sensShunt: fluxShunt < 0 ? -1 : 1
    },
    congestion: congestion,
    congestionSystemique: congestionSystemique,
    canal: d.canal
  };
}

/* Intensite normalisee d'un obstacle interauriculaire. Les resistances du
   catalogue sont qualitatives : en dessous de 0,15 la communication est
   fonctionnellement large ; le septum intact vaut 1. */
function obstructionInterauriculaire(rCIA) {
  if (rCIA >= 1e9) return 1;
  return Math.min(1, Math.max(0, (rCIA - 0.15) / 1.1));
}

/* Congestion veineuse systemique : si la valve AV droite est atresique,
   tout le retour cave doit sortir de l'OD par la CIA. */
function congestionSys(d, rA) {
  if (rA('valve AV droite') < 1e9) return 0;
  return obstructionInterauriculaire(rA('CIA'));
}

/* Congestion veineuse pulmonaire : le retour pulmonaire doit trouver une
   issue. Si la valve AV gauche est atresique, tout doit passer par la CIA.
   Di Filippo : « il est indispensable d'etablir un shunt non restrictif
   entre les deux oreillettes ».                                          */
function congestionPulm(d, rA, cx) {
  var rCIA = rA('CIA');
  var sortieOG = rA('valve AV gauche') < 1e9;
  if (sortieOG) {
    /* sortie propre : seule une CIA tres restrictive avec obligation de
       shunt (atresie mitrale) gene reellement */
    return 0;
  }
  return obstructionInterauriculaire(rCIA);
}

/* ------------------------------------------------------------------
   Classification. Les seuils viennent de Di Filippo 2010.
------------------------------------------------------------------ */
function classer(anat, etat) {
  var d = anat.describe();
  var cx = etat.connexite;

  var remplissable = (d.vd.av && d.o.av !== 'droit') || (d.vg.av && d.o.av !== 'gauche');
  if (!remplissable)
    return { statut: 'impossible', cause: 'aucun-remplissage',
             titre: 'Assemblage impossible',
             texte: 'Aucun ventricule ne peut se remplir : les deux jonctions auriculo-ventriculaires sont fermées.' };

  /* assemblages degeneres des voies d'ejection */
  if (d.deuxAortes)
    return { statut: 'impossible', cause: 'aucune-artere-pulmonaire',
             titre: 'Assemblage impossible',
             texte: 'Les deux ventricules éjectent dans une aorte : il n’existe aucune artère pulmonaire, donc aucun lit d’oxygénation. Pose une artère pulmonaire sur l’une des deux voies.' };
  if (d.deuxAP)
    return { statut: 'impossible', cause: 'aucune-aorte',
             titre: 'Assemblage impossible',
             texte: 'Les deux ventricules éjectent dans une artère pulmonaire : il n’existe aucune aorte, donc aucune issue systémique. Pose une aorte sur l’une des deux voies.' };

  /* Atrésie tricuspide : le retour cave doit obligatoirement passer de l'OD
     vers l'OG. Le canal arteriel et les shunts arteriels ne peuvent pas
     contourner une oreillette droite borgne. */
  if (!cx.retourCave || etat.congestionSystemique >= 0.999)
    return { statut: 'letal', cause: 'retour-cave-bloque',
             titre: 'Retour cave sans issue',
             texte: 'La valve tricuspide est atrétique et le septum interauriculaire est intact : le sang cave reste bloqué dans l’oreillette droite. Aucun remplissage efficace n’est possible. Il faut créer une communication interauriculaire en urgence.' };

  if (etat.congestionSystemique > 0.55)
    return { statut: 'critique', cause: 'restriction-retour-cave',
             titre: 'Restriction du retour cave',
             texte: 'Tout le retour cave doit franchir une communication interauriculaire restrictive : la pression auriculaire droite monte et le débit cardiaque chute. Il faut élargir la communication.' };

  if (!cx.systemique)
    return { statut: 'letal', cause: 'sans-issue-systemique',
             titre: 'Aucune issue systémique',
             texte: 'Le sang ne peut atteindre l’aorte. Aucun débit systémique n’est possible.' };

  if (!cx.pulmonaire)
    return { statut: 'letal', cause: 'sans-debit-pulmonaire',
             titre: 'Aucun débit pulmonaire',
             texte: 'Le sang ne peut atteindre le lit pulmonaire : aucune oxygénation n’est possible.' };

  /* cœur normal — test anatomique */
  if (d.o.cia === 'intacte' && d.o.av === null && d.fbv === 'ferme' &&
      d.vd.type === 'vd' && d.vg.type === 'vg' &&
      d.ap.calibre === 'normale' && d.ao.calibre === 'normale' && !d.discordance)
    return { statut: 'normal', cause: 'coeur-normal',
             titre: 'Cœur normal',
             texte: 'Circulation en série, Qp/Qs = 1, saturation systémique normale. Ce n’est pas un ventricule unique.' };

  /* transposition sans mélange : urgence absolue */
  if (d.discordance && etat.SaO2 < 55)
    return { statut: 'critique', cause: 'transposition-sans-melange',
             titre: 'Transposition sans mélange suffisant',
             texte: 'Les deux circulations tournent en parallèle sans communication efficace. Il faut ouvrir le septum interauriculaire en urgence.' };

  if (etat.congestion > 0.55)
    return { statut: 'critique', cause: 'restriction-auriculaire',
             titre: 'Restriction auriculaire',
             texte: 'Le retour veineux pulmonaire n’a pas d’issue : œdème pulmonaire et hypoxémie. Urgence d’atrioseptostomie.' };

  /* ducto-dépendance : on recalcule sans le canal */
  var sansCanal = Object.create(Object.getPrototypeOf(anat));
  for (var k in anat) if (anat.hasOwnProperty(k)) sansCanal[k] = anat[k];
  sansCanal.canal = 0;
  var e2 = resoudre(sansCanal, { rvpRatio: etat.RVP });
  if (e2.Qs < 0.22 && etat.Qs >= 0.22)
    return { statut: 'ducto-dependant', cause: 'ducto-systemique',
             titre: 'Ducto-dépendance systémique',
             texte: 'Le débit systémique passe par le canal artériel. Sa fermeture provoque un choc cardiogénique en quelques heures.' };
  if (e2.SaO2 < 55 && etat.SaO2 >= 60)
    return { statut: 'ducto-dependant', cause: 'ducto-pulmonaire',
             titre: 'Ducto-dépendance pulmonaire',
             texte: 'Le débit pulmonaire passe par le canal artériel. Sa fermeture provoque une hypoxémie majeure.' };

  if (etat.obstacleSousAortique)
    return { statut: 'instable', cause: 'obstacle-sous-aortique',
             titre: 'Obstacle sous-aortique',
             texte: 'L’aorte naît de la chambre non dominante et le foramen est restrictif. L’obstacle dévie le flux vers le poumon et majore le Qp. Un cerclage l’aggravera.' };

  /* seuils Di Filippo */
  if (etat.qpqs > 2.0)
    return { statut: 'instable', cause: 'hyperdebit',
             titre: 'Hyperdébit pulmonaire',
             texte: 'Qp/Qs supérieur à 2 : surcharge volumétrique du ventricule. La saturation est belle (SpO₂ > 90 %) mais le débit systémique s’effondre. Le geste est un cerclage de l’artère pulmonaire.' };

  if (etat.SaO2 < 75)
    return { statut: 'instable', cause: 'hypodebit',
             titre: 'Hypodébit pulmonaire',
             texte: 'SpO₂ inférieure à 75 % : cyanose réfractaire à l’oxygène. Il faut augmenter le débit pulmonaire (canal, shunt).' };

  return { statut: 'equilibre', cause: 'equilibre',
           titre: 'Circulation équilibrée',
           texte: 'Qp/Qs entre 1 et 2 et SpO₂ entre 75 et 85 % : c’est la cible de Di Filippo.' };
}
