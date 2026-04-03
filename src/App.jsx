import { useState, useEffect, useRef, useCallback, memo } from "react";
import Collection from "./Collection.jsx";
import CardDetailModal from "./CardDetailModal.jsx";
import GradingTab from "./GradingTab.jsx";
import AuthOverlay from "./AuthOverlay.jsx";
import LeaderboardModal from "./LeaderboardModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import { supabase } from "./supabaseClient.js";
import { TC, RC, getMarketPrice, generateCardProperties, calculatePSAGrade,
  GRADING_COST, GRADING_DURATION_MS, getCardValue } from "./constants.js";

/* ═══════════════════════════════════════════════════
   SOUND ENGINE — Web Audio API synthesis
   ═══════════════════════════════════════════════════ */
class SFX {
  constructor(){this.ctx=null;this.on=false;}
  init(){
    if(!this.on) {
      try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.on=true;}catch(e){}
    }
    if(this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }
  noise(dur,vol=.15,freq=4000){
    if(!this.ctx)return;const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate);
    const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const s=this.ctx.createBufferSource();s.buffer=b;
    const f=this.ctx.createBiquadFilter();f.type="bandpass";f.frequency.value=freq;f.Q.value=1.5;
    const g=this.ctx.createGain();const t=this.ctx.currentTime;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f).connect(g).connect(this.ctx.destination);s.start();
  }
  tone(freq,dur,vol=.1,type="sine",delay=0){
    if(!this.ctx)return;const t=this.ctx.currentTime+delay;
    const o=this.ctx.createOscillator();o.type=type;o.frequency.value=freq;
    const g=this.ctx.createGain();g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+dur+.05);
  }
  tear(p){if(!this.ctx)return;this.noise(.06,.08+p*.12,2000+p*6000);}
  tearDone(){
    if(!this.ctx)return;const t=this.ctx.currentTime;
    this.noise(.3,.25,5000);
    const o=this.ctx.createOscillator();o.type="sine";
    o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(30,t+.2);
    const g=this.ctx.createGain();g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);
    o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.25);
    setTimeout(()=>this.noise(.15,.1,8000),80);
    setTimeout(()=>this.noise(.1,.06,10000),160);
  }
  flip(){if(!this.ctx)return;this.noise(.04,.18,6000);
    const t=this.ctx.currentTime;const o=this.ctx.createOscillator();o.type="sine";
    o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(250,t+.1);
    const g=this.ctx.createGain();g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);
    o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.12);
  }
  reveal(rarity){
    if(!this.ctx)return;
    const map={
      common:[[523],.2,.08,"sine"],
      uncommon:[[523,659],.25,.1,"sine"],
      rare:[[523,659,784],.3,.12,"triangle"],
      ultra:[[440,554,659,880,1109],.4,.13,"triangle"],
      legendary:[[330,440,554,659,880,1109,1319],.5,.15,"triangle"],
    };
    const[notes,dur,vol,type]=map[rarity]||map.common;
    notes.forEach((f,i)=>this.tone(f,dur,vol,type,i*.07));
    if(rarity==="legendary"){
      setTimeout(()=>{
        const t=this.ctx.currentTime;this.noise(.5,.08,12000);
      },150);
    }
  }
  startDrone(){
    if(!this.ctx)return;
    this._droneOsc=this.ctx.createOscillator();this._droneOsc.type="sine";this._droneOsc.frequency.value=80;
    this._droneG=this.ctx.createGain();this._droneG.gain.value=0;
    this._droneF=this.ctx.createBiquadFilter();this._droneF.type="lowpass";this._droneF.frequency.value=200;
    this._droneOsc.connect(this._droneF).connect(this._droneG).connect(this.ctx.destination);this._droneOsc.start();
  }
  updateDrone(p){
    if(!this._droneG||!this.ctx)return;const t=this.ctx.currentTime;
    this._droneG.gain.setTargetAtTime(p*.12,t,.05);
    this._droneF.frequency.setTargetAtTime(200+p*800,t,.05);
    this._droneOsc.frequency.setTargetAtTime(80+p*60,t,.05);
  }
  stopDrone(){
    if(!this._droneG||!this.ctx)return;const t=this.ctx.currentTime;
    this._droneG.gain.setTargetAtTime(0,t,.05);
    try{this._droneOsc.stop(t+.2);}catch(e){}this._droneOsc=null;
  }
  hover(){if(!this.ctx)return;this.tone(1200,.08,.03);}
  collect(){if(!this.ctx)return;[523,659,784,1047].forEach((f,i)=>this.tone(f,.3,.1,"sine",i*.06));}
  sell(){if(!this.ctx)return;this.tone(1319,.12,.1,"sine",0);this.noise(.04,.06,9000);}
  bulkSell(){if(!this.ctx)return;[0,40,80].forEach((d,i)=>setTimeout(()=>this.tone(1319+i*200,.08,.06,"sine"),d));}
}
const sfx=new SFX();

