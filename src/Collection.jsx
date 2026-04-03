import { useState, useMemo, useEffect } from "react";
import { TC, RC, getMarketPrice, getCardValue, PSA_GRADE_COLORS, PSA_GRADE_LABELS } from "./constants.js";
import SlabHeader from "./SlabHeader.jsx";

export default function Collection({ collection, onSell, onBulkSell, wallet, sets,
  autoSellThreshold, onAutoSellThresholdChange, onCardClick }) {
  const [sort, setSort] = useState("price-desc");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterSet, setFilterSet] = useState("all");
  const [sellAnim, setSellAnim] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [thresholdInput, setThresholdInput] = useState(autoSellThreshold > 0 ? autoSellThreshold.toString() : "");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  // Reset pagination on filter change
  useEffect(() => setVisibleCount(30), [sort, filterRarity, filterSet]);

  const filtered = useMemo(() => {
    let items = [...collection];
    if (filterRarity !== "all") items = items.filter(c => c.rarity === filterRarity);
    if (filterSet !== "all") items = items.filter(c => c.setId === filterSet);
    
    items.sort((a, b) => {
      const pa = getMarketPrice(a), pb = getMarketPrice(b);
      const ro = { common: 0, uncommon: 1, rare: 2, ultra: 3, legendary: 4 };
      switch (sort) {
        case "price-desc": return pb - pa;
        case "price-asc": return pa - pb;
        case "rarity-desc": return ro[b.rarity] - ro[a.rarity];
        case "rarity-asc": return ro[a.rarity] - ro[b.rarity];
        case "name": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    return items;
  }, [collection, sort, filterRarity, filterSet]);

  const totalValue = useMemo(() =>
    collection.reduce((s, c) => s + getCardValue(c), 0), [collection]);

  const uniqueSets = useMemo(() => {
    const s = new Set(collection.map(c => c.setId));
    return [...s];
  }, [collection]);

  // Cards eligible for instant bulk sell based on current threshold input
  const bulkSellCards = useMemo(() => {
    const thresh = parseFloat(thresholdInput);
    if (isNaN(thresh) || thresh <= 0) return [];
    return collection.filter(c => {
      const p = getMarketPrice(c);
      return p < thresh && p > 0;
    });
  }, [collection, thresholdInput]);

  const bulkSellTotal = useMemo(() =>
    bulkSellCards.reduce((s, c) => s + getMarketPrice(c), 0), [bulkSellCards]);

  const handleSell = (card) => {
    const price = getMarketPrice(card);
    setSellAnim(card.uid);
    setTimeout(() => {
      onSell(card, price);
      setSellAnim(null);
    }, 400);
  };

  const handleBulkSell = () => {
    if (bulkSellCards.length === 0) return;
    setShowBulkConfirm(false);
    onBulkSell(bulkSellCards);
  };

  const handleSetAutoSell = () => {
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val <= 0) {
      onAutoSellThresholdChange(0);
    } else {
      onAutoSellThresholdChange(val);
    }
  };

  const handleClearAutoSell = () => {
    onAutoSellThresholdChange(0);
    setThresholdInput("");
  };

  const fmtPrice = (p) => p < 0.01 ? "<$0.01" : `$${p.toFixed(2)}`;

  // Rarity counts for filter badges
  const rarityCounts = useMemo(() => {
    const counts = {};
    collection.forEach(c => { counts[c.rarity] = (counts[c.rarity] || 0) + 1; });
    return counts;
  }, [collection]);

  // Set counts for filter badges
  const setCounts = useMemo(() => {
    const counts = {};
    collection.forEach(c => { counts[c.setId] = (counts[c.setId] || 0) + 1; });
    return counts;
  }, [collection]);

  const visibleCards = filtered.slice(0, visibleCount);

  return (
    <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", animation: "slideUp .4s ease-out" }}>
      {/* Portfolio Summary */}
      <div className="mobile-summary-box" style={{
        display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", alignItems: "center",
        padding: "24px 32px", marginBottom: 24, borderRadius: 16,
        background: "linear-gradient(135deg,#ffffff08,#ffffff04)",
        border: "1px solid #ffffff10", backdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px #00000033"
      }}>
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 13, color: "#fff5", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Cards</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#fff" }}>{collection.length}</div>
        </div>
        <div style={{ width: 2, height: 48, background: "#ffffff12" }} />
        <div style={{ textAlign: "center", minWidth: 160 }}>
          <div style={{ fontSize: 13, color: "#fff5", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Portfolio Value</div>
          <div style={{ fontSize: 32, fontWeight: 900, background: "linear-gradient(135deg,#4ade80,#22d3ee)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ${totalValue.toFixed(2)}
          </div>
        </div>
        <div style={{ width: 2, height: 48, background: "#ffffff12" }} />
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 13, color: "#fff5", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Total Wallet</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#FFD700" }}>${wallet.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters & Automation */}
      <div className="mobile-filter-stack" style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
        
        {/* Filters Left Side */}
        <div className="mobile-panel-pd" style={{
          flex: "2 1 400px", padding: "20px 24px", borderRadius: 16,
          background: "linear-gradient(135deg,#ffffff06,#ffffff03)",
          border: "1px solid #ffffff0a",
        }}>
          <div style={{ fontSize: 13, color: "#fff6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
            🔍 Collection Filters
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
             <select value={sort} onChange={e => setSort(e.target.value)} style={{...selectStyle, padding: "10px 16px", fontSize: 14 }}>
              <option value="price-desc">Sort by Price: High → Low</option>
              <option value="price-asc">Sort by Price: Low → High</option>
              <option value="rarity-desc">Sort by Rarity: Best First</option>
              <option value="rarity-asc">Sort by Rarity: Common First</option>
              <option value="name">Sort Alphabetically A-Z</option>
            </select>
          </div>

          {/* Rarity filter pills */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#fff4", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Filter by Rarity</div>
            <div className="mobile-scroll-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="mobile-btn-pill" onClick={() => setFilterRarity("all")} style={{
                ...pillStyle,
                fontSize: 12, padding: "6px 14px",
                background: filterRarity === "all" ? "#ffffff18" : "#ffffff08",
                color: filterRarity === "all" ? "#fff" : "#fff6",
                border: filterRarity === "all" ? "1px solid #ffffff30" : "1px solid #ffffff10",
              }}>All Singular ({collection.length})</button>
              {Object.entries(RC).map(([key, val]) => {
                const count = rarityCounts[key] || 0;
                if (count === 0) return null;
                return (
                  <button key={key} className="mobile-btn-pill" onClick={() => setFilterRarity(filterRarity === key ? "all" : key)} style={{
                    ...pillStyle,
                    fontSize: 12, padding: "6px 14px",
                    background: filterRarity === key ? `${val.c}22` : "#ffffff08",
                    color: filterRarity === key ? val.c : "#fff6",
                    border: filterRarity === key ? `1px solid ${val.c}55` : "1px solid #ffffff10",
                    boxShadow: filterRarity === key ? `0 0 12px ${val.c}22` : "none",
                  }}>{val.s} {val.l} ({count})</button>
                );
              })}
            </div>
          </div>

          {/* Set filter pills */}
          <div>
            <div style={{ fontSize: 11, color: "#fff4", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Filter by Set</div>
            <div className="mobile-scroll-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="mobile-btn-pill" onClick={() => setFilterSet("all")} style={{
                ...pillStyle,
                fontSize: 12, padding: "6px 14px",
                background: filterSet === "all" ? "#ffffff18" : "#ffffff08",
                color: filterSet === "all" ? "#fff" : "#fff6",
                border: filterSet === "all" ? "1px solid #ffffff30" : "1px solid #ffffff10",
              }}>All Sets</button>
              {uniqueSets.map(sid => {
                const s = sets.find(x => x.id === sid);
                const count = setCounts[sid] || 0;
                return (
                  <button key={sid} className="mobile-btn-pill" onClick={() => setFilterSet(filterSet === sid ? "all" : sid)} style={{
                    ...pillStyle,
                    fontSize: 12, padding: "6px 14px",
                    background: filterSet === sid ? `${s?.accentColor || "#888"}22` : "#ffffff08",
                    color: filterSet === sid ? (s?.accentColor || "#fff") : "#fff6",
                    border: filterSet === sid ? `1px solid ${s?.accentColor || "#888"}55` : "1px solid #ffffff10",
                    boxShadow: filterSet === sid ? `0 0 12px ${s?.accentColor || "#888"}22` : "none",
                  }}>{s?.name || sid} ({count})</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Auto Sell Automation Panel Right Side */}
        <div className="mobile-panel-pd" style={{
          flex: "1 1 300px", padding: "20px 24px", borderRadius: 16,
          background: "linear-gradient(135deg,#ef444408,#ef444404)",
          border: `1px solid ${autoSellThreshold > 0 ? "#ef444444" : "#ef444415"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#ef4444", letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>
              ⚡ Auto-Sell System
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#fff8", marginBottom: 16, lineHeight: 1.4 }}>
             Automatically sell cards instantly as soon as they are pulled if their market value is below your set threshold.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>Threshold:</span>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 12, fontSize: 14, color: "#fff8", pointerEvents: "none" }}>$</span>
                <input type="number" step="0.01" min="0" placeholder="0.50"
                  value={thresholdInput}
                  onChange={e => { setThresholdInput(e.target.value); setShowBulkConfirm(false); }}
                  style={{
                    width: 120, padding: "10px 14px 10px 26px", borderRadius: 8,
                    border: "1px solid #ffffff22", background: "#ffffff0a", color: "#fff",
                    fontSize: 16, outline: "none", fontFamily: "'Courier New',monospace", fontWeight: 700
                  }}
                />
              </div>
            </div>

            {/* Auto-sell toggles */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleSetAutoSell} style={{
                flex: 1, padding: "12px 16px", borderRadius: 8, border: "1px solid #4ade8055",
                background: autoSellThreshold > 0 ? "linear-gradient(135deg,#4ade8033,#4ade8011)" : "linear-gradient(135deg,#ffffff11,#ffffff05)",
                color: autoSellThreshold > 0 ? "#4ade80" : "#fff",
                fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .2s",
                boxShadow: autoSellThreshold > 0 ? "0 4px 16px #4ade8022" : "none"
              }}>
                {autoSellThreshold > 0 ? "✓ ACTIVE THRESHOLD" : "ENABLE AUTO-SELL"}
              </button>

              {autoSellThreshold > 0 && (
                <button onClick={handleClearAutoSell} style={{
                  padding: "12px 16px", borderRadius: 8, border: "1px solid #ffffff22",
                  background: "#ffffff0a", color: "#fff8", fontSize: 12, cursor: "pointer",
                  fontWeight: 600, transition: "all .2s",
                }}>Disable</button>
              )}
            </div>

            {autoSellThreshold > 0 && (
              <div style={{
                marginTop: 8, fontSize: 11, color: "#4ade80", fontWeight: 700, background: "#4ade8015",
                padding: "6px 12px", borderRadius: 8, textAlign: "center"
              }}>
                Currently auto-selling all cards under ${autoSellThreshold.toFixed(2)}
              </div>
            )}
          </div>

          {/* Bulk sell now */}
          {bulkSellCards.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #ffffff14" }}>
              <div style={{ fontSize: 13, color: "#fca5a5", fontWeight: 700, marginBottom: 12 }}>
                Bulk Action ({bulkSellCards.length} cards matching threshold) · +${bulkSellTotal.toFixed(2)}
              </div>
              {!showBulkConfirm ? (
                <button onClick={() => setShowBulkConfirm(true)} style={{
                  width: "100%", padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff",
                  fontSize: 14, fontWeight: 800, letterSpacing: 1,
                  boxShadow: "0 4px 16px #ef444444",
                }}>SELL {bulkSellCards.length} CARDS NOW</button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", animation: "fadeIn .2s ease-out", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 800 }}>⚠️ Are you sure?</span>
                  <div style={{ display: "flex", gap: 8, width: "100%" }}>
                    <button onClick={handleBulkSell} style={{
                      flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg,#ef4444,#b91c1c)", color: "#fff",
                      fontSize: 14, fontWeight: 900, boxShadow: "0 2px 12px #ef444466",
                    }}>✓ YES, SELL</button>
                    <button onClick={() => setShowBulkConfirm(false)} style={{
                      flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ffffff22",
                      background: "#ffffff0a", color: "#fff8", fontSize: 14, cursor: "pointer", fontWeight: 600
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Showing X of Y */}
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 11, color: "#fff4" }}>
        Showing {filtered.length} of {collection.length} cards
        {(filterRarity !== "all" || filterSet !== "all") && (
          <button onClick={() => { setFilterRarity("all"); setFilterSet("all"); }} style={{
            marginLeft: 8, padding: "2px 10px", borderRadius: 8,
            border: "1px solid #ffffff15", background: "#ffffff08",
            color: "#fff6", fontSize: 10, cursor: "pointer",
          }}>✕ Clear filters</button>
        )}
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#fff3" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14 }}>
            {collection.length === 0 ? "Open some packs to start your collection!" : "No cards match your filters"}
          </div>
        </div>
      ) : (
        <div className="mobile-grid"
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, 170px)",
              gap: 20, padding: "20px 0", justifyContent: "center",
            }}>
          {visibleCards.map((card) => {
            const basePrice = getMarketPrice(card);
            const price = getCardValue(card);
            const rc = RC[card.rarity];
            const tc = TC[card.type] || "#aaa";
            const isSelling = sellAnim === card.uid;
            const isHovered = hoveredCard === card.uid;
            const grade = card.properties?.overallGrade;
            const isGraded = !!card.psaGrade;
            const psaColor = isGraded ? PSA_GRADE_COLORS[card.psaGrade] : null;

            return (
              <div key={card.uid}
                className="mobile-card-size"
                onMouseEnter={() => setHoveredCard(card.uid)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  borderRadius: 12, overflow: "hidden", position: "relative",
                  background: isGraded ? "linear-gradient(160deg,#0f111a,#1a1f33)" : "linear-gradient(160deg,#10131f,#161b2a)",
                  border: isGraded ? `1.5px solid ${psaColor}${isHovered ? "aa" : "44"}` : `1.5px solid ${rc.c}${isHovered ? "66" : "22"}`,
                  transition: "all .3s cubic-bezier(.4,0,.2,1)",
                  transform: isSelling ? "scale(0.8) rotateZ(5deg)" : isHovered ? "translateY(-4px) scale(1.02)" : "none",
                  opacity: isSelling ? 0 : 1,
                  boxShadow: isHovered 
                    ? (isGraded ? `0 8px 30px ${psaColor}33, 0 0 40px ${psaColor}15` : `0 8px 30px ${rc.c}22, 0 0 40px ${rc.c}11`)
                    : (isGraded ? `0 2px 12px ${psaColor}11` : "0 2px 10px #0003"),
                }}>
                
                {/* Clickable card image */}
                <div onClick={() => onCardClick && onCardClick(card)}
                  style={{ 
                    width: "100%", aspectRatio: "2.5/3.5", overflow: "hidden", position: "relative", cursor: "pointer",
                    background: isGraded ? "#0a0c14" : "transparent"
                  }}>
                  <img src={card.imageSmall} alt={card.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {["ultra", "legendary"].includes(card.rarity) && (
                    <div style={{
                      position: "absolute", inset: 0, pointerEvents: "none",
                      background: `radial-gradient(ellipse at 50% 30%, ${rc.c}15, transparent 70%)`,
                    }} />
                  )}
                  {isGraded && card.psaGrade >= 9 && (
                    <div style={{
                      position: "absolute", inset: 0, pointerEvents: "none",
                      background: `radial-gradient(ellipse at 50% 30%, ${psaColor}12, transparent 70%)`
                    }} />
                  )}
                  {/* PSA Badge (Graded) */}
                  {isGraded && (
                    <div style={{
                      position: "absolute", top: 8, right: 8, padding: "3px 8px",
                      borderRadius: 8, background: "#e3322f", backdropFilter: "blur(4px)",
                      fontSize: 11, fontWeight: 900, fontFamily: "monospace",
                      color: "#fff", border: "1px solid #ffffff44",
                      boxShadow: "0 4px 12px rgba(227, 50, 47, 0.4)",
                      display: "flex", alignItems: "center", gap: 5, zIndex: 5
                    }}>
                      <span style={{ fontSize: 9, opacity: 0.8, letterSpacing: 0.5 }}>PSA</span>
                      {card.psaGrade}
                    </div>
                  )}
                  {/* Grade badge (Raw) */}
                  {!isGraded && grade && (
                    <div style={{
                      position: "absolute", top: 8, right: 8, padding: "3px 8px",
                      borderRadius: 8, background: "#000a", backdropFilter: "blur(6px)",
                      fontSize: 11, fontWeight: 900, fontFamily: "monospace",
                      color: grade >= 9.5 ? "#FFD700" : grade >= 8.5 ? "#4ade80" : grade >= 7 ? "#60a5fa" : grade >= 5 ? "#fb923c" : "#ef4444",
                      border: "1px solid #ffffff15", zIndex: 5
                    }}>{grade}</div>
                  )}
                  {/* Tap hint on hover */}
                  {isHovered && (
                    <div style={{
                      position: "absolute", inset: 0, background: "#00000044",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: "fadeIn .2s ease-out",
                    }}>
                      <div style={{ fontSize: 10, color: "#fff", fontWeight: 600, letterSpacing: 1,
                        background: "#00000088", padding: "4px 10px", borderRadius: 8 }}>🔍 VIEW</div>
                    </div>
                  )}
                </div>

                {/* Info section */}
                <div className="info-section" style={{ 
                  padding: "8px 10px 6px",
                  background: isGraded ? `linear-gradient(135deg,${psaColor}08,${psaColor}04)` : "transparent",
                  borderTop: isGraded ? `1px solid ${psaColor}22` : "none"
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3
                  }}>{card.name}</div>
                  
                  {!isGraded && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{
                          fontSize: 8, color: rc.c, fontWeight: 700, background: `${rc.c}15`,
                          padding: "1px 6px", borderRadius: 4
                        }}>{rc.s} {rc.l}</span>
                        <span style={{ fontSize: 8, color: tc, fontWeight: 600 }}>{card.type}</span>
                      </div>
                      {card.setName && (
                        <div style={{ fontSize: 8, color: "#fff3", marginBottom: 4, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.setName}</div>
                      )}
                      {/* Properties mini display */}
                      {card.properties && (
                        <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                          {[
                            { l: "C", v: card.properties.condition, s: card.properties.condition.grade },
                            { l: "N", v: card.properties.centering, s: card.properties.centering.score },
                            { l: "L", v: card.properties.coloring, s: card.properties.coloring.score },
                          ].map((p, i) => (
                            <div key={i} title={`${p.l === "C" ? "Condition" : p.l === "N" ? "Centering" : "Coloring"}: ${p.v.label}`}
                              style={{
                                flex: 1, textAlign: "center", fontSize: 7, fontWeight: 700,
                                color: p.v.color, background: `${p.v.color}12`,
                                borderRadius: 3, padding: "1px 0",
                              }}>{p.s}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Price Summary */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 900, fontFamily: "'Courier New',monospace",
                      color: price > 5 ? "#4ade80" : price > 1 ? "#22d3ee" : "#fff9"
                    }}>
                      {fmtPrice(price)}
                    </div>
                    {isGraded && basePrice > 0 && (
                      <div style={{ fontSize: 10, color: "#fff6" }}>Raw: ${basePrice.toFixed(2)}</div>
                    )}
                  </div>

                  {/* Accessible Full-Width Action Button */}
                  {(!card.gradingStartTime && !isGraded || isGraded) ? (
                    <button onClick={(e) => { e.stopPropagation(); handleSell(card); }}
                      style={{
                        width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff",
                        fontSize: 13, fontWeight: 800, letterSpacing: 1, transition: "all .2s",
                        boxShadow: "0 2px 10px #ef444444", marginTop: 4,
                      }}>SELL CARD</button>
                  ) : (
                    <div style={{
                      width: "100%", padding: "10px 0", borderRadius: 8,
                      background: "#fbbf2422", color: "#fbbf24", textAlign: "center",
                      fontSize: 13, fontWeight: 800, letterSpacing: 1, marginTop: 4,
                    }}>GRADING...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {visibleCount < filtered.length && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button onClick={() => setVisibleCount(p => p + 30)} style={{
            padding: "12px 32px", borderRadius: 24, border: "2px solid #ffffff22",
            background: "#ffffff0a", color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer", transition: "all .2s", letterSpacing: 1
          }}>
            LOAD MORE CARDS ({(filtered.length - visibleCount)} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  padding: "6px 12px", borderRadius: 10, border: "1px solid #ffffff15",
  background: "#ffffff0a", color: "#fffc", fontSize: 11, cursor: "pointer",
  outline: "none", appearance: "auto", minWidth: 130,
};

const pillStyle = {
  padding: "4px 12px", borderRadius: 20, cursor: "pointer",
  fontSize: 10, fontWeight: 600, letterSpacing: .5,
  transition: "all .2s", outline: "none",
};
