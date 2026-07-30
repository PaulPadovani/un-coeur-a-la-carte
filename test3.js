var fs=require('fs'),src='';
['js/anatomie.js','js/model.js','js/vitals.js'].forEach(f=>src+=fs.readFileSync(f,'utf8')+'\n');
(0,eval)(src);
function pad(s,n){s=''+s;while(s.length<n)s+=' ';return s;}
function at(nom,conf,gestes,t){
  var a=new Anatomie(); for(var k in conf) if(k!=='gestes') a[k]=conf[k];
  if(gestes) for(var g in gestes) a.gestes[g]=1;
  a.canal = (gestes&&gestes.pge)?1:(t>=72?0:1-Math.max(0,(t-12)/60));
  var e=resoudre(a,{rvpRatio:rapportRVP(t,a.gestes)}), c=classer(a,e);
  console.log(pad(nom,40),'H'+pad(t,4),
    'RVP/RVS '+e.RVP.toFixed(2),' Qp/Qs '+pad(e.qpqs.toFixed(2),6),
    'SaO2 '+pad(e.SaO2.toFixed(0)+'%',5),'SvO2 '+pad(e.SvO2.toFixed(0)+'%',5),
    'DO2 '+pad(e.DO2.toFixed(0),4),'| '+c.titre);
}
console.log('=== evolution dans le temps ===');
[0,24,72,168].forEach(t=>at('Coeur normal',{oreillettes:'O3',ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'ferme'},null,t));
console.log('');
[0,24,72,168].forEach(t=>at('AT + FBV large + AP normale',{oreillettes:'O2-atrG',ventriculeDroit:'V2'},null,t));
console.log('');
[0,72,168].forEach(t=>at('  ... + cerclage',{oreillettes:'O2-atrG',ventriculeDroit:'V2'},{cerclage:1},t));
console.log('');
[0,24,72].forEach(t=>at('AT + atresie pulmonaire',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'},null,t));
console.log('');
[0,24,72].forEach(t=>at('HypoVG',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'},{pge:1},t));
console.log('');
[0,72].forEach(t=>at('CIV isolee (septum ouvert)',{oreillettes:'O3',ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'large'},null,t));
[0,72].forEach(t=>at('CIA isolee',{oreillettes:'O2',ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'ferme'},null,t));
[0,24].forEach(t=>at('TGA septum intact',{oreillettes:'O3',ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'ferme',discordance:true},null,t));
[0,24].forEach(t=>at('TGA + CIA large',{oreillettes:'O2',ventriculeDroit:'V3',ventriculeGauche:'V4',fbv:'ferme',discordance:true},null,t));
