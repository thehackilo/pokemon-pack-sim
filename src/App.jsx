import { useState, useEffect, useRef, useCallback, memo } from "react";
import Collection from "./Collection.jsx";
import CardDetailModal from "./CardDetailModal.jsx";
import GradingTab from "./GradingTab.jsx";
import AuthOverlay from "./AuthOverlay.jsx";
import LeaderboardModal from "./LeaderboardModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import { supabase } from "./supabaseClient.js";
import { TC, RC, getMarketPrice, generateCardProperties, calculatePSAGrade,
  GRADING_COST, GRADING_DURATION_MS } from "./constants.js";

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
        const t=this.ctx.currentTime;
        const sw=this.ctx.createOscillator();sw.type="sine";
        sw.frequency.setValueAtTime(1500,t);sw.frequency.exponentialRampToValueAtTime(9000,t+.7);
        const sg=this.ctx.createGain();sg.gain.setValueAtTime(.05,t);sg.gain.exponentialRampToValueAtTime(.001,t+.9);
        sw.connect(sg).connect(this.ctx.destination);sw.start(t);sw.stop(t+.95);
        this.noise(.5,.08,12000);
      },150);
      setTimeout(()=>{
        const t=this.ctx.currentTime;
        const o=this.ctx.createOscillator();o.type="sine";
        o.frequency.setValueAtTime(60,t);o.frequency.exponentialRampToValueAtTime(20,t+.4);
        const g=this.ctx.createGain();g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.4);
        o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.45);
      },50);
    } else if(rarity==="ultra"){
      setTimeout(()=>{this.noise(.35,.06,10000);
        const t=this.ctx.currentTime;const o=this.ctx.createOscillator();o.type="sine";
        o.frequency.setValueAtTime(2000,t);o.frequency.exponentialRampToValueAtTime(6000,t+.5);
        const g=this.ctx.createGain();g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.6);
        o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.65);
      },120);
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
  sell(){
    if(!this.ctx)return;
    // Coin drop sound
    this.tone(1319,.12,.1,"sine",0);
    this.tone(1568,.1,.08,"sine",.06);
    this.tone(2093,.15,.07,"sine",.12);
    this.noise(.04,.06,9000);
    // Cash register cha-ching
    setTimeout(()=>{
      this.tone(2637,.2,.09,"sine",0);
      this.tone(3136,.25,.07,"sine",.05);
      this.noise(.06,.04,12000);
    },140);
  }
  bulkSell(){
    if(!this.ctx)return;
    // Rapid coin cascade
    [0,40,80,120,160].forEach((d,i)=>{
      setTimeout(()=>this.tone(1319+i*200,.08,.06,"sine"),d);
    });
    setTimeout(()=>{
      this.tone(2093,.3,.1,"sine");
      this.tone(2637,.25,.08,"sine",.06);
      this.tone(3520,.2,.06,"sine",.12);
      this.noise(.08,.05,12000);
    },220);
  }
}
const sfx=new SFX();

/* ═══════════════════════════════════════════════════
   SET DEFINITIONS
   ═══════════════════════════════════════════════════ */
const SETS = [
  {
    id: "sv1",
    name: "Scarlet & Violet",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv1/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv1/symbol.png",
    total: 198,
    releaseDate: "2023/03/31",
    accentColor: "#C03028",
    gradientFrom: "#1a0505",
    gradientTo: "#3d0808",
    packGradient: "linear-gradient(140deg,#2e0505,#6b1010,#a01818)",
    description: "The first expansion of the Scarlet & Violet era!",
    packPrice: 0,
  },
  {
    id: "sv2",
    name: "Paldea Evolved",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv2/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv2/symbol.png",
    total: 193,
    releaseDate: "2023/06/09",
    accentColor: "#4ade80",
    gradientFrom: "#051a05",
    gradientTo: "#0d3d0d",
    packGradient: "linear-gradient(140deg,#0a2e0a,#106b10,#18a018)",
    description: "New powers awaken in the Paldea region!",
    packPrice: 2,
  },
  {
    id: "sv3",
    name: "Obsidian Flames",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv3/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv3/symbol.png",
    total: 197,
    releaseDate: "2023/08/11",
    accentColor: "#F08030",
    gradientFrom: "#1a0800",
    gradientTo: "#3d1800",
    packGradient: "linear-gradient(140deg,#2d0a00,#5c1a00,#8b3000)",
    description: "Charizard ex leads the charge in this fiery expansion!",
    packPrice: 4,
  },
  {
    id: "sv4",
    name: "Paradox Rift",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv4/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv4/symbol.png",
    total: 182,
    releaseDate: "2023/11/03",
    accentColor: "#7038F8",
    gradientFrom: "#0a0520",
    gradientTo: "#1a0a4a",
    packGradient: "linear-gradient(140deg,#120838,#2a1070,#4018a8)",
    description: "Ancient and Future Paradox Pokémon collide!",
    packPrice: 4,
  },
  {
    id: "sv5",
    name: "Temporal Forces",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv5/symbol.png",
    total: 162,
    releaseDate: "2024/03/22",
    accentColor: "#22d3ee",
    gradientFrom: "#051a1a",
    gradientTo: "#0d3d3d",
    packGradient: "linear-gradient(140deg,#0a2e2e,#106b6b,#18a0a0)",
    description: "The ranks of Ancient and Future Pokémon continue to grow!",
    packPrice: 4,
  },
  {
    id: "sv6",
    name: "Twilight Masquerade",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv6/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv6/symbol.png",
    total: 167,
    releaseDate: "2024/05/24",
    accentColor: "#a78bfa",
    gradientFrom: "#10051a",
    gradientTo: "#240d3d",
    packGradient: "linear-gradient(140deg,#1a0a2e,#42106b,#6118a0)",
    description: "Welcome to the land of Kitakami!",
    packPrice: 4,
  },
  {
    id: "sv6pt5",
    name: "Shrouded Fable",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv6pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv6pt5/symbol.png",
    total: 64,
    releaseDate: "2024/08/02",
    accentColor: "#fb923c",
    gradientFrom: "#1a0f05",
    gradientTo: "#3d240d",
    packGradient: "linear-gradient(140deg,#2e1a0a,#6b4210,#a06118)",
    description: "Discover the legendary Pecharunt ex!",
    packPrice: 4,
  },
  {
    id: "sv7",
    name: "Stellar Crown",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv7/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv7/symbol.png",
    total: 142,
    releaseDate: "2024/09/13",
    accentColor: "#f472b6",
    gradientFrom: "#1a0510",
    gradientTo: "#3d0d24",
    packGradient: "linear-gradient(140deg,#2e0a1a,#6b1042,#a01861)",
    description: "Descend into the depths of Area Zero!",
    packPrice: 4,
  },
  {
    id: "zsv10pt5",
    name: "Black Bolt",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/zsv10pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/zsv10pt5/symbol.png",
    total: 100,
    releaseDate: "2025/07/18",
    accentColor: "#fbbf24",
    gradientFrom: "#1a1a05",
    gradientTo: "#3d3d0d",
    packGradient: "linear-gradient(140deg,#2e2e0a,#6b6b10,#a0a018)",
    description: "A dark storm approaches!",
    packPrice: 4,
  },
  {
    id: "rsv10pt5",
    name: "White Flare",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/rsv10pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/rsv10pt5/symbol.png",
    total: 100,
    releaseDate: "2025/07/18",
    accentColor: "#f87171",
    gradientFrom: "#1a0505",
    gradientTo: "#3d0d0d",
    packGradient: "linear-gradient(140deg,#2e0505,#6b1010,#a01818)",
    description: "The celestial fire burns bright!",
    packPrice: 4,
  },
  {
    id: "sv4pt5",
    name: "Paldean Fates",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv4pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv4pt5/symbol.png",
    total: 91,
    releaseDate: "2024/01/26",
    accentColor: "#2dd4bf",
    gradientFrom: "#051a1a",
    gradientTo: "#0d3d3d",
    packGradient: "linear-gradient(140deg,#0a2e2e,#106b6b,#18a0a0)",
    description: "Shiny Pokémon return to the spotlight!",
    packPrice: 10,
  },
  {
    id: "sv8",
    name: "Surging Sparks",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv8/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv8/symbol.png",
    total: 191,
    releaseDate: "2024/11/08",
    accentColor: "#fbbf24",
    gradientFrom: "#1a1505",
    gradientTo: "#3d320d",
    packGradient: "linear-gradient(140deg,#2e250a,#6b5810,#a08318)",
    description: "Electric energy surges through the Paldea region!",
    packPrice: 10,
  },
  {
    id: "sv9",
    name: "Journey Together",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv9/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv9/symbol.png",
    total: 160,
    releaseDate: "2025/03/28",
    accentColor: "#4ade80",
    gradientFrom: "#051a0d",
    gradientTo: "#0d3d1f",
    packGradient: "linear-gradient(140deg,#0a2e18,#106b3a,#18a058)",
    description: "Explore new horizons together!",
    packPrice: 10,
  },
  {
    id: "sv10",
    name: "Destined Rivals",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv10/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv10/symbol.png",
    total: 160,
    releaseDate: "2025/05/30",
    accentColor: "#ef4444",
    gradientFrom: "#1a0505",
    gradientTo: "#3d0d0d",
    packGradient: "linear-gradient(140deg,#2e0505,#6b1010,#a01818)",
    description: "Two powerful rivals face off!",
    packPrice: 10,
  },
  {
    id: "sv3pt5",
    name: "151",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv3pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv3pt5/symbol.png",
    total: 165,
    releaseDate: "2023/09/22",
    accentColor: "#6890F0",
    gradientFrom: "#050d1a",
    gradientTo: "#0a1a3d",
    packGradient: "linear-gradient(140deg,#0a1535,#152a6b,#1e3fa0)",
    description: "Relive the original 151 Pokémon with stunning new art!",
    packPrice: 15,
  },
  {
    id: "sv8pt5",
    name: "Prismatic Evolutions",
    series: "Scarlet & Violet",
    logoUrl: "https://images.pokemontcg.io/sv8pt5/logo.png",
    symbolUrl: "https://images.pokemontcg.io/sv8pt5/symbol.png",
    total: 175,
    releaseDate: "2025/01/17",
    accentColor: "#c084fc",
    gradientFrom: "#1a051a",
    gradientTo: "#3d0d3d",
    packGradient: "linear-gradient(140deg,#2e0a2e,#6b106b,#a018a0)",
    description: "Eevee and its Evolutions take center stage!",
    packPrice: 15,
  },
  {
    id: "base1",
    name: "Base Set (Unlimited)",
    series: "Base",
    logoUrl: "https://images.pokemontcg.io/base1/logo.png",
    symbolUrl: "https://images.pokemontcg.io/base1/symbol.png",
    total: 102,
    releaseDate: "1999/01/09",
    accentColor: "#F8D030",
    gradientFrom: "#1a1505",
    gradientTo: "#3d320d",
    packGradient: "linear-gradient(140deg,#b8a038,#d4af37,#ffd700)",
    description: "The set that started it all! Relive the 1999 phenomenon.",
    packPrice: 500,
  },
  {
    id: "base1_1st",
    name: "Base Set (1st Edition)",
    series: "Base",
    logoUrl: "https://images.pokemontcg.io/base1/logo.png",
    symbolUrl: "https://images.pokemontcg.io/base1/symbol.png",
    total: 102,
    releaseDate: "1999/01/09",
    accentColor: "#fbbf24",
    gradientFrom: "#1a1a05",
    gradientTo: "#3d3d0d",
    packGradient: "linear-gradient(145deg,#222,#444,#000)", // Dark premium 1st ed look
    description: "Ultra-rare 1st Edition print run. The holy grail of collecting.",
    packPrice: 5000,
    is1stEdition: true,
  },
];

