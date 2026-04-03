import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import PublicVaultModal from "./PublicVaultModal.jsx";

export default function LeaderboardModal({ onClose }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showVault, setShowVault] = useState(null); // { userId, username, totalValue }

  const fetchLeaders = useCallback(async (isAuto = false) => {
    if (!isAuto) setRefreshing(true);
    try {
      const { data, error: err } = await supabase.rpc('get_leaderboard');
      if (err) throw err;
      setLeaders(data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Leaderboard error:", err);
      setError("Database function 'get_leaderboard' not found or out of date.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaders();
    // Auto-refresh every 30 seconds while open
    const interval = setInterval(() => fetchLeaders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchLeaders]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(5, 8, 15, 0.95)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .leaderboard-row:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          transform: translateX(4px);
          cursor: pointer;
        }
      `}</style>
      
      <div style={{
        width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto',
        background: 'linear-gradient(160deg, #1a1f35, #0f121d)',
        borderRadius: 28, border: '1px solid #ffffff15',
        boxShadow: '0 24px 80px #000', padding: 32, position: 'relative'
      }}>
        {/* Navigation back from Vault handled inside PublicVaultModal */}
        {showVault && (
          <PublicVaultModal 
            userId={showVault.userId} 
            username={showVault.username} 
            totalValue={showVault.totalValue}
            onClose={() => setShowVault(null)} 
          />
        )}

        <button onClick={onClose} style={{
          position: 'absolute', top: 24, right: 24, background: 'none', border: 'none',
          color: '#fff4', fontSize: 24, cursor: 'pointer', zIndex: 10
        }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏆</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#FFD700', margin: 0, letterSpacing: 3 }}>HALL OF FAME</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ 
              width: 8, height: 8, background: '#ef4444', borderRadius: '50%',
              boxShadow: '0 0 10px #ef4444', animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: 10, color: '#fff4', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Live Rankings
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
          <div style={{ fontSize: 10, color: '#fff3' }}>
            LAST UPDATE: {lastUpdated.toLocaleTimeString()}
          </div>
          <button 
            disabled={refreshing}
            onClick={() => fetchLeaders()} 
            style={{ 
              background: 'none', border: 'none', color: '#FFD700', fontSize: 11, 
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: refreshing ? 0.5 : 1
            }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {refreshing ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#fff4' }}>Initializing Vaults...</div>
        ) : error ? (
          <div style={{ padding: 24, background: '#ef444410', border: '1px solid #ef444433', borderRadius: 16, color: '#fca5a5', fontSize: 14, textAlign: 'center' }}>
            {error}
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Run the updated SQL migration in Supabase.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 10, color: '#fff2', textAlign: 'center', marginBottom: 8, letterSpacing: 1 }}>TAP A TRAINER TO VIEW VAULT</div>
            {leaders.map((user, i) => (
              <div 
                key={i} 
                className="leaderboard-row"
                onClick={() => setShowVault({ userId: user.user_id, username: user.username, totalValue: user.total_value })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 24px', borderRadius: 20,
                  background: i === 0 ? 'linear-gradient(90deg, #FFD70015, transparent)' : '#ffffff03',
                  border: i === 0 ? '1px solid #FFD70033' : '1px solid #ffffff06',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ 
                    width: 32, height: 32, borderRadius: '50%', 
                    background: i < 3 ? 'linear-gradient(135deg, #FFD700, #FFA000)' : '#ffffff08',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900, color: i < 3 ? '#000' : '#fff4'
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: i === 0 ? '#FFD700' : '#fff' }}>
                      {user.username}
                    </div>
                    {i === 0 && <div style={{ fontSize: 10, color: '#FFD700', fontWeight: 800, letterSpacing: 1 }}>CURRENT CHAMPION</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80', textShadow: '0 0 20px #4ade8022' }}>
                    ${parseFloat(user.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 9, color: '#fff2', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>Portfolio Value</div>
                </div>
              </div>
            ))}
            {leaders.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: '#fff2' }}>No trainers in the Hall of Fame yet!</div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 32, padding: 16, borderRadius: 16, border: '1px solid #ffffff10',
          background: 'rgba(255,255,255,0.03)', color: '#fff8', fontWeight: 800, cursor: 'pointer',
          transition: 'all 0.2s ease'
        }} onMouseEnter={e => e.target.style.background = '#ffffff08'} onMouseLeave={e => e.target.style.background = '#ffffff03'}>
          Return to Hub
        </button>
      </div>
    </div>
  );
}
