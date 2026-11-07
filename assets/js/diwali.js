(function(){
var S=Date.UTC(2026,10,6,18,30),E=Date.UTC(2026,10,8,18,30),n=Date.now();
var f=/[?&]diwali=1/.test(location.search);
if(!f&&(n<S||n>=E))return;
try{if(!f&&sessionStorage.getItem("swg-dw"))return}catch(e){}
var rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
var css="#dw{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:16px 16px max(18px,env(safe-area-inset-bottom));overflow:hidden;background:url(assets/diwali-l.webp) 50% 100%/cover no-repeat,radial-gradient(ellipse at 50% 105%,#1d5f40,#0a2418 55%,#03100a);opacity:0;transition:opacity .45s cubic-bezier(.16,1,.3,1)}#dw.on{opacity:1}"
+"#dw::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,transparent 35%,rgba(3,16,10,.6));pointer-events:none}#dw canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}"
+"#dw .c{position:relative;max-width:400px;width:100%;padding:16px 20px 20px;text-align:center;color:#FFF3CC;background:rgba(8,32,21,.74);border:2px solid #F3C762;border-radius:24px;box-shadow:0 0 50px rgba(243,199,98,.22);opacity:0;transform:scale(.95);transform-origin:50% 100%;transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}#dw.sh .c{opacity:1;transform:none}"
+"#dw .ds{display:flex;justify-content:center;align-items:flex-end;gap:6px;margin:0 0 2px}#dw .ds svg{width:56px;height:42px;overflow:visible}#dw .ds svg:nth-child(2){width:78px;height:58px}"
+"#dw .fl{transform-origin:60px 42px;animation:dwf 1.3s ease-in-out infinite alternate}#dw .ds svg:nth-child(1) .fl{animation-delay:-.4s}#dw .ds svg:nth-child(3) .fl{animation-delay:-.8s}"
+"#dw h2{margin:4px 0 2px;font:800 clamp(1.8rem,8vw,2.3rem)/1.1 Georgia,serif;color:#F3C762;text-shadow:0 2px 14px rgba(243,199,98,.35)}"
+"#dw .t{margin:0 0 10px;font-size:1rem;letter-spacing:.04em;color:#F3C762}#dw p{margin:0 0 18px;font:italic 600 1.22rem/1.55 'Cormorant Garamond',Georgia,'Palatino Linotype',serif;letter-spacing:.01em;color:#FFF3CC}#dw .gh{color:transparent}#dw .ca{display:inline-block;width:2px;height:1.05em;margin-left:1px;vertical-align:-.15em;background:#F3C762;animation:dwc .8s steps(1) infinite}@keyframes dwc{50%{opacity:0}}#dw .ti{display:none;margin:0 0 4px;font:800 1.5rem Georgia,serif;color:#F3C762}#dw.rm .ti{display:block}"
+"#dw .b{padding:12px 28px;border:0;border-radius:999px;background:#F3C762;color:#103A27;font:inherit;font-weight:800;cursor:pointer;visibility:hidden;opacity:0;transition:opacity .5s cubic-bezier(.16,1,.3,1),visibility 0s linear .5s,transform .15s cubic-bezier(.16,1,.3,1)}#dw.go .b{visibility:visible;opacity:1;transition-delay:0s}#dw .b:active{transform:scale(.97)}#dw .x{position:absolute;top:10px;right:14px;z-index:3;border:0;background:none;color:#FFF3CC;font-size:30px;line-height:1;cursor:pointer}#dw button:focus-visible{outline:3px solid #fff;outline-offset:3px}"
+"@media(min-width:900px){#dw{padding-bottom:6vh}}@keyframes dwf{from{transform:scale(.92,.9) skewX(-4deg)}to{transform:scale(1.05,1.12) skewX(4deg)}}"
+"@media(prefers-reduced-motion:reduce){#dw *{animation:none!important}#dw .c{transform:none;transition:opacity .3s}}";
function dy(){return '<svg viewBox="0 0 120 90" aria-hidden="true"><defs><radialGradient id="g'+(dy.i=(dy.i||0)+1)+'"><stop offset="0" stop-color="#FFD36B" stop-opacity=".55"/><stop offset="1" stop-color="#FFD36B" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="26" r="40" fill="url(#g'+dy.i+')"/><path d="M8 48Q60 104 112 48Q60 60 8 48Z" fill="#C8691B" stroke="#F3C762" stroke-width="3"/><g class="fl"><path d="M60 46C46 30 55 14 60 2C65 14 74 30 60 46Z" fill="#FFB21F"/><path d="M60 44C53 34 57 24 60 16C63 24 67 34 60 44Z" fill="#FFF3CC"/></g></svg>'}
try{var fk=document.createElement("link");fk.rel="stylesheet";fk.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&display=swap";document.head.appendChild(fk)}catch(e){}
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
var d=document.createElement("div");d.id="dw";d.setAttribute("role","dialog");d.setAttribute("aria-label","Swagramam wishes you a happy Diwali");
d.innerHTML='<canvas></canvas><button class="x" type="button" aria-label="Close">&times;</button><div class="c"><h1 class="ti">Swagramam</h1><div class="ds">'+dy()+dy()+dy()+'</div><h2>Happy Diwali</h2><div class="t">శుభ దీపావళి · शुभ दीपावली</div><p class="w">May your home glow with light, joy and good food. Warm wishes from Team Swagramam.</p><button class="b" type="button">Thank you</button></div>';
function kd(e){if(e.key==="Escape")cl()}
var cd=0;function cl(){if(cd)return;cd=1;d.classList.remove("on");pm.forEach(function(m){try{var q=m.play();q&&q.catch&&q.catch(function(){})}catch(e){}});removeEventListener("keydown",kd);removeEventListener("resize",sz);ug(0);try{AC&&AC.close()}catch(e){}try{pf&&pf.focus&&pf.focus()}catch(e){}setTimeout(function(){d.remove()},500);try{sessionStorage.setItem("swg-dw","1")}catch(e){}}
d.addEventListener("click",function(e){if(e.target.classList.contains("s")){tm();return}if(e.target.tagName==="BUTTON")cl()});
addEventListener("keydown",kd);
var pf=document.activeElement,pm=[];try{[].forEach.call(document.querySelectorAll("audio,video"),function(m){if(!m.paused&&!m.muted&&m.volume>0){m.pause();pm.push(m)}})}catch(e){}
document.body.appendChild(d);requestAnimationFrame(function(){d.classList.add("on")});d.querySelector(".x").focus();
if(rm){d.classList.add("rm","sh","go");setTimeout(cl,8000);return}
var AC=null,mu=false,qd=0,qa=0,bs=1,nb,mg,sb_=null;
function au(){try{AC=new(window.AudioContext||window.webkitAudioContext)();var L=AC.sampleRate*2,b=AC.createBuffer(1,L,AC.sampleRate),a=b.getChannelData(0),i;for(i=0;i<L;i++)a[i]=Math.random()*2-1;nb=b;mg=AC.createGain();mg.gain.value=.9;mg.connect(AC.destination);AC.onstatechange=lb;if(AC.state!=="running")AC.resume().catch(function(){})}catch(e){AC=null}}
function ok(){return AC&&AC.state==="running"&&!mu&&!qd}
function ns(t,du,ty,f0,f1,v){var s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=nb;fl.type=ty;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(f1,t+du);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+du);s.connect(fl);fl.connect(g);g.connect(mg);s.start(t,Math.random()*.5);s.stop(t+du+.05)}
function cr(t0_,n,sp,v){var i;for(i=0;i<n;i++)ns(t0_+Math.random()*sp,.025+Math.random()*.03,"highpass",2500+Math.random()*3000,2600+Math.random()*3000,v*(.4+Math.random()*.6))}
function sW(){if(!ok())return;ns(AC.currentTime,.75,"bandpass",350,2600,.07)}
function sB(){if(!ok())return;var t=AC.currentTime;ns(t,.55,"lowpass",1000,70,.45);ns(t,.12,"highpass",1500,1500,.2);cr(t+.06,9,.7,.14)}
function sT(){if(!ok())return;var t=AC.currentTime;ns(t,.9,"lowpass",900,50,.8);ns(t,.2,"highpass",1200,1200,.3);cr(t+.1,34,1.4,.13)}
function un(){if(!AC)au();else AC.resume().catch(function(){});lb()}
function lb(){sb_.textContent=mu?"\uD83D\uDD07":(AC&&AC.state==="running"?"\uD83D\uDD0A":"\uD83D\uDD07 Tap for sound")}
function tm(){if(!AC||AC.state!=="running"){mu=false;un();return}mu=!mu;lb()}
st.textContent+="#dw .s{position:absolute;top:12px;left:14px;z-index:3;border:1px solid #F3C762;border-radius:999px;background:rgba(8,32,21,.7);color:#FFF3CC;font:600 13px system-ui,sans-serif;padding:6px 12px;cursor:pointer}#dw .s:active{transform:scale(.97)}";
sb_=document.createElement("button");sb_.className="s";sb_.type="button";sb_.setAttribute("aria-label","Toggle sound");d.appendChild(sb_);au();lb();ug(1);document.addEventListener("visibilitychange",function(){if(!AC||qd||cd)return;try{document.hidden?AC.suspend():AC.resume()}catch(e){}});
function gu(){un();ug(0)}
function ug(on){["pointerdown","touchstart","keydown","click"].forEach(function(n){document[on?"addEventListener":"removeEventListener"](n,gu,true)})}
var cv=d.querySelector("canvas"),x=cv.getContext("2d"),W,H,r=Math.min(devicePixelRatio||1,2),P=[],R=[],T=[],FL=[],tt=0,F=0,t0=0,pv=0,nx=0;
if(!x){d.classList.add("sh","go");return}
var C=["#F3C762","#FFB21F","#FF6B8B","#FFF3CC","#7CE0A3","#FF8A3D"];
function sz(){W=cv.width=d.clientWidth*r;H=cv.height=d.clientHeight*r}sz();addEventListener("resize",sz);
function bu(cx,cy,n,c,k){if(P.length>1500)return;sB();var i,a,s,c2=C[Math.random()*6|0];FL.push({x:cx,y:cy,l:1});
for(i=0;i<n;i++){a=i/n*6.283+Math.random()*.2;s=(k==2?4.5*r:(1.6+Math.random()*3.2)*r)*bs;P.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:c,z:2*r,g:(k==1?.07:.04)*r,f:k==1?.98:.985,dc:k==1?.008:.011})}
if(k==0)for(i=0;i<n*.6;i++){a=i/(n*.6)*6.283;s=(.8+Math.random()*.7)*r*bs;P.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:c2,z:1.8*r,g:.04*r,f:.985,dc:.012})}
for(i=0;i<n/2;i++){a=Math.random()*6.283;s=Math.random()*2.2*r*bs;P.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1.3,c:"#FFF3CC",z:1.2*r,g:.02*r,f:.97,dc:.007})}}
function tg(){var o=document.createElement("canvas"),c=o.getContext("2d"),fs,w,q=[],s,i,j,dd;c.font="800 100px Georgia,serif";w=c.measureText("SWAGRAMAM").width;fs=Math.min(100*.9*W/w,H*.14);o.width=W;o.height=Math.ceil(fs*1.4);c=o.getContext("2d");c.font="800 "+fs+"px Georgia,serif";c.textAlign="center";c.textBaseline="middle";c.fillStyle="#fff";c.fillText("SWAGRAMAM",W/2,o.height/2);dd=c.getImageData(0,0,o.width,o.height).data;
for(s=Math.round(2*r);s<40;s++){q=[];for(j=0;j<o.height;j+=s)for(i=0;i<o.width;i+=s)if(dd[(j*o.width+i)*4+3]>128)q.push([i,j+H*.38-o.height/2]);if(q.length<=1100)break}return q}
function lc(f,tf,m){var k=Math.random()*3|0;sW();R.push({x:W*f,y:H+8*r,ty:H*tf,vy:-(H*(1-tf))/72,m:m,k:k,c:k==1?"#F3C762":C[Math.random()*6|0]})}
var EV=[],i0;for(i0=0;i0<9;i0++)EV.push([.1+i0*.17,.08+Math.random()*.84,.16+Math.random()*.34,0]);EV.push([1.8,.5,.38,1]);
var pw=d.querySelector(".w"),TX=pw.textContent,tyS=document.createElement("span"),ca=document.createElement("span"),gh=document.createElement("span"),tn=0,tT=0,dn=0;
pw.setAttribute("aria-label",TX);pw.textContent="";ca.className="ca";gh.className="gh";gh.textContent=TX;[tyS,ca,gh].forEach(function(n){n.setAttribute("aria-hidden","true");pw.appendChild(n)});
function ty_(){if(dn)return;if(!tT)tT=tt;var n=Math.max(0,Math.min(TX.length,Math.floor((tt-tT-.5)*28)));if(n!==tn){tn=n;tyS.textContent=TX.slice(0,n);gh.textContent=TX.slice(n)}if(n>=TX.length){dn=1;ca.remove();d.classList.add("go");setTimeout(cl,5000)}}
function qt(){if(qa&&!qd&&tt>qa){qd=1;sb_.hidden=true;try{mg.gain.setTargetAtTime(0,AC.currentTime,.2)}catch(e){}}}
function lp(t){if(!d.isConnected)return;if(document.hidden){pv=0;requestAnimationFrame(lp);return}if(!t0)t0=t;var k=Math.min((t-(pv||t))/16.7,3),i,j,p,e,q,a,s,f,tw,g,fx;pv=t;tt=(t-t0)/1000;x.clearRect(0,0,W,H);x.globalCompositeOperation="lighter";
while(EV.length&&tt>=EV[0][0]){e=EV.shift();lc(e[1],e[2],e[3])}
if(tt>5&&tt>nx){nx=tt+.5+Math.random()*.6;fx=.08+Math.random()*.84;lc(fx,.07+Math.random()*.13,0);if(Math.random()<.4)lc(.08+Math.random()*.84,.07+Math.random()*.13,0)}
qt();if(tt>4.9){d.classList.add("sh");ty_()}
for(i=R.length-1;i>=0;i--){p=R[i];p.y+=p.vy*k;P.push({x:p.x+(Math.random()-.5)*2*r,y:p.y+4*r,vx:(Math.random()-.5)*.6*r,vy:r,l:1,c:"#FFB21F",z:1.6*r,g:.02*r,f:.92,dc:.05});x.globalAlpha=1;x.fillStyle="#FFF3CC";x.beginPath();x.arc(p.x,p.y,2.6*r,0,6.283);x.fill();
if(p.y<=p.ty){R.splice(i,1);if(p.m){q=tg();for(j=0;j<q.length;j++){a=Math.random()*6.283;s=(2+Math.random()*5)*r;T.push({x:p.x,y:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,tx:q[j][0],ty:q[j][1],c:j%7?"#F3C762":"#FFF3CC",t0:tt,o:Math.random()*6})}sT();bs=.7;qa=tt+1.6;F=.6;FL.push({x:p.x,y:p.y,l:1.2})}else bu(p.x,p.y,56,p.c,p.k)}}
for(i=FL.length-1;i>=0;i--){p=FL[i];p.l-=.06*k;if(p.l<=0){FL.splice(i,1);continue}g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,90*r);g.addColorStop(0,"rgba(255,226,160,"+Math.min(p.l,1)*.35+")");g.addColorStop(1,"rgba(255,226,160,0)");x.globalAlpha=1;x.fillStyle=g;x.fillRect(p.x-90*r,p.y-90*r,180*r,180*r)}
for(i=P.length-1;i>=0;i--){p=P[i];p.x+=p.vx*k;p.y+=p.vy*k;p.vy+=p.g*k;f=Math.pow(p.f,k);p.vx*=f;p.vy*=f;p.l-=p.dc*k;if(p.l<=0){P.splice(i,1);continue}x.globalAlpha=Math.min(p.l,1);x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,p.z,0,6.283);x.fill()}
for(i=0;i<T.length;i++){p=T[i];a=tt-p.t0;if(a<.8){p.x+=p.vx*k;p.y+=p.vy*k;f=Math.pow(.95,k);p.vx*=f;p.vy*=f}else{e=1-Math.pow(.92,k);p.x+=(p.tx-p.x)*e;p.y+=(p.ty-p.y)*e}
tw=.65+.35*Math.sin(tt*5+p.o);x.globalAlpha=tw*Math.min(1,a*3);x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,2.1*r,0,6.283);x.fill();x.globalAlpha*=.18;x.beginPath();x.arc(p.x,p.y,5.5*r,0,6.283);x.fill()}
if(F>0){x.globalAlpha=F*.3;x.fillStyle="#FFE2A0";x.fillRect(0,0,W,H);F-=.04*k}
requestAnimationFrame(lp)}
requestAnimationFrame(lp);
})();