/* TC and RC are imported from constants.js */

/* Map API rarities to our internal tiers */
function mapRarity(apiRarity) {
  if (!apiRarity) return "common";
  const r = apiRarity.toLowerCase();
  if (r.includes("hyper") || r.includes("special illustration") || r.includes("secret") || r.includes("promo")) return "legendary";
  if (r.includes("illustration rare") || r.includes("ultra") || r.includes("ace spec") || r.includes("double")) return "ultra";
  if (r.includes("rare holo") || r.includes("rare")) return "rare";
  if (r.includes("uncommon")) return "uncommon";
  return "common";
}

/* Robust UUID fallback for non-secure contexts */
function genUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ═══════════════════════════════════════════════════
   CARD CACHE — fetch cards from pokemontcg.io
   ═══════════════════════════════════════════════════ */
const cardCache = {};

async function fetchSetCards(setId) {
  const apiId = setId === "base1_1st" ? "base1" : setId;
  if (cardCache[setId]) return cardCache[setId];
  
  const allCards = [];
  let page = 1;
  let totalCount = Infinity;
  
  while (allCards.length < totalCount) {
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${apiId}&pageSize=250&page=${page}&select=id,number,name,supertype,subtypes,types,hp,rarity,flavorText,rules,images,tcgplayer`;
    const res = await fetch(url);
    const data = await res.json();
    totalCount = data.totalCount;
    allCards.push(...data.data);
    page++;
    if (data.data.length === 0) break;
  }
  
  // Transform to our format — only keep Pokémon cards (not trainers/energy)
  const cards = allCards
    .filter(c => c.supertype === "Pokémon")
    .map(c => ({
      id: c.id,
      number: c.number,
      name: c.name,
      type: (c.types && c.types[0]) || "Colorless",
      rarity: mapRarity(c.rarity),
      apiRarity: c.rarity || "Common",
      imageSmall: c.images?.small,
      imageLarge: c.images?.large,
      hp: c.hp,
      subtypes: c.subtypes || [],
      tcgPrices: c.tcgplayer?.prices || null,
      tcgUrl: c.tcgplayer?.url || null,
    }));
  
  cardCache[setId] = cards;
  return cards;
}

/* ═══════════════════════════════════════════════════
   PACK GENERATION
   ═══════════════════════════════════════════════════ */
function pickR(){const r=Math.random()*100;let s=0;for(const[k,v]of Object.entries(RC)){s+=v.w;if(r<s)return k;}return"common";}

function genPack(allCards){
  const pool={common:[],uncommon:[],rare:[],ultra:[],legendary:[]};
  allCards.forEach(p=>pool[p.rarity]?.push(p));
  
  // Ensure pools aren't empty — fallback filling
  if(!pool.uncommon.length) pool.uncommon = [...pool.common];
  if(!pool.rare.length) pool.rare = [...pool.uncommon];
  if(!pool.ultra.length) pool.ultra = [...pool.rare];
  if(!pool.legendary.length) pool.legendary = [...pool.ultra];
  
  const cards=[];
  const pick=a=>a[Math.floor(Math.random()*a.length)];const used=new Set();
  const add=a=>{let c,t=0;do{c=pick(a);t++}while(used.has(c.id)&&t<50);used.add(c.id);return c;};
  
  for(let i=0;i<4;i++)cards.push(add(pool.common));
  for(let i=0;i<3;i++)cards.push(add(pool.uncommon));
  cards.push(add(pool.rare));
  for(let i=0;i<2;i++)cards.push(add(pool[pickR()]));
  
  const sorted=[...cards].sort((a,b)=>{const o={common:0,uncommon:1,rare:2,ultra:3,legendary:4};return o[a.rarity]-o[b.rarity];});
  const best=sorted.pop();return[...cards.filter(c=>c.id!==best.id).sort(()=>Math.random()-.5),best];
}

/* ═══════════════════════════════════════════════════
   CARD IMAGE — shows actual TCG card art
   ═══════════════════════════════════════════════════ */
function CardImage({card, loaded, onLoad, style}){
  const [src, setSrc] = useState(card.imageLarge || card.imageSmall);
  const tried = useRef(0);
  const handleErr = () => {
    tried.current++;
    if(tried.current === 1 && card.imageSmall) setSrc(card.imageSmall);
  };
  return <img src={src} alt={card.name} onLoad={onLoad} onError={handleErr} crossOrigin="anonymous" style={style}/>;
}

/* ═══════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════ */
function Particles({active,color,rarity}){
  const[ps,setPs]=useState([]);
  useEffect(()=>{if(!active)return;const a=[];
    const n=rarity==="legendary"?90:rarity==="ultra"?55:rarity==="rare"?30:0;
    for(let i=0;i<n;i++)a.push({i,x:50+((Math.random()-.5)*60),y:50+((Math.random()-.5)*60),
      sz:Math.random()*5+1.5,dl:Math.random()*.4,du:.5+Math.random()*1.5,
      a:Math.random()*360,d:25+Math.random()*90,sh:Math.random()>.6?"d":"c"});
    setPs(a);},[active,rarity]);
  if(!active||!ps.length)return null;
  return(<div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:6}}>
    {ps.map(p=>{const r=p.a*Math.PI/180;return(
      <div key={p.i} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.sz,height:p.sz,
        borderRadius:p.sh==="c"?"50%":"1px",transform:p.sh==="d"?"rotate(45deg)":"none",
        background:rarity==="legendary"?`radial-gradient(#fff,${color})`:`radial-gradient(${color}ee,${color}44)`,
        boxShadow:`0 0 ${p.sz*3}px ${color}`,opacity:0,
        animation:`pBurst ${p.du}s ${p.dl}s cubic-bezier(.15,.8,.25,1) forwards`,
        "--tx":`${Math.cos(r)*p.d}px`,"--ty":`${Math.sin(r)*p.d}px`}}/>);})}</div>);
}

