/* ═══════════════════════════════════════════════════
   TYPE COLORS & RARITY CONFIG (shared)
   ═══════════════════════════════════════════════════ */
export const TC={Grass:"#78C850",Fire:"#F08030",Water:"#6890F0",Lightning:"#F8D030",Psychic:"#F85888",
  Fighting:"#C03028",Darkness:"#705848",Metal:"#B8B8D0",Dragon:"#7038F8",Fairy:"#EE99AC",
  Colorless:"#A8A878",grass:"#78C850",fire:"#F08030",water:"#6890F0",bug:"#A8B820",normal:"#A8A878",
  poison:"#A040A0",electric:"#F8D030",ground:"#E0C068",fairy:"#EE99AC",fighting:"#C03028",
  psychic:"#F85888",rock:"#B8A038",ghost:"#705898",ice:"#98D8D8",dragon:"#7038F8"};

export const RC={
  common:{l:"Common",s:"●",c:"#8B9DAF",g:"transparent",w:45},
  uncommon:{l:"Uncommon",s:"◆",c:"#5DB35D",g:"#5DB35D44",w:30},
  rare:{l:"Rare",s:"★",c:"#4A90D9",g:"#4A90D966",w:15},
  ultra:{l:"Ultra Rare",s:"★★",c:"#C969D9",g:"#C969D988",w:7},
  legendary:{l:"Legendary",s:"✦✦✦",c:"#FFD700",g:"#FFD700BB",w:3},
};

export function getMarketPrice(card) {
  if (!card.tcgPrices) return 0;
  const p = card.tcgPrices;
  return p.holofoil?.market || p.reverseHolofoil?.market || p.normal?.market || p.unlimitedHolofoil?.market || p["1stEditionHolofoil"]?.market || 0;
}

/** Get the effective value of a card (market price × PSA multiplier if graded) */
export function getCardValue(card) {
  const base = getMarketPrice(card);
  if (card.psaGrade) {
    return base * PSA_MULTIPLIERS[card.psaGrade];
  }
  return base;
}

/* ═══════════════════════════════════════════════════
   CARD GRADING PROPERTIES
   Pack-fresh cards: condition rarely below 7
   ═══════════════════════════════════════════════════ */
export const CONDITIONS = [
  { id: "gem-mint",  label: "Gem Mint",       grade: 10,  color: "#FFD700", weight: 5 },
  { id: "mint",      label: "Mint",           grade: 9.5, color: "#4ade80", weight: 15 },
  { id: "near-mint", label: "Near Mint",      grade: 9,   color: "#22d3ee", weight: 30 },
  { id: "excellent", label: "Excellent",      grade: 8.5, color: "#60a5fa", weight: 25 },
  { id: "good",      label: "Good",           grade: 8,   color: "#a78bfa", weight: 15 },
  { id: "light-play",label: "Light Play",     grade: 7,   color: "#fb923c", weight: 8 },
  { id: "moderate",  label: "Moderate Play",  grade: 6,   color: "#f87171", weight: 1.5 },
  { id: "heavy",     label: "Heavy Play",     grade: 4,   color: "#ef4444", weight: 0.5 },
];

export const CENTERINGS = [
  { id: "perfect",   label: "Perfect",        score: 10,  color: "#FFD700", weight: 10 },
  { id: "near-perf", label: "Near Perfect",   score: 9,   color: "#4ade80", weight: 25 },
  { id: "slight-off",label: "Slightly Off",   score: 7.5, color: "#60a5fa", weight: 35 },
  { id: "off-center",label: "Off-Center",     score: 5,   color: "#fb923c", weight: 22 },
  { id: "heavy-off", label: "Heavily Off",    score: 3,   color: "#ef4444", weight: 8 },
];

