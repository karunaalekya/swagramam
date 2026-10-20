/* Swagramam Reserve / Order: dine-in reservation or pickup order -> prefilled WhatsApp message.
   Data: order-data.js (generated from the menu JSON in menu.html). Edit CONFIG below for number and hours. */
(function(){
"use strict";
var CONFIG={
 wa:"917659858999",
 // [open, close] in minutes after midnight. Monday lunch closes earlier.
 hours:function(dow){return [[720,dow===1?960:990],[1140,1410]]},
 hoursText:"Lunch 12:00 to 4:30 pm (Mon till 4:00 pm) · Dinner 7:00 to 11:30 pm, every day",
 step:30,          // slot length in minutes
 pickupLead:45,    // minimum minutes before a pickup slot
 dineLead:30,
 maxDays:30,
 maxGuests:30,
 // UPI payment for Take away (merchant QR, amount prefilled). Set upi:null to switch the payment step off.
 upi:{
  id:"pinelabs.stq5137823@pineaxis",   // restaurant UPI ID (Pine Labs)
  name:"RR FRESH FOODS",               // payee name exactly as registered (shown in the customer's UPI app)
  shop:"Swagramam",                    // name shown on our own screen
  mc:"5812",tr:"STQ5137823",           // merchant category (restaurant) and terminal ref from the printed QR
  note:"Swagramam take away",
  img:"assets/upi-qr.webp",            // printed shop QR, shown as a fallback
  counter:true                         // keep the "Pay at pickup instead" link
 }
};
var ASSETS=window.SX_ASSETS||"";   // WordPress theme sets window.SX_ASSETS to the theme URL; the static site leaves it empty
var M=window.SX_MENU;
/* some dishes have a lunch name and a dinner name: {l:"..",d:".."} */
function dishName(it){var n=it&&it.n;if(typeof n==="string")return n;if(n&&typeof n==="object")return n.l&&n.d&&n.l!==n.d?n.l+" / "+n.d:(n.l||n.d||"");return""}
/* ---------- QR code for the UPI payment screen (byte mode, error correction M, versions 1-10) ---------- */
function qrMatrix(text){
 var ECW=[0,10,16,26,18,24,16,18,22,22,26],NB=[0,1,1,1,2,2,4,4,4,5,5],AL=[0,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
 var b=unescape(encodeURIComponent(text)),n=b.length,data=[],i,v,x,y,k;
 for(i=0;i<n;i++)data.push(b.charCodeAt(i));
 function raw(v){var r=(16*v+128)*v+64;if(v>=2){var a=Math.floor(v/7)+2;r-=(25*a-10)*a-55;if(v>=7)r-=36}return r}
 function cap(v){return 8*(Math.floor(raw(v)/8)-ECW[v]*NB[v])}
 for(v=1;v<=10;v++){if(cap(v)>=4+(v<10?8:16)+8*n)break}
 if(v>10)return null;
 var bits=[];function put(val,len){for(var j=len-1;j>=0;j--)bits.push((val>>>j)&1)}
 put(4,4);put(n,v<10?8:16);data.forEach(function(d){put(d,8)});
 put(0,Math.min(4,cap(v)-bits.length));while(bits.length%8)bits.push(0);
 for(var pd=0xEC;bits.length<cap(v);pd^=0xEC^0x11)put(pd,8);
 var cw=[];for(i=0;i<bits.length;i+=8){var q=0;for(k=0;k<8;k++)q=q*2+bits[i+k];cw.push(q)}
 function mul(a,c){var z=0;for(var j=7;j>=0;j--){z=(z<<1)^((z>>>7)*0x11D);z^=((c>>>j)&1)*a}return z}
 function rs(d,deg){var g=[],r=[],root=1,j,m;for(j=0;j<deg-1;j++)g.push(0);g.push(1);
  for(j=0;j<deg;j++){for(m=0;m<g.length;m++){g[m]=mul(g[m],root);if(m+1<g.length)g[m]^=g[m+1]}root=mul(root,2)}
  for(j=0;j<deg;j++)r.push(0);
  d.forEach(function(bt){var f=bt^r.shift();r.push(0);g.forEach(function(c,m2){r[m2]^=mul(c,f)})});return r}
 var nb=NB[v],el=ECW[v],rc=Math.floor(raw(v)/8),ns=nb-rc%nb,sl=Math.floor(rc/nb),blocks=[],k0=0;
 for(i=0;i<nb;i++){var dt=cw.slice(k0,k0+sl-el+(i<ns?0:1));k0+=dt.length;var ec=rs(dt,el);if(i<ns)dt.push(0);blocks.push(dt.concat(ec))}
 var out=[];for(i=0;i<blocks[0].length;i++)blocks.forEach(function(bl,j){if(i!==sl-el||j>=ns)out.push(bl[i])});
 var sz=17+4*v,M=[],F=[];
 for(y=0;y<sz;y++){M.push([]);F.push([]);for(x=0;x<sz;x++){M[y].push(false);F[y].push(false)}}
 function setF(px,py,d){M[py][px]=!!d;F[py][px]=true}
 for(i=0;i<sz;i++){setF(6,i,i%2===0);setF(i,6,i%2===0)}
 function finder(cx,cy){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var d=Math.max(Math.abs(dx),Math.abs(dy)),xx=cx+dx,yy=cy+dy;if(xx>=0&&xx<sz&&yy>=0&&yy<sz)setF(xx,yy,d!==2&&d!==4)}}
 finder(3,3);finder(sz-4,3);finder(3,sz-4);
 var al=AL[v],na=al.length;
 al.forEach(function(a,ia){al.forEach(function(c,ic){if((ia===0&&ic===0)||(ia===0&&ic===na-1)||(ia===na-1&&ic===0))return;
  for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)setF(a+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)})});
 function fmt(mask){var d=mask,r=d,j;for(j=0;j<10;j++)r=(r<<1)^((r>>>9)*0x537);var bt=((d<<10)|r)^0x5412;
  function g(j2){return (bt>>>j2)&1}
  for(j=0;j<=5;j++)setF(8,j,g(j));setF(8,7,g(6));setF(8,8,g(7));setF(7,8,g(8));for(j=9;j<15;j++)setF(14-j,8,g(j));
  for(j=0;j<8;j++)setF(sz-1-j,8,g(j));for(j=8;j<15;j++)setF(8,sz-15+j,g(j));setF(8,sz-8,1)}
 fmt(0);
 if(v>=7){var r7=v;for(i=0;i<12;i++)r7=(r7<<1)^((r7>>>11)*0x1F25);var vb=(v<<12)|r7;
  for(i=0;i<18;i++){var a2=sz-11+i%3,b2=Math.floor(i/3),c2=(vb>>>i)&1;setF(a2,b2,c2);setF(b2,a2,c2)}}
 var bi=0;
 for(var right=sz-1;right>=1;right-=2){if(right===6)right=5;
  for(var vert=0;vert<sz;vert++)for(var j=0;j<2;j++){x=right-j;y=((right+1)&2)===0?sz-1-vert:vert;
   if(!F[y][x]&&bi<out.length*8){M[y][x]=((out[bi>>>3]>>>(7-(bi&7)))&1)===1;bi++}}}
 function mk(m){for(y=0;y<sz;y++)for(x=0;x<sz;x++){var inv;
  switch(m){case 0:inv=(x+y)%2===0;break;case 1:inv=y%2===0;break;case 2:inv=x%3===0;break;case 3:inv=(x+y)%3===0;break;
   case 4:inv=(Math.floor(x/3)+Math.floor(y/2))%2===0;break;case 5:inv=x*y%2+x*y%3===0;break;
   case 6:inv=(x*y%2+x*y%3)%2===0;break;default:inv=((x+y)%2+x*y%3)%2===0}
  if(inv&&!F[y][x])M[y][x]=!M[y][x]}}
 function pen(){var p=0,t=sz*sz,dark=0,r,c,run,dir;
  function at(d,a,b){return d?M[b][a]:M[a][b]}
  for(dir=0;dir<2;dir++)for(r=0;r<sz;r++){run=1;
   for(c=1;c<=sz;c++){if(c<sz&&at(dir,r,c)===at(dir,r,c-1))run++;else{if(run>=5)p+=run-2;run=1}}
   for(c=0;c+11<=sz;c++){var s1="",s2="",q;for(q=0;q<11;q++){s1+=at(dir,r,c+q)?1:0}
    if(s1==="10111010000"||s1==="00001011101")p+=40}}
  for(r=0;r<sz;r++)for(c=0;c<sz;c++){if(M[r][c])dark++;
   if(r<sz-1&&c<sz-1&&M[r][c]===M[r][c+1]&&M[r][c]===M[r+1][c]&&M[r][c]===M[r+1][c+1])p+=3}
  return p+(Math.ceil(Math.abs(dark*20-t*10)/t)-1)*10}
 var best=0,bp=1e9;
 for(var m=0;m<8;m++){mk(m);fmt(m);var pp=pen();if(pp<bp){bp=pp;best=m}mk(m)}
 mk(best);fmt(best);
 return M;
}
function qrSvg(text,label){
 var M=qrMatrix(text);if(!M)return "";
 var sz=M.length,pad=3,d="",y,x,s;
 for(y=0;y<sz;y++){x=0;while(x<sz){if(M[y][x]){s=x;while(x<sz&&M[y][x])x++;d+="M"+(s+pad)+" "+(y+pad)+"h"+(x-s)+"v1h-"+(x-s)+"z"}else x++}}
 var t=sz+pad*2;
 return '<svg viewBox="0 0 '+t+" "+t+'" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="'+(label||"QR code")+'"><rect width="'+t+'" height="'+t+'" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';
}

var S={mode:"dine",cart:{},cat:"all",q:""};
var pill;
function loadCart(){try{var c=JSON.parse(store("cart")||"{}");Object.keys(c).forEach(function(k){var a=k.split("|"),it=M&&M.items[+a[0]];var q=Math.floor(+c[k]);if(it&&q>0&&(a[1]===""||(it.o&&it.o[+a[1]])))S.cart[k]=Math.min(20,q)})}catch(e){}}
function save(){
 store("cart",JSON.stringify(S.cart));
 var c=cartTotal();
 if(pill){if(c.n>(save.n||0)){pill.classList.remove("bump");void pill.offsetWidth;pill.classList.add("bump")}save.n=c.n;pill.hidden=!c.n;pill.querySelector("[data-pn]").textContent=c.n+(c.n===1?" dish":" dishes")+" · "+rs(c.t)}
 try{document.dispatchEvent(new CustomEvent("sxcart"))}catch(e){}
}
function qtyOf(id,opt){return S.cart[lineKey(id,opt)]||0}
function qtyAll(id){var n=0;Object.keys(S.cart).forEach(function(k){if(+k.split("|")[0]===id)n+=S.cart[k]});return n}
function fly(from){
 if(!from||!pill||!from.getBoundingClientRect||!Element.prototype.animate||matchMedia("(prefers-reduced-motion:reduce)").matches)return 0;
 var img=from.tagName==="IMG"?from:from.querySelector&&from.querySelector("img"),a=from.getBoundingClientRect();
 if(!a.width)return 0;
 var b=pill.getBoundingClientRect(),n=el("div","sxfly");n.setAttribute("aria-hidden","true");
 if(img&&(img.currentSrc||img.src))n.style.backgroundImage='url("'+(img.currentSrc||img.src)+'")';
 document.body.appendChild(n);
 var x0=a.left+a.width/2,y0=a.top+a.height/2,x1=b.left+46,y1=b.top+b.height/2,mx=(x0+x1)/2,my=Math.min(y0,y1)-70;
 var an=n.animate([{transform:"translate("+x0+"px,"+y0+"px) scale(1)",opacity:1},{transform:"translate("+mx+"px,"+my+"px) scale(.8)",opacity:1,offset:.45},{transform:"translate("+x1+"px,"+y1+"px) scale(.25)",opacity:.35}],{duration:640,easing:"cubic-bezier(.45,.05,.55,.95)"});
 an.onfinish=an.oncancel=function(){n.remove()};return 600;
}
function change(id,opt,d,from){var k=lineKey(id,opt),q=Math.max(0,Math.min(20,(S.cart[k]||0)+d));if(q)S.cart[k]=q;else delete S.cart[k];save.hold=0;save();if(d>0&&from){var h=fly(from);if(h){pill.classList.remove("bump");setTimeout(function(){pill.classList.remove("bump");void pill.offsetWidth;pill.classList.add("bump")},h)}}if(root&&!root.hidden){renderMenu();updateSum()}}
function mkPill(){
 pill=el("button","sxcart");pill.type="button";pill.id="sxcart";pill.hidden=true;
 pill.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2H1z"/></svg><span><b>Review order</b><small data-pn></small></span><i aria-hidden="true">&rsaquo;</i>';
 pill.addEventListener("click",function(){open(S.mode)});
 function lift(){var k=document.getElementById("ckb");pill.style.marginBottom=(k&&!k.hidden?k.offsetHeight+8:0)+"px"}
 lift();window.addEventListener("resize",lift);document.addEventListener("click",function(){setTimeout(lift,60)});
 document.body.appendChild(pill);save();
}
var root,lastFocus;

function $(s,r){return (r||root).querySelector(s)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function pad(n){return n<10?"0"+n:""+n}
function fmt12(m){var h=Math.floor(m/60),mm=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+":"+pad(mm)+" "+ap}
function rs(n){return "₹"+n.toLocaleString("en-IN")}
function store(k,v){try{if(v===undefined)return localStorage.getItem("sx_"+k);localStorage.setItem("sx_"+k,v)}catch(e){return null}}

/* ---------- time slots ---------- */
function todayStr(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function addDays(n){var d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function slotsFor(dateStr){
 var p=dateStr.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]),dow=d.getDay(),out=[];
 var now=new Date(),isToday=dateStr===todayStr(),lead=S.mode==="pickup"?CONFIG.pickupLead:CONFIG.dineLead;
 var nowM=now.getHours()*60+now.getMinutes()+lead;
 CONFIG.hours(dow).forEach(function(r){
  for(var t=r[0];t<=r[1]-CONFIG.step;t+=CONFIG.step){if(!isToday||t>=nowM)out.push(t)}
 });
 return out;
}
function mealOf(t){return t<1020?"l":"d"}   // before 5 pm = lunch menu

/* ---------- menu helpers ---------- */
function itemsFor(meal){
 return M.items.map(function(it,i){it.id=i;return it}).filter(function(it){
  return !meal||it.m==="ld"||it.m===meal;
 });
}
function lineKey(id,opt){return id+"|"+(opt==null?"":opt)}
function lineInfo(k){
 var a=k.split("|"),it=M.items[+a[0]],opt=a[1]===""?null:+a[1];
 var price=it.o?(it.o[opt==null?0:opt][1]):it.p;
 var name=dishName(it)+(it.o?" ("+it.o[opt==null?0:opt][0]+")":"");
 return {it:it,name:name,price:price};
}
function cartTotal(){var t=0,n=0;Object.keys(S.cart).forEach(function(k){var q=S.cart[k],li=lineInfo(k);t+=q*(li.price||0);n+=q});return {t:t,n:n}}

/* ---------- build modal ---------- */
function build(){
 root=el("div","ord");root.id="ord";root.hidden=true;
 root.innerHTML=
 '<div class="ord-bg" data-close></div>'+
 '<div class="ord-box" role="dialog" aria-modal="true" aria-labelledby="ord-h" tabindex="-1">'+
 '<div class="ord-grab" aria-hidden="true"></div><div class="ord-hd"><div><h2 id="ord-h">Reserve or order</h2><p class="ord-sub">We will confirm on WhatsApp.</p></div><button type="button" class="ord-x" data-close aria-label="Close">&times;</button></div>'+
 '<div class="ord-tabs" role="tablist" aria-label="Choose how you want to visit">'+
 '<button type="button" role="tab" id="ord-t-dine" data-mode="dine" aria-selected="true"><b>Dine in</b><small>Reserve a table</small></button>'+
 '<button type="button" role="tab" id="ord-t-pickup" data-mode="pickup" aria-selected="false"><b>Take away</b><small>Order ahead</small></button></div>'+
 '<form class="ord-form" novalidate><div class="ord-scroll">'+
 '<section class="ord-cart" aria-labelledby="ord-ch" hidden><h3 id="ord-ch">Your order</h3><ul class="ord-lines"></ul></section>'+
 '<div class="ord-grid">'+
 '<label class="f"><span>Your name *</span><input name="name" autocomplete="name" required maxlength="60"></label>'+
 '<label class="f"><span>Mobile number *</span><input name="mobile" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="10-digit number" required maxlength="18"></label>'+
 '<label class="f full"><span>Email</span><input name="email" type="email" autocomplete="email" placeholder="name@example.com" maxlength="80"></label>'+
 '<label class="f"><span data-l="date">Date *</span><input name="date" type="date" required></label>'+
 '<label class="f"><span data-l="time">Time *</span><select name="time" required></select></label>'+
 '<div class="f full guests" data-only="dine"><span>Guests *</span><div class="stp"><button type="button" data-g="-1" aria-label="Fewer guests">&minus;</button><output name="guests" aria-live="polite">2</output><button type="button" data-g="1" aria-label="More guests">+</button></div></div>'+
 '<label class="f full" data-only="dine"><span>Occasion or request (optional)</span><input name="occ" maxlength="120" placeholder="Birthday, high chair, window seat"></label>'+
 '</div>'+
 '<p class="ord-hrs"><b>Restaurant timings:</b> '+CONFIG.hoursText+'. Times shown are restaurant timings only.</p>'+
 '<section class="ord-menu" aria-labelledby="ord-mh"><div class="ord-mt"><h3 id="ord-mh"></h3><span class="ord-mn" data-meal></span></div>'+
 '<div class="ord-tools"><input type="search" class="ord-q" placeholder="Search dishes" aria-label="Search dishes"><div class="ord-chips" role="group" aria-label="Filter by course"></div></div>'+
 '<ul class="ord-list"></ul></section>'+
 '<label class="f full"><span>Message to the restaurant (optional)</span><textarea name="note" rows="2" maxlength="300" placeholder="Spice level, allergies, anything we should know"></textarea></label>'+
 '</div>'+
 '<div class="ord-ft"><div class="ord-sum" aria-live="polite"><b data-n>No dishes selected</b><span data-t></span><button type="button" class="ord-clr" data-clear hidden>Clear</button></div>'+
 '<p class="ord-err" role="alert" hidden></p>'+
 '<button type="submit" class="ord-go"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.4-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2z"/></svg><span data-go>Send on WhatsApp</span></button>'+
 '<p class="ord-fn">Opens WhatsApp with your details and dishes filled in. Nothing is sent until you press send there.</p></div></form>'+
 '<div class="ord-pay" hidden><div class="ord-scroll">'+
 '<div class="op-amt"><small>Amount to pay</small><b data-pamt></b></div>'+
 '<ol class="op-steps"><li>Pay in your UPI app</li><li>Come back and tap <b>I have paid</b></li><li>Press <b>Send</b> in WhatsApp</li></ol>'+
 '<div class="op-apps" data-papps></div>'+
 '<figure class="op-qr"><div class="op-qrb" data-pqr></div><figcaption>Scan with GPay, PhonePe, Paytm or any UPI app</figcaption></figure>'+
 '<div class="op-id"><span>UPI ID</span><code data-pid></code><button type="button" data-copy>Copy</button></div>'+
 '<p class="op-who">Your UPI app will show the payee as <b data-pwho></b>.</p>'+
 '<details class="op-alt"><summary>QR not scanning? Use the shop QR</summary><img data-pimg alt="Swagramam UPI QR code" width="240" height="337" loading="lazy"><p>Enter the amount yourself: <b data-pamt2></b></p></details>'+
 '<p class="op-note">Pay the exact amount and keep your UPI transaction ID or a screenshot. We check the payment before preparing your order.</p>'+
 '</div><div class="ord-ft"><button type="button" class="ord-go" data-paid><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.4-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2z"/></svg><span>I have paid, send order on WhatsApp</span></button>'+
 '<div class="op-sec"><button type="button" data-payback>&larr; Back to order</button><button type="button" data-paycounter>Pay at pickup instead</button></div></div></div>'+
 '<div class="ord-done" hidden><div class="ord-ck"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg></div><h3 data-dt></h3><p data-dp></p><div class="ord-da"><button type="button" class="ord-again" data-again>Open WhatsApp again</button><button type="button" class="ord-fin" data-fin>Done</button></div></div></div>';
 document.body.appendChild(root);

 var f=$(".ord-form");
 f.elements.date.min=todayStr();f.elements.date.max=addDays(CONFIG.maxDays);
 // events
 root.addEventListener("click",function(e){
  if(e.target.closest("[data-close]")){close();return}
  var t=e.target.closest("button[data-mode]");if(t){setMode(t.getAttribute("data-mode"));return}
  if(e.target.closest("[data-clear]")){S.cart={};renderMenu();updateSum();return}
  var ln=e.target.closest("[data-ln]");if(ln){var kk=ln.getAttribute("data-k"),a=kk.split("|");change(+a[0],a[1]===""?null:+a[1],ln.getAttribute("data-ln")==="+"?1:-1);return}
  if(e.target.closest("[data-again]")){if(S.lastUrl){var w2=window.open(S.lastUrl,"_blank","noopener");if(!w2)location.href=S.lastUrl}return}
  if(e.target.closest("[data-payback]")){hidePay();return}
  if(e.target.closest("[data-paid]")){submit("upi");return}
  if(e.target.closest("[data-paycounter]")){submit("counter");return}
  if(e.target.closest("[data-copy]")){copyUpi(e.target.closest("[data-copy]"));return}
  if(e.target.closest("[data-fin]")){S.cart={};save();updateSum();close();return}
  var g=e.target.closest("[data-g]");if(g){var o=f.elements.guests,v=Math.max(1,Math.min(CONFIG.maxGuests,(+o.value||2)+ +g.getAttribute("data-g")));o.value=v;return}
 });
 document.addEventListener("keydown",function(e){
  if(root.hidden)return;
  if(e.key==="Escape"){close();return}
  if(e.key==="Tab"){var n=[].slice.call(root.querySelectorAll("button,input,select,textarea,a[href]")).filter(function(x){return !x.disabled&&x.offsetParent!==null});
   if(!n.length)return;var a=n[0],b=n[n.length-1];
   if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}}
 });
 f.elements.date.addEventListener("change",function(){fillTimes();renderMenu()});
 f.elements.time.addEventListener("change",function(){renderMenu(true)});
 $(".ord-q").addEventListener("input",function(e){S.q=e.target.value.trim().toLowerCase();renderMenu()});
 f.addEventListener("submit",function(e){e.preventDefault();submit()});
 (function(){var hd=$(".ord-hd"),bx=$(".ord-box"),y0=null,dy=0;
  hd.addEventListener("touchstart",function(e){y0=e.touches[0].clientY;dy=0;bx.style.transition="none"},{passive:true});
  hd.addEventListener("touchmove",function(e){if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);bx.style.transform="translateY("+dy+"px)"},{passive:true});
  hd.addEventListener("touchend",function(){if(y0==null)return;y0=null;bx.style.transition="";if(dy>90){close()}else{bx.style.transform=""}dy=0});
 })();
 f.addEventListener("input",function(){hideErr()});
 // restore saved contact
 ["name","mobile","email"].forEach(function(k){var v=store(k);if(v)f.elements[k].value=v});
}