/* ═══════════════════════════════════════════════════
   SCREEN FLASH
   ═══════════════════════════════════════════════════ */
function ScreenFlash({color,active}){
  if(!active)return null;
  return <div style={{position:"fixed",inset:0,background:color,opacity:0,zIndex:100,pointerEvents:"none",
    animation:"screenFlash .6s ease-out forwards"}}/>;
}

/* ═══════════════════════════════════════════════════
   CARD COMPONENT — shows actual TCG card images
   ═══════════════════════════════════════════════════ */
const PokemonCard = memo(function PokemonCard({pokemon,revealed,index,onClick,isLast,onFlash,onDetailClick}){
  const[imgOk,setImgOk]=useState(false);
  const[hover,setHover]=useState({x:0,y:0});
  const[showP,setShowP]=useState(false);
  const[revealAnim,setRevealAnim]=useState("");
  const ref=useRef(null);const did=useRef(false);
  const rc=RC[pokemon.rarity];const tc=TC[pokemon.type]||"#aaa";
  const isHolo=["rare","ultra","legendary"].includes(pokemon.rarity);

  useEffect(()=>{
    if(!revealed||did.current)return;did.current=true;
    sfx.flip();
    const r=pokemon.rarity;
    const delay=r==="legendary"?(isLast?600:400):r==="ultra"?(isLast?450:250):r==="rare"?200:100;
    
    setTimeout(()=>{
      sfx.reveal(r);
      if(r==="legendary"){
        setRevealAnim("legendaryReveal");
        onFlash?.("#FFD70066");
        setTimeout(()=>setShowP(true),150);
      } else if(r==="ultra"){
        setRevealAnim("ultraReveal");
        onFlash?.("#C969D944");
        setTimeout(()=>setShowP(true),100);
      } else if(r==="rare"){
        setRevealAnim("rareReveal");
        setShowP(true);
      } else if(r==="uncommon"){
        setRevealAnim("uncommonReveal");
      } else {
        setRevealAnim("commonReveal");
      }
    },delay);
  },[revealed]);

  const onMove=useCallback(e=>{if(!revealed||!ref.current)return;const b=ref.current.getBoundingClientRect();
    setHover({x:((e.clientX-b.left)/b.width-.5)*28,y:((e.clientY-b.top)/b.height-.5)*-28});},[revealed]);

  const flipDur=pokemon.rarity==="legendary"?".9s":pokemon.rarity==="ultra"?".75s":".6s";

  return(
    <div ref={ref} onClick={onClick} onMouseMove={onMove} onMouseLeave={()=>setHover({x:0,y:0})}
      className={`mobile-card-size ${revealAnim}`}
      style={{width:170,height:238,perspective:900,cursor:"pointer",
        animation:revealed?`cardIn .5s ${index*.04}s cubic-bezier(.34,1.56,.64,1) both`
          :`cardFloat 2.5s ease-in-out infinite`,
        animationDelay:revealed?`${index*.04}s`:`${index*.15}s`,
        filter:revealed?"none":"brightness(0.85) saturate(0.7)",transition:"filter .4s"}}>
      <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",
        transition:`transform ${flipDur} cubic-bezier(.175,.885,.32,1.275)`,
        transform:revealed?`rotateY(0) rotateX(${hover.y*.6}deg) rotateY(${hover.x*.6}deg)`:"rotateY(180deg)"}}>
        
        {/* ── FRONT — actual card image ── */}
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",borderRadius:10,overflow:"hidden",
          background:`linear-gradient(160deg,#12141f,${tc}12,#12141f)`,
          border:`2px solid ${rc.c}44`,
          boxShadow:revealed?`0 4px 20px ${rc.g},0 0 ${isHolo?50:15}px ${rc.g}`:"none",
          display:"flex",alignItems:"center",justifyContent:"center",transition:"box-shadow .5s"}}>
          
          {/* Holo refraction overlay */}
          {isHolo&&revealed&&<div style={{position:"absolute",inset:0,zIndex:3,pointerEvents:"none",
            background:`linear-gradient(${130+hover.x*5}deg,transparent,${rc.c}20 15%,transparent 30%,${tc}25 50%,transparent 65%,${rc.c}15 80%,transparent)`,
            mixBlendMode:"screen",transition:"background .06s"}}/>}
          
          {/* Rainbow conic for legendary */}
          {pokemon.rarity==="legendary"&&revealed&&<div style={{position:"absolute",inset:0,zIndex:4,pointerEvents:"none",
            background:`conic-gradient(from ${hover.x*12}deg at 50% 50%,#ff000018,#ff880018,#ffff0018,#00ff0018,#0088ff18,#8800ff18,#ff000018)`,
            mixBlendMode:"screen",animation:"spin 3s linear infinite"}}/>}
          
          {/* Ultra shimmer */}
          {pokemon.rarity==="ultra"&&revealed&&<div style={{position:"absolute",inset:0,zIndex:4,pointerEvents:"none",
            background:`linear-gradient(${90+hover.x*8}deg,transparent 40%,#C969D922 50%,transparent 60%)`,
            transition:"background .08s"}}/>}

          {/* Card image */}
          <CardImage card={pokemon} loaded={imgOk} onLoad={()=>setImgOk(true)}
            style={{width:"100%",height:"100%",objectFit:"cover",position:"relative",
              filter:imgOk?"none":"blur(8px) brightness(.4)",
              transition:"filter .5s ease-out"}}/>
          
          {/* Rarity badge overlay */}
          <div className="rarity-badge" style={{position:"absolute",bottom:6,right:6,zIndex:5,
            background:"#000a",backdropFilter:"blur(4px)",borderRadius:6,padding:"2px 6px",
            display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:8,color:rc.c,fontWeight:800}}>{rc.s}</span>
            <span style={{fontSize:7,color:rc.c,fontWeight:700,
              animation:isHolo?"sPulse 2s ease-in-out infinite":"none"}}>{rc.l}</span>
          </div>

          {/* 1st Edition Stamp */}
          {pokemon.variant === "1st Edition" && (
            <div style={{
              position: "absolute", bottom: 45, left: 12, zIndex: 6,
              width: 24, height: 24, borderRadius: "50%",
              background: "#000e", border: "1.5px solid #FFD700",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 10px #FFD70066", transform: "rotate(-10deg)"
            }}>
              <div style={{fontSize: 8, fontWeight: 900, color: "#FFD700", letterSpacing: -0.5}}>1st</div>
            </div>
          )}
          
          <Particles active={showP} color={rc.c} rarity={pokemon.rarity}/>
        </div>

        {/* ── BACK ── */}
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",
          borderRadius:10,overflow:"hidden",background:"linear-gradient(160deg,#0b0f1a,#161c2e,#0b0f1a)",
          border:"2px solid #1a2040",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",inset:0,opacity:.12,
            background:"repeating-conic-gradient(#243060 0deg 15deg,transparent 15deg 30deg)"}}/>
          <div className="pokeball-logo" style={{width:54,height:54,borderRadius:"50%",position:"relative",
            background:"radial-gradient(circle at 38% 32%,#fff,#e0e0e0 42%,#dc2626 43%,#ef4444 65%,#b91c1c)",
            border:"4px solid #151a2e",boxShadow:"0 0 16px #0006"}}>
            <div style={{position:"absolute",top:"50%",left:-4,right:-4,height:4,background:"#151a2e",transform:"translateY(-50%)"}}/>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              width:13,height:13,borderRadius:"50%",background:"#fff",border:"3px solid #151a2e"}}/>
          </div>
          <div className="tap-to-flip" style={{position:"absolute",bottom:14,fontSize:8,color:"#fff2",letterSpacing:2.5,textTransform:"uppercase"}}>tap to flip</div>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════
   PACK WRAPPER — themed per set
   ═══════════════════════════════════════════════════ */
