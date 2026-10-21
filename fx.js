/* v51 shared effects: hero word-by-word + steam flag, vine dividers, dish-name ribbon pause. No dependencies. */
(function(){
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
/* hero headline: reveal word by word each time a slide renders */
var hx=document.getElementById('hx'),home=document.getElementById('home');
function split(el){var i=0;(function walk(n){[].slice.call(n.childNodes).forEach(function(c){
 if(c.nodeType===3){var parts=c.textContent.split(/(\s+)/),f=document.createDocumentFragment();
  parts.forEach(function(p){if(!p)return;if(/^\s+$/.test(p)){f.appendChild(document.createTextNode(' '));return}
   var s=document.createElement('span');s.className='wd';s.style.setProperty('--i',i++);s.textContent=p;f.appendChild(s)});
  n.replaceChild(f,c)}else if(c.nodeType===1&&c.tagName!=='BR'){walk(c)}})})(el)}
function dress(){var h=hx&&hx.querySelector('.hh');if(h&&!h.dataset.sp){h.dataset.sp='1';if(!RM)split(h)}
 if(home)home.classList.toggle('has-steam',!!(hx&&hx.querySelector('.vd')))}
if(hx&&'MutationObserver' in window){new MutationObserver(dress).observe(hx,{childList:true});dress()}
/* things that animate once when they scroll into view */
var els=[].slice.call(document.querySelectorAll('.vine,.dmq,.dpx'));
if(els.length){if(RM||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')})}
 else{var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.35});els.forEach(function(e){io.observe(e)})}}
/* v51: image-loading shimmer */
function shim(){[].slice.call(document.querySelectorAll('.sgi img,.rvph img,.mn-tb>img,.ct-i img')).forEach(function(i){
 if(i.complete||i.dataset.sh)return;i.dataset.sh='1';var p=i.parentNode;p.classList.add('sh-l');
 function d(){p.classList.remove('sh-l')}i.addEventListener('load',d,{once:true});i.addEventListener('error',d,{once:true});setTimeout(d,8000)})}
if(!RM){shim();var st;if('MutationObserver' in window)new MutationObserver(function(){clearTimeout(st);st=setTimeout(shim,150)}).observe(document.body,{childList:true,subtree:true})}
/* v51: count-up on rewards points */
var cn=[].slice.call(document.querySelectorAll('li>b>small')).filter(function(s){return s.textContent.trim()==='pts'}).map(function(s){return s.parentNode});
cn.forEach(function(b){var t=b.firstChild;if(!t||t.nodeType!==3)return;var to=parseInt(t.textContent,10);if(!to||RM||!('IntersectionObserver' in window))return;
 var io=new IntersectionObserver(function(es){if(!es[0].isIntersecting)return;io.disconnect();var st=null;
  (function f(ts){if(st===null)st=ts;var k=Math.max(0,Math.min(1,(ts-st)/1100));t.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f);else t.textContent=to})(performance.now())},{threshold:.6});
 t.textContent=0;io.observe(b)});
/* v51: menu.html?c=xx opens that course */
(function(){var m=/[?&]c=([a-z]{2})/.exec(location.search);if(!m||!document.getElementById('menu'))return;var n=0,t=setInterval(function(){var a=document.querySelector('#mn-rail a[data-c="'+m[1]+'"]');if(a){clearInterval(t);a.click()}else if(++n>40)clearInterval(t)},100)})();
})();

/* v55 carousels: one engine for "Explore by Course", "Customer Favourites" and "Reviews".
   Markup: <div class="cvr" data-cv="desktop,tablet,phone cards" data-cvspeed="px/s" data-cvlabel="...">
             <div class="cvr-vp"><ul|div class="cvr-tk"> ...cards... </></div></div>
   Slow right-to-left motion, < > arrows (tap = one card, hold = fast), pause on hover/touch/keyboard focus,
   drag/swipe with momentum, reduced-motion = plain swipeable strip. The menu running grid (#menu-run) is separate CSS. */