/* ---------- mode, times, menu render ---------- */
function setMode(m){
 S.mode=m;root.setAttribute("data-mode",m);
 [].forEach.call(root.querySelectorAll("[data-mode]"),function(b){b.setAttribute("aria-selected",b.getAttribute("data-mode")===m?"true":"false")});
 var dine=m==="dine";
 [].forEach.call(root.querySelectorAll("[data-only=dine]"),function(x){x.hidden=!dine});
 $("[data-l=date]").textContent=dine?"Date *":"Take away date *";
 $("[data-l=time]").textContent=dine?"Time *":"Take away time *";
 $("#ord-mh").textContent=dine?"Pre-order dishes (optional)":"Choose your dishes *";
 hidePay();root.classList.toggle("pay-on",payOn());
 $("[data-go]").textContent=dine?"Reserve on WhatsApp":(payOn()?"Continue to pay by UPI":"Send order on WhatsApp");
 $(".ord-sub").textContent=dine?"Tell us when you are coming. We will confirm on WhatsApp.":(payOn()?"Order ahead, pay by UPI and collect from the restaurant. We confirm on WhatsApp after checking payment.":"Order ahead and collect from the restaurant. We will confirm on WhatsApp.");
 fillTimes();renderMenu();updateSum();hideErr();
}
function fillTimes(){
 var f=$(".ord-form"),sel=f.elements.time,cur=sel.value,d=f.elements.date.value||todayStr();
 sel.innerHTML="";
 var o=el("option","", "Select a time");o.value="";sel.appendChild(o);
 var s=slotsFor(d);
 if(!s.length){var n=el("option","","No slots left for this date");n.value="";sel.appendChild(n)}
 var group;
 s.forEach(function(t){
  var lab=t<1020?"Lunch":"Dinner";
  if(!group||group.label!==lab){group=document.createElement("optgroup");group.label=lab;sel.appendChild(group)}
  var op=el("option","",fmt12(t));op.value=t;group.appendChild(op);
 });
 if(cur&&sel.querySelector('option[value="'+cur+'"]'))sel.value=cur;
}
function currentMeal(){var v=$(".ord-form").elements.time.value;return v?mealOf(+v):null}
function renderMenu(prune){
 var meal=currentMeal(),list=itemsFor(meal),f=$(".ord-form");
 $("[data-meal]").textContent=meal?(meal==="l"?"Lunch menu":"Dinner menu"):"All dishes";
 if(prune){ // drop dishes not served at the chosen time
  var gone=[];Object.keys(S.cart).forEach(function(k){var it=M.items[+k.split("|")[0]];if(meal&&!(it.m==="ld"||it.m===meal)){gone.push(dishName(it));delete S.cart[k]}});
  if(gone.length){showErr("Removed (not served at this time): "+gone.join(", "),true);save()}
 }
 // chips
 var chips=$(".ord-chips");chips.innerHTML="";
 var cs=["all"].concat(M.order[meal||"l"].concat(M.order.d).filter(function(c,i,a){return a.indexOf(c)===i}));
 cs.forEach(function(c){
  var b=el("button","chip"+(S.cat===c?" on":""),c==="all"?"All":M.cats[c]);b.type="button";b.setAttribute("aria-pressed",S.cat===c);
  b.onclick=function(){S.cat=c;renderMenu()};chips.appendChild(b);
 });
 var ul=$(".ord-list");ul.innerHTML="";shownIdx=0;
 var shown=0;
 list.forEach(function(it){
  if(S.cat!=="all"&&it.c!==S.cat)return;
  if(S.q&&dishName(it).toLowerCase().indexOf(S.q)<0)return;
  shown++;ul.appendChild(row(it));
 });
 if(!shown){var li=el("li","none","No dishes match.");ul.appendChild(li)}
}
var shownIdx=0;
function row(it){
 var li=el("li","dish"+(it.i?" has-ph":""));li.style.setProperty("--k",Math.min(shownIdx++,12));
 var dot=el("i","dt "+(it.t==="v"?"v":"n"));dot.setAttribute("role","img");dot.setAttribute("aria-label",it.t==="v"?"Vegetarian":it.t==="e"?"Egg":"Non-vegetarian");
 var nm=el("div","dn");nm.appendChild(el("b","",dishName(it)));
 var opt=null;
 if(it.o){
  var sel=document.createElement("select");sel.setAttribute("aria-label","Choose option for "+dishName(it));
  it.o.forEach(function(o,i){var op=el("option","",o[0]+" · "+rs(o[1]));op.value=i;sel.appendChild(op)});
  opt=sel;nm.appendChild(sel);
  // preselect the option that is already in the cart
  for(var i=0;i<it.o.length;i++){if(S.cart[lineKey(it.id,i)]){sel.value=i;break}}
 }else if(it.p!=null){nm.appendChild(el("small","",rs(it.p)))}
 var qty=el("div","stp sm");
 var minus=el("button","","−");minus.type="button";
 var out=el("output","","0");var plus=el("button","","+");plus.type="button";
 function key(){return lineKey(it.id,opt?+opt.value:null)}
 function sync(){var q=S.cart[key()]||0;if(out.textContent!=String(q)){out.classList.remove("pop");void out.offsetWidth;out.classList.add("pop")}out.value=q;out.textContent=q;plus.textContent=q?"+":"Add";li.classList.toggle("sel",q>0);minus.disabled=q===0;minus.setAttribute("aria-label","Remove one "+it.n);plus.setAttribute("aria-label","Add one "+it.n)}
 minus.onclick=function(){var k=key(),q=(S.cart[k]||0)-1;if(q<=0)delete S.cart[k];else S.cart[k]=q;sync();updateSum()};
 plus.onclick=function(){var k=key();S.cart[k]=Math.min(20,(S.cart[k]||0)+1);sync();updateSum()};
 if(opt)opt.onchange=sync;
 qty.appendChild(minus);qty.appendChild(out);qty.appendChild(plus);
 li.appendChild(dot);
 if(it.i){var th=el("span","dph");th.innerHTML='<img src="'+ASSETS+'assets/dishes/'+it.i+'-t.webp" alt="" width="56" height="56" loading="lazy">';li.appendChild(th)}
 li.appendChild(nm);li.appendChild(qty);sync();return li;
}
function renderCart(){
 var box=$(".ord-cart");if(!box)return;var ks=Object.keys(S.cart),ul=$(".ord-lines");
 box.hidden=!ks.length;ul.innerHTML="";
 ks.forEach(function(k){
  var li=lineInfo(k),q=S.cart[k],r=el("li","ln");
  var ph=li.it.i?'<img src="'+ASSETS+'assets/dishes/'+li.it.i+'-t.webp" alt="" width="44" height="44" loading="lazy">':'<i class="ln-ph" aria-hidden="true"></i>';
  r.innerHTML=ph+'<span class="ln-n"><b></b><small></small></span><span class="stp sm"><button type="button" data-ln="-" data-k="'+k+'" aria-label="Remove one">&minus;</button><output>'+q+'</output><button type="button" data-ln="+" data-k="'+k+'" aria-label="Add one">+</button></span>';
  r.querySelector("b").textContent=li.name;r.querySelector("small").textContent=rs(li.price*q);
  ul.appendChild(r);
 });
}
function tween(node,to,pre){
 var from=+node.getAttribute("data-v")||0;node.setAttribute("data-v",to);
 if(!to){node.textContent="";return}
 if(from===to||matchMedia("(prefers-reduced-motion:reduce)").matches){node.textContent=pre+rs(to);return}
 var t0=performance.now(),d=380;
 (function f(t){var p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,3);node.textContent=pre+rs(Math.round(from+(to-from)*e));if(p<1)requestAnimationFrame(f)})(t0);
 node.classList.remove("flash");void node.offsetWidth;node.classList.add("flash");
}
function updateSum(){
 var c=cartTotal();save();renderCart();
 $("[data-n]").textContent=c.n?c.n+(c.n===1?" dish selected":" dishes selected"):"No dishes selected";
 tween($("[data-t]"),c.t,"Estimated ");
 var cb=$("[data-clear]");if(cb)cb.hidden=!c.n;
}

