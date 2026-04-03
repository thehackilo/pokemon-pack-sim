import { useState, useEffect } from "react";
import { RC, TC, getMarketPrice, getCardValue,
  PSA_GRADE_LABELS, PSA_GRADE_COLORS, PSA_MULTIPLIERS } from "./constants.js";
import SlabHeader from "./SlabHeader.jsx";

export default function CardDetailModal({ card, onSell, onClose }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [entering, setEntering] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSell = () => {
    if (!onSell) return;
    onSell(card, getMarketPrice(card));
    handleClose();
  };

  if (!card) return null;

  const rc = RC[card.rarity];
  const tc = TC[card.type] || "#aaa";
  const basePrice = getMarketPrice(card);
  const effectivePrice = getCardValue(card);
  const isHolo = ["rare", "ultra", "legendary"].includes(card.rarity);
  const props = card.properties;
  const isGraded = !!card.psaGrade;
  const gradeColor = isGraded ? PSA_GRADE_COLORS[card.psaGrade] : null;
  const gradeLabel = isGraded ? PSA_GRADE_LABELS[card.psaGrade] : null;

  const scoreColor = (score) => {
    if (score >= 9.5) return "#FFD700";
    if (score >= 8.5) return "#4ade80";
    if (score >= 7) return "#60a5fa";
    if (score >= 5) return "#fb923c";
    return "#ef4444";
  };

  return (
    <div onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: exiting ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.85)",
        backdropFilter: exiting ? "blur(0px)" : "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .3s ease-out",
        opacity: entering ? 0 : 1,
        cursor: "pointer",
      }}>

      <div onClick={e => e.stopPropagation()}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          transform: exiting ? "scale(0.8) translateY(40px)" : entering ? "scale(0.5)" : "scale(1)",
          opacity: exiting ? 0 : 1,
          transition: "all .35s cubic-bezier(.34,1.56,.64,1)",
          cursor: "default",
          maxWidth: "95vw",
        }}>

        {/* Card with flip */}
        <div onClick={() => setIsFlipped(!isFlipped)}
          style={{
            width: isGraded ? 310 : 300,
            height: isGraded ? 470 : 420,
            perspective: 1200, cursor: "pointer",
          }}>
          <div style={{
            width: "100%", height: "100%", position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform .7s cubic-bezier(.175,.885,.32,1.275)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}>
            {/* Front */}
            <div style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden",
              borderRadius: isGraded ? 4 : 14, overflow: "hidden",
              border: isGraded ? `3px solid ${gradeColor}88` : `3px solid ${rc.c}66`,
              boxShadow: isGraded
                ? `0 8px 40px ${gradeColor}33, 0 0 60px ${gradeColor}15, 0 20px 60px #0008`
                : `0 8px 40px ${rc.g}, 0 0 ${isHolo ? 80 : 20}px ${rc.g}, 0 20px 60px #0008`,
              display: "flex", flexDirection: "column",
              background: isGraded ? "#0a0c16" : "transparent",
            }}>
              {/* PSA Slab Header */}
              {isGraded && (
                <SlabHeader card={card} style={{ borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              )}

              {/* Card image */}
              <div style={{ flex: 1, overflow: "hidden", position: "relative",
                margin: isGraded ? "6px" : 0,
              }}>
                <img src={card.imageLarge || card.imageSmall} alt={card.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                {isHolo && <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: `linear-gradient(135deg,transparent,${rc.c}15 20%,transparent 40%,${tc}20 60%,transparent 80%,${rc.c}10)`,
                  mixBlendMode: "screen",
                }} />}

                {!isGraded && (
                  <div style={{
                    position: "absolute", bottom: 10, right: 10,
                    background: "#000b", backdropFilter: "blur(6px)", borderRadius: 8,
                    padding: "4px 10px", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ fontSize: 11, color: rc.c, fontWeight: 800 }}>{rc.s}</span>
                    <span style={{ fontSize: 10, color: rc.c, fontWeight: 700 }}>{rc.l}</span>
                  </div>
                )}
              </div>

              {/* PSA Slab Footer */}
              {isGraded && (
                <div style={{
                  background: `linear-gradient(135deg,${gradeColor}08,transparent)`,
                  borderTop: `1px solid ${gradeColor}33`,
                  padding: "6px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ fontSize: 9, color: "#fff3", letterSpacing: 1 }}>{card.setName}</div>
                  <div style={{ fontSize: 8, color: rc.c, fontWeight: 700 }}>{rc.s} {rc.l}</div>
                </div>
              )}
            </div>

            {/* Back */}
            <div style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden",
              transform: "rotateY(180deg)", borderRadius: isGraded ? 4 : 14, overflow: "hidden",
              background: "linear-gradient(160deg,#0b0f1a,#161c2e,#0b0f1a)",
              border: isGraded ? `3px solid ${gradeColor}55` : "3px solid #1a2040",
              boxShadow: "0 20px 60px #0008",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                position: "absolute", inset: 0, opacity: .12,
                background: "repeating-conic-gradient(#243060 0deg 15deg,transparent 15deg 30deg)",
              }} />
              {isGraded && (
                <div style={{
                  position: "absolute", top: 20, fontSize: 12, fontWeight: 900,
                  color: gradeColor, letterSpacing: 4, opacity: 0.3,
                }}>GRADED</div>
              )}
              <div style={{
                width: 90, height: 90, borderRadius: "50%", position: "relative",
                background: "radial-gradient(circle at 38% 32%,#fff,#e0e0e0 42%,#dc2626 43%,#ef4444 65%,#b91c1c)",
                border: "6px solid #151a2e", boxShadow: "0 0 24px #0006",
              }}>
                <div style={{
                  position: "absolute", top: "50%", left: -6, right: -6, height: 6,
                  background: "#151a2e", transform: "translateY(-50%)",
                }} />
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "4px solid #151a2e",
                }} />
              </div>
              <div style={{
                position: "absolute", bottom: 20, fontSize: 10, color: "#fff3",
                letterSpacing: 3, textTransform: "uppercase",
              }}>Tap to flip back</div>
            </div>
          </div>
        </div>

        {/* Card Info Panel */}
        <div style={{
          width: 360, maxWidth: "90vw", borderRadius: 16, overflow: "hidden",
          background: "linear-gradient(160deg,#10131fee,#161b2aee)",
          border: `1.5px solid ${isGraded ? gradeColor + "44" : rc.c + "33"}`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 8px 40px #0008, 0 0 30px ${isGraded ? gradeColor + "11" : rc.c + "11"}`,
        }}>
          {/* Header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #ffffff0a" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{card.name}</div>
                <div style={{ fontSize: 13, color: "#fff6", marginTop: 4 }}>
                  {card.setName && `${card.setName} · `}{card.apiRarity}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 24, fontWeight: 900,
                  color: effectivePrice > 5 ? "#4ade80" : effectivePrice > 1 ? "#22d3ee" : "#fff7",
                }}>
                  {effectivePrice < 0.01 ? "<$0.01" : `$${effectivePrice.toFixed(2)}`}
                </div>
                <div style={{ fontSize: 12, color: "#fff5" }}>
                  {isGraded ? `PSA ${card.psaGrade} Value` : "Market Price"}
                </div>
                {isGraded && basePrice > 0 && (
                  <div style={{ fontSize: 11, color: "#fff4", marginTop: 2 }}>
                    Raw: ${basePrice.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Properties */}
          {props && (
            <div style={{ padding: "16px 24px" }}>
              <div style={{
                fontSize: 12, color: "#fff5", letterSpacing: 2,
                textTransform: "uppercase", marginBottom: 12, fontWeight: 700
              }}>Card Properties</div>

              {/* Overall raw grade */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 16, marginBottom: 16, padding: "14px 0",
                background: `${scoreColor(props.overallGrade)}08`,
                borderRadius: 12, border: `1px solid ${scoreColor(props.overallGrade)}22`,
              }}>
                <div style={{
                  fontSize: 40, fontWeight: 900, color: scoreColor(props.overallGrade),
                  fontFamily: "'Courier New',monospace",
                  textShadow: `0 0 24px ${scoreColor(props.overallGrade)}44`,
                }}>{props.overallGrade}</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(props.overallGrade) }}>
                    Raw Quality
                  </div>
                  <div style={{ fontSize: 11, color: "#fff6" }}>
                    Average of condition, centering, and coloring
                  </div>
                </div>
              </div>

              {/* Individual properties */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <GradeProp label="Condition" value={props.condition.label}
                  score={props.condition.grade} color={props.condition.color} max={10} />
                <GradeProp label="Centering" value={props.centering.label}
                  score={props.centering.score} color={props.centering.color} max={10} />
                <GradeProp label="Coloring" value={props.coloring.label}
                  score={props.coloring.score} color={props.coloring.color} max={10} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: "10px 16px 12px", borderTop: "1px solid #ffffff0a",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 12,
          }}>
            <div style={{ fontSize: 9, color: "#fff2", flex: 1 }}>Tap card to flip · Click outside to close</div>
            
            {onSell && (
              <button onClick={handleSell}
                style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#22c55e,#15803d)",
                  color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  letterSpacing: 0.5, transition: "all .2s",
                }}>
                SELL CARD FOR ${effectivePrice.toFixed(2)}
              </button>
            )}

            <button onClick={handleClose}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "1px solid #ffffff15",
                background: "#ffffff08", color: "#fff8", fontSize: 11, cursor: "pointer",
                fontWeight: 600, transition: "all .2s",
              }}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeProp({ label, value, score, color, max }) {
  const pct = (score / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 65, fontSize: 9, color: "#fff5", textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#ffffff0a", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg,${color}88,${color})`,
          boxShadow: `0 0 8px ${color}44`,
          transition: "width .6s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32, textAlign: "right" }}>
        {score}
      </div>
      <div style={{
        fontSize: 8, color, fontWeight: 600, background: `${color}15`,
        padding: "2px 6px", borderRadius: 4, minWidth: 65, textAlign: "center",
      }}>
        {value}
      </div>
    </div>
  );
}
