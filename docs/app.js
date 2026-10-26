import { sample, apiKey } from "./api.js";

const $ = s => document.querySelector(s);
const el = (tag, props = {}, kids = []) => { const n = document.createElement(tag); Object.assign(n, props); for (const k of [].concat(kids)) if (k != null) n.append(k); return n; };
const store = {
  get(k, d) { try { const v = localStorage.getItem("gbk." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gbk." + k, JSON.stringify(v)); } catch {} }
};

/* ---------- Voorbeelddata ---------- */
const SAMPLE_ITEMS = [
  {naam:"Spinazie",hoeveelheid:"300 g",houdbaar:"kort"},
  {naam:"Paksoi",hoeveelheid:"2 stuks",houdbaar:"kort"},
  {naam:"Champignons",hoeveelheid:"250 g",houdbaar:"kort"},
  {naam:"Peterselie",hoeveelheid:"1 bos",houdbaar:"kort"},
  {naam:"Prei",hoeveelheid:"2 stuks",houdbaar:"middel"},
  {naam:"Wortel",hoeveelheid:"500 g",houdbaar:"lang"},
  {naam:"Rode biet",hoeveelheid:"4 stuks",houdbaar:"lang"},
  {naam:"Appels",hoeveelheid:"4 stuks",houdbaar:"lang"}
];
const SAMPLE_MENU = {
  dagen:[
    {dag:"Maandag",titel:"Noedels met paksoi, champignons en ei",tijd_min:25,gebruikt:["Paksoi","Champignons"],
     ingredienten:[{naam:"Mie-noedels",hoeveelheid:"250 g"},{naam:"Paksoi",hoeveelheid:"2 stuks"},{naam:"Champignons",hoeveelheid:"250 g"},{naam:"Eieren",hoeveelheid:"3 stuks"},{naam:"Sojasaus",hoeveelheid:"45 ml"},{naam:"Knoflook",hoeveelheid:"2 tenen"}],
     stappen:["Kook de noedels volgens de verpakking. Giet af.","Snijd de champignons in plakjes en de paksoi in repen.","Bak de champignons 5 minuten in een hete wok met olie.","Voeg knoflook en paksoi toe en bak 3 minuten.","Roer de noedels en sojasaus erdoor.","Bak de eieren apart en leg ze erop."],
     extra:["Mie-noedels 250 g","Eieren 6 stuks","Sojasaus 1 fles"],
     tip:"Paksoi en champignons worden snel slap. Daarom staan ze op dag 1."},
    {dag:"Dinsdag",titel:"Romige pasta met spinazie en peterselie",tijd_min:20,gebruikt:["Spinazie","Peterselie"],
     ingredienten:[{naam:"Penne",hoeveelheid:"300 g"},{naam:"Spinazie",hoeveelheid:"300 g"},{naam:"Roomkaas",hoeveelheid:"150 g"},{naam:"Parmezaan (vega)",hoeveelheid:"40 g"},{naam:"Peterselie",hoeveelheid:"½ bos"}],
     stappen:["Kook de pasta. Bewaar 100 ml kookwater.","Laat de spinazie slinken in een pan.","Roer roomkaas en het kookwater erdoor.","Meng met de pasta en strooi kaas en peterselie erover."],
     extra:["Penne 500 g","Roomkaas 150 g","Vegetarische Parmezaan 40 g"],
     tip:"Spinazie gaat snel achteruit. Eet hem binnen 3 dagen."},
    {dag:"Donderdag",titel:"Ovenschotel met biet, wortel en prei",tijd_min:45,gebruikt:["Rode biet","Wortel","Prei","Peterselie"],
     ingredienten:[{naam:"Rode biet",hoeveelheid:"4 stuks"},{naam:"Wortel",hoeveelheid:"500 g"},{naam:"Prei",hoeveelheid:"2 stuks"},{naam:"Feta",hoeveelheid:"200 g"},{naam:"Couscous",hoeveelheid:"250 g"}],
     stappen:["Verwarm de oven voor op 200 °C.","Snijd biet en wortel in blokjes van 2 cm.","Rooster ze 30 minuten met olie en zout.","Bak de prei in ringen zacht in een pan.","Maak de couscous klaar.","Schep alles samen en verkruimel de feta erover."],
     extra:["Feta 200 g","Couscous 250 g"],
     tip:"Biet en wortel blijven ruim een week goed in de koelkast."}
  ],
  restjes:"Van de appels maak je een appelcrumble als toetje, of eet ze los als snack. Overgebleven peterselie kun je fijnhakken en invriezen in een ijsblokjesbakje."
};

/* ---------- State ---------- */
let items = store.get("items", null);
let itemsAreSample = !items;
if (!items) items = SAMPLE_ITEMS.slice();
let menu = store.get("menu", null);
let menuIsSample = !menu;
if (!menu) menu = JSON.parse(JSON.stringify(SAMPLE_MENU));
const settings = Object.assign({personen:"2",avonden:"4",tijd:"45"}, store.get("settings", {}));
let files = [];
let mode = "foto";
const openDays = new Set();          // welke recepten zijn uitgeklapt (alleen deze sessie)
const busyDays = new Map();          // idx -> AbortController bij "Ander recept"
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Kleine helpers ---------- */
const SVG = {
  chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/></svg>'
};
function msg(id, text){ const m=$("#"+id); if(!m) return; m.textContent=text||""; m.hidden=!text; }
function status(text){ const s=$("#status"); s.textContent=text||""; s.hidden=!text; }

/* busy: voortgang met tijd + Stop (punt 1) */
function startBusy(prefix, ctl){
  const box=$("#"+prefix+"-busy"), t=$("#"+prefix+"-time"), hint=$("#"+prefix+"-hint");
  const t0=Date.now(); box.hidden=false; hint.hidden=true; t.textContent="0 s";
  const iv=setInterval(()=>{ const s=Math.round((Date.now()-t0)/1000); t.textContent=s+" s"; if(s>=15) hint.hidden=false; },1000);
  $("#"+prefix+"-stop").onclick=()=>ctl.abort();
  return ()=>{ clearInterval(iv); box.hidden=true; };
}

/* toast met ongedaan maken (punt 4) */
let toastTimer=null, toastUndo=null;
function toast(text, undo){
  const t=$("#toast"); $("#toast-text").textContent=text; toastUndo=undo||null;
  $("#toast-undo").hidden=!undo; t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.hidden=true; toastUndo=null;},7000);
}
$("#toast-undo").onclick=()=>{ const u=toastUndo; $("#toast").hidden=true; clearTimeout(toastTimer); toastUndo=null; if(u) u(); };

/* ---------- Logo: groente uit je box valt in het krat ---------- */
const VEG = {
  blad:   '<path d="M0 8C-14-6-11-34 0-46C11-34 14-6 0 8Z" fill="var(--leafy)"/><path d="M0 6V-38" stroke="var(--stem)" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>',
  wortel: '<path d="M-7-28H7L0 10Z" fill="var(--carrot)"/><path d="M0-28L-7-42M0-28V-46M0-28L7-42" stroke="var(--leafy)" stroke-width="3" stroke-linecap="round" fill="none"/>',
  biet:   '<ellipse cx="-5" cy="-38" rx="4" ry="9" transform="rotate(-20 -5 -38)" fill="var(--leafy)"/><ellipse cx="5" cy="-38" rx="4" ry="9" transform="rotate(20 5 -38)" fill="var(--leafy)"/><circle cy="-18" r="12" fill="var(--beetroot)"/>',
  prei:   '<rect x="-5" y="-54" width="10" height="26" rx="4" fill="var(--leafy)"/><rect x="-5" y="-30" width="10" height="38" rx="3" fill="var(--stem)"/>',
  paddo:  '<rect x="-4" y="-22" width="8" height="18" rx="3" fill="var(--stem)"/><path d="M-14-20A14 12 0 0 1 14-20Z" fill="var(--mush)"/>',
  appel:  '<path d="M0-28V-36" stroke="var(--crate-dark)" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="6" cy="-35" rx="5" ry="2.6" transform="rotate(-25 6 -35)" fill="var(--leafy)"/><circle cy="-16" r="12" fill="var(--apple)"/>'
};
const VEG_WORDS = [
  ["wortel",/wortel|peen|pastinaak/],
  ["biet",/biet|radijs|knolselderij|koolrabi/],
  ["prei",/prei|bosui|lente-?ui|venkel|selder/],
  ["paddo",/champignon|paddenstoel|zwam/],
  ["appel",/appel|peer|tomaat|paprika|pompoen|aardbei|pruim/],
  ["blad",/spinazie|sla|andijvie|paksoi|kool|rucola|peterselie|basilicum|kruid|biet.?blad|snijbiet|broccoli|bonen|courgette|komkommer/]
];
function boxVeg(){
  const found=[];
  for(const it of items){
    const n=it.naam.toLowerCase();
    const hit=VEG_WORDS.find(([,re])=>re.test(n));
    if(hit&&!found.includes(hit[0])) found.push(hit[0]);
  }
  for(const d of ["blad","wortel","biet","prei","appel"]) if(found.length<5&&!found.includes(d)) found.push(d);
  return found.slice(0,5);
}
let lastLogo="";
function renderLogo(animate){
  const veg=boxVeg(), key=veg.join();
  if(key===lastLogo && !animate) return; lastLogo=key;
  const slots=[24,42,60,78,96];
  const vegSvg=veg.map((v,i)=>`<g transform="translate(${slots.at(i)} 62)"><g class="veg${animate?" anim":""}" style="animation-delay:${i*90}ms">${VEG[v]}</g></g>`).join("");
  $("#logo").innerHTML=
    `<rect x="10" y="48" width="100" height="14" rx="3" fill="var(--crate-dark)"/>`+vegSvg+
    `<rect x="8" y="56" width="104" height="38" rx="5" fill="var(--crate)"/>`+
    `<path d="M8 69H112M8 82H112" stroke="var(--crate-dark)" stroke-width="2"/>`+
    `<rect x="48" y="62" width="24" height="5" rx="2.5" fill="var(--crate-dark)"/>`;
}

/* ---------- Render ---------- */
const ORDER = {kort:0,middel:1,lang:2};
function renderItems(){
  const ul = $("#items"); ul.replaceChildren();
  items.slice().sort((a,b)=>(ORDER[a.houdbaar]??1)-(ORDER[b.houdbaar]??1)).forEach(it=>{
    const del = el("button",{type:"button",textContent:"×",title:"Verwijder "+it.naam});
    del.setAttribute("aria-label","Verwijder "+it.naam);
    del.onclick = () => {
      const pos=items.indexOf(it), wasSample=itemsAreSample;
      items = items.filter(x=>x!==it); itemsAreSample=false; save(); renderItems(); renderMenu();
      toast(it.naam+" verwijderd", ()=>{ items.splice(pos,0,it); itemsAreSample=wasSample; save(); renderItems(); renderMenu(); });
    };
    ul.append(el("li",{className:"item"},[el("i",{className:"dot "+(it.houdbaar||"middel")}),el("span",{textContent:it.naam}),it.hoeveelheid?el("span",{className:"amt",textContent:it.hoeveelheid}):null,del]));
  });
  $("#items-badge").hidden = !itemsAreSample;
  renderLogo(false);
}
function itemSkeleton(){
  $("#items").replaceChildren(...Array.from({length:6},()=>{ const li=el("li",{className:"sk sk-chip"}); li.setAttribute("aria-hidden","true"); return li; }));
}
function menuSkeleton(n){
  $("#menu").replaceChildren(...Array.from({length:n},skeletonCard));
}
function shoppingList(){
  const seen=new Map();
  (menu.dagen||[]).filter(d=>!d.skip).forEach(d=>{
    (d.extra||[]).forEach(s=>{ const k=String(s).toLowerCase().replace(/[\d.,]+\s*(g|kg|ml|l|stuks?|fles|pak|blik)?/g,"").trim(); if(!seen.has(k)) seen.set(k,String(s)); });
  });
  if(!(menu.dagen||[]).some(d=>d.extra) && menu.extra_boodschappen) return menu.extra_boodschappen;
  return [...seen.values()];
}
function ensureOwnMenu(){ if(menuIsSample){ menuIsSample=false; } }

function skeletonCard(){
  const c=el("div",{className:"day sk-card"}); c.setAttribute("aria-hidden","true");
  c.append(el("div",{className:"sk sk-line",style:"width:30%"}),el("div",{className:"sk sk-title"}),el("div",{className:"sk sk-line",style:"width:55%"}));
  return c;
}
function renderMenu(stillComing=0){
  const m = $("#menu"); m.replaceChildren();
  (menu.dagen||[]).forEach((d,idx)=>{
    const on=!d.skip, open=openDays.has(idx), busy=busyDays.has(idx);

    // punt 6: één schakelaar
    const sw=el("button",{type:"button",className:"switch"});
    sw.setAttribute("role","switch"); sw.setAttribute("aria-checked",on);
    sw.setAttribute("aria-label",(d.titel||"Recept")+" op de boodschappenlijst");
    sw.append(el("span",{className:"track"},[el("span",{className:"thumb"})]),el("span",{className:"sw-label",textContent:on?"Op de lijst":"Overgeslagen"}));
    sw.onclick=()=>{ d.skip=on; saveMenu(); renderMenu(); $("#day-"+idx+" .switch")?.focus(); };

    // punt 5: ingeklapt, met knop
    const tog=el("button",{type:"button",className:"act"});
    tog.innerHTML=(open?"Verberg recept":"Toon recept")+SVG.chev;
    tog.setAttribute("aria-expanded",open); tog.setAttribute("aria-controls","more-"+idx);
    tog.onclick=()=>{ const card=$("#day-"+idx); const now=!card.classList.contains("open");
      card.classList.toggle("open",now); now?openDays.add(idx):openDays.delete(idx);
      tog.setAttribute("aria-expanded",now); tog.innerHTML=(now?"Verberg recept":"Toon recept")+SVG.chev; };

    const swap=el("button",{type:"button",className:"act"});
    swap.innerHTML=SVG.swap+(busy?"Stop":"Ander recept");
    swap.onclick=()=> busy ? busyDays.get(idx).abort() : replaceRecipe(idx);

    const head = el("header",{},[
      el("div",{className:"top"},[
        el("div",{className:"meta"},[el("b",{textContent:d.dag||""}),el("span",{textContent:(d.tijd_min||"?")+" min"})]),
        sw
      ]),
      el("h3",{textContent:busy?"Nieuw recept wordt bedacht…":(d.titel||"")}),
      el("div",{className:"uses"},(d.gebruikt||[]).map(u=>el("span",{textContent:u}))),
      el("div",{className:"actions"},[tog,swap]),
      el("p",{className:"msg",id:"day-msg-"+idx,hidden:true})
    ]);
    const ingr = el("ul",{className:"ingr"},(d.ingredienten||[]).map(i=>el("li",{},[el("span",{textContent:i.naam}),el("span",{className:"q",textContent:i.hoeveelheid||""})])));
    const steps = el("ol",{className:"steps"},(d.stappen||[]).map(s=>el("li",{textContent:s})));
    const body = el("div",{className:"body"},[
      el("div",{},[el("p",{className:"label",textContent:"Ingrediënten · "+settings.personen+" pers."}),ingr]),
      el("div",{},[el("p",{className:"label",textContent:"Bereiding"}),steps])
    ]);
    const more=el("div",{className:"more",id:"more-"+idx},[el("div",{},[body,d.tip?el("p",{className:"tip",textContent:"Tip: "+d.tip}):null])]);
    const card=el("article",{className:"day"+(on?"":" skipped")+(open?" open":""),id:"day-"+idx},[head,more]);
    if(busy){ card.setAttribute("aria-busy","true"); head.querySelector("h3").classList.add("sk-text"); }
    m.append(card);
  });
  for(let i=0;i<stillComing;i++) m.append(skeletonCard());
  const list=shoppingList();
  $("#shop").replaceChildren(...list.map(s=>el("li",{textContent:s})));
  const chosen=(menu.dagen||[]).filter(d=>!d.skip).length;
  $("#shop-count").textContent=`${list.length} producten · voor ${chosen} van ${(menu.dagen||[]).length} recepten`;
  const used=new Set((menu.dagen||[]).filter(d=>!d.skip).flatMap(d=>(d.gebruikt||[]).map(u=>String(u).toLowerCase())));
  const unused=items.filter(i=>![...used].some(u=>u.includes(i.naam.toLowerCase())||i.naam.toLowerCase().includes(u))).map(i=>i.naam);
  const w=$("#unused"); w.hidden=!unused.length || menuIsSample!==itemsAreSample || stillComing>0;
  w.textContent="Let op: deze box-producten zitten nu in geen enkel gekozen recept: "+unused.join(", ")+". Kies 'Ander recept' of zet een recept weer aan.";
  $("#rest").textContent = menu.restjes || "";
  $("#menu-badge").hidden = !menuIsSample;
}
function renderSettings(){
  document.querySelectorAll(".seg").forEach(seg=>{
    const key = seg.dataset.key;
    seg.querySelectorAll("button").forEach(b=>{
      b.type="button";
      b.setAttribute("aria-pressed", b.textContent===settings[key]);
      b.onclick=()=>{settings[key]=b.textContent;store.set("settings",settings);renderSettings();};
    });
  });
}
function save(){ if(!itemsAreSample) store.set("items",items); }
function saveMenu(){ if(!menuIsSample) store.set("menu",menu); }

/* ---------- Tabs & upload ---------- */
function setMode(m){ mode=m; $("#tab-foto").setAttribute("aria-selected",m==="foto"); $("#tab-tekst").setAttribute("aria-selected",m==="tekst"); $("#pane-foto").hidden=m!=="foto"; $("#pane-tekst").hidden=m!=="tekst"; msg("read-msg",""); }
$("#tab-foto").onclick=()=>setMode("foto");
$("#tab-tekst").onclick=()=>setMode("tekst");
function addFiles(list){
  for (const f of list) if (f.type.startsWith("image/")) files.push(f);
  files = files.slice(-4);
  $("#thumbs").replaceChildren(...files.map(f=>el("img",{src:URL.createObjectURL(f),alt:f.name||"Foto van de box"})));
  if (files.length){ setMode("foto"); msg("read-msg",""); }
}
$("#file").onchange=e=>addFiles(e.target.files);
const drop=$("#drop");
drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("over");});
drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("over");addFiles(e.dataTransfer.files);});
document.addEventListener("paste",e=>{const imgs=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith("image/")); if(imgs.length){e.preventDefault();addFiles(imgs);}});

