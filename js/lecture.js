/* lecture.js — lecture pédagogique : repères et hiérarchie du moniteur.
   Aucun calcul hémodynamique. Les repères numériques viennent de REPERES et CFG.
   Le contexte de mélange complet ne doit pas être appliqué à une TGV séparée. */
function texteLecture(fr, en) { return APP_LANG === 'en' ? en : fr; }
function nombreLecture(n, decimales) {
  return n.toFixed(decimales).replace('.', APP_LANG === 'en' ? '.' : ',');
}
function contexteLecture(d, e) {
  if (e.melangeComplet) return 'melange';
  return d.discordance ? 'discordance' : 'serie';
}

function construireLecture() {
  var t = texteLecture;
  document.getElementById('lecture-moniteur').innerHTML =
    '<div class="saturation" id="saturation">' +
      '<div class="mesure-entete"><span>SaO₂</span><span>' + t('Saturation artérielle', 'Arterial saturation') + '</span></div>' +
      '<div class="saturation-valeur"><strong id="v-sao2">—</strong><span>%</span></div>' +
      '<div class="echelle-sat" aria-hidden="true"><span id="zone-sat"></span><i id="curseur-sat"></i></div>' +
      '<div class="echelle-bornes" aria-hidden="true"><span>0</span><span>50</span><span>100 %</span></div>' +
      '<p class="repere" id="repere-sat"></p>' +
    '</div>' +
    '<div class="mesure-debits">' +
      '<div class="mesure-entete"><span>Qp/Qs</span><strong id="v-qpqs">—</strong></div>' +
      '<div class="balance-debits" aria-hidden="true"><span id="part-qp"></span><span id="part-qs"></span><i></i></div>' +
      '<div class="debits-legende"><span>Qp <b id="v-qp">—</b></span><span>Qs <b id="v-qs">—</b></span></div>' +
      '<p class="repere" id="repere-debits"></p>' +
    '</div>' +
    '<div class="mesures-secondaires">' +
      '<div><span class="lbl">SvO₂</span><strong id="v-svo2">—</strong><small>' + t('Retour veineux', 'Venous return') + '</small></div>' +
      '<div><span class="lbl">DO₂ ' + t('syst.', 'sys.') + '</span><strong id="v-do2">—</strong><small>' + t('Unités du modèle', 'Model units') + '</small></div>' +
    '</div>';

  document.getElementById('reperes-emplacement').innerHTML =
    '<details class="reperes-details"><summary>' + t('Comprendre les repères', 'Understanding the references') + '</summary>' +
      '<p>' + t('Repères pédagogiques, à interpréter selon l’anatomie. Une SaO₂ élevée ne garantit pas un débit systémique suffisant.', 'Educational references depend on anatomy. A high SaO₂ does not guarantee adequate systemic blood flow.') + '</p>' +
      '<dl><dt>' + t('Mélange complet', 'Complete mixing') + '</dt><dd>SaO₂ ' + REPERES.sao2VU.join('–') + ' % · Qp/Qs ' + nombreLecture(REPERES.qpqsVU[0], 0) + '–' + nombreLecture(REPERES.qpqsVU[1], 1) + '.</dd>' +
      '<dt>' + t('Circulation en série', 'Series circulation') + '</dt><dd>' + t('Référence sans shunt : Qp/Qs = 1. SaO₂ de référence du modèle : ', 'Reference without a shunt: Qp/Qs = 1. Model reference SaO₂: ') + CFG.SpvO2 + ' %.</dd>' +
      '<dt>' + t('Seuils internes du jeu', 'Internal game thresholds') + '</dt><dd>Qp/Qs &gt; ' + REPERES.qpqsAlerte + ' : ' + t('hyperdébit. Consommation de réserve si DO₂ &lt; ', 'overcirculation. Reserve depletion if DO₂ &lt; ') + REPERES.do2Reserve + t(' unités ou SaO₂ &lt; ', ' units or SaO₂ &lt; ') + REPERES.sao2Reserve + ' %.</dd></dl>' +
      '<p>' + t('Qp, Qs et DO₂ : unités relatives du modèle, sans valeur prédictive individuelle. SvO₂ : à suivre en tendance, sans zone cible universelle affichée.', 'Qp, Qs and DO₂: relative model units, without individual predictive validity. SvO₂: follow the trend; no universal target band is displayed.') + '</p>' +
      '<p class="sources-reperes">' + t('Ancrages : ', 'Sources: ') + '<a href="https://doi.org/10.1016/S1166-4568(10)39429-0" target="_blank" rel="noopener">Di Filippo, 2010</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/9760295/" target="_blank" rel="noopener">Barnea et al., 1998</a>.</p>' +
    '</details>';

  document.getElementById('btn-mouvement').addEventListener('click', function () {
    var fige = document.body.classList.toggle('flux-figes');
    this.setAttribute('aria-pressed', String(fige));
    this.textContent = fige ? t('Animer les flux', 'Animate flow') : t('Figer les flux', 'Freeze flow');
  });
}

