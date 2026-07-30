var fs=require('fs'), src='';
['js/anatomie.js','js/model.js','js/vitals.js'].forEach(function(f){src+=fs.readFileSync(f,'utf8')+'\n';});
(0,eval)(src);
function pad(s,n){s=''+s;while(s.length<n)s+=' ';return s;}
function course(nom, conf, gestes){
  var a=new Anatomie();
  for(var k in conf) a[k]=conf[k];
  if(gestes) for(var g in gestes) a.gestes[g]=gestes[g];
  var s=new Simulation(a); s.enCours=true;
  var trace=[];
  for(var t=0;t<168 && !s.mort;t+=0.5){
    s.pas(0.5);
    if(Math.abs(t%24)<0.3) trace.push('H'+Math.round(t)+' Sa'+Math.round(s.etat.SaO2)+' r'+s.reserve.toFixed(2));
  }
  console.log(pad(nom,44), s.mort ? ('MORT H'+Math.round(s.mort.t)+' — '+s.mort.titre)
                                  : ('SURVIE J7, reserve '+s.reserve.toFixed(2)));
  if(s.mort) console.log(pad('',44)+'  '+trace.slice(0,5).join(' | '));
}
console.log('--- sans intervention ---');
course('Atresie tricuspide + atresie pulmonaire',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'});
course('HypoVG',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'});
course('HypoVG + septum intact',{oreillettes:'O3-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'});
course('VU sans obstacle (AT + AP normale)',{});
console.log('\n--- avec le bon geste ---');
course('Atresie pulmonaire + PGE1',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'},{pge:true});
course('Atresie pulmonaire + BTT',{oreillettes:'O2-atrG',ventriculeDroit:'V2',ap:'P3'},{btt:true});
course('HypoVG + PGE1',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'},{pge:true});
course('HypoVG septum intact + Rashkind',{oreillettes:'O2-atrD',ventriculeDroit:'V3',ventriculeGauche:'V2',aorte:'A3'},{pge:true,rashkind:true});
console.log('\n--- avec le MAUVAIS geste ---');
course('VU sans obstacle + O2 + NO (piege)',{},{o2:true,no:true});
course('FBV restrictif + cerclage (piege)',{oreillettes:'O2',ventriculeDroit:'V3',ventriculeGauche:'V2',fbv:'restrictif'},{cerclage:true,pge:true});
