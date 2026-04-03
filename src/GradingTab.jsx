import { useState, useEffect, useMemo } from "react";
import { RC, TC, getMarketPrice, getCardValue, GRADING_COST, GRADING_DURATION_MS,
  PSA_GRADE_LABELS, PSA_GRADE_COLORS, PSA_MULTIPLIERS } from "./constants.js";
import SlabHeader from "./SlabHeader.jsx";

export default function GradingTab({ collection, wallet, onSubmitGrading, onCardClick }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [tick, setTick] = useState(0); // force re-render for timers
  const [sortOrder, setSortOrder] = useState("price-desc");
  const [visibleGraded, setVisibleGraded] = useState(20);
  const [visibleUngraded, setVisibleUngraded] = useState(20);

  // Tick every second for timer updates
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const sortingFn = (a, b) => {
    if (sortOrder === "price-desc") return getMarketPrice(b) - getMarketPrice(a);
    if (sortOrder === "price-asc") return getMarketPrice(a) - getMarketPrice(b);
    if (sortOrder === "name-asc") return a.name.localeCompare(b.name);
    return 0; // "newest" leaves it in collection order (which we will slice and reverse)
  };

  const gradingCards = useMemo(() =>
    collection.filter(c => c.gradingStartTime && !c.psaGrade), [collection, tick]);

  const gradedCards = useMemo(() =>
    [...collection.filter(c => c.psaGrade)].reverse().sort(sortingFn), [collection, sortOrder]);

  const ungradedCards = useMemo(() =>
    [...collection.filter(c => !c.gradingStartTime && !c.psaGrade)].reverse().sort(sortingFn), [collection, sortOrder]);
    
  const visibleGradedCards = gradedCards.slice(0, visibleGraded);
  const visibleUngradedCards = ungradedCards.slice(0, visibleUngraded);

  const canAfford = wallet >= GRADING_COST;

  const formatTime = (ms) => {
    if (ms <= 0) return "Done!";
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const getTimeRemaining = (card) => {
    const elapsed = Date.now() - card.gradingStartTime;
    return Math.max(0, GRADING_DURATION_MS - elapsed);
  };

  const getProgress = (card) => {
    const elapsed = Date.now() - card.gradingStartTime;
    return Math.min(100, (elapsed / GRADING_DURATION_MS) * 100);
  };

  return (
    <div style={{ width: "100%", maxWidth: 1100, animation: "slideUp .4s ease-out" }}>
      {/* Header */}
      <div className="mobile-h1" style={{
        textAlign: "center", marginBottom: 32, padding: "32px 24px",
        background: "linear-gradient(135deg,#1a103008,#FFD70008)",
        borderRadius: 24, border: "1px solid #FFD70015", boxShadow: "0 8px 32px #FFD70008"
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#FFD700", letterSpacing: 3, marginBottom: 12 }}>
          ⚡ CARD GRADING CENTER
        </div>
        <div className="mobile-hide" style={{ fontSize: 15, color: "#fff8", maxWidth: 600, margin: "0 auto", lineHeight: 1.5 }}>
          Submit cards for professional grading. Each submission costs <strong style={{ color: "#FFD700" }}>${GRADING_COST}</strong> and takes 10 minutes.
          Graded cards receive a PSA-style grade that multiplies their market value.
        </div>
        <div className="mobile-scroll-row" style={{
          display: "flex", justifyContent: "center", gap: 16, marginTop: 14, flexWrap: "wrap",
        }}>
          {[10,9,8,7,6,5].map(g => (
            <div key={g} style={{ textAlign: "center", background: "#ffffff05", padding: "8px 16px", borderRadius: 12, border: "1px solid #ffffff11" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: PSA_GRADE_COLORS[g] }}>PSA {g}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#fff8" }}>{PSA_MULTIPLIERS[g]}× Val</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools & Sorting */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#fff6", fontWeight: 700 }}>SORT BY:</span>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
            style={{
              padding: "10px 16px", borderRadius: 12, border: "1px solid #ffffff22",
              background: "#161b2a", color: "#fff", outline: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, minWidth: 160
            }}>
            <option value="newest">Newest First</option>
            <option value="price-desc">Highest Value</option>
            <option value="price-asc">Lowest Value</option>
            <option value="name-asc">Name (A-Z)</option>
          </select>
        </div>
      </div>
      {/* Currently Grading */}
      {gradingCards.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 800, letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 16 }}>
            ⏳ Currently Grading ({gradingCards.length})
          </div>
          <div className="mobile-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
            gap: 12,
          }}>
            {gradingCards.map(card => {
              const remaining = getTimeRemaining(card);
              const progress = getProgress(card);
              const rc = RC[card.rarity];
              return (
                <div key={card.uid} className="mobile-card-size" style={{
                  borderRadius: 12, overflow: "hidden", position: "relative",
                  background: "linear-gradient(160deg,#10131f,#1a1d2e)",
                  border: `1.5px solid #fbbf2433`,
                  boxShadow: "0 2px 15px #fbbf2411",
                }}>
                  <div style={{
                    width: "100%", aspectRatio: "2.5/3.5", overflow: "hidden",
                    position: "relative", filter: "brightness(0.6) blur(0.5px)",
                  }}>
                    <img src={card.imageSmall} alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  {/* Timer overlay */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", background: "#00000066",
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24",
                      fontFamily: "'Courier New',monospace", textShadow: "0 0 20px #fbbf2444" }}>
                      {formatTime(remaining)}
                    </div>
                    <div style={{ fontSize: 9, color: "#fff5", letterSpacing: 2, marginTop: 4 }}>GRADING...</div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 3, background: "#ffffff0a" }}>
                    <div style={{
                      width: `${progress}%`, height: "100%",
                      background: "linear-gradient(90deg,#fbbf24,#FFD700)",
                      transition: "width 1s linear",
                    }} />
                  </div>
                  <div className="info-section" style={{ padding: "6px 10px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#fff",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: 8, color: rc.c }}>{rc.s} {rc.l}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Graded Collection */}
      {gradedCards.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 12 }}>
            ✓ Graded Cards ({gradedCards.length})
          </div>
          <div className="mobile-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))",
            gap: 14,
          }}>
            {visibleGradedCards.map(card => {
              const grade = card.psaGrade;
              const gradeColor = PSA_GRADE_COLORS[grade];
              const gradeLabel = PSA_GRADE_LABELS[grade];
              const basePrice = getMarketPrice(card);
              const gradedPrice = getCardValue(card);
              const multiplier = PSA_MULTIPLIERS[grade];
              const rc = RC[card.rarity];

              return (
                <div key={card.uid}
                  className="mobile-card-size"
                  onClick={() => onCardClick && onCardClick(card)}
                  onMouseEnter={() => setHoveredCard(card.uid)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    borderRadius: 4, overflow: "hidden", cursor: "pointer",
                    background: "linear-gradient(160deg,#0c0e18,#141828)",
                    border: `2px solid ${gradeColor}55`,
                    boxShadow: hoveredCard === card.uid
                      ? `0 8px 30px ${gradeColor}33, 0 0 40px ${gradeColor}15`
                      : `0 2px 12px ${gradeColor}11`,
                    transition: "all .3s",
                    transform: hoveredCard === card.uid ? "translateY(-4px) scale(1.02)" : "none",
                  }}>
                  {/* PSA Slab Header */}
                  <SlabHeader card={card} style={{ borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />

                  {/* Card image in slab */}
                  <div style={{
                    width: "100%", aspectRatio: "2.5/3.5", overflow: "hidden", position: "relative",
                    borderLeft: `4px solid ${gradeColor}22`,
                    borderRight: `4px solid ${gradeColor}22`,
                    background: "#0a0c14",
                  }}>
                    <img src={card.imageSmall} alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {grade >= 9 && (
                      <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        background: `radial-gradient(ellipse at 50% 30%, ${gradeColor}12, transparent 70%)`,
                      }} />
                    )}
                  </div>

                  {/* Slab Footer */}
                  <div className="slab-footer" style={{
                    background: `linear-gradient(135deg,${gradeColor}08,${gradeColor}04)`,
                    borderTop: `1px solid ${gradeColor}22`,
                    padding: "8px 10px",
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#fff",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3,
                    }}>{card.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: gradeColor }}>
                          ${gradedPrice.toFixed(2)}
                        </div>
                        {basePrice > 0 && (
                          <div style={{ fontSize: 8, color: "#fff3" }}>
                            Base: ${basePrice.toFixed(2)} × {multiplier}
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontSize: 8, color: rc.c, fontWeight: 700,
                        background: `${rc.c}15`, padding: "2px 6px", borderRadius: 4,
                      }}>{rc.s} {rc.l}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleGraded < gradedCards.length && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => setVisibleGraded(p => p + 20)} style={{
                padding: "8px 24px", borderRadius: 20, border: "1px solid #ffffff22",
                background: "#ffffff0a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>LOAD MORE ({gradedCards.length - visibleGraded})</button>
            </div>
          )}
        </div>
      )}

      {/* Submit Cards for Grading */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: "#fff9", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            📋 Submit for Grading
          </div>
          {!canAfford && (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", background: "#ef444415", padding: "4px 12px", borderRadius: 8 }}>
              Need ${GRADING_COST.toFixed(2)} per submission
            </div>
          )}
        </div>

        {ungradedCards.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#fff3" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 12 }}>
              {collection.length === 0
                ? "Open packs to get cards for grading!"
                : "All your cards are graded or being graded!"}
            </div>
          </div>
        ) : (
          <div className="mobile-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap: 12,
          }}>
            {visibleUngradedCards.map(card => {
              const price = getMarketPrice(card);
              const rc = RC[card.rarity];
              const grade = card.properties?.overallGrade;
              const isHovered = hoveredCard === card.uid;

              return (
                <div key={card.uid}
                  className="mobile-card-size"
                  onMouseEnter={() => setHoveredCard(card.uid)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    borderRadius: 12, overflow: "hidden",
                    background: "linear-gradient(160deg,#10131f,#161b2a)",
                    border: `1.5px solid ${rc.c}${isHovered ? "55" : "22"}`,
                    transition: "all .3s",
                    transform: isHovered ? "translateY(-3px) scale(1.01)" : "none",
                    boxShadow: isHovered ? `0 6px 24px ${rc.c}18` : "0 2px 10px #0003",
                  }}>
                  <div onClick={() => onCardClick && onCardClick(card)}
                    style={{
                      width: "100%", aspectRatio: "2.5/3.5", overflow: "hidden",
                      position: "relative", cursor: "pointer",
                    }}>
                    <img src={card.imageSmall} alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {grade && (
                      <div style={{
                        position: "absolute", top: 6, right: 6, padding: "2px 6px",
                        borderRadius: 6, background: "#000a", backdropFilter: "blur(4px)",
                        fontSize: 10, fontWeight: 800, fontFamily: "'Courier New',monospace",
                        color: grade >= 9 ? "#FFD700" : grade >= 8 ? "#4ade80" : grade >= 7 ? "#60a5fa" : "#fb923c",
                      }}>{grade}</div>
                    )}
                  </div>
                  <div className="info-section" style={{ padding: "12px" }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: "#fff",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 6,
                    }}>{card.name}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{
                        fontSize: 10, color: rc.c, fontWeight: 800, background: `${rc.c}15`,
                        padding: "2px 8px", borderRadius: 6,
                      }}>{rc.s} {rc.l}</span>
                      <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "'Courier New',monospace",
                        color: price > 5 ? "#4ade80" : price > 1 ? "#22d3ee" : "#fff9" }}>
                        ${price.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => canAfford && onSubmitGrading(card)}
                      disabled={!canAfford}
                      style={{
                        width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        background: canAfford
                          ? "linear-gradient(135deg,#FFD700,#FFA000)"
                          : "#ffffff12",
                        color: canAfford ? "#000" : "#fff4",
                        fontSize: 13, fontWeight: 900, letterSpacing: 1,
                        transition: "all .2s",
                        opacity: canAfford ? 1 : 0.5,
                        boxShadow: canAfford ? "0 4px 16px #FFD70033" : "none"
                      }}>
                      ⚡ GRADE FOR ${GRADING_COST}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {ungradedCards.length > 0 && visibleUngraded < ungradedCards.length && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button onClick={() => setVisibleUngraded(p => p + 20)} style={{
                padding: "10px 24px", borderRadius: 20, border: "1px solid #ffffff22",
                background: "#ffffff0a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>LOAD MORE UNGRADED ({ungradedCards.length - visibleUngraded})</button>
            </div>
        )}
      </div>
    </div>
  );
}