/* ═══════════════════════════════════════════════════
   SET DEFINITIONS
   ═══════════════════════════════════════════════════ */
const SETS = [
  { id: "sv1", name: "Scarlet & Violet", series: "Scarlet & Violet", logoUrl: "https://images.pokemontcg.io/sv1/logo.png", symbolUrl: "https://images.pokemontcg.io/sv1/symbol.png", total: 198, releaseDate: "2023/03/31", accentColor: "#C03028", gradientFrom: "#1a0505", gradientTo: "#3d0808", packGradient: "linear-gradient(140deg,#2e0505,#6b1010,#a01818)", description: "The first expansion of the Scarlet & Violet era!", packPrice: 0 },
  { id: "sv2", name: "Paldea Evolved", series: "Scarlet & Violet", logoUrl: "https://images.pokemontcg.io/sv2/logo.png", symbolUrl: "https://images.pokemontcg.io/sv2/symbol.png", total: 193, releaseDate: "2023/06/09", accentColor: "#4ade80", gradientFrom: "#051a05", gradientTo: "#0d3d0d", packGradient: "linear-gradient(140deg,#0a2e0a,#106b10,#18a018)", description: "New powers awaken in the Paldea region!", packPrice: 2 },
  { id: "sv3", name: "Obsidian Flames", series: "Scarlet & Violet", logoUrl: "https://images.pokemontcg.io/sv3/logo.png", symbolUrl: "https://images.pokemontcg.io/sv3/symbol.png", total: 197, releaseDate: "2023/08/11", accentColor: "#F08030", gradientFrom: "#1a0800", gradientTo: "#3d1800", packGradient: "linear-gradient(140deg,#2d0a00,#5c1a00,#8b3000)", description: "Charizard ex leads the charge in this fiery expansion!", packPrice: 4 },
  { id: "sv4", name: "Paradox Rift", series: "Scarlet & Violet", logoUrl: "https://images.pokemontcg.io/sv4/logo.png", symbolUrl: "https://images.pokemontcg.io/sv4/symbol.png", total: 182, releaseDate: "2023/11/03", accentColor: "#7038F8", gradientFrom: "#0a0520", gradientTo: "#1a0a4a", packGradient: "linear-gradient(140deg,#120838,#2a1070,#4018a8)", description: "Ancient and Future Paradox Pokémon collide!", packPrice: 4 },
  { id: "base1", name: "Base Set (Unlimited)", series: "Base", logoUrl: "https://images.pokemontcg.io/base1/logo.png", symbolUrl: "https://images.pokemontcg.io/base1/symbol.png", total: 102, releaseDate: "1999/01/09", accentColor: "#F8D030", gradientFrom: "#1a1505", gradientTo: "#3d320d", packGradient: "linear-gradient(140deg,#b8a038,#d4af37,#ffd700)", description: "The set that started it all!", packPrice: 500 },
  { id: "base1_1st", name: "Base Set (1st Edition)", series: "Base", logoUrl: "https://images.pokemontcg.io/base1/logo.png", symbolUrl: "https://images.pokemontcg.io/base1/symbol.png", total: 102, releaseDate: "1999/01/09", accentColor: "#fbbf24", gradientFrom: "#1a1a05", gradientTo: "#3d3d0d", packGradient: "linear-gradient(145deg,#222,#444,#000)", description: "Ultra-rare 1st Edition print run.", packPrice: 5000, is1stEdition: true },
];

function mapRarity(apiRarity) {
  if (!apiRarity) return "common";
  const r = apiRarity.toLowerCase();
  if (r.includes("hyper") || r.includes("special illustration") || r.includes("secret") || r.includes("promo")) return "legendary";
  if (r.includes("illustration rare") || r.includes("ultra") || r.includes("ace spec") || r.includes("double")) return "ultra";
  if (r.includes("rare holo") || r.includes("rare")) return "rare";
  if (r.includes("uncommon")) return "uncommon";
  return "common";
}

function genUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const cardCache = {};
async function fetchSetCards(setId) {
  const apiId = setId === "base1_1st" ? "base1" : setId;
  if (cardCache[setId]) return cardCache[setId];
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${apiId}&pageSize=250&select=id,number,name,supertype,subtypes,types,hp,rarity,images,tcgplayer`;
  const res = await fetch(url);
  const data = await res.json();
  const transformed = data.data.filter(c => c.supertype === "Pokémon").map(c => ({
    id: c.id, number: c.number, name: c.name, type: (c.types && c.types[0]) || "Colorless",
    rarity: mapRarity(c.rarity), apiRarity: c.rarity || "Common",
    imageSmall: c.images?.small, imageLarge: c.images?.large, hp: c.hp, subtypes: c.subtypes || [],
    tcgPrices: c.tcgplayer?.prices || null
  }));
  cardCache[setId] = transformed;
  return transformed;
}

function pickR(){const r=Math.random()*100;let s=0;for(const[k,v]of Object.entries(RC)){s+=v.w;if(r<s)return k;}return"common";}
function genPack(poolCards){
  const p={common:[],uncommon:[],rare:[],ultra:[],legendary:[]};
  poolCards.forEach(c=>p[c.rarity]?.push(c));
  ["uncommon","rare","ultra","legendary"].forEach(r=>{if(!p[r].length)p[r]=[...p.common]});
  const res=[];const used=new Set();
  const add=a=>{let c;do{c=a[Math.floor(Math.random()*a.length)]}while(used.has(c.id));used.add(c.id);return c;};
  for(let i=0;i<4;i++)res.push(add(p.common));
  for(let i=0;i<3;i++)res.push(add(p.uncommon));
  res.push(add(p.rare));
  for(let i=0;i<2;i++)res.push(add(p[pickR()]));
  const best=res.pop();return[...res.sort(()=>Math.random()-.5),best];
}

function CardImage({card, loaded, onLoad, style}){
  return <img src={card.imageLarge || card.imageSmall} alt={card.name} onLoad={onLoad} crossOrigin="anonymous" style={style}/>;
}

function Particles({active,color,rarity}){
  const[ps,setPs]=useState([]);
  useEffect(()=>{if(!active)return;const a=[];const n=rarity==="legendary"?60:rarity==="ultra"?30:rarity==="rare"?15:0;
    for(let i=0;i<n;i++)a.push({i,x:50,y:50,sz:Math.random()*4+1,a:Math.random()*360,d:40+Math.random()*80});
    setPs(a)},[active,rarity]);
  if(!active)return null;
  return <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:6}}>{ps.map(p=>(
    <div key={p.i} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.sz,height:p.sz,borderRadius:"50%",background:color,
      animation:`pBurst .8s forwards`,"--tx":`${Math.cos(p.a)*p.d}px`,"--ty":`${Math.sin(p.a)*p.d}px`}}/>))}</div>;
}

const PokemonCard = memo(function PokemonCard({pokemon,revealed,index,onClick}){
  const[imgOk,setImgOk]=useState(false);
  const rc=RC[pokemon.rarity];
  return(
    <div onClick={onClick} className="mobile-card-size" style={{width:170,height:238,perspective:1000,cursor:"pointer",animation:"cardFloat 3s infinite"}}>
      <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transition:".6s",transform:revealed?"rotateY(0)":"rotateY(180deg)"}}>
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",borderRadius:12,overflow:"hidden",background:"#12141f",border:`2px solid ${rc.c}44`,boxShadow:revealed?`0 0 20px ${rc.g}`:"none"}}>
          <CardImage card={pokemon} onLoad={()=>setImgOk(true)} style={{width:"100%",height:"100%",objectFit:"cover",filter:imgOk?"none":"blur(10px)"}}/>
          <div style={{position:"absolute",bottom:6,right:6,background:"#000a",borderRadius:4,padding:"2px 6px",fontSize:8,color:rc.c}}>{rc.l}</div>
          {pokemon.variant==="1st Edition"&&<div style={{position:"absolute",bottom:40,left:8,fontSize:9,color:"#FFD700",fontWeight:900,background:"#000b",padding:"2px 4px",borderRadius:4}}>1st</div>}
          <Particles active={revealed&&["rare","ultra","legendary"].includes(pokemon.rarity)} color={rc.c} rarity={pokemon.rarity}/>
        </div>
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",borderRadius:12,background:"linear-gradient(45deg,#111,#222)",border:"2px solid #333",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:40,height:40,borderRadius:"50%",border:"4px solid #fff2"}}/>
        </div>
      </div>
    </div>
  );
});

function PackWrapper({onOpen, setInfo}){
  const[tp,setTp]=useState(0);const[hold,setHold]=useState(false);const hRef=useRef(null);const pRef=useRef(0);
  const accent=setInfo.accentColor;
  const go=()=>{sfx.init();setHold(true);const tick=()=>{pRef.current=Math.min(pRef.current+1.2,100);setTp(pRef.current);
    if(pRef.current>=100){sfx.tearDone();setTimeout(onOpen,300)}else{hRef.current=requestAnimationFrame(tick)}};hRef.current=requestAnimationFrame(tick)};
  const no=()=>{if(hRef.current)cancelAnimationFrame(hRef.current);setHold(false);const snap=()=>{pRef.current=Math.max(pRef.current-5,0);setTp(pRef.current);if(pRef.current>0)requestAnimationFrame(snap)};snap()};
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
      <div onPointerDown={go} onPointerUp={no} onPointerLeave={no} style={{width:220,height:310,borderRadius:16,background:setInfo.packGradient,cursor:"pointer",position:"relative",overflow:"hidden",boxShadow:hold?"0 0 30px #fff4":"0 10px 30px #0008"}}>
        <div style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",width:100,height:100,borderRadius:"50%",border:"4px solid #fff2"}}/>
        <div style={{position:"absolute",top:0,left:0,right:0,height:`${tp}%`,background:`linear-gradient(to bottom,${accent}99,transparent)`,zIndex:2}}/>
      </div>
      <div style={{fontSize:14,color:"#fff6"}}>{hold?`Tearing... ${Math.floor(tp)}%`:"Hold to open"}</div>
    </div>
  );
}

function SetSelector({onSelect}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,width:"100%",maxWidth:1000}}>
      {SETS.map(s=>(
        <div key={s.id} onClick={()=>onSelect(s)} style={{padding:20,borderRadius:16,background:s.packGradient,cursor:"pointer",transition:".2s"}}>
          <img src={s.logoUrl} style={{maxHeight:50,maxWidth:"100%"}} alt=""/>
          <div style={{marginTop:12,fontSize:14,fontWeight:800}}>{s.name} — {s.packPrice===0?"FREE":`$${s.packPrice}`}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner({setInfo}){return <div style={{marginTop:100}}>Fetching {setInfo.name}...</div>}

export default function App(){
  const[user,setUser]=useState(null);const userRef=useRef(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[phase,setPhase]=useState("select");
  const[selectedSet,setSelectedSet]=useState(null);
  const[cardPool,setCardPool]=useState([]);
  const[cards,setPackCards]=useState([]);
  const[revealed,setRevealed]=useState([]);
  const[cur,setCur]=useState(0);
  const[collection,setCollection]=useState([]);
  const[stats,setStats]=useState({packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0});
  const[wallet,setWallet]=useState(25);
  const[activeTab,setActiveTab]=useState("open");
  const[autoSellThreshold,setAutoSellThreshold]=useState(0);
  const[detailCard,setDetailCard]=useState(null);
  const[showLeaderboard,setShowLeaderboard]=useState(false);
  const[showProfileModal,setShowProfileModal]=useState(false);
  const[username,setUsername]=useState("");

  useEffect(()=>{userRef.current=user},[user]);

  const allDone = revealed.length===cards.length && cards.length>0;
  const best = cards.length>0 ? [...cards].sort((a,b)=>{const o={common:0,uncommon:1,rare:2,ultra:3,legendary:4};return o[b.rarity]-o[a.rarity]})[0] : null;

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>handleUserSession(session?.user));
    supabase.auth.onAuthStateChange((_,s)=>handleUserSession(s?.user));
  },[]);

  const handleUserSession=async(u)=>{
    if(u){
      setUser(u);if(u.id==="guest"){setAuthLoading(false);return}
      const{data:p}=await supabase.from("profiles").select("*").eq("id",u.id).single();
      if(p){setWallet(p.wallet);setStats(p.stats);setAutoSellThreshold(p.auto_sell_threshold);setUsername(p.username||"")}
      const{data:c}=await supabase.from("cards").select("*").eq("user_id",u.id);
      if(c)setCollection(c.map(r=>({uid:r.uid,id:r.card_id,...r.api_data,properties:r.properties,psaGrade:r.psa_grade})));
    }else{setUser(null)}
    setAuthLoading(false);
  };

  const syncWalletAndStats=async(w,s)=>{
    const u=userRef.current;if(!u||u.id==="guest")return;
    await supabase.from("profiles").update({wallet:w,stats:s}).eq("id",u.id);
  };

  const handleSelectSet=async(s)=>{setSelectedSet(s);setPhase("loading");const f=await fetchSetCards(s.id);setCardPool(f);setPhase("pack")};

  const openPack=async()=>{
    const cost=selectedSet.packPrice;
    if(wallet<cost)return;
    const nc=genPack(cardPool).map(c=>({...c,uid:genUID(),setId:selectedSet.id,setName:selectedSet.name,properties:generateCardProperties(),variant:selectedSet.is1stEdition?"1st Edition":null}));
    const ns={...stats,packs:stats.packs+1};nc.forEach(c=>ns[c.rarity]++);
    let netChange=-cost;const toKeep=[];
    nc.forEach(c=>{const v=getCardValue(c);if(v<autoSellThreshold)netChange+=v;else toKeep.push(c)});
    setWallet(w=>{const next=w+netChange;syncWalletAndStats(next,ns);return next});
    setStats(ns);setCollection(prev=>[...prev,...toKeep]);
    setPackCards(nc);setRevealed([]);setCur(0);setPhase("revealing");
    const records=toKeep.map(c=>({uid:c.uid,user_id:user.id,card_id:c.id,set_id:c.setId,set_name:c.setName,api_data:c,properties:c.properties}));
    if(user.id!=="guest")await supabase.from("cards").insert(records);
  };

  const handleSignOut=async()=>{await supabase.auth.signOut();setUser(null);setCollection([]);setWallet(25)};

  if(authLoading)return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>Loading...</div>;

  return(
    <div style={{minHeight:"100vh",background:"#050810",fontFamily:"sans-serif",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",width:"100%",maxWidth:1000,marginBottom:40}}>
        <h1>POKÉMON SIM</h1>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <div style={{fontSize:24,fontWeight:900,color:"#FFD700"}}>${wallet.toFixed(2)}</div>
          {user&&<button onClick={()=>setShowProfileModal(true)} style={{background:"#fff2",border:"none",color:"#fff",padding:"8px 16px",borderRadius:8}}>👤 {username||user.email}</button>}
          {user&&<button onClick={handleSignOut} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>Log Out</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:30}}>
        <button onClick={()=>setActiveTab("open")} style={{padding:"10px 20px",background:activeTab==="open"?"#FFD70033":"#fff1",border:"none",color:"#fff",borderRadius:8}}>Pack Shop</button>
        <button onClick={()=>setActiveTab("collection")} style={{padding:"10px 20px",background:activeTab==="collection"?"#FFD70033":"#fff1",border:"none",color:"#fff",borderRadius:8}}>Collection ({collection.length})</button>
      </div>

      {activeTab==="open"&&(
        <>
          {phase==="select"&&<SetSelector onSelect={handleSelectSet}/>}
          {phase==="loading"&&<LoadingSpinner setInfo={selectedSet}/>}
          {phase==="pack"&&<PackWrapper onOpen={openPack} setInfo={selectedSet}/>}
          {phase==="revealing"&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:10}}>
                {cards.map((p,i)=><PokemonCard key={p.uid} pokemon={p} revealed={revealed.includes(i)} onClick={()=>{if(i===cur){setRevealed(prev=>[...prev,i]);setCur(i+1);sfx.reveal(p.rarity)}} } />)}
              </div>
              {allDone&&<button onClick={()=>setPhase("pack")} style={{padding:"12px 30px",background:"#FFD700",color:"#000",fontWeight:900,borderRadius:24,border:"none"}}>OPEN ANOTHER</button>}
            </div>
          )}
        </>
      )}

      {activeTab==="collection"&&<Collection collection={collection} wallet={wallet} stats={stats}/>}

      {showLeaderboard&&<LeaderboardModal onClose={()=>setShowLeaderboard(false)}/>}
      {showProfileModal&&<ProfileModal currentName={username} onUpdate={setUsername} onRefresh={()=>{}} onClose={()=>setShowProfileModal(false)}/>}
      
      <style>{`
        @keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes pBurst{0%{transform:scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
        .mobile-card-size{transition:.3s} .mobile-card-size:hover{transform:scale(1.05)}
      `}</style>
    </div>
  );
}