/* Réécrit seulement les valeurs modifiées, y compris pendant la simulation. */
function texteMesure(id, texte) {
  var el = document.getElementById(id);
  if (el && el.textContent !== texte) el.textContent = texte;
}
function majLecture(e) {
  var t = texteLecture, contexte = contexteLecture(anat.describe(), e);
  var mort = !!sim.mort;
  var inutilisable = mort || !e.connexite.systemique || !e.connexite.pulmonaire || e.Qs < 0.000001;
  var estMelange = contexte === 'melange';
  var repere = estMelange ? t('Mélange complet · repère ', 'Complete mixing · reference ') + REPERES.sao2VU.join('–') + ' %'
    : contexte === 'serie' ? t('Référence du modèle en série : ', 'Series model reference: ') + CFG.SpvO2 + ' %'
    : t('TGV · interpréter selon le mélange', 'TGA · interpret according to mixing');
  texteMesure('repere-sat', inutilisable ? t('Pas de circulation efficace', 'No effective circulation') : repere);
  var zone = document.getElementById('zone-sat');
  zone.style.left = (estMelange ? REPERES.sao2VU[0] : CFG.SpvO2 - 0.5) + '%';
  zone.style.width = (estMelange ? REPERES.sao2VU[1] - REPERES.sao2VU[0] : 1) + '%';
  zone.hidden = contexte === 'discordance' || inutilisable;
  var curseur = document.getElementById('curseur-sat');
  curseur.style.left = Math.max(0, Math.min(100, e.SaO2)) + '%';
  curseur.hidden = inutilisable;
  document.getElementById('saturation').classList.toggle('sans-circulation', inutilisable);

  var total = e.Qp + e.Qs, part = total > 0.000001 ? e.Qp / total * 100 : 0;
  document.getElementById('part-qp').style.width = (mort ? 0 : part) + '%';
  document.getElementById('part-qs').style.width = (mort || total <= 0.000001 ? 0 : 100 - part) + '%';
  texteMesure('v-qp', mort ? '—' : nombreLecture(e.Qp, 2));
  texteMesure('v-qs', mort ? '—' : nombreLecture(e.Qs, 2));
  texteMesure('v-qpqs', mort || total <= 0.000001 ? '—' : e.Qs <= 0.000001 ? '∞' : nombreLecture(e.qpqs, 2));
  texteMesure('repere-debits', mort ? t('Circulation arrêtée', 'Circulation stopped') :
    contexte === 'discordance' ? t('Le rapport seul ne mesure pas le mélange.', 'The ratio alone does not measure mixing.') :
    (estMelange ? t('Repère 1–1,5', 'Reference 1–1.5') : t('Sans shunt : 1', 'Without shunt: 1')) + ' · ' + t('hyperdébit > ', 'overcirculation > ') + REPERES.qpqsAlerte);

  texteMesure('v-fc', mort ? '0' : String(ecgParams(sim).fc));
  texteMesure('v-reserve', Math.round(sim.reserve * 100) + ' %');
}