(function(){
var roots=[].slice.call(document.querySelectorAll('[data-cv]'));
if(!roots.length)return;
document.documentElement.classList.add('cv-js');
var mq=window.matchMedia?matchMedia('(prefers-reduced-motion:reduce)'):{matches:false};
var FAST=640,HOLD=380;
function chev(d){return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="'+d+'" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
function ease(k){return k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2}
function mod(a,m){return((a%m)+m)%m}

function CV(root){
 var vp=root.querySelector('.cvr-vp'),tk=root.querySelector('.cvr-tk');
 if(!vp||!tk||!tk.children.length)return;
 var items=[].slice.call(tk.children),lbl=root.getAttribute('data-cvlabel')||'items';
 var cfg=(root.getAttribute('data-cv')||'3,2,1.2').split(',').map(parseFloat);
 var speed=parseFloat(root.getAttribute('data-cvspeed'))||24;
 var c3d=root.hasAttribute('data-cv3d'),cards=[],lefts=[],cw=0,act=-1,dots=[],pos=0,setW=0,step=0,cnum=0,clones=[],raf=0,last=0,vis=true,rm=false,anim=null,fast=0,vel=0,blk=false,dr=null,tchT=0;
 var P={hov:0,foc:0,tch:0};

 /* arrows */
 var bp=document.createElement('button'),bn=document.createElement('button');
 bp.type=bn.type='button';bp.className='cvr-b p';bn.className='cvr-b n';
 bp.setAttribute('aria-label','Previous '+lbl);bn.setAttribute('aria-label','Next '+lbl);
 bp.innerHTML=chev('M15 5l-7 7 7 7');bn.innerHTML=chev('M9 5l7 7-7 7');
 root.appendChild(bp);root.appendChild(bn);

 function kick(){if(!raf&&vis&&!rm){last=performance.now();raf=requestAnimationFrame(tick)}}
 function render(){if(setW){var o=mod(pos,setW);tk.style.transform='translate3d('+(-o)+'px,0,0)';if(c3d)paint3d(o)}}
 /* 3D coverflow: every card is tilted/scaled by its distance from the centre, so the look follows the motion */
 function paint3d(o){
  var vw=vp.clientWidth,cx=vw/2,best=1e9,bi=0,n=items.length;
  for(var i=0;i<cards.length;i++){
   var d=lefts[i]+cw/2-o-cx,a=Math.abs(d);
   if(a>vw+cw)continue;
   var t=Math.min(1,a/step),sg=d>0?1:-1,c=cards[i];
   c.style.transform='perspective(1000px) translateX('+(-sg*t*step*.1).toFixed(1)+'px) rotateY('+(sg*t*(vw<700?22:28)).toFixed(2)+'deg) scale('+(1.03-.25*t).toFixed(3)+')';
   c.style.opacity=(1-.28*t).toFixed(3);c.style.zIndex=100-Math.round(a/8);
   c.classList.toggle('is-on',a<step*.5);
   if(a<best){best=a;bi=i%n}}
  if(bi!==act){act=bi;dots.forEach(function(b,k){b.setAttribute('aria-current',k===bi?'true':'false')})}}
 function goTo(i){if(!setW||rm)return;var tg=lefts[i]+cw/2-vp.clientWidth/2;vel=0;anim={from:pos,to:pos+mod(tg-pos+setW/2,setW)-setW/2,t0:performance.now(),d:720};kick();touchHold();touchRelease()}
 if(c3d){var rk=document.createElement('div'),rd=document.createElement('div');rk.className='rvk';rd.className='rvd';rd.setAttribute('role','group');rd.setAttribute('aria-label','Choose a review');
  items.forEach(function(it,i){var b=document.createElement('button');b.type='button';b.setAttribute('aria-label',lbl.replace(/s$/,'')+' '+(i+1)+' of '+items.length);b.addEventListener('click',function(){goTo(i)});rd.appendChild(b);dots.push(b)});
  rk.appendChild(rd);root.appendChild(rk)}
 function tick(ts){
  raf=0;if(!vis||rm)return;
  var dt=Math.min(.05,Math.max(0,(ts-last)/1000));last=ts;
  if(anim){var k=Math.min(1,(ts-anim.t0)/anim.d);pos=anim.from+(anim.to-anim.from)*ease(k);if(k>=1)anim=null}
  else if(fast){pos+=fast*FAST*dt}
  else if(dr&&dr.on){}
  else if(Math.abs(vel)>14){pos+=vel*dt;vel*=Math.pow(.04,dt)}
  else{vel=0;if(!P.hov&&!P.foc&&!P.tch&&!document.hidden)pos+=speed*dt}
  if(!anim&&setW&&Math.abs(pos)>setW*40)pos=mod(pos,setW);
  render();raf=requestAnimationFrame(tick)}

 function stepBy(dir){
  if(rm){vp.scrollBy({left:dir*step,behavior:'auto'});return}
  vel=0;var base=anim?anim.to:pos;
  if(c3d&&!anim&&setW){var tg=Math.round((pos+vp.clientWidth/2-cw/2)/step)*step-vp.clientWidth/2+cw/2;base=pos+mod(tg-pos+setW/2,setW)-setW/2}
  anim={from:pos,to:base+dir*step,t0:performance.now(),d:540};kick()}
 function touchHold(){P.tch=1;clearTimeout(tchT)}
 function touchRelease(){clearTimeout(tchT);tchT=setTimeout(function(){P.tch=0},1800)}

 function bind(b,dir){
  var ht=0,held=false,down=false;
  b.addEventListener('pointerdown',function(e){
   if(e.button>0)return;down=true;held=false;clearTimeout(ht);
   if(e.pointerType!=='mouse')touchHold();
   if(!rm)ht=setTimeout(function(){held=true;anim=null;vel=0;fast=dir;kick()},HOLD)});
  function up(commit){clearTimeout(ht);var was=held;if(held){fast=0;held=false}
   if(down&&commit&&!was)stepBy(dir);down=false;touchRelease()}
  b.addEventListener('pointerup',function(){up(true)});
  b.addEventListener('pointerleave',function(){if(down)up(false)});
  b.addEventListener('pointercancel',function(){up(false)});
  b.addEventListener('click',function(e){if(e.detail===0)stepBy(dir)});
  b.addEventListener('contextmenu',function(e){e.preventDefault()})}
 bind(bp,-1);bind(bn,1);

 /* layout */
 function removeClones(){clones.forEach(function(c){if(c.parentNode)c.parentNode.removeChild(c)});clones=[];cnum=0}
 function measure(){
  var w=window.innerWidth,n=w>=1000?cfg[0]:(w>=640?(cfg[1]||cfg[0]):(cfg[2]||cfg[1]||cfg[0]));
  root.style.setProperty('--cn',n);root.style.setProperty('--cvw',vp.clientWidth+'px');
  var gap=parseFloat(getComputedStyle(tk).columnGap)||0,iw=items[0].getBoundingClientRect().width;
  if(!iw)return;step=iw+gap;
  if(rm)return;
  setW=step*items.length;
  var need=Math.max(1,Math.ceil(vp.clientWidth/setW));
  if(need!==cnum){removeClones();
   for(var c=0;c<need;c++)items.forEach(function(it){var k=it.cloneNode(true);
    k.classList.add('cvr-cl');k.setAttribute('aria-hidden','true');k.setAttribute('inert','');
    [].forEach.call(k.querySelectorAll('[id]'),function(x){x.removeAttribute('id')});
    if(k.hasAttribute('id'))k.removeAttribute('id');
    [].forEach.call(k.querySelectorAll('a,button,[tabindex]'),function(x){x.setAttribute('tabindex','-1')});
    if(k.tagName==='A')k.setAttribute('tabindex','-1');
    tk.appendChild(k);clones.push(k)});
   cnum=need}
  cards=[].slice.call(tk.children);lefts=cards.map(function(c){return c.offsetLeft});cw=iw;
  render()}
 function mode(){
  rm=!!mq.matches;root.classList.toggle('cvr-rm',rm);removeClones();anim=null;fast=0;vel=0;pos=0;
  tk.style.transform='';vp.scrollLeft=0;if(c3d&&rm)items.forEach(function(c){c.style.transform=c.style.opacity=c.style.zIndex='';c.classList.remove('is-on')});measure();if(!rm)kick()}
 var rq=0;function relayout(){if(rq)return;rq=requestAnimationFrame(function(){rq=0;measure()})}
 if('ResizeObserver' in window)new ResizeObserver(relayout).observe(vp);
 window.addEventListener('resize',relayout);
 if(mq.addEventListener)mq.addEventListener('change',mode);else if(mq.addListener)mq.addListener(mode);

 /* run only while on screen; load lazy images in the strip just before it appears */
 if('IntersectionObserver' in window){
  vis=false;var ld=false;
  new IntersectionObserver(function(es){vis=es[0].isIntersecting;
   if(vis&&!ld){ld=true;[].forEach.call(root.querySelectorAll('img[loading=lazy]'),function(i){i.loading='eager'})}
   if(vis)kick()},{rootMargin:'300px 0px'}).observe(root)}

 /* pause: mouse hover, keyboard focus (touch is handled by the drag code) */
 root.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')P.hov=1});
 root.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')P.hov=0});
 root.addEventListener('focusin',function(e){
  try{P.foc=e.target.matches(':focus-visible')?1:0}catch(x){P.foc=1}
  var it=e.target.closest&&e.target.closest('.cvr-tk>*');vp.scrollLeft=0;
  if(it&&!rm&&setW&&it.parentNode===tk&&!it.classList.contains('cvr-cl')){
   var iw=it.offsetWidth,vw=vp.clientWidth,rel=mod(it.offsetLeft-mod(pos,setW),setW);
   if(rel+iw>vw+1&&rel<setW-iw){var d=rel-(vw-iw)/2;if(d>setW/2)d-=setW;vel=0;anim={from:pos,to:pos+d,t0:performance.now(),d:420};kick()}}});
 root.addEventListener('focusout',function(){P.foc=0});
 vp.addEventListener('scroll',function(){if(!rm&&vp.scrollLeft)vp.scrollLeft=0},{passive:true});
 vp.addEventListener('dragstart',function(e){e.preventDefault()});

 /* swipe / drag with momentum */
 vp.addEventListener('pointerdown',function(e){
  if(rm||(e.pointerType==='mouse'&&e.button!==0))return;
  blk=false;if(e.pointerType!=='mouse')touchHold();
  dr={id:e.pointerId,x:e.clientX,o:pos,on:false,lx:e.clientX,lt:performance.now(),v:0}});
 vp.addEventListener('pointermove',function(e){
  if(!dr||e.pointerId!==dr.id)return;var dx=e.clientX-dr.x;
  if(!dr.on){if(Math.abs(dx)<7)return;dr.on=true;anim=null;fast=0;vel=0;root.classList.add('is-drag');try{vp.setPointerCapture(e.pointerId)}catch(x){}}
  var now=performance.now(),dt=(now-dr.lt)/1000;
  if(dt>0){dr.v=.6*dr.v+.4*((dr.lx-e.clientX)/dt);dr.lx=e.clientX;dr.lt=now}
  pos=dr.o-dx;render()});
 function release(e,cancel){
  if(!dr||(e&&e.pointerId!==dr.id))return;var d=dr;dr=null;
  if(d.on){root.classList.remove('is-drag');blk=!cancel;
   try{vp.releasePointerCapture(d.id)}catch(x){}
   var v=Math.max(-1800,Math.min(1800,d.v));if(performance.now()-d.lt>120)v=0;vel=v;kick()}
  if(e&&e.pointerType!=='mouse')touchRelease()}
 vp.addEventListener('pointerup',function(e){release(e,false)});
 vp.addEventListener('pointercancel',function(e){release(e,true)});
 vp.addEventListener('click',function(e){if(blk){e.preventDefault();e.stopPropagation();blk=false}},true);

 mode()}

roots.forEach(function(r){try{new CV(r)}catch(e){if(window.console)console.warn('carousel',e)}});
})();

/* v57 Phase 3: Village Story letter-by-letter (scroll-linked) -> map reveal, scroll-in effects. Nothing here runs under reduced motion. */
(function(){
if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
var de=document.documentElement;de.classList.add('fx3');

/* 1. Village Story: letters light up as you scroll */
var host=document.querySelector('#story .g3 > div:first-child');
if(host){
 var letters=[],cur=0;
 [host.querySelector('h2'),host.querySelector('.lead')].forEach(function(el){
  if(!el)return;
  var nodes=[].slice.call(el.childNodes),plain=nodes.map(function(n){return n.nodeName==='BR'?' ':n.textContent}).join('').replace(/\s+/g,' ').trim();
  var sr=document.createElement('span');sr.className='lt-sr';sr.textContent=plain;
  var v=document.createElement('span');v.className='lt-v';v.setAttribute('aria-hidden','true');
  nodes.forEach(function(n){
   if(n.nodeName==='BR'){v.appendChild(document.createElement('br'));return}
   n.textContent.split(/(\s+)/).forEach(function(w){
    if(!w)return;if(/^\s+$/.test(w)){v.appendChild(document.createTextNode(' '));return}
    var ws=document.createElement('span');ws.className='lt-w';
    w.split('').forEach(function(ch){var c=document.createElement('span');c.className='lt-c';c.textContent=ch;ws.appendChild(c);letters.push(c)});
    v.appendChild(ws)})});
  el.textContent='';el.appendChild(sr);el.appendChild(v);el.classList.add('lt-on')});
 var tk=0;
 function upd(force){tk=0;var r=host.getBoundingClientRect(),vh=window.innerHeight,
  p=force?1:Math.max(0,Math.min(1,(vh*.86-r.top)/(vh*.5))),n=Math.round(p*letters.length);
  if(n===cur)return;var i;
  if(n>cur){for(i=cur;i<n;i++)letters[i].classList.add('on')}else{for(i=n;i<cur;i++)letters[i].classList.remove('on')}
  cur=n}
 function sch(){if(!tk)tk=requestAnimationFrame(function(){upd(false)})}
 addEventListener('scroll',sch,{passive:true});addEventListener('resize',sch);upd(false);

 /* 2. map reveal, after the story text */
 var st=document.querySelector('#cz .cz-stage');
 if(st&&'IntersectionObserver' in window){
  st.classList.add('mp-pre');
  var mo=new IntersectionObserver(function(es){if(!es[0].isIntersecting)return;mo.disconnect();upd(true);
   st.classList.add('mp-in');setTimeout(function(){st.classList.add('mp-done')},2200)},{threshold:.22});
  mo.observe(st)}
}

/* 3. scroll-in for blocks that had no entrance effect */
if('IntersectionObserver' in window){
 var t=[].slice.call(document.querySelectorAll('.cvr,.mrg-w,#cz .cz-strip,.sgb,footer .w'));
 t.forEach(function(e){e.classList.add('fx-up')});
 var fo=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('fx-in');fo.unobserve(x.target)}})},{threshold:.12});
 t.forEach(function(e){fo.observe(e)})}
})();