$("#add").onsubmit=e=>{
  e.preventDefault();
  const naam=$("#add-name").value.trim(); if(!naam){ $("#add-name").focus(); return; }
  if(itemsAreSample){items=[];itemsAreSample=false;}
  items.push({naam,hoeveelheid:$("#add-amt").value.trim(),houdbaar:"middel"});
  $("#add-name").value="";$("#add-amt").value="";save();renderItems();renderMenu();
};

$("#copy").onclick=async()=>{
  const txt=shoppingList().join("\n"); msg("copy-msg","");
  try{await navigator.clipboard.writeText(txt);$("#copy").textContent="Gekopieerd";setTimeout(()=>$("#copy").textContent="Kopieer lijst",1800);}
  catch{const r=document.createRange();r.selectNodeContents($("#shop"));const s=getSelection();s.removeAllRanges();s.addRange(r);msg("copy-msg","Kopiëren lukte niet automatisch. De lijst is geselecteerd: gebruik Ctrl+C.");}
};

/* ---------- Claude ---------- */
const ERR = {
  no_key:"Je hebt nog geen API-sleutel ingevuld. Voeg hem toe bij Instellingen, bovenaan de pagina.",
  bad_key:"Je API-sleutel klopt niet of is ingetrokken. Controleer hem bij Instellingen.",
  no_credit:"Je Anthropic-tegoed is op. Waardeer het op in de Anthropic Console en probeer het opnieuw.",
  rate_limited:"Even te veel verzoeken, of je limiet is bereikt. Probeer het over een minuutje opnieuw, of check je tegoed in de Anthropic Console.",
  network:"Geen verbinding met Claude. Controleer je internet en probeer het opnieuw.",
  overloaded:"Claude is nu erg druk. Probeer het over een minuutje opnieuw.",
  image_rejected:"Deze foto kan niet gelezen worden. Probeer een JPG of PNG, of maak een scherpere foto.",
  images_unavailable:"Foto's lezen werkt hier niet. Plak de tekst van de mail in het tabblad 'Tekst plakken'.",
  invalid_json:"Het antwoord kwam niet goed door. Klik nog een keer.",
  refused:"Claude kon deze invoer niet verwerken. Probeer een andere foto of tekst."
};
const errMsg = e => ERR[e?.code] || "Er ging iets mis. Probeer het opnieuw.";
const hasKey = () => !!apiKey.get();
const NO_KEY = ERR.no_key;
function askKey(){ const p=$("#keypanel"); p.open=true; $("#key-input").focus(); }

