/* smoke test sans dependance : node test.js */
var fs = require('fs');
var src='';
['js/anatomie.js','js/model.js','js/vitals.js'].forEach(function(f){
  src += fs.readFileSync(f,'utf8') + '\n';
});
(0,eval)(src);
function scenario(nom, conf){
  var a = new Anatomie();
  for (var k in conf) if (k!=='gestes') a[k]=conf[k];
  if (conf.gestes) for (var g in conf.gestes) a.gestes[g]=conf.gestes[g];
  var e = resoudre(a,{}), c = classer(a,e);
  console.log(pad(nom,42), pad(c.statut,18),
    'SaO2 '+e.SaO2.toFixed(0)+'%', ' Qp/Qs '+e.qpqs.toFixed(2),
    ' DO2 '+e.DO2.toFixed(0), ' | '+c.titre);
  return {a:a,e:e,c:c};
}
function pad(s,n){s=''+s;while(s.length<n)s+=' ';return s;}
console.log('=== canal OUVERT ===');
scenario('Coeur normal',{ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'ferme',oreillettes:'O3'});
scenario('VU equilibre (CIA large, FBV large)',{});
scenario('Atresie tricuspide + AP normale',{oreillettes:'O2-atrG',ventriculeDroit:'V2'});
scenario('Atresie tricuspide + CIA restrictive',{oreillettes:'O1-atrG',ventriculeDroit:'V2'});
scenario('Atresie tricuspide + septum intact',{oreillettes:'O3-atrG',ventriculeDroit:'V2'});
scenario('Atresie tricuspide + atresie pulmonaire',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'});
scenario('HypoVG (atresie mitrale, aorte filiforme)',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'});
scenario('HypoVG + septum intact',{oreillettes:'O3-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'});
scenario('FBV restrictif + aorte de la chambre bulbaire',{oreillettes:'O2',ventriculeDroit:'V3',ventriculeGauche:'V2',fbv:'restrictif'});
scenario('AP large sans obstacle (hyperdebit)',{ap:'P1',aorte:'A2'});

console.log('\n=== canal FERME (H72 sans PGE1) ===');
[['Atresie pulmonaire',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'}],
 ['Atresie pulmonaire + BTT',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3',gestes:{btt:true}}],
 ['HypoVG aorte filiforme',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'}],
 ['VU equilibre',{}]].forEach(function(x){
  var a=new Anatomie(); for(var k in x[1]) if(k!=='gestes') a[k]=x[1][k];
  if(x[1].gestes) for(var g in x[1].gestes) a.gestes[g]=x[1].gestes[g];
  a.canal=0;
  var e=resoudre(a,{}), c=classer(a,e);
  console.log(pad(x[0],42),pad(c.statut,18),'SaO2 '+e.SaO2.toFixed(0)+'%',
    ' Qp/Qs '+e.qpqs.toFixed(2),' DO2 '+e.DO2.toFixed(0),' | '+c.titre);
});
