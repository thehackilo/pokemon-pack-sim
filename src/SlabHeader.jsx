import { PSA_GRADE_LABELS } from './constants.js';

function hashStr(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}

export default function SlabHeader({ card, style = {} }) {
  if (!card || !card.psaGrade) return null;

  // Use a deterministic pseudo-random 'cert' number based on the uid
  const certNumber = card.uid ? String(Math.abs(hashStr(card.uid))).padStart(8, '4') : "14069039";

  const gradeNumber = card.psaGrade;
  let gradeLabel = PSA_GRADE_LABELS[gradeNumber] || "";
  if (gradeNumber === 10) gradeLabel = "GEM MT";
  if (gradeNumber === 9) gradeLabel = "MINT";
  if (gradeNumber === 8) gradeLabel = "NM-MT";
  if (gradeNumber === 7) gradeLabel = "NM";

  const releaseYear = card.set?.releaseDate ? card.set.releaseDate.substring(0, 4) : "2023";
  const setName = (card.setName || card.set?.name || "").toUpperCase().substring(0, 16);
  const cardName = card.name.toUpperCase().substring(0, 24);
  const infoLine = (card.supertype || "POKEMON").toUpperCase();
  const cardNumber = card.number ? `#${card.number}` : "#000";

  return (
    <div style={{ backgroundColor: "#e3322f", padding: "4px", ...style }}>
      <div style={{
        backgroundColor: "#f7f7f7",
        padding: "4px 8px 6px 8px",
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: "#1c325b",
      }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", fontSize: "10px", fontWeight: "600", lineHeight: "1.2" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <span>{releaseYear}</span>
            <span>POKEMON {setName}</span>
          </div>
          <div>{cardName}</div>
          <div>{infoLine}</div>
          <div style={{ marginTop: "4px", fontSize: "11px", letterSpacing: "-1px", opacity: 0.8, fontFamily: "monospace" }}>
            ❚▐ ❚❚▐ ▐ ❚▐ ❚❚▐
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: "10px", fontWeight: "600", lineHeight: "1.2" }}>
          <div>{cardNumber}</div>
          <div>{gradeLabel}</div>
          <div style={{ fontSize: "14px", marginTop: "1px" }}>{gradeNumber}</div>
          <div style={{ marginTop: "4px", fontSize: "9px", fontWeight: "400", letterSpacing: "0.5px" }}>{certNumber}</div>
        </div>
      </div>
    </div>
  );
}