const EXTRACT = `Je leest de inhoud van een groente- en fruitbox uit een foto of tekst (bezorgmail of brief).
Antwoord met alleen een JSON-array. Elk item: {"naam": string (Nederlands, met hoofdletter), "hoeveelheid": string (metrisch: "500 g", "1 bos", "2 stuks"; leeg als onbekend), "houdbaar": "kort"|"middel"|"lang"}.
kort = op binnen 2-3 dagen (bladgroente, kruiden, paddenstoelen, zacht fruit). middel = 4-5 dagen. lang = een week of langer (knollen, kool, appels, uien).
Neem alleen eetbare producten op. Negeer prijzen, adressen, bezorgtijden, recepten en reclame.
Voorbeeld: [{"naam":"Spinazie","hoeveelheid":"300 g","houdbaar":"kort"}]`;

$("#read").onclick=async()=>{
  msg("read-msg",""); $("#read-ok").hidden=true;
  if(!hasKey()){msg("read-msg",NO_KEY);askKey();return;}
  const text=$("#paste").value.trim();
  if(mode==="foto"&&!files.length){msg("read-msg","Kies eerst een foto, of plak de tekst in het tabblad 'Tekst plakken'.");return;}
  if(mode==="tekst"&&!text){msg("read-msg","Plak eerst de tekst van de mail.");$("#paste").focus();return;}
  const btn=$("#read"), ctl=new AbortController(), before=items.slice(), wasSample=itemsAreSample;
  btn.disabled=true; itemSkeleton(); const stop=startBusy("read",ctl);
  try{
    const prompt = mode==="foto" ? EXTRACT+"\n\nDe bijgevoegde afbeelding(en) tonen de box." : EXTRACT+"\n\nTekst:\n"+text.slice(0,12000);
    // snelle modus: uitlezen is eenvoudig werk, hoeft niet eerst na te denken
    const res = await sample.json(prompt, mode==="foto"?{images:files,signal:ctl.signal,modelTier:"quick"}:{signal:ctl.signal,modelTier:"quick"});
    if(!Array.isArray(res)||!res.length) throw {code:"empty"};
    items=res.filter(x=>x&&x.naam).map(x=>({naam:String(x.naam),hoeveelheid:String(x.hoeveelheid||""),houdbaar:["kort","middel","lang"].includes(x.houdbaar)?x.houdbaar:"middel"}));
    itemsAreSample=false; save(); renderItems(); renderMenu(); renderLogo(true);
    const ok=$("#read-ok"); ok.textContent="✓ "+items.length+" producten gevonden. Klopt het? Pas het hieronder aan."; ok.hidden=false;
    toast("Box ingelezen", ()=>{ items=before; itemsAreSample=wasSample; if(!wasSample) save(); renderItems(); renderMenu(); ok.hidden=true; });
  }catch(e){
    renderItems();
    if(e?.code!=="cancelled") msg("read-msg", e?.code==="empty"?"Geen groente of fruit gevonden. Probeer een duidelijkere foto.":errMsg(e));
  }finally{ stop(); btn.disabled=false; }
};