/* v76: live open/closed badge + facts count-up. Hours mirror CONFIG.hours in order.js (IST). */
(function(){
 var RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
 var DAYS={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
 function ist(){var o={};new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).forEach(function(x){o[x.type]=x.value});return{d:DAYS[o.weekday],m:(+o.hour%24)*60+(+o.minute)}}
 function slots(d){return [[720,d===1?960:990],[1140,1410]]}
 function fmt(m){var h=Math.floor(m/60),mi=m%60,ap=h>=12?'pm':'am';h=h%12||12;return h+(mi?':'+(mi<10?'0':'')+mi:'')+' '+ap}
 function state(){
  var n=ist(),s=slots(n.d),i;
  for(i=0;i<s.length;i++)if(n.m>=s[i][0]&&n.m<s[i][1]){var left=s[i][1]-n.m;return{k:left<=30?'soon':'open',t:(left<=30?'Closing soon':'Open now')+' \u00b7 till '+fmt(s[i][1])}}
  for(i=0;i<s.length;i++)if(n.m<s[i][0])return{k:'closed',t:'Closed \u00b7 opens '+fmt(s[i][0])};
  return{k:'closed',t:'Closed \u00b7 opens '+fmt(slots((n.d+1)%7)[0][0])+' tomorrow'}
 }
 window.SXOpenState=state;
 var els=[].slice.call(document.querySelectorAll('[data-open]'));
 function paint(){var s=state();els.forEach(function(e){e.className=e.className.replace(/\boc-(open|soon|closed)\b/g,'').replace(/\s+/g,' ').trim();if(e.className.indexOf('oc ')!==0&&e.className!=='oc')e.className=('oc '+e.className).trim();e.classList.add('oc-'+s.k);e.innerHTML='<i aria-hidden="true"></i><span></span>';e.lastChild.textContent=s.t})}
 if(els.length){paint();setInterval(paint,60000)}
 var ns=[].slice.call(document.querySelectorAll('.fx-n[data-to]'));
 if(ns.length&&!RM&&'IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(!x.isIntersecting)return;io.unobserve(x.target);var n=x.target,li=n.closest('li'),to=+n.getAttribute('data-to'),suf=n.getAttribute('data-suf')||'',idx=ns.indexOf(n),t0=null,dur=1900+idx*260;
   setTimeout(function(){if(li){li.classList.add('fx-on','fx-run')}
    (function f(ts){if(t0===null)t0=ts;var k=Math.min(1,(ts-t0)/dur),e=k===1?1:1-Math.pow(2,-10*k);n.textContent=Math.round(to*e)+(k<1?'':suf);if(k<1)requestAnimationFrame(f);else if(li){li.classList.remove('fx-run');li.classList.add('fx-done')}})(performance.now())},idx*180)})},{threshold:.4,rootMargin:'0px 0px -6% 0px'});
  ns.forEach(function(n){n.textContent='0';io.observe(n)});
 }
})();