function PackWrapper({onOpen, setInfo}){
  const[tp,setTp]=useState(0);const[hold,setHold]=useState(false);const[wb,setWb]=useState(0);
  const hRef=useRef(null);const pRef=useRef(0);const tRef=useRef(0);const dRef=useRef(false);
  const accent = setInfo.accentColor;

  const go=()=>{
    if(hold) return;
    try {
      sfx.init();
      setHold(true);
      if(!dRef.current){
        try { sfx.startDrone(); } catch(e) {}
        dRef.current=true;
      }
      const tick=()=>{
        if(!pRef.current) pRef.current=0;
        const spd=.8+(pRef.current/100)*2.6;
        pRef.current=Math.min(pRef.current+spd,100);
        setTp(pRef.current);
        
        try {
          const p=pRef.current/100;
          sfx.updateDrone(p);
          tRef.current++;
          if(tRef.current % Math.max(2, 12-Math.floor(p*11)) === 0) sfx.tear(p);
          setWb(Math.sin(Date.now()*.02)*p*5);
        } catch(e) {}
        
        if(pRef.current>=100){
          try { sfx.stopDrone(); sfx.tearDone(); } catch(e){}
          dRef.current=false;
          setTimeout(()=>onOpen(),350);
          return;
        }
        hRef.current=requestAnimationFrame(tick);
      };
      hRef.current=requestAnimationFrame(tick);
    } catch(err) {
      onOpen();
    }
  };

  const no=()=>{
    if(hRef.current)cancelAnimationFrame(hRef.current);setHold(false);
    if(pRef.current<100){
      try { sfx.stopDrone(); } catch(e) {}
      dRef.current=false;
      const snap=()=>{pRef.current=Math.max(pRef.current-4,0);setTp(pRef.current);setWb(0);
        if(pRef.current>0)requestAnimationFrame(snap);};snap();
    }
  };

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24}}>
      <div 
        onPointerDown={go} onPointerUp={no} onPointerLeave={no} onPointerCancel={no}
        style={{width:230,height:330,borderRadius:14,position:"relative",cursor:"pointer",
          touchAction:"none",userSelect:"none",WebkitUserSelect:"none",
          background:setInfo.packGradient,
          boxShadow:hold?`0 0 ${20+tp*.5}px ${accent}55,0 0 ${40+tp*1.2}px ${accent}22,0 8px 40px #0008`
            :"0 10px 40px #0006",
          transition:"box-shadow .2s",transform:`rotate(${wb}deg) scale(${1-tp*.001})`,
          overflow:"hidden",userSelect:"none",WebkitUserSelect:"none",touchAction:"none"}}>
        
        <div style={{position:"absolute",inset:0,
          background:"repeating-linear-gradient(45deg,transparent,transparent 8px,#ffffff06 8px,#ffffff06 16px),repeating-linear-gradient(-45deg,transparent,transparent 12px,#ffffff04 12px,#ffffff04 24px)"}}/>
        <div style={{position:"absolute",inset:0,
          background:`linear-gradient(${105+tp*1.8}deg,transparent 25%,#ffffff15 50%,transparent 75%)`,transition:"background .1s"}}/>

        {/* Set logo */}
        <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",textAlign:"center",zIndex:2,width:"85%"}}>
          <img src={setInfo.logoUrl} alt={setInfo.name} 
            style={{width:"100%",maxHeight:80,objectFit:"contain",filter:"drop-shadow(0 2px 8px #000a)"}}
            onError={e=>{e.target.style.display='none'}}/>
        </div>

        <div style={{position:"absolute",top:"50%",left:"50%",
          transform:`translate(-50%,-50%) scale(${1+tp*.004})`,
          width:85,height:85,borderRadius:"50%",zIndex:2,
          background:"radial-gradient(circle at 38% 32%,#fff,#eee 40%,#e53935 42%,#f44336 62%,#c62828)",
          border:"5px solid #111730",boxShadow:`0 0 ${8+tp*.4}px #0008,0 0 ${tp*.6}px ${accent}33`}}>
          <div style={{position:"absolute",top:"50%",left:-5,right:-5,height:5,background:"#111730",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:18,height:18,borderRadius:"50%",background:"#fff",border:"4px solid #111730",
            boxShadow:`0 0 ${3+tp*.2}px #fff6`}}/>
        </div>

        <div style={{position:"absolute",bottom:22,left:"50%",transform:"translateX(-50%)",textAlign:"center",zIndex:2}}>
          <div style={{fontSize:8,color:"#fff4",letterSpacing:3}}>10 CARDS INSIDE</div>
        </div>

        {/* Tear effects */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:`${tp*.65}%`,
          background:`linear-gradient(180deg,${accent}${Math.min(200,Math.floor(tp*2.5)).toString(16).padStart(2,'0')},transparent)`,
          zIndex:3}}/>
        {tp>5&&<div style={{position:"absolute",top:`${tp*.65}%`,left:0,right:0,height:2.5,zIndex:4,
          background:`linear-gradient(90deg,transparent 3%,${accent} 15%,#fff 50%,${accent} 85%,transparent 97%)`,
          boxShadow:`0 0 14px ${accent},0 0 35px ${accent}66`}}/>}
        {tp>25&&<div style={{position:"absolute",top:`${tp*.65-8}%`,left:0,right:0,height:35,zIndex:5,pointerEvents:"none",overflow:"hidden"}}>
          {Array.from({length:Math.floor(tp/8)}).map((_,i)=>
            <div key={i} style={{position:"absolute",left:`${8+Math.random()*84}%`,top:`${Math.random()*100}%`,
              width:1.5+Math.random()*3,height:1.5+Math.random()*3,background:accent,borderRadius:"50%",
              boxShadow:`0 0 5px ${accent}`,animation:`sDrift .7s ${Math.random()*.4}s ease-out infinite`}}/>)}
        </div>}
      </div>

      <div style={{textAlign:"center"}}>
        <div style={{fontSize:14,color:hold?accent:"#fff6",fontWeight:hold?700:400,
          transition:"all .3s",animation:hold?"none":"breathe 2.5s ease-in-out infinite"}}>
          {hold?`Tearing... ${Math.floor(tp)}%`:"Hold to tear open"}</div>
        <div style={{width:200,height:3,borderRadius:2,background:"#fff1",overflow:"hidden",margin:"10px auto 0"}}>
          <div style={{width:`${tp}%`,height:"100%",
            background:`linear-gradient(90deg,${accent},#fff,${accent})`,borderRadius:2,
            boxShadow:tp>0?`0 0 8px ${accent}`:"none",transition:"width .03s"}}/>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SET SELECTOR — gorgeous set picker
   ═══════════════════════════════════════════════════ */