/* ---------- validation + WhatsApp ---------- */
function showErr(m,soft){var e=$(".ord-err");e.textContent=m;e.hidden=false;e.classList.toggle("soft",!!soft)}
function hideErr(){var e=$(".ord-err");e.hidden=true}
function submit(pay){
 var f=$(".ord-form"),v=function(n){return (f.elements[n].value||"").trim()};
 var name=v("name"),mob=v("mobile").replace(/[\s\-()]/g,"").replace(/^(\+?91|0)(?=\d{10}$)/,""),email=v("email"),date=v("date"),time=v("time");
 if(!name){showErr("Please enter your name.");f.elements.name.focus();return}
 if(!/^[6-9]\d{9}$/.test(mob)){showErr("Please enter a valid 10-digit mobile number.");f.elements.mobile.focus();return}
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showErr("That email address does not look right.");f.elements.email.focus();return}
 if(!date){showErr("Please choose a date.");f.elements.date.focus();return}
 if(!time){showErr("Please choose a time within restaurant timings.");f.elements.time.focus();return}
 var c=cartTotal();
 if(S.mode==="pickup"&&!c.n){showErr("Please choose at least one dish for take away.");$(".ord-menu").scrollIntoView({behavior:"smooth",block:"start"});return}
 store("name",name);store("mobile",mob);store("email",email);
 if(S.mode==="pickup"&&!pay&&payOn(c)){showPay(c);return}
 var p=date.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]);
 var dateTxt=d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 var L=[];
 L.push("Namaste Swagramam \uD83D\uDE4F I would like to "+(S.mode==="dine"?"reserve a table.":"place a take away order."));
 L.push("");
 L.push("*"+(S.mode==="dine"?"Dine-in reservation":"Take away order")+"*");
 L.push("Name: "+name);
 L.push("Mobile: +91 "+mob);
 if(email)L.push("Email: "+email);
 L.push((S.mode==="dine"?"Date: ":"Take away date: ")+dateTxt);
 L.push((S.mode==="dine"?"Time: ":"Take away time: ")+fmt12(+time));
 if(S.mode==="dine")L.push("Guests: "+f.elements.guests.value);
 if(S.mode==="dine"&&v("occ"))L.push("Occasion/request: "+v("occ"));
 if(c.n){
  L.push("");L.push("*Selected dishes*");
  var i=0;Object.keys(S.cart).forEach(function(k){
   var li=lineInfo(k),q=S.cart[k];i++;
   L.push(i+". "+li.name+" x "+q+(li.price?" = "+rs(li.price*q):""));
  });
  L.push("Estimated total: "+rs(c.t));
 }
 var upiOn=S.mode==="pickup"&&pay==="upi"&&payOn(c);
 if(S.mode==="pickup"&&payOn()){
  L.push("");L.push("*Payment*");
  if(upiOn){L.push("Payment: UPI, awaiting confirmation");L.push("Amount paid: "+rs(c.t));L.push("Paid to: "+CONFIG.upi.id);L.push("Please reply with your UPI transaction ID or attach the payment screenshot.")}
  else L.push("Payment: pay at pickup");
 }else if(S.mode==="dine"&&!c.n){L.push("");L.push("Dishes: to be decided at the restaurant.")}
 if(v("note")){L.push("");L.push("Note: "+v("note"))}
 L.push("");L.push(upiOn?"Please confirm after checking the payment. Thank you!":"Please confirm. Thank you!");
 var url="https://wa.me/"+CONFIG.wa+"?text="+encodeURIComponent(L.join("\n"));
 S.lastUrl=url;
 var w=window.open(url,"_blank","noopener");
 if(!w){location.href=url;return}
 $("[data-dt]").textContent=S.mode==="dine"?"Reservation request ready":"Order request ready";
 $("[data-dp]").textContent="WhatsApp is opening with your details"+(c.n?" and "+c.n+(c.n===1?" dish":" dishes"):"")+". Press Send there to confirm. "+(upiOn?"We will confirm your order once we see your payment.":"We will reply to you on WhatsApp.");
 hidePay(true);$(".ord-done").hidden=false;
}