const DAY_SHAPE = `{"dag":"Maandag","titel":"...","tijd_min":25,"gebruikt":["box- of voorraadproducten die dit recept gebruikt"],"ingredienten":[{"naam":"...","hoeveelheid":"250 g"}],"stappen":["..."],"extra":["wat je voor DIT recept moet kopen, als winkelregel: 'Feta 200 g'"],"tip":"één zin"}`;
function context(){
  const list=items.map(i=>`- ${i.naam}${i.hoeveelheid?" ("+i.hoeveelheid+")":""} [houdbaar: ${i.houdbaar}]`).join("\n");
  const vr=$("#voorraad").value.trim().slice(0,1000);
  return `Box-inhoud:\n${list}` + (vr?`\n\nAndere producten die al in huis zijn en mee moeten in het menu:\n${vr}`:"");
}
function RULES(){
  const wens=$("#wens").value.trim().slice(0,300);
  return `- Alleen vegetarisch (geen vlees, vis, gelatine of dierlijk stremsel; noem kaas "vega" waar nodig).
- Gebruik alle box-producten en de producten in huis zo volledig mogelijk. Producten met houdbaar "kort" komen in de eerste maaltijden.
- Elke maaltijd duurt maximaal ${settings.tijd} minuten.
- Alleen metrische eenheden: g, kg, ml, l, °C. Nooit cups, oz of °F. Hoeveelheden voor ${settings.personen} personen.
- Ga ervan uit dat olie, zout, peper, ui, knoflook en bouillon in huis zijn.
- "extra" bevat alleen wat gekocht moet worden: niet de box, niet de producten in huis, niet de basisvoorraad. Gebruik gangbare supermarktnamen en verpakkingsmaten.
- Schrijf in eenvoudig Nederlands (B1), korte zinnen. Maximaal 6 stappen per recept.${wens?"\n- Extra wens: "+wens:""}`;
}
async function replaceRecipe(idx){
  if(!hasKey()){ renderMenu(); msg("day-msg-"+idx,NO_KEY); askKey(); return; }
  const d=menu.dagen[idx], old=JSON.parse(JSON.stringify(d)), ctl=new AbortController();
  busyDays.set(idx,ctl); renderMenu();
  const others=menu.dagen.filter((_,i)=>i!==idx&&!menu.dagen[i].skip).map(x=>"- "+x.titel).join("\n");
  const prompt=`Bedenk één vervangend vegetarisch avondrecept voor ${d.dag} voor ${settings.personen} personen.
${context()}

Het oude recept was "${d.titel}" en gebruikte: ${(d.gebruikt||[]).join(", ")}. Gebruik vooral diezelfde producten, maar maak een duidelijk ander gerecht.
De andere recepten deze week (niet herhalen):
${others||"- geen"}

Regels:
${RULES()}

Antwoord met alleen één JSON-object in deze vorm:
${DAY_SHAPE}`;
  let err=null;
  try{
    const r=await sample.json(prompt,{cache:false,signal:ctl.signal,modelTier:"quick"});
    if(!r||!r.titel||!Array.isArray(r.stappen)) throw {code:"invalid_json"};
    r.dag=d.dag; if(!Array.isArray(r.extra)) r.extra=[]; r.skip=false;
    ensureOwnMenu(); menu.dagen[idx]=r; saveMenu();
    toast(`${d.dag}: "${old.titel}" vervangen`, ()=>{ menu.dagen[idx]=old; saveMenu(); renderMenu(); });
  }catch(e){ if(e?.code!=="cancelled") err=errMsg(e); }
  finally{ busyDays.delete(idx); renderMenu(); if(err) msg("day-msg-"+idx,err); }
}