/* v85: hide the chat button while scrolling down on phones, show it again when scrolling up or idle */
(function(){var y=window.scrollY,t,h=document.documentElement;addEventListener('scroll',function(){if(innerWidth>1000)return;var d=window.scrollY-y;y=window.scrollY;if(d>6)h.classList.add('fabh');else if(d<-6)h.classList.remove('fabh');clearTimeout(t);t=setTimeout(function(){h.classList.remove('fabh')},900)},{passive:true})})();

/* v88: WhatsApp welcome panel. Chat button opens a welcome (live open/closed status, quick actions, name + optional mobile),
   then sends the visitor to WhatsApp with the message ready, or into the Take away / Dine-in cart (order.js), or shows timings. Number lives in WA. */
(function(){
var WA="917659858999",fw=document.querySelector(".fab .fw");if(!fw)return;
var $=function(s,r){return(r||document).querySelector(s)};
function st(k,v){try{if(v===undefined)return localStorage.getItem("sx_"+k)||"";localStorage.setItem("sx_"+k,v)}catch(e){return""}}
var ICON={
 pickup:'<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
 dine:'<svg viewBox="0 0 24 24"><path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8M6 7h4M17 3c-2 2-3 5-3 8h3v10"/></svg>',
 time:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 cater:'<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>'};
var WAI='<svg viewBox="0 0 32 32"><path d="'+(fw.querySelector("svg path")||{getAttribute:function(){return""}}).getAttribute("d")+'"/></svg>';
function status(){
 var d=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"})),m=d.getHours()*60+d.getMinutes(),dow=d.getDay();
 var slots=[[720,dow===1?960:990],[1140,1410]];
 for(var i=0;i<slots.length;i++)if(m>=slots[i][0]&&m<slots[i][1])return{o:true,t:"Open now \u00B7 we reply within minutes"};
 var nx=null;for(i=0;i<slots.length;i++)if(m<slots[i][0]){nx=slots[i][0];break}
 var h=nx===null?"12:00 pm tomorrow":(nx===720?"12:00 pm":"7:00 pm");
 return{o:false,t:"Closed now \u00B7 opens "+h+". Message us, we reply when open"}}
var root;
function build(){
 root=document.createElement("div");root.id="swa";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-label","Chat with Swagramam on WhatsApp");
 root.innerHTML='<div class="sw-h"><span class="sw-av"><img src="assets/swg-logo-320w.webp" alt="" width="48" height="48"></span><div class="sw-t"><b>Swagramam</b><small></small></div><button type="button" class="sw-x" aria-label="Close chat">&times;</button></div>'+
 '<div class="sw-b"><p class="sw-m">Namaste! \uD83D\uDE4F Welcome to <b>Swagramam</b>, Vijayawada.<br>How can we help you today?</p>'+
 '<div class="sw-ch"><button type="button" data-a="pickup">'+ICON.pickup+'Take away order</button><button type="button" data-a="dine">'+ICON.dine+'Reserve a table</button><button type="button" data-a="time">'+ICON.time+'Timings &amp; location</button><button type="button" data-a="cater">'+ICON.cater+'Catering &amp; events</button></div>'+
 '<div class="sw-i" hidden></div>'+
 '<div class="sw-f"><label><span>Your name</span><input id="swa-n" autocomplete="name" maxlength="60" placeholder="Your name"></label>'+
 '<label><span>Mobile number <i>(optional)</i></span><input id="swa-p" inputmode="numeric" autocomplete="tel-national" maxlength="16" placeholder="10-digit mobile"></label>'+
 '<p class="sw-e" role="alert" hidden></p>'+
 '<button type="button" class="sw-go" data-a="chat">'+WAI+'Start chat on WhatsApp</button>'+
 '<small class="sw-n">WhatsApp opens with your message ready. Just press Send.<br>+91 76598 58999</small></div></div>';
 document.body.appendChild(root);
 $("#swa-n").value=st("name");$("#swa-p").value=st("mobile");
 root.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;if(b.classList.contains("sw-x")){close();return}var a=b.getAttribute("data-a");if(a)go(a)});
 document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!root.hidden){close();fw.focus()}});
 document.addEventListener("click",function(e){if(!root.hidden&&!root.contains(e.target)&&!e.target.closest(".fab"))close()},true);
}
function err(m){var p=$(".sw-e",root);p.textContent=m;p.hidden=!m}
function who(){
 var name=$("#swa-n").value.trim(),mob=$("#swa-p").value.replace(/[\s\-()]/g,"").replace(/^(\+?91|0)(?=\d{10}$)/,"");
 if(!name){err("Please tell us your name.");$("#swa-n").focus();return null}
 if(mob&&!/^[6-9]\d{9}$/.test(mob)){err("Please enter a valid 10-digit mobile number, or leave it empty.");$("#swa-p").focus();return null}
 err("");st("name",name);if(mob)st("mobile",mob);return{name:name,mob:mob}}
