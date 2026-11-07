(function(){
var nv=document.getElementById("nv");
function centre(){if(!nv)return;var a=nv.querySelector("a.on");if(!a||nv.scrollWidth<=nv.clientWidth)return;nv.scrollLeft=a.offsetLeft-(nv.clientWidth-a.offsetWidth)/2}
if(document.readyState==="complete")centre();else addEventListener("load",centre);
addEventListener("resize",centre);
var bar=document.getElementById("cq-bar");
if(bar&&"IntersectionObserver"in window){
var seen=new Set(),io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)seen.add(e.target);else seen.delete(e.target)});bar.classList.toggle("cq-off",seen.size>0)});
["cq","cta"].forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el)});
var x=document.querySelector(".xcta");if(x)io.observe(x)}
})();
