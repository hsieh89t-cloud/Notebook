// fullfix3: 強制浮動 ↻ + 書籤恢復
const BASE=window.__CONFIG__.BASE_URL;
function $(id){return document.getElementById(id)}
function on(el,ev,fn){if(el)el.addEventListener(ev,fn)}
let cacheList=[],lastQuery={q:"",tag:"",cat:""};
// refresh button浮動
(function(){
 const b=document.createElement('button');b.id='refreshBtnFloat';b.textContent='↻';b.title='立即更新快取';
 b.onclick=async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));if(navigator.serviceWorker?.controller){navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'});}location.reload(true);};
 document.body.appendChild(b);
})();
// 書籤FAB
let bookmarkY=null;on($('bookmarkBtn'),'click',e=>{e.preventDefault();if(bookmarkY==null){bookmarkY=window.scrollY;toast('已設書籤');}else{window.scrollTo({top:bookmarkY,behavior:'smooth'});bookmarkY=null;}});
function toast(m){const t=document.createElement('div');t.textContent=m;Object.assign(t.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'6px 12px',borderRadius:'6px',zIndex:9999});document.body.appendChild(t);setTimeout(()=>t.remove(),1500);}
// TODO: 加上你的 listNotebook, showNote 等函式 (保留前版的)