function wa(lines){var url="https://wa.me/"+WA+"?text="+encodeURIComponent(lines.join("\n"));close();var w=window.open(url,"_blank","noopener");if(!w)location.href=url}
function info(h){var b=$(".sw-i",root);b.innerHTML=h;b.hidden=false}
function go(a){
 if(a==="time"){
  info('<div><b>Lunch</b> 12:00 to 4:30 pm (Mon till 4:00 pm)<br><b>Dinner</b> 7:00 to 11:30 pm, every day<br><b>Find us</b> Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada 520010</div><div class="sw-r"><a href="https://www.google.com/maps?q=Swagramam,+Mogalrajapuram,+Sidhartha+Nagar,+Labbipet,+Vijayawada,+Andhra+Pradesh+520010&ftid=0x3a35fb6a44708c9d:0x725debf16635bfe7" target="_blank" rel="noopener">Get directions</a><a class="o" href="tel:+917659858999">Call us</a></div>');return}
 if(a==="cater"){
  info('<div><b>Private catering</b><br>Village-style South Indian feasts for family functions, gatherings and office events.</div><div class="sw-r"><a href="catering.html">Plan your event</a><a class="o" href="tel:+919849982052">Call 098499 82052</a></div>');return}
 var p=who();if(!p)return;
 if(a==="chat"){
  wa(["Namaste Swagramam \uD83D\uDE4F","I am "+p.name+(p.mob?" (mobile +91 "+p.mob+")":"")+".","I have an enquiry."]);return}
 close();if(window.SXOrder)window.SXOrder.open(a);
}
function open(){if(!root)build();var s=status(),sm=$(".sw-t small",root);sm.textContent=s.t;sm.className=s.o?"":"cl";var i=$(".sw-i",root);i.hidden=true;
 root.hidden=false;root.style.animation="none";void root.offsetWidth;root.style.animation="swaIn2 .32s cubic-bezier(.2,.8,.2,1) both";
 document.documentElement.classList.add("swa-open");fw.setAttribute("aria-expanded","true");fw.classList.remove("hint");setTimeout(function(){var n=$("#swa-n");if(!n.value)n.focus()},80)}