$("#voorraad").value = store.get("voorraad","");
$("#voorraad").addEventListener("input",e=>store.set("voorraad",e.target.value));

$("#plan").onclick=async()=>{
  msg("plan-msg","");
  if(!hasKey()){msg("plan-msg",NO_KEY);askKey();return;}
  if(!items.length){msg("plan-msg","Je box is leeg. Lees eerst je box uit of voeg producten toe bij stap 1.");return;}
  const btn=$("#plan"), ctl=new AbortController();
  const prevMenu=menu, prevSample=menuIsSample, prevOpen=new Set(openDays);
  const total=Number(settings.avonden);
  btn.disabled=true; menuSkeleton(total); $("#menu-badge").hidden=true;
  $("#h-menu").scrollIntoView({behavior:reduceMotion()?"auto":"smooth"});
  const stop=startBusy("plan",ctl);
  // Elk recept op een eigen regel: zo verschijnt recept 1 al terwijl de rest nog komt.
  const prompt=`Maak een vegetarisch weekmenu voor ${settings.personen} personen, ${total} avondmaaltijden.
${context()}

Regels:
${RULES()}
- Dagen: gebruik weekdagnamen vanaf maandag, verspreid over de week.

Antwoordvorm (belangrijk): schrijf precies ${total + 1} regels en verder niets, geen opsomming, geen codeblok.
- Regel 1 t/m ${total}: één recept per regel, als één JSON-object op één regel: ${DAY_SHAPE}
- Laatste regel: {"restjes":"1-2 zinnen over wat overblijft en wat je ermee doet"}`;
  const fresh={dagen:[],restjes:""}; let pending="";
  const eat=line=>{
    line=line.trim().replace(/^```\w*|```$/g,"").trim(); if(!line.startsWith("{")) return;
    let o; try{ o=JSON.parse(line); }catch{ return; }
    if(o.titel&&Array.isArray(o.stappen)){
      if(!Array.isArray(o.extra)) o.extra=[];
      fresh.dagen.push(o);
      if(fresh.dagen.length===1){ menu=fresh; menuIsSample=false; openDays.clear(); }
      renderMenu(Math.max(0,total-fresh.dagen.length));
    } else if(typeof o.restjes==="string"){ fresh.restjes=o.restjes; }
  };
  try{
    await sample(prompt,{cache:false,signal:ctl.signal,effort:"low",onText:({delta})=>{
      const lines=(pending+delta).split("\n"); pending=lines.pop(); lines.forEach(eat);
    }});
    eat(pending);
    if(!fresh.dagen.length) throw {code:"invalid_json"};
    menu=fresh; menuIsSample=false; store.set("menu",menu); renderMenu();
    toast("Nieuw weekmenu gemaakt", ()=>{ menu=prevMenu; menuIsSample=prevSample; openDays.clear(); prevOpen.forEach(i=>openDays.add(i)); if(!prevSample) store.set("menu",menu); renderMenu(); });
  }catch(e){
    if(fresh.dagen.length){ // half binnen: houd wat er is
      menu=fresh; menuIsSample=false; store.set("menu",menu); renderMenu();
      if(e?.code!=="cancelled") msg("plan-msg",`${fresh.dagen.length} van ${total} recepten binnen. ${errMsg(e)}`);
    } else {
      menu=prevMenu; menuIsSample=prevSample; renderMenu();
      if(e?.code!=="cancelled") msg("plan-msg",errMsg(e));
    }
  }finally{ stop(); btn.disabled=false; }
};