function SetSelector({onSelect, currentSetId}) {
  const [hovered, setHovered] = useState(null);
  
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24,animation:"slideUp .5s ease-out",width:"100%",maxWidth:800}}>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:13,color:"#fff3",letterSpacing:4,textTransform:"uppercase",marginBottom:8}}>Select a Set</div>
      </div>
      
      <div className="mobile-set-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16,width:"100%",padding:"0 12px"}}>
        {SETS.map((set) => {
          const isHovered = hovered === set.id;
          const isActive = currentSetId === set.id;
          return (
            <div key={set.id}
              onClick={() => onSelect(set)}
              onMouseEnter={() => {setHovered(set.id); sfx.init(); sfx.hover();}}
              onMouseLeave={() => setHovered(null)}
              className="mobile-set-card"
              style={{
                cursor:"pointer",
                background: isHovered 
                  ? `linear-gradient(145deg,${set.gradientFrom}ee,${set.gradientTo}ee)`
                  : `linear-gradient(145deg,${set.gradientFrom}88,${set.gradientTo}88)`,
                border: isActive ? `2px solid ${set.accentColor}88` : "2px solid #ffffff10",
                borderRadius:16,
                padding:"20px 20px 16px",
                transition:"all .3s cubic-bezier(.4,0,.2,1)",
                transform: isHovered ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
                boxShadow: isHovered 
                  ? `0 12px 40px ${set.accentColor}33,0 0 60px ${set.accentColor}11`
                  : "0 4px 20px #0004",
                position:"relative",
                overflow:"hidden",
              }}>
              {/* Shimmer overlay */}
              <div style={{position:"absolute",inset:0,
                background:`linear-gradient(105deg,transparent 40%,${set.accentColor}08 50%,transparent 60%)`,
                animation: isHovered ? "shimmer 2s ease-in-out infinite" : "none",
                backgroundSize:"200% 100%"}}/>
              
              {/* Set logo */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,position:"relative",zIndex:1}}>
                <img src={set.logoUrl} alt={set.name} 
                  style={{maxWidth:"100%",maxHeight:50,objectFit:"contain",
                    filter:`drop-shadow(0 2px 8px ${set.accentColor}44)`}}
                  onError={e=>{e.target.style.display='none'}}/>
              </div>
              
              {/* Set info */}
              <div style={{position:"relative",zIndex:1}}>
                <div style={{fontSize:11,color:"#fff5",marginBottom:4}}>{set.description}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <span style={{fontSize:9,color:"#fff3",letterSpacing:1}}>{set.total} CARDS</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:800,
                      color:set.packPrice===0?"#4ade80":"#FFD700"}}>
                      {set.packPrice===0?"FREE":`$${set.packPrice.toFixed(2)}`}
                    </span>
                    <span style={{fontSize:9,color:set.accentColor,fontWeight:700,letterSpacing:1,
                      opacity:isActive?1:.6}}>
                      {isActive ? "✓ SELECTED" : "SELECT →"}
                    </span>
                  </div>
                </div>
              </div>
              {/* Info section */}
              <div className="info-section" style={{ padding: "8px 10px 6px" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LOADING SPINNER
   ═══════════════════════════════════════════════════ */
function LoadingSpinner({setInfo}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,animation:"fadeIn .5s ease-out"}}>
      <div style={{width:60,height:60,borderRadius:"50%",position:"relative",
        border:`3px solid ${setInfo.accentColor}22`,borderTopColor:setInfo.accentColor,
        animation:"spin 1s linear infinite"}}/>
      <div style={{fontSize:13,color:"#fff6",letterSpacing:2}}>Loading {setInfo.name}...</div>
      <div style={{fontSize:10,color:"#fff3"}}>Fetching card data from pokemontcg.io</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════ */
let uidCounter = 0;

export default function App(){
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  // Keep references to prevent stale closures in sync helpers
  useEffect(() => { userRef.current = user; }, [user]);

  const[phase,setPhase]=useState("select"); // select | loading | pack | revealing
  const[selectedSet,setSelectedSet]=useState(null);
  const[cardPool,setCardPool]=useState([]);
  const[cards,setPackCards]=useState([]);
  const[revealed,setRevealed]=useState([]);
  const[cur,setCur]=useState(0);
  const[collection,setCollection]=useState([]);  // flat array of all collected cards (with duplicates)
  const[stats,setStats]=useState({packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0});
  const[flash,setFlash]=useState(null);
  const[shake,setShake]=useState(false);
  const[wallet,setWallet]=useState(25.00);
  const[activeTab,setActiveTab]=useState("open"); // "open" | "collection" | "grading"
  const[walletFlash,setWalletFlash]=useState(null); // "green" | "red" | null
  const[autoSellThreshold,setAutoSellThreshold]=useState(0); // 0 = disabled
  const[detailCard,setDetailCard]=useState(null); // card for detail modal

  const doFlash=(color)=>{setFlash(color);setTimeout(()=>setFlash(null),700);};
  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500);};
  const flashWallet=(color)=>{setWalletFlash(color);setTimeout(()=>setWalletFlash(null),600);};

  // Auth & DB Hydration
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (user?.id === "guest") {
      setUser(null);
      setCollection([]);
      setWallet(25.00);
      setStats({packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0});
      return;
    }
    await supabase.auth.signOut();
  };

  const handleUserSession = async (loggedInUser) => {
    if (loggedInUser) {
      setUser(loggedInUser);
      if (loggedInUser.id === "guest") {
        setAuthLoading(false);
        return; // handle bypass option
      }
      // Load user profile
      try {
        const { data: pData, error: pError } = await supabase.from('profiles').select('*').eq('id', loggedInUser.id).single();
        if (pError && pError.code !== 'PGRST116') throw pError; // PGRST116 is "no rows found"

        if (pData) {
          const wVal = parseFloat(pData.wallet);
          setWallet(isNaN(wVal) ? 25.00 : wVal);
          setStats(pData.stats || {packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0});
          setAutoSellThreshold(Number(pData.auto_sell_threshold) || 0);
          setUsername(pData.username || "");
        } else {
          // Create initial profile if it doesn't exist yet
          const initialStats = {packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0};
          await supabase.from('profiles').insert({
            id: loggedInUser.id,
            wallet: 25.00,
            stats: initialStats,
            auto_sell_threshold: 0
          });
          setWallet(25.00);
          setStats(initialStats);
        }
      } catch (err) {
        console.error("Profile Load Error:", err);
        // Fallback to guest-like behavior if fetch fails critically
      }
      // Load collection
      const { data: cData } = await supabase.from('cards').select('*').eq('user_id', loggedInUser.id);
      if (cData) {
        setCollection(cData.map(row => ({
          uid: row.uid,
          id: row.card_id,
          setId: row.set_id,
          setName: row.set_name,
          ...row.api_data,
          variant: row.api_data?.variant || null,
          properties: row.properties,
          gradingStartTime: row.grading_start_time,
          psaGrade: row.psa_grade
        })));
      }
    } else {
      setUser(null);
    }
    setAuthLoading(false);
  };

  const refreshProfile = async () => {
    const u = userRef.current;
    if (!u || u.id === "guest") return;
    setAuthLoading(true);
    await handleUserSession(u);
    setAuthLoading(false);
  };

  // Sync Helpers
  const syncWalletTransaction = async (amount, newStats) => {
    const u = userRef.current;
    if (u && u.id !== "guest") {
      try {
        const { error } = await supabase.rpc('process_transaction', { p_amount: amount, p_stats: newStats });
        if (error) {
           console.warn("RPC Sync failed, falling back to basic sync:", error);
           syncWalletAndStats(wallet + amount, newStats);
        }
      } catch(err) {
        syncWalletAndStats(wallet + amount, newStats);
      }
    }
  };

  const syncAutoSellThreshold = (val) => {
    const u = userRef.current;
    if (u && u.id !== "guest") {
      supabase.from('profiles').update({ auto_sell_threshold: val }).eq('id', u.id).then();
    }
  };

  const syncCardsInsert = (cardsArray) => {
    const u = userRef.current;
    if (u && u.id !== "guest" && cardsArray.length > 0) {
      const records = cardsArray.map(c => ({
        uid: c.uid, user_id: u.id, card_id: c.id, set_id: c.setId, set_name: c.setName,
        api_data: { 
          name: c.name, supertype: c.supertype, subtypes: c.subtypes, rarity: c.rarity, apiRarity: c.apiRarity,
          imageSmall: c.imageSmall, imageLarge: c.imageLarge, rules: c.rules, flavorText: c.flavorText, hp: c.hp, types: c.types,
          tcgPrices: c.tcgPrices, variant: c.variant || null
        },
        properties: c.properties, grading_start_time: c.gradingStartTime || null, psa_grade: c.psaGrade || null
      }));
      supabase.from('cards').insert(records).then(({error}) => {
        if(error) alert("Database Sync Error: " + error.message);
      });
    }
  };

  const syncCardDelete = (uidsArray) => {
    const u = userRef.current;
    if (u && u.id !== "guest" && uidsArray.length > 0) {
      supabase.from('cards').delete().in('uid', uidsArray).then();
    }
  };

  const syncCardUpdate = (uid, updates) => {
    const u = userRef.current;
    if (u && u.id !== "guest") {
      supabase.from('cards').update(updates).eq('uid', uid).then();
    }
  };

  const handleSelectSet = async (set) => {
    setSelectedSet(set);
    setPhase("loading");
    try {
      const fetched = await fetchSetCards(set.id);
      setCardPool(fetched);
      setPhase("pack");
    } catch(err) {
      console.error("Failed to fetch cards:", err);
      setPhase("select");
    }
  };

  const openPack=() => {
    const cost = selectedSet?.packPrice || 0;
    if (wallet < cost) { flashWallet("red"); doShake(); return; }
    
    // Generate cards and properties instantly
    const newCards = genPack(cardPool).map(c => ({
      ...c, uid: crypto.randomUUID(), setId: selectedSet?.id, setName: selectedSet?.name,
      properties: generateCardProperties(),
      variant: selectedSet?.is1stEdition ? "1st Edition" : null,
    }));

    // Increment stats
    const ns={...stats,packs:stats.packs+1};
    newCards.forEach(c=>{ns[c.rarity]=(ns[c.rarity]||0)+1;});
    setStats(ns);

    // Calculate net wallet change (Auto-Sell Earnings - Pack Cost)
    let netChange = -cost;
    const toKeep = [];
    
    if (autoSellThreshold > 0) {
      let autoSellEarnings = 0;
      newCards.forEach(c => {
        const price = getCardValue(c);
        if (price < autoSellThreshold && price > 0) {
          autoSellEarnings += price;
        } else {
          toKeep.push(c);
        }
      });
      netChange += autoSellEarnings;
      setCollection(prev => [...prev, ...toKeep]);
      syncCardsInsert(toKeep);
    } else {
      setCollection(prev => [...prev, ...newCards]);
      syncCardsInsert(newCards);
    }

    // Atomic wallet update
    setWallet(curr => {
      const updated = curr + netChange;
      syncWalletAndStats(updated, ns); // Sync with the precise calculated value
      return updated;
    });

    if (netChange > -cost) flashWallet("green");
    else if (cost > 0) flashWallet("red");

    setPackCards(newCards);
    setRevealed([]);setCur(0);setPhase("revealing");
  };
  const revealCard=i=>{if(i!==cur)return;setRevealed(p=>[...p,i]);setCur(p=>p+1);};
  const revealAll=()=>{for(let i=cur;i<cards.length;i++){
    ((idx,d)=>setTimeout(()=>{setRevealed(p=>[...p,idx]);setCur(idx+1);},d))(i,(i-cur)*140);}};
  const keep=()=>{sfx.collect(); setPhase("pack");};


  const handleSell = (card, price) => {
    sfx.init();
    sfx.sell();
    setCollection(prev => prev.filter(c => c.uid !== card.uid));
    setWallet(curr => {
      const updated = curr + price;
      syncWalletAndStats(updated, stats);
      flashWallet("green");
      return updated;
    });
    syncCardDelete([card.uid]);
  };

  const handleBulkSell = (cardsArray) => {
    if (cardsArray.length === 0) return;
    sfx.init();
    sfx.bulkSell();
    const totalEarned = cardsArray.reduce((s, c) => s + getCardValue(c), 0);
    const uidsToRemove = new Set(cardsArray.map(c => c.uid));
    setCollection(prev => prev.filter(c => !uidsToRemove.has(c.uid)));
    setWallet(curr => {
      const updated = curr + totalEarned;
      syncWalletAndStats(updated, stats);
      flashWallet("green");
      return updated;
    });
    syncCardDelete(Array.from(uidsToRemove));
  };

  // PSA Grading handlers
  const handleSubmitGrading = (card) => {
    setCollection(prev => {
      const target = prev.find(c => c.uid === card.uid);
      if (target?.gradingStartTime) return prev; // Already grading

      setWallet(currentWallet => {
        if (currentWallet < GRADING_COST) { flashWallet("red"); return currentWallet; }
        sfx.collect(); // submission sound
        const w = currentWallet - GRADING_COST;
        syncWalletAndStats(w, stats);
        flashWallet("red");
        const st = Date.now();
        syncCardUpdate(card.uid, { grading_start_time: st });
        return w;
      });

      return prev.map(c => c.uid === card.uid ? { ...c, gradingStartTime: Date.now() } : c);
    });
  };

  // Check for completed grading every second
  useEffect(() => {
    const iv = setInterval(() => {
      setCollection(prev => {
        let changed = false;
        const next = prev.map(c => {
          if (c.gradingStartTime && !c.psaGrade) {
            const elapsed = Date.now() - c.gradingStartTime;
            if (elapsed >= GRADING_DURATION_MS) {
              changed = true;
              const grade = calculatePSAGrade(c.properties);
              syncCardUpdate(c.uid, { psa_grade: grade, grading_start_time: null });
              return { ...c, psaGrade: grade, gradingStartTime: null };
            }
          }
          return c;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const best=cards.length?cards[cards.length-1]:null;
  const allDone=revealed.length===cards.length&&cards.length>0;
  const packCost = selectedSet?.packPrice || 0;
  const canAfford = wallet >= packCost;

  if (authLoading) {
    return <div style={{height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#050810", color: "#FFD700", fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: 4, textShadow: "0 0 20px #FFD700aa"}}>Connecting to Global Network...</div>;
  }

  return(
    <div className={shake?"shakeAnim":""}
      style={{minHeight:"100vh",
        background:"radial-gradient(ellipse at 20% 50%,#0f172a,transparent 50%),radial-gradient(ellipse at 80% 20%,#1e1b4b22,transparent 50%),linear-gradient(180deg,#050810,#0a1018,#050810)",
        fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",color:"#fff",
        display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 12px",
        overflow:"hidden",position:"relative"}}>
      
      {!user && <AuthOverlay onLogin={handleUserSession} />}
      <ScreenFlash color={flash} active={!!flash}/>

      <style>{`
        @keyframes cardIn{0%{transform:translateY(40px)scale(.7);opacity:0}60%{transform:translateY(-10px)scale(1.08)}80%{transform:translateY(3px)scale(.97)}100%{transform:translateY(0)scale(1);opacity:1}}
        @keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes breathe{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes pBurst{0%{opacity:1;transform:translate(0,0)scale(1)}60%{opacity:.7}100%{opacity:0;transform:translate(var(--tx),var(--ty))scale(0)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sPulse{0%,100%{text-shadow:0 0 4px currentColor}50%{text-shadow:0 0 14px currentColor,0 0 28px currentColor}}
        @keyframes sFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes sDrift{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(12px)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes screenFlash{0%{opacity:.6}100%{opacity:0}}
        .legendaryReveal{animation:legendaryPop .8s ease-out!important}
        @keyframes legendaryPop{0%{transform:scale(1)}15%{transform:scale(1.18) rotate(-1deg)}30%{transform:scale(1.22) rotate(1deg);filter:brightness(2) drop-shadow(0 0 30px #FFD700)}50%{transform:scale(1.15);filter:brightness(1.5) drop-shadow(0 0 20px #FFD700)}70%{transform:scale(1.05);filter:brightness(1.2)}100%{transform:scale(1);filter:brightness(1)}}
        .ultraReveal{animation:ultraPop .6s ease-out!important}
        @keyframes ultraPop{0%{transform:scale(1)}20%{transform:scale(1.12);filter:brightness(1.8) drop-shadow(0 0 20px #C969D9)}50%{transform:scale(1.08);filter:brightness(1.3)}100%{transform:scale(1);filter:brightness(1)}}
        .rareReveal{animation:rarePop .5s ease-out!important}
        @keyframes rarePop{0%{transform:scale(1)}25%{transform:scale(1.08);filter:brightness(1.4)}100%{transform:scale(1);filter:brightness(1)}}
        .uncommonReveal{animation:uncommonPop .35s ease-out!important}
        @keyframes uncommonPop{0%{transform:scale(1)}30%{transform:scale(1.04)}100%{transform:scale(1)}}
        .commonReveal{animation:commonPop .25s ease-out!important}
        @keyframes commonPop{0%{transform:scale(1)}30%{transform:scale(1.02)}100%{transform:scale(1)}}
        .shakeAnim{animation:shake .5s ease-out}
        @keyframes shake{0%,100%{transform:translateX(0)}10%{transform:translateX(-6px)}20%{transform:translateX(5px)}30%{transform:translateX(-4px)}40%{transform:translateX(3px)}50%{transform:translateX(-2px)}}
        button:hover{filter:brightness(1.15)!important}button:active{transform:scale(.97)!important}
        @media(max-width: 768px) {
          .mobile-stack { flex-direction: column !important; align-items: stretch !important; gap: 16px; padding: 12px !important; box-sizing: border-box !important; max-width: 100vw !important; overflow-x: hidden !important; }
          .mobile-stack > div { align-items: stretch !important; text-align: left; }
          .mobile-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important; gap: 8px !important; padding: 4px !important; }
          .mobile-tabs { width: 100%; justify-content: center; flex-wrap: wrap; gap: 4px !important; }
          .mobile-tabs button { flex: 1 1 30%; padding: 8px 6px !important; font-size: 12px !important; }
          .mobile-header-txt { font-size: 18px !important; }
          .mobile-hide { display: none !important; }
          .mobile-h1 { padding: 16px !important; margin-bottom: 16px !important; }
          .mobile-h1 > div:first-child { font-size: 20px !important; letter-spacing: 1px !important; }
          .mobile-set-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; padding: 0 4px !important; }
          .mobile-set-card { padding: 10px 8px !important; }
          .mobile-scroll-row { flex-wrap: nowrap !important; overflow-x: auto !important; padding-bottom: 8px !important; justify-content: flex-start !important; scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100% !important; box-sizing: border-box !important; }
          .mobile-scroll-row::-webkit-scrollbar { display: none; }
          .mobile-btn-pill { padding: 6px 12px !important; font-size: 11px !important; white-space: nowrap !important; flex: 0 0 auto !important; }
          .mobile-panel-pd { padding: 12px !important; flex: none !important; width: 100% !important; box-sizing: border-box !important; }
          .mobile-summary-box { padding: 16px 12px !important; gap: 12px !important; flex-wrap: wrap !important; width: 100% !important; box-sizing: border-box !important; justify-content: center !important; }
          .mobile-summary-box > div { min-width: 45% !important; }
          .mobile-summary-box > div:nth-child(even) { display: none !important; }
          .mobile-filter-stack { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; margin-bottom: 24px !important; width: 100% !important; box-sizing: border-box !important; }
          .mobile-card-size { width: 100px !important; height: auto !important; min-height: 140px !important; }
          .mobile-card-size .particles { display: none !important; }
          .mobile-card-size .info-section { display: none !important; }
          .mobile-card-size .slab-footer { display: none !important; }

          /* Restore info section ONLY in Collection & Grading where buttons are needed */
          .collection-tab .mobile-card-size .info-section,
          .grading-card .info-section { display: block !important; padding: 4px !important; }
          .grading-card .slab-footer { display: block !important; }
          .grading-card { width: 100% !important; min-height: 200px !important; }
        }
      `}</style>

      {/* HEADER NAV BAR */}
      <div className="mobile-stack" style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", marginBottom: 24, 
        background: "linear-gradient(180deg,rgba(22,27,42,0.95) 0%,rgba(22,27,42,0.85) 100%)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #ffffff11",
        animation: "slideUp .6s ease-out"
      }}>
        {/* App Title */}
        <div>
          <h1 className="mobile-header-txt" style={{fontSize:22,fontWeight:900,margin:0,letterSpacing:2,
            background:"linear-gradient(135deg,#FFD700,#FFA000,#FFD700,#FFE44D)",backgroundSize:"200% 100%",
            animation:"shimmer 3s ease-in-out infinite",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            POKÉMON PACK SIM
          </h1>
          <div style={{fontSize:12,color:"#fff4",marginTop:4,letterSpacing:2}}>
            {selectedSet ? `${selectedSet.series.toUpperCase()} — ${selectedSet.name.toUpperCase()}` : "SCARLET & VIOLET ERA"}
          </div>
        </div>

        {/* Tabs */}
        <div className="mobile-tabs" style={{display:"flex", gap: 8, background:"#ffffff08", borderRadius: 16, padding: 4}}>
          {[
            {id:"open",label:"🎴 Open Packs"},
            {id:"collection",label:`📚 Collection (${collection.length})`},
            {id:"grading",label:`⚡ Grading (${collection.filter(c=>c.gradingStartTime&&!c.psaGrade).length||collection.filter(c=>c.psaGrade).length||"—"})`}
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              padding:"10px 24px", borderRadius: 12, border:"none", cursor:"pointer", 
              fontSize: 14, fontWeight: 700, letterSpacing: .5, transition:"all .2s ease-out",
              background:activeTab===tab.id?"linear-gradient(135deg,#FFD70033,#FFA00022)":"transparent",
              color:activeTab===tab.id?"#FFD700":"#fff6",
              boxShadow:activeTab===tab.id?"0 2px 16px #FFD70022":"none"
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Wallet & Account */}
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap: 6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 20px",borderRadius:24,
            background:walletFlash==="green"?"#22c55e22":walletFlash==="red"?"#ef444422":"linear-gradient(135deg,#ffffff11,#ffffff05)",
            border:`1px solid ${walletFlash==="green"?"#22c55e55":walletFlash==="red"?"#ef444455":"#ffffff22"}`,
            transition:"all .2s",transform:walletFlash?"scale(1.05)":"scale(1)"}}>
            <span style={{fontSize:18}}>💰</span>
            <span style={{fontSize:20,fontWeight:800,color:"#FFD700",fontFamily:"'Courier New',monospace"}}>${wallet.toFixed(2)}</span>
          </div>

          <div style={{display:"flex", alignItems:"center", gap: 8}}>
            {user && (
              <div style={{fontSize: 10, color: "#fff6", display: "flex", alignItems: "center", gap: 12}}>
                <button onClick={() => setShowLeaderboard(true)} style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', color: '#FFD700', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🏆 LEADERBOARD
                </button>
                <div style={{ height: 12, width: 1, background: '#fff2' }} />
                <button onClick={() => setShowProfileModal(true)} style={{background: "#ffffff11", padding: "4px 10px", borderRadius: 12, border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6}}>
                  👤 {user.id === "guest" ? "Guest Vault" : (username || user.email)}
                </button>
                <button onClick={handleSignOut} style={{background: "none", border: "none", color: "#fca5a5", fontSize: 10, cursor: "pointer", textDecoration: "underline"}}>Log Out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-header Context / Actions */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20, padding: "0 24px"}}>
        {phase !== "select" && activeTab === "open" && phase === "pack" && (
           <button onClick={()=>{setPhase("select");setActiveTab("open");sfx.hover();}} onMouseEnter={()=>sfx.hover()}
              style={{padding:"8px 18px",borderRadius:8,border:"1px solid #fff2",background:"#ffffff08",
                color:"#fffa",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s",letterSpacing:1}}>
              🔙 Return to Set Selection
           </button>
        )}
        <div style={{ flex: 1 }} />
        {/* Pack stats */}
        <div style={{fontSize:13,color:"#fff4"}}>
          📦 Opened {stats.packs} packs
          {stats.legendary>0 && <span style={{marginLeft: 12, color:"#FFD700",fontWeight:700}}>✦ {stats.legendary} Legendary</span>}
        </div>
      </div>

      {activeTab === "open" && phase === "select" && <SetSelector onSelect={handleSelectSet} currentSetId={selectedSet?.id}/>}
      {activeTab === "open" && phase === "loading" && selectedSet && <div style={{marginTop:60}}><LoadingSpinner setInfo={selectedSet}/></div>}

      {activeTab === "open" && phase === "pack" && selectedSet && (
        <div style={{animation:"slideUp .5s ease-out",display:"flex",flexDirection:"column",alignItems:"center",marginTop:28}}>
          {!canAfford && packCost > 0 && (
            <div style={{marginBottom:16,padding:"10px 20px",borderRadius:12,background:"#ef444422",border:"1px solid #ef444444",
              color:"#fca5a5",fontSize:12,textAlign:"center",animation:"fadeIn .3s ease-out"}}>
              💸 Not enough funds! You need ${packCost.toFixed(2)} — Sell cards or open Paradox Rift (FREE)</div>)}
          {packCost > 0 && <div style={{marginBottom:12,fontSize:12,color:canAfford?"#4ade80":"#ef4444",fontWeight:600}}>Pack cost: ${packCost.toFixed(2)}</div>}
          {packCost === 0 && <div style={{marginBottom:12,fontSize:12,color:"#4ade80",fontWeight:600}}>✨ FREE PACKS</div>}
          <PackWrapper onOpen={openPack} setInfo={selectedSet}/></div>)}

      {activeTab === "open" && phase === "revealing" && (
        <div style={{animation:"slideUp .3s ease-out",display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:1060}}>
          {/* Controls ABOVE cards */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",alignItems:"center",marginBottom:16,padding:"0 20px"}}>
            {!allDone&&<>
              <div style={{fontSize:12,color:"#fff4"}}>Tap to flip · {revealed.length}/{cards.length}</div>
              <button onClick={revealAll} onMouseEnter={()=>sfx.hover()}
                style={{padding:"10px 24px",borderRadius:20,border:"1px solid #FFD70088",background:"#FFD70015",
                  color:"#FFD700",fontSize:13,fontWeight:900,cursor:"pointer",boxShadow:"0 4px 15px #FFD70022"}}>
                ✨ REVEAL ALL
              </button>
            </>}
            {allDone&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,animation:"slideUp .3s ease-out"}}>
                {best&&<div style={{fontSize:15,color:RC[best.rarity].c,fontWeight:800,textAlign:"center",
                  textShadow:`0 0 24px ${RC[best.rarity].g}`,
                  animation:["ultra","legendary"].includes(best.rarity)?"sPulse 2s infinite":"none"}}>
                  Best pull: {best.name}!</div>}
                <button onClick={()=>{setRevealed([]);setPhase("pack");}} onMouseEnter={()=>sfx.hover()}
                  style={{padding:"12px 32px",borderRadius:24,border:"none",background:"linear-gradient(135deg,#FFD700,#FFA000)",
                    color:"#000",fontSize:14,fontWeight:900,cursor:"pointer",boxShadow:"0 6px 20px #FFD70044"}}>
                  OPEN ANOTHER PACK
                </button>
            </div>}
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:11,justifyContent:"center",padding:6,marginBottom:14}}>
            {cards.map((p,i)=><PokemonCard key={`${p.id}-${i}`} pokemon={p} revealed={revealed.includes(i)}
              index={i} isLast={i===cards.length-1}
              onClick={()=>{if(revealed.includes(i)){setDetailCard({...p,properties:generateCardProperties()});}else{revealCard(i);}}}
              onFlash={(c)=>{doFlash(c);if(p.rarity==="legendary")doShake();}}/> )}
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",alignItems:"center",marginTop:6}}>
            {!allDone&&<>
              <div style={{fontSize:12,color:"#fff4"}}>Tap cards in order · {revealed.length}/{cards.length}</div>
              <button onClick={revealAll} onMouseEnter={()=>sfx.hover()}
                style={{padding:"8px 20px",borderRadius:20,border:"1px solid #fff2",background:"#ffffff08",
                  color:"#fff9",fontSize:12,cursor:"pointer",transition:"all .2s"}}>Reveal All</button></>}
            {allDone&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,animation:"slideUp .4s ease-out"}}>
              {best&&<div style={{fontSize:15,color:RC[best.rarity].c,fontWeight:800,textAlign:"center",
                textShadow:`0 0 24px ${RC[best.rarity].g}`,
                animation:["ultra","legendary"].includes(best.rarity)?"sPulse 2s infinite":"none"}}>
                Best pull: {best.name} — {RC[best.rarity].l}!</div>}
              {best&&best.tcgPrices&&<div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>
                Market value: ${getMarketPrice(best).toFixed(2)}</div>}
              <button onClick={keep} onMouseEnter={()=>sfx.hover()}
                style={{padding:"12px 36px",borderRadius:24,border:"none",
                  background:`linear-gradient(135deg,${selectedSet?.accentColor||"#FFD700"},${selectedSet?.accentColor||"#FF8C00"}cc)`,
                  color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",
                  boxShadow:`0 4px 20px ${selectedSet?.accentColor||"#FFD700"}44`,letterSpacing:1.5,transition:"all .2s",
                  textTransform:"uppercase"}}>Collect & Open Another</button>
            </div>}
          </div></div>)}

      {activeTab === "collection" && (
        <div className="collection-tab" style={{width:"100%"}}>
          <Collection collection={collection} onSell={handleSell} onBulkSell={handleBulkSell} wallet={wallet} sets={SETS}
            autoSellThreshold={autoSellThreshold} onAutoSellThresholdChange={(val) => { setAutoSellThreshold(val); syncAutoSellThreshold(val); }}
            onCardClick={setDetailCard}/>
        </div>
      )}

      {activeTab === "grading" && (
        <GradingTab collection={collection} wallet={wallet}
          onSubmitGrading={handleSubmitGrading} onCardClick={setDetailCard}/>
      )}

      {detailCard && <CardDetailModal card={detailCard} onSell={handleSell} onClose={() => setDetailCard(null)} />}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
      {showProfileModal && (
        <ProfileModal 
          currentName={username} 
          onUpdate={setUsername} 
          onRefresh={refreshProfile}
          onClose={() => setShowProfileModal(false)} 
        />
      )}

      <div style={{position:"fixed",bottom:10,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#fff15",letterSpacing:1}}>
        🔊 Sound on for full experience</div>
    </div>
  );
}