function close(){if(root){root.hidden=true;document.documentElement.classList.remove("swa-open");fw.setAttribute("aria-expanded","false")}}
fw.addEventListener("click",function(e){if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();root&&!root.hidden?close():open()});
/* one-time label hint on desktop, after the intro is gone */
(function(){if(innerWidth<=1000||st("fabhint"))return;var t=setInterval(function(){if(document.getElementById("sx"))return;clearInterval(t);setTimeout(function(){if(root&&!root.hidden)return;fw.classList.add("hint");st("fabhint","1");setTimeout(function(){fw.classList.remove("hint")},4200)},1800)},500)})();
var k=document.createElement("style");k.textContent="@keyframes swaIn2{from{opacity:0;transform:translateY(16px) scale(.96)}}";document.head.appendChild(k);
})();

/* v89: page transitions. Browsers with cross-page View Transitions use the CSS sunrise reveal; others get a fade. Internal pages are prefetched. */
(function(){
var h=document.documentElement;
try{if(HTMLScriptElement.supports&&HTMLScriptElement.supports("speculationrules")&&location.protocol!=="file:"){var r=document.createElement("script");r.type="speculationrules";r.textContent=JSON.stringify({prefetch:[{where:{and:[{href_matches:"/*"},{not:{href_matches:"/*#*"}}]},eagerness:"moderate"}]});document.head.appendChild(r)}}catch(e){}
if("onpagereveal" in window||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
h.classList.add("pt-fb");
addEventListener("pageshow",function(e){if(e.persisted)h.classList.remove("pt-leave")});
document.addEventListener("click",function(e){
 var a=e.target.closest&&e.target.closest("a[href]");
 if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute("download"))return;
 var u;try{u=new URL(a.href,location.href)}catch(x){return}
 if(u.origin!==location.origin||!/\.html$|\/$/.test(u.pathname)||(u.pathname===location.pathname&&u.search===location.search))return;
 e.preventDefault();h.classList.add("pt-leave");setTimeout(function(){location.href=a.href},300)});
})();