/* ---------- Start ---------- */
renderItems(); renderSettings(); renderMenu(); renderLogo(true);

/* ---------- Instellingen: API-sleutel ---------- */
function renderKey(){
  const has=hasKey(), p=$("#keypanel");
  p.classList.toggle("has-key",has);
  $("#key-summary").textContent = has ? "Instellingen: API-sleutel opgeslagen" : "Instellingen: voeg je API-sleutel toe";
  $("#key-input").placeholder = has ? "•••••••• (opgeslagen, plak een nieuwe om te vervangen)" : "Plak hier je sleutel";
  if(has){ status(""); }
  else { p.open=true; status("Voeg je eigen API-sleutel toe bij Instellingen om je box te laten uitlezen. Hieronder zie je een voorbeeld."); }
}
$("#key-form").onsubmit=e=>{
  e.preventDefault();
  const v=$("#key-input").value.trim(), ok=$("#key-ok");
  if(!v){ $("#key-input").focus(); return; }
  apiKey.set(v); $("#key-input").value=""; renderKey();
  ok.textContent="✓ Sleutel opgeslagen in deze browser."; ok.hidden=false;
};
$("#key-clear").onclick=()=>{
  apiKey.clear(); $("#key-input").value=""; renderKey();
  const ok=$("#key-ok"); ok.textContent="Sleutel gewist uit deze browser."; ok.hidden=false;
};
renderKey();
sample.limits().then(lim=>{ if(!lim?.images){ setMode("tekst"); $("#tab-foto").hidden=true; } }).catch(()=>{});
