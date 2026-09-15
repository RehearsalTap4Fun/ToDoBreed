// v2 母版：手调路径 + 多层明暗 + 升级脸 + 微细节。o.stage 1..4 控制层级（1 轮廓 2 明暗 3 脸 4 细节）
(function(){
  var DARK='#3b3232', TONGUE='#f29aa6';
  function h2r(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
  function r2h(r){return '#'+r.map(function(v){v=Math.max(0,Math.min(255,Math.round(v)));return (v<16?'0':'')+v.toString(16);}).join('');}
  function mix(a,b,t){var A=h2r(a),B=h2r(b);return r2h([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);}
  function darken(h,t){return mix(h,'#2a2030',t);}
  function tint(h,t){return mix(h,'#ffffff',t);}
  var uid=0;
  function el(t,a){var s='<'+t;for(var k in a){s+=' '+k+'="'+a[k]+'"';}return s+'/>';}
  function E(cx,cy,rx,ry,f,x){return el('ellipse',Object.assign({cx:cx,cy:cy,rx:rx,ry:ry,fill:f},x||{}));}
  function C(cx,cy,r,f,x){return el('circle',Object.assign({cx:cx,cy:cy,r:r,fill:f},x||{}));}
  function P(d,f,x){return el('path',Object.assign({d:d,fill:f},x||{}));}
  function tri(pts,f,w){return P('M'+pts[0]+' L'+pts[1]+' L'+pts[2]+' Z',f,{stroke:f,'stroke-width':w,'stroke-linejoin':'round'});}
  function ln(d,w,c,x){return P(d,'none',Object.assign({stroke:c,'stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round'},x||{}));}

  var BODY='M78,100 C60,106 45,128 44,154 C43,176 56,187 76,187 L124,187 C144,187 157,176 156,154 C155,128 140,106 122,100 Z';
  var HEAD='M100,32 C125,32 141,47 141,67 C141,86 128,102 100,103 C72,102 59,86 59,67 C59,47 75,32 100,32 Z';
  var TAIL='M146,172 C174,170 190,142 176,108 C173,101 164,101 162,108 C172,138 160,158 144,160 Z';
  var TAIL_DOG='M146,168 C166,164 176,144 162,128 C158,124 151,127 153,134 C162,146 156,156 144,158 Z';

  function eyeLayer(x,y,ec,st){
    if(st<3) return E(x,y,10,11.5,ec)+E(x+.4,y+1.5,4.8,6.6,DARK)+C(x-3.4,y-3.6,2.8,'#fff');
    var s='';
    s+=E(x,y-1.2,11,12.8,DARK);
    s+=E(x,y+.4,10.4,11.6,mix(ec,'#000',.25));
    s+=E(x,y+1.6,8.6,9.6,ec);
    s+=E(x,y-2.2,6.4,4,tint(ec,.3),{opacity:.5});
    s+=E(x+.4,y+2,4.8,6.6,DARK);
    s+=C(x-3.6,y-3.8,3.2,'#fff')+C(x+3.6,y+4.2,1.6,'#fff',{opacity:.9});
    return s;
  }

  function pet2(g,o){
    o=o||{}; var sp=o.species||'cat', st=o.stage||4, pat=!o.noPattern&&st>=4;
    var c1=g.c1,c2=g.c2,c3=g.c3,c4=g.c4,ec=g.eye;
    var sh=darken(c1,.18), hi=tint(c1,.14), lg=tint(c1,.08);
    var id='m'+(++uid), out='';
    out+=E(100,189,56,6,'#000',{opacity:.10});
    // 尾
    if(sp==='cat'){
      out+=P(TAIL,c1);
      if(st>=2){ out+='<clipPath id="'+id+'t">'+P(TAIL,'')+'</clipPath><g clip-path="url(#'+id+'t)">'+P('M150,178 C176,176 190,150 178,116 C176,112 174,112 172,116 C182,148 168,166 148,168 Z',sh,{opacity:.45}); if(pat) out+=ln('M164,128 l14,-4 M168,116 l12,-3 M170,140 l12,-6',4,c2,{opacity:.85}); out+='</g>'; }
      if(st>=4) out+=C(168,107,6.5,c3);
    } else if(sp==='dog'){ out+=P(TAIL_DOG,c1); if(st>=4) out+=C(157,130,5.5,c3); }
    else { out+=C(156,158,12,c3); if(st>=2) out+=E(154,164,9,5,mix(c3,sh,.35),{opacity:.5}); }
    // 身体
    out+=P(BODY,c1);
    out+='<clipPath id="'+id+'b">'+P(BODY,'')+'</clipPath><g clip-path="url(#'+id+'b)">';
    out+=P('M100,116 C120,116 130,138 130,160 C130,180 118,190 100,190 C82,190 70,180 70,160 C70,138 80,116 100,116 Z',c3);
    if(st>=4) out+=tri(['92,120','100,112','108,120'],c3,3);
    if(st>=2){
      out+=E(100,198,72,20,sh);
      out+=P('M44,154 C43,176 56,187 76,187 C60,182 50,170 48,150 Z',sh,{opacity:.55})+P('M156,154 C157,176 144,187 124,187 C140,182 150,170 152,150 Z',sh,{opacity:.55});
      out+=E(160,150,14,46,sh,{opacity:.22})+E(100,103,22,7,sh,{opacity:.5});
    }
    if(pat&&sp==='cat') out+=ln('M48,148 q10,-10 22,-4 M46,164 q10,-8 20,-2 M152,148 q-10,-10 -22,-4 M154,164 q-10,-8 -20,-2',4.5,c2,{opacity:.85});
    if(pat&&sp==='dog') out+=E(128,152,12,9,c2)+E(52,166,7,6,c2);
    out+='</g>';
    // 后脚
    var pc=(sp==='rabbit'&&pat)?c3:lg;
    if(st>=4) out+=E(58,183,10,5,lg)+C(52,184,3,lg)+C(58,183.5,3,lg)+C(64,184,3,lg)+E(142,183,10,5,lg)+C(136,184,3,lg)+C(142,183.5,3,lg)+C(148,184,3,lg);
    else out+=E(58,183,10,5,lg)+E(142,183,10,5,lg);
    // 前腿 + 爪
    out+=P('M76,130 Q84,124 92,130 L91,178 Q84,182 78,178 Z',lg)+P('M108,130 Q116,124 124,130 L122,178 Q116,182 109,178 Z',lg);
    if(st>=2) out+=ln('M77,134 L79,176',1.6,sh,{opacity:.45})+ln('M123,134 L121,176',1.6,sh,{opacity:.45})+ln('M91,134 L90,176',1.6,sh,{opacity:.3})+ln('M109,134 L110,176',1.6,sh,{opacity:.3});
    function paw(x){ return st>=4 ? E(x,181,11,6,mix(pc,sh,.4))+C(x-7,182,4.2,pc)+C(x,180.5,4.4,pc)+C(x+7,182,4.2,pc) : E(x,181,11,6,pc); }
    out+=paw(84)+paw(116);
    if(!o.noHead){
    // 头
    out+=P(HEAD,c1);
    if(sp==='cat'&&st>=4) out+=tri(['61,71','53,76','61,82'],c1,2.5)+tri(['139,71','147,76','139,82'],c1,2.5);
    out+='<clipPath id="'+id+'h">'+P(HEAD,'')+'</clipPath><g clip-path="url(#'+id+'h)">';
    if(st>=2) out+=E(86,46,20,12,hi,{opacity:.55})+E(100,105,30,10,sh,{opacity:.55});
    if(pat&&sp==='cat') out+=ln('M86,48 q1,-9 4,-14 M100,46 l0,-16 M114,48 q-1,-9 -4,-14',4.2,c2,{opacity:.9});
    if(pat&&sp==='dog') out+=C(119,66,19,c2);
    if(pat&&sp==='rabbit') out+=E(100,64,7,24,c3);
    out+='</g>';
    // 耳
    if(sp==='cat'){
      out+=tri(['66,52','92,33','64,15'],c1,7)+tri(['134,52','108,33','136,15'],c1,7);
      if(st>=3) out+=tri(['72,48','86,38','68,25'],c4,3.5)+tri(['128,48','114,38','132,25'],c4,3.5);
    } else if(sp==='dog'){
      out+=P('M66,56 C50,58 44,84 52,104 C56,112 68,110 70,100 C74,86 76,66 66,56 Z',c2)+P('M134,56 C150,58 156,84 148,104 C144,112 132,110 130,100 C126,86 124,66 134,56 Z',c2);
      if(st>=2) out+=P('M66,56 C58,60 54,72 56,84 C60,74 66,66 66,56 Z',sh,{opacity:.3})+P('M134,56 C142,60 146,72 144,84 C140,74 134,66 134,56 Z',sh,{opacity:.3});
    } else {
      out+=P('M82,42 C70,26 74,0 86,-2 C96,-4 100,22 94,40 Z',c1)+P('M118,42 C130,26 126,0 114,-2 C104,-4 100,22 106,40 Z',c1);
      if(st>=3) out+=P('M84,38 C76,26 78,6 86,4 C92,4 95,22 91,38 Z',c4)+P('M116,38 C124,26 122,6 114,4 C108,4 105,22 109,38 Z',c4);
    }
    // 口鼻底
    if(st>=3){
      if(sp==='cat'){ out+=P('M78,85 C78,76 96,74 100,81 C104,74 122,76 122,85 C122,93 110,97 100,95 C90,97 78,93 78,85 Z',c3)+E(100,98,7,4,c3); if(st>=4) [[88,85],[85,89],[90,91],[112,85],[115,89],[110,91]].forEach(function(p){ out+=C(p[0],p[1],.9,sh,{opacity:.55}); }); }
      else if(sp==='dog') out+=P('M76,86 C76,72 124,72 124,86 C124,99 108,105 100,103 C92,105 76,99 76,86 Z',c3);
      else out+=E(100,88,13,8,c3)+E(100,97,6,3.5,c3);
    }
    // 眼
    function eye(x,y){ return eyeLayer(x,y,ec,st); }
    out+=eye(83,70)+eye(117,70);
    // 鼻 嘴
    if(!o.noMouth){
    if(sp==='cat'){ out+=tri(['95,79','105,79','100,85'],c4,2.5); if(st>=3) out+=C(98,80,1,'#fff',{opacity:.8}); out+=ln('M100,85 q-3,6 -8,3 M100,85 q3,6 8,3',2.2,DARK); }
    else if(sp==='dog'){ out+=E(100,83,8,6,DARK); if(st>=3) out+=C(97,81,1.8,'#fff',{opacity:.7}); out+=ln('M100,89 q-4,7 -10,3 M100,89 q4,7 10,3',2.2,DARK)+P('M95,93 h10 v6.5 a5,5 0 0 1 -10,0 Z',TONGUE); }
    else { out+=tri(['96.5,83','103.5,83','100,87'],c4,1.5)+ln('M100,87 l0,4',2,DARK)+ln('M92,91 q8,4 16,0',2.2,DARK)+el('rect',{x:95.7,y:91.5,width:4.2,height:6.5,rx:1,fill:'#fff'})+el('rect',{x:100.3,y:91.5,width:4.2,height:6.5,rx:1,fill:'#fff'}); }
    }
    if(st>=3) out+=E(70,86,6.5,3.6,c4,{opacity:.4})+E(130,86,6.5,3.6,c4,{opacity:.4});
    }
    return '<svg viewBox="-6 -10 212 216" role="img" shape-rendering="geometricPrecision">'+out+'</svg>';
  }
  window.pet2=pet2; window.cat2=pet2; window.pet2Eye=eyeLayer; window.pet2Helpers={E:E,C:C,P:P,mix:mix,tint:tint,darken:darken,DARK:DARK};
})();
