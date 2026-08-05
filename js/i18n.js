/* i18n.js — textes d'interface partagés par les versions française et anglaise.
   Le français reste la langue par défaut. La page /en/ fixe APP_LANG à "en"
   avant de charger ce fichier. Aucun état n'est conservé dans le navigateur. */

var APP_LANG = (typeof window !== 'undefined' && window.APP_LANG) || 'fr';

var TEXTES_EN = {
  'slot.cia': 'Atrial septum',
  'slot.ventriculeDroit': 'Right ventricle (left side of image)',
  'slot.ventriculeGauche': 'Left ventricle (right side of image)',
  'slot.voieDroite': 'Right ventricular outflow',
  'slot.voieGauche': 'Left ventricular outflow',
  'slot.fbv': 'Interventricular communication',

  'catalogue.cia.large': 'Large ASD',
  'catalogue.cia.restrictive': 'Restrictive ASD',
  'catalogue.cia.intacte': 'Intact atrial septum',
  'catalogue.ventriculeDroit.V3': 'Right ventricle',
  'catalogue.ventriculeDroit.V2': 'Outlet chamber',
  'catalogue.ventriculeDroit.V1': 'Rudimentary ventricle',
  'catalogue.ventriculeGauche.V4': 'Left ventricle',
  'catalogue.ventriculeGauche.V2': 'Outlet chamber',
  'catalogue.ventriculeGauche.V1': 'Rudimentary ventricle',
  'catalogue.voies.P1': 'Normal-calibre pulmonary artery',
  'catalogue.voies.P2': 'Small pulmonary artery',
  'catalogue.voies.P3': 'Pulmonary atresia',
  'catalogue.voies.A1': 'Normal-calibre aorta',
  'catalogue.voies.A2': 'Hypoplastic aorta + coarctation',
  'catalogue.voies.A3': 'Thread-like aorta, imperforate valve',
  'catalogue.fbv.large': 'Large bulboventricular foramen',
  'catalogue.fbv.restrictif': 'Restrictive bulboventricular foramen',
  'catalogue.fbv.ferme': 'Intact ventricular septum',

  'note.av.tricuspide': 'No right-sided inlet valve: tricuspid atresia.',
  'note.av.mitrale': 'No left-sided inlet valve: mitral atresia.',
  'note.av.deuxValves': 'Both atrioventricular valves are patent.',
  'note.voies.deuxAortes': 'Two aortas: no pulmonary artery and therefore no oxygenation bed.',
  'note.voies.deuxAP': 'Two pulmonary arteries: no aorta and therefore no systemic outlet.',
  'note.voies.discordance': 'The aorta arises from the right ventricle: ventriculoarterial discordance (transposition).',
  'note.voies.concordance': 'Venticuloarterial concordance.',

  'gesture.pge.name': 'Prostaglandin E1',
  'gesture.pge.title': 'maintains ductal patency',
  'gesture.o2.name': 'Oxygen',
  'gesture.o2.title': 'lowers pulmonary vascular resistance',
  'gesture.no.name': 'Inhaled NO',
  'gesture.no.title': 'markedly lowers pulmonary vascular resistance',
  'gesture.co2.name': 'CO₂ / hypercapnia',
  'gesture.co2.title': 'raises pulmonary vascular resistance',
  'gesture.btt.name': 'Blalock–Taussig–Thomas shunt',
  'gesture.btt.title': 'provides a source of pulmonary blood flow',
  'gesture.cerclage.name': 'Pulmonary artery banding',
  'gesture.cerclage.title': 'restricts pulmonary blood flow',
  'gesture.rashkind.name': 'Rashkind atrial septostomy',
  'gesture.rashkind.title': 'opens the atrial septum',
  'gesture.short.cerclage': 'banding',

  'canal.wide': 'widely patent',
  'canal.closing': 'closing',
  'canal.restrictive': 'restrictive',
  'canal.nearlyClosed': 'nearly closed',
  'canal.closed': 'closed — ligamentum arteriosum',
  'time.pause': 'paused',
  'transport.resume': 'Resume',
  'transport.pause': 'Pause',
  'transport.start': 'Start',
  'transport.restart': 'Restart',
  'graph.expand': 'Expand',
  'graph.collapse': 'Collapse',
  'graph.birth': 'birth',
  'graph.dayPrefix': 'D',
  'graph.resistanceLabel': 'PVR/SVR',
  'vessel.pulmonaryAbbr': 'PA',

  'classification.aucun-remplissage.title': 'Impossible assembly',
  'classification.aucun-remplissage.text': 'Neither ventricle can fill: both atrioventricular junctions are closed.',
  'classification.aucune-artere-pulmonaire.title': 'Impossible assembly',
  'classification.aucune-artere-pulmonaire.text': 'Both ventricles eject into an aorta: there is no pulmonary artery and therefore no oxygenation bed. Place a pulmonary artery on one of the two outflow tracts.',
  'classification.aucune-aorte.title': 'Impossible assembly',
  'classification.aucune-aorte.text': 'Both ventricles eject into a pulmonary artery: there is no aorta and therefore no systemic outlet. Place an aorta on one of the two outflow tracts.',
  'classification.sans-issue-systemique.title': 'No systemic outlet',
  'classification.sans-issue-systemique.text': 'Blood cannot reach the aorta. No systemic blood flow is possible.',
  'classification.sans-debit-pulmonaire.title': 'No pulmonary blood flow',
  'classification.sans-debit-pulmonaire.text': 'Blood cannot reach the pulmonary vascular bed: oxygenation is impossible.',
  'classification.coeur-normal.title': 'Normal heart',
  'classification.coeur-normal.text': 'Circulation in series, Qp/Qs = 1, normal systemic saturation. This is not a functionally univentricular heart.',
  'classification.transposition-sans-melange.title': 'Transposition without adequate mixing',
  'classification.transposition-sans-melange.text': 'The two circulations run in parallel without effective communication. The atrial septum must be opened urgently.',
  'classification.restriction-auriculaire.title': 'Atrial restriction',
  'classification.restriction-auriculaire.text': 'Pulmonary venous return has no outlet: pulmonary oedema and hypoxaemia. Urgent atrial septostomy is required.',
  'classification.retour-cave-bloque.title': 'Blocked systemic venous return',
  'classification.retour-cave-bloque.text': 'The tricuspid valve is atretic and the atrial septum is intact: caval blood is trapped in the right atrium. Effective ventricular filling is impossible. An atrial communication must be created urgently.',
  'classification.restriction-retour-cave.title': 'Restricted systemic venous return',
  'classification.restriction-retour-cave.text': 'All caval return must cross a restrictive atrial communication: right atrial pressure rises and cardiac output falls. The communication must be enlarged.',
  'classification.ducto-systemique.title': 'Duct-dependent systemic circulation',
  'classification.ducto-systemique.text': 'Systemic blood flow crosses the ductus arteriosus. Ductal closure causes cardiogenic shock within hours.',
  'classification.ducto-pulmonaire.title': 'Duct-dependent pulmonary circulation',
  'classification.ducto-pulmonaire.text': 'Pulmonary blood flow crosses the ductus arteriosus. Ductal closure causes severe hypoxaemia.',
  'classification.obstacle-sous-aortique.title': 'Subaortic obstruction',
  'classification.obstacle-sous-aortique.text': 'The aorta arises from the non-dominant chamber and the foramen is restrictive. The obstruction diverts flow towards the lungs and increases Qp. Pulmonary artery banding will worsen it.',
  'classification.hyperdebit.title': 'Pulmonary overcirculation',
  'classification.hyperdebit.text': 'Qp/Qs above 2 causes ventricular volume overload. Saturation looks reassuring (SpO₂ > 90%), but systemic blood flow collapses. Pulmonary artery banding is required.',
  'classification.hypodebit.title': 'Low pulmonary blood flow',
  'classification.hypodebit.text': 'SpO₂ below 75% indicates oxygen-resistant cyanosis. Pulmonary blood flow must be increased (ductus or shunt).',
  'classification.equilibre.title': 'Balanced circulation',
  'classification.equilibre.text': 'Qp/Qs between 1 and 2 and SpO₂ between 75 and 85%: the target described by Di Filippo.',

  'death.oedeme-pulmonaire.title': 'Pulmonary oedema due to atrial restriction',
  'death.oedeme-pulmonaire.text': 'Pulmonary venous return had no outlet. Urgent atrial septostomy was the only effective intervention.',
  'death.restriction-retour-cave.title': 'Collapse due to obstructed systemic venous return',
  'death.restriction-retour-cave.text': 'Caval blood could not leave the right atrium effectively. The atrial septum had to be opened widely.',
  'death.hypoxemie.title': 'Refractory hypoxaemia',
  'death.hypoxemie.text': 'Pulmonary blood flow collapsed as the ductus closed. Ductal patency had to be maintained, or another source of pulmonary blood flow created.',
  'death.collapsus.title': 'Systemic collapse due to diastolic steal',
  'death.collapsus.text': 'Saturation looked reassuring, but blood was being diverted to the lungs. Pulmonary blood flow had to be restricted, not increased.',
  'death.obstacle-sous-aortique.title': 'Subaortic obstruction',
  'death.obstacle-sous-aortique.text': 'All systemic blood flow crossed the restrictive bulboventricular foramen.',
  'death.defaillance.title': 'Circulatory failure',
  'death.defaillance.text': 'Systemic oxygen delivery remained inadequate for too long.'
};

function tr(cle, repli) {
  if (APP_LANG === 'en' && Object.prototype.hasOwnProperty.call(TEXTES_EN, cle))
    return TEXTES_EN[cle];
  return repli === undefined ? cle : repli;
}

function traduireVerdict(verdict) {
  if (APP_LANG !== 'en' || !verdict) return verdict;
  return {
    statut: verdict.statut,
    cause: verdict.cause,
    titre: tr('classification.' + verdict.cause + '.title', verdict.titre),
    texte: tr('classification.' + verdict.cause + '.text', verdict.texte)
  };
}

function traduireDeces(deces) {
  if (APP_LANG !== 'en' || !deces) return deces;
  var prefixe = Object.prototype.hasOwnProperty.call(
    TEXTES_EN, 'death.' + deces.cause + '.title') ? 'death.' : 'classification.';
  return {
    cause: deces.cause,
    titre: tr(prefixe + deces.cause + '.title', deces.titre),
    texte: tr(prefixe + deces.cause + '.text', deces.texte),
    t: deces.t
  };
}
