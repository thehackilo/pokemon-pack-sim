import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function LeaderboardModal({ onClose }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const { data, error: err } = await supabase.rpc('get_leaderboard');
        if (err) throw err;
        setLeaders(data || []);
      } catch (err) {
        console.error("Leaderboard error:", err);
        setError("Database function 'get_leaderboard' not found. Please run the SQL migration.");
      } finally {
        setLoading(false);
      }
    }
    fetchLeaders();
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(5, 8, 15, 0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto',
        background: 'linear-gradient(160deg, #1a1f35, #0f121d)',
        borderRadius: 24, border: '1px solid #ffffff15',
        boxShadow: '0 20px 50px #000', padding: 32, position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, background: 'none', border: 'none',
          color: '#fff4', fontSize: 24, cursor: 'pointer'
        }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#FFD700', margin: 0, letterSpacing: 2 }}>HALL OF FAME</h2>
          <div style={{ fontSize: 12, color: '#fff5', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Top Collection Values</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#fff4' }}>Loading rankings...</div>
        ) : error ? (
          <div style={{ padding: 20, background: '#ef444415', border: '1px solid #ef444433', borderRadius: 12, color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leaders.map((user, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: 16,
                background: i === 0 ? 'linear-gradient(90deg, #FFD70022, transparent)' : '#ffffff05',
                border: i === 0 ? '1px solid #FFD70033' : '1px solid #ffffff08',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ 
                    width: 28, height: 28, borderRadius: '50%', background: i < 3 ? '#FFD700' : '#ffffff11',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900, color: i < 3 ? '#000' : '#fff5'
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? '#FFD700' : '#fff' }}>
                    {user.username}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#4ade80' }}>
                    ${parseFloat(user.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: '#fff3', letterSpacing: 1 }}>COLLECTION VALUE</div>
                </div>
              </div>
            ))}
            {leaders.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#fff3' }}>No ranked trainers yet!</div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 32, padding: 14, borderRadius: 12, border: '1px solid #ffffff15',
          background: '#ffffff08', color: '#fff', fontWeight: 700, cursor: 'pointer'
        }}>
          Close
        </button>
      </div>
    </div>
  );
}