/* ---------- UPI payment step (Take away) ---------- */
function payOn(c){var u=CONFIG.upi;return !!(u&&u.id)&&(c?c.t>0:true)}
function upiUrl(amt,scheme){
 var u=CONFIG.upi,e=function(x){return encodeURIComponent(x).replace(/%40/g,"@")};
 return (scheme||"upi://pay")+"?pa="+e(u.id)+"&pn="+encodeURIComponent(u.name)+(u.mc?"&mc="+u.mc:"")+(u.tr?"&tr="+u.tr:"")+"&am="+amt.toFixed(2)+"&cu=INR&tn="+encodeURIComponent(u.note||"Swagramam order");
}
function isIOS(){return /iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
function isTouch(){return matchMedia("(pointer:coarse)").matches}
function showPay(c){
 var u=CONFIG.upi,url=upiUrl(c.t),pay=$(".ord-pay");
 $("[data-pamt]").textContent=rs(c.t);$("[data-pamt2]").textContent=rs(c.t);
 $("[data-pqr]").innerHTML=qrSvg(url,"UPI payment QR code for "+rs(c.t));
 $("[data-pid]").textContent=u.id;$("[data-pwho]").textContent=u.name+" ("+u.shop+")";
 var im=$("[data-pimg]");if(u.img){im.src=ASSETS+u.img;im.parentNode.hidden=false}else im.parentNode.hidden=true;
 var ap=$("[data-papps]");ap.innerHTML="";
 if(isTouch()){
  var mk=function(label,href,cls){var a=el("a","op-pay"+(cls?" "+cls:""),label);a.href=href;a.rel="noopener";ap.appendChild(a)};
  if(isIOS()){mk("Pay "+rs(c.t)+" with GPay",upiUrl(c.t,"tez://upi/pay"));mk("PhonePe",upiUrl(c.t,"phonepe://pay"),"alt");mk("Paytm",upiUrl(c.t,"paytmmp://pay"),"alt")}
  else mk("Pay "+rs(c.t)+" with UPI app",url);
  ap.hidden=false;pay.classList.add("touch");
 }else{ap.hidden=true;pay.classList.remove("touch")}
 $("[data-paycounter]").hidden=!u.counter;
 $("[data-copy]").textContent="Copy";
 $(".ord-form").hidden=true;pay.hidden=false;hideErr();
 $(".ord-sub").textContent="Pay by UPI first. Then send your order on WhatsApp.";
 pay.querySelector(".ord-scroll").scrollTop=0;
}
function hidePay(keep){
 var pay=$(".ord-pay");if(!pay)return;
 pay.hidden=true;
 if(!keep){$(".ord-form").hidden=false;if(S.mode==="pickup"&&payOn())$(".ord-sub").textContent="Order ahead, pay by UPI and collect from the restaurant. We confirm on WhatsApp after checking payment."}
}
function copyUpi(btn){
 var t=CONFIG.upi.id,ok=function(){btn.textContent="Copied";setTimeout(function(){btn.textContent="Copy"},1800)};
 function fb(){try{var ta=document.createElement("textarea");ta.value=t;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();ok()}catch(e){btn.textContent="Select and copy"}}
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,fb)}else fb();
}

