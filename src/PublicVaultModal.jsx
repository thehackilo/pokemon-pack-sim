import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { RC, TC, getMarketPrice, getCardValue, PSA_GRADE_COLORS } from "./constants.js";

export default function PublicVaultModal({ userId, username, totalValue, onClose }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchVault() {
      if (!userId) {
        setError("Missing trainer ID.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: err } = await supabase
          .from('cards')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (err) throw err;
        setCards(data || []);
      } catch (err) {
        console.error("Vault fetch error details:", err);
        setError(err.message || "Failed to load trainer's vault.");
      } finally {
        setLoading(false);
      }
    }
    fetchVault();
  }, [userId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(5, 8, 15, 0.98)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px', background: '#ffffff05', borderBottom: '1px solid #ffffff10',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} style={{
            background: '#ffffff10', border: 'none', color: '#fff', padding: '8px 16px',
            borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>← Back</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
              <h2 style={{ fontSize: 18, color: '#fff', margin: 0, fontWeight: 900 }}>{username.toUpperCase()}'S VAULT</h2>
            </div>
            <div style={{ fontSize: 12, color: '#fff5', marginTop: 2 }}>{cards.length} Collectibles · ${parseFloat(totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })} Portfolio</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#fff5' }}>Unlocking Vault...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#fca5a5' }}>{error}</div>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
            gap: 12
          }}>
            {cards.map((c) => {
              const api = c.api_data;
              const cardObj = { ...api, psaGrade: c.psa_grade, rarity: api.rarity.toLowerCase() };
              const rc = RC[cardObj.rarity] || RC.common;
              const isGraded = !!cardObj.psaGrade;
              const psaColor = isGraded ? PSA_GRADE_COLORS[cardObj.psaGrade] : null;

              return (
                <div key={c.uid} style={{
                  borderRadius: 12, overflow: "hidden", position: "relative",
                  background: isGraded ? "linear-gradient(160deg,#0f111a,#1a1f33)" : "#161b2a",
                  border: isGraded ? `1px solid ${psaColor}44` : `1px solid #ffffff10`,
                  aspectRatio: "2.5/4.2", display: 'flex', flexDirection: 'column'
                }}>
                  {/* Card Image */}
                  <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                    <img src={api.imageSmall} alt={api.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {isGraded && (
                      <div style={{
                        position: "absolute", top: 6, right: 6, padding: "2px 6px",
                        borderRadius: 6, background: "#e3322f", border: "1px solid #ffffff22",
                        fontSize: 9, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 3
                      }}>
                        <span style={{ fontSize: 7, opacity: 0.8 }}>PSA</span> {cardObj.psaGrade}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '8px 10px', background: isGraded ? 'transparent' : '#ffffff03' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {api.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 8, color: rc.c, fontWeight: 800 }}>{rc.s} {rc.l.toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 900 }}>${getCardValue(cardObj).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16,
        background: 'linear-gradient(to top, #000, transparent)', 
        pointerEvents: 'none', textAlign: 'center'
      }}>
        <div style={{ 
          display: 'inline-block', background: '#ffffff10', backdropFilter: 'blur(10px)',
          padding: '6px 16px', borderRadius: 20, color: '#fff5', fontSize: 11, fontWeight: 700 
        }}>
          TRAINER VAULT IS READ-ONLY
        </div>
      </div>
    </div>
  );
}
