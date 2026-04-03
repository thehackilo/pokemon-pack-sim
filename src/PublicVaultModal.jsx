import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { RC, TC, getMarketPrice, getCardValue, PSA_GRADE_COLORS } from "./constants.js";

const PER_PAGE = 24;

export default function PublicVaultModal({ userId, username, totalValue, onClose }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchVault = useCallback(async (pageNum) => {
    if (!userId) return;
    try {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      const { data, error: err } = await supabase.rpc('get_user_vault', {
        target_user_id: userId,
        p_limit: PER_PAGE,
        p_offset: pageNum * PER_PAGE
      });

      if (err) throw err;
      
      if (data.length < PER_PAGE) setHasMore(false);
      
      setCards(prev => (pageNum === 0 ? data : [...prev, ...data]));
      setError(null);
    } catch (err) {
      console.error("Vault fetch error:", err);
      setError(err.message || "Failed to load trainer's vault.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchVault(page);
  }, [page, fetchVault]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(5, 8, 15, 0.98)', backdropFilter: 'blur(24px)',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px', background: '#ffffff05', borderBottom: '1px solid #ffffff10',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} style={{
            background: 'linear-gradient(135deg, #ffffff15, #ffffff05)', 
            border: '1px solid #ffffff10', color: '#fff', padding: '10px 20px',
            borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px #0003'
          }}>← Back</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
              <h2 style={{ fontSize: 20, color: '#fff', margin: 0, fontWeight: 900, letterSpacing: 1 }}>{username.toUpperCase()}'S VAULT</h2>
            </div>
            <div style={{ fontSize: 12, color: '#fff5', marginTop: 4, fontWeight: 600 }}>
               ${parseFloat(totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })} Portfolio · Sorted by Value
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 120px' }}>
        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#fff4' }}>
             <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 2s linear infinite' }}>📀</div>
             Authenticating Vault...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#fca5a5', background: '#ef444408', borderRadius: 20, border: '1px solid #ef444422' }}>
             <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
             {error}
             <div style={{ fontSize: 12, marginTop: 12, opacity: 0.7 }}>Ensure the latest SQL migrations were applied in Supabase.</div>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 14
            }}>
              {cards.map((c, index) => {
                const api = c.api_data;
                const cardObj = { ...api, psaGrade: c.psa_grade, rarity: api.rarity.toLowerCase() };
                const rc = RC[cardObj.rarity] || RC.common;
                const isGraded = !!cardObj.psaGrade;
                const psaColor = isGraded ? PSA_GRADE_COLORS[cardObj.psaGrade] : null;

                const isLast = index === cards.length - 1;

                return (
                  <div 
                    key={c.uid} 
                    ref={isLast ? lastElementRef : null}
                    style={{
                      borderRadius: 16, overflow: "hidden", position: "relative",
                      background: isGraded ? "linear-gradient(160deg,#0f111a,#1a223a)" : "#161b2a",
                      border: isGraded ? `1px solid ${psaColor}44` : `1px solid #ffffff08`,
                      aspectRatio: "2.5/4.3", display: 'flex', flexDirection: 'column',
                      transition: 'transform 0.2s', boxShadow: '0 4px 20px #0004'
                    }}
                  >
                    {/* Card Image */}
                    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                      <img src={api.imageSmall} alt={api.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {isGraded && (
                        <div style={{
                          position: "absolute", top: 8, right: 8, padding: "3px 8px",
                          borderRadius: 8, background: "#e3322f", border: "1px solid #ffffff22",
                          fontSize: 10, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 4,
                          boxShadow: '0 4px 10px #0004'
                        }}>
                          <span style={{ fontSize: 8, opacity: 0.8 }}>PSA</span> {cardObj.psaGrade}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '10px 12px', background: isGraded ? 'transparent' : '#ffffff02' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {api.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 9, color: rc.c, fontWeight: 900, letterSpacing: 0.5 }}>{rc.s} {rc.l.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 900 }}>${getCardValue(cardObj).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#fff4', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                LOADING MORE CARDS...
              </div>
            )}
            
            {!hasMore && cards.length > 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#fff2', fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>
                 VAULT FULLY LOADED
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Status */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px 16px',
        background: 'linear-gradient(to top, #05080f 80%, transparent)', 
        display: 'flex', justifyContent: 'center'
      }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
          padding: '8px 20px', borderRadius: 20, color: '#fff4', fontSize: 10, fontWeight: 800, 
          letterSpacing: 1.5, border: '1px solid #ffffff08'
        }}>
          {cards.length} CARDS VISIBLE • READ-ONLY VAULT
        </div>
      </div>
    </div>
  );
}