/* ---------- open / close ---------- */
function open(mode,opts){
 if(!root)build();
 lastFocus=document.activeElement;
 root.hidden=false;document.documentElement.classList.add("ord-open");$(".ord-done").hidden=true;$(".ord-box").style.transform="";hidePay();
 var f=$(".ord-form");if(!f.elements.date.value)f.elements.date.value=todayStr();
 setMode(mode||S.mode);
 if(opts&&opts.q!=null){S.q=String(opts.q).toLowerCase();S.cat="all";$(".ord-q").value=opts.q;renderMenu()}
 requestAnimationFrame(function(){root.classList.add("on");var b=$(".ord-box");b.focus();f.elements.name.value?f.elements.date.focus():f.elements.name.focus()});
}
function close(){
 if(!root||root.hidden)return;
 root.classList.remove("on");document.documentElement.classList.remove("ord-open");
 setTimeout(function(){root.hidden=true},200);
 if(lastFocus&&lastFocus.focus)lastFocus.focus();
}
window.SXOrder={open:open,close:close,qty:qtyOf,qtyAll:qtyAll,change:change};
loadCart();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mkPill);else mkPill();

// triggers: header/CTA/bottom-bar booking buttons (not the general chat button)
document.addEventListener("click",function(e){
 var a=e.target.closest("a,button");if(!a)return;
 var mode=a.getAttribute("data-order");
 var isBook=a.matches(".btn.bk,#v10bar a.p,a[data-order]")||(a.tagName==="A"&&/wa\.me\/\d+\?text=[^"]*reserve/i.test(a.getAttribute("href")||"")&&!a.closest(".fab"));
 if(!isBook)return;
 if(e.metaKey||e.ctrlKey||e.shiftKey)return;
 e.preventDefault();open(mode==="pickup"?"pickup":"dine");
});
})();