export const COLORINGS = [
  { id: "pristine",  label: "Pristine",       score: 10,  color: "#FFD700", weight: 8 },
  { id: "vibrant",   label: "Vibrant",        score: 9,   color: "#4ade80", weight: 28 },
  { id: "standard",  label: "Standard",       score: 7.5, color: "#60a5fa", weight: 38 },
  { id: "slight-fade",label:"Slightly Faded", score: 5.5, color: "#fb923c", weight: 20 },
  { id: "faded",     label: "Faded",          score: 3,   color: "#ef4444", weight: 6 },
];

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/** Generate random grading properties for a pulled card */
export function generateCardProperties() {
  const condition = weightedPick(CONDITIONS);
  const centering = weightedPick(CENTERINGS);
  const coloring = weightedPick(COLORINGS);
  const overallGrade = ((condition.grade + centering.score + coloring.score) / 3).toFixed(1);
  
  return {
    condition,
    centering,
    coloring,
    overallGrade: parseFloat(overallGrade),
  };
}

/* ═══════════════════════════════════════════════════
   PSA GRADING RUBRIC (Semi-Strict)
   ═══════════════════════════════════════════════════
   
   Methodology:
   1. Each sub-grade (Condition, Centering, Coloring) maps to a 1-10 scale
   2. Final grade is heavily influenced by the WEAKEST attribute (60% weight)
   3. The average of all three provides the remaining pull (40% weight)
   4. A small variance (±0.5) simulates grader subjectivity
   5. Any single sub-grade below 5 caps the maximum at 7
   6. All three must be 9+ for a PSA 10 to be possible
   7. Final grade is rounded to a whole number (1-10)
   
   Semi-strict means:
   - One weak area significantly hurts the grade
   - But exceptional performance in other areas can offset slightly
   - PSA 10 requires near-perfection in ALL categories
   ═══════════════════════════════════════════════════ */

export const GRADING_COST = 20; // $20 per submission
export const GRADING_DURATION_MS = 15 * 1000; // 15 seconds for testing

/** PSA grade multipliers on base market price */
export const PSA_MULTIPLIERS = {
  10: 8.0,
  9:  3.0,
  8:  1.6,
  7:  1.15,
  6:  0.9,
  5:  0.7,
  4:  0.5,
  3:  0.35,
  2:  0.25,
  1:  0.15,
};

export const PSA_GRADE_LABELS = {
  10: "GEM MINT",
  9:  "MINT",
  8:  "NM-MT",
  7:  "NM",
  6:  "EX-MT",
  5:  "EX",
  4:  "VG-EX",
  3:  "VG",
  2:  "GOOD",
  1:  "PR",
};

export const PSA_GRADE_COLORS = {
  10: "#FFD700",
  9:  "#4ade80",
  8:  "#22d3ee",
  7:  "#60a5fa",
  6:  "#a78bfa",
  5:  "#fb923c",
  4:  "#f87171",
  3:  "#ef4444",
  2:  "#dc2626",
  1:  "#991b1b",
};

/** Calculate PSA grade from card properties using semi-strict rubric */
export function calculatePSAGrade(properties) {
  if (!properties || !properties.condition || !properties.centering || !properties.coloring) {
    return 1; // Fallback for legacy cards
  }
  
  const cond = properties.condition.grade;   // 4-10
  const cent = properties.centering.score;   // 3-10
  const color = properties.coloring.score;   // 3-10
  
  const scores = [cond, cent, color];
  const lowest = Math.min(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / 3;
  
  // Semi-strict: 60% lowest score, 40% average
  let base = lowest * 0.6 + avg * 0.4;
  
  // Grader subjectivity: ±0.5 variance
  const variance = (Math.random() - 0.5) * 1.0;
  base += variance;
  
  // Hard caps:
  // Rule 1: Any sub-grade below 5 caps the max at 7
  if (lowest < 5) base = Math.min(base, 7);
  
  // Rule 2: PSA 10 requires ALL sub-grades at 9+
  if (scores.some(s => s < 9)) base = Math.min(base, 9);
  
  // Rule 3: PSA 10 is still hard to get even with all 9+ (need avg 9.5+)
  if (base >= 9.5 && avg < 9.5) base = 9;
  
  // Round, clamp 1-10
  const grade = Math.max(1, Math.min(10, Math.round(base)));
  return grade;
}
