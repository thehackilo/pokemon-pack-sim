import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function ProfileModal({ currentName, onUpdate, onClose }) {
  const [newName, setNewName] = useState(currentName || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (newName.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (newName.length > 15) {
      setError("Username must be under 15 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error: err } = await supabase
        .from('profiles')
        .update({ username: newName.trim() })
        .eq('id', user.id);

      if (err) throw err;

      onUpdate(newName.trim());
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error("Update error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(5, 8, 15, 0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'linear-gradient(160deg, #1a1f35, #0f121d)',
        borderRadius: 24, border: '1px solid #ffffff15',
        boxShadow: '0 20px 60px #000', padding: 32, position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, background: 'none', border: 'none',
          color: '#fff4', fontSize: 24, cursor: 'pointer'
        }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>TRAINER PROFILE</h2>
          <p style={{ fontSize: 13, color: '#fff5', marginTop: 4 }}>Set your public display name</p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase' }}>USERNAME</label>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              placeholder="Enter username..."
              autoFocus
              style={{
                width: '100%', padding: '14px 18px', background: '#ffffff0a', border: '1px solid #ffffff15',
                borderRadius: 14, color: '#fff', outline: 'none', fontSize: 16
              }}
            />
          </div>

          {error && <div style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: '#4ade80', fontSize: 12, textAlign: 'center' }}>Username updated!</div>}

          <button 
            type="submit" 
            disabled={loading || success} 
            style={{
              padding: '16px', borderRadius: 14, border: 'none', cursor: (loading || success) ? 'wait' : 'pointer',
              background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#000',
              fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8,
              opacity: (loading || success) ? 0.7 : 1
            }}
          >
            {loading ? 'SAVING...' : success ? 'DONE!' : 'SAVE CHANGES'}
          </button>
        </form>

        <button onClick={onClose} style={{
          width: '100%', marginTop: 20, padding: 12, background: 'none', border: 'none',
          color: '#fff4', fontSize: 13, cursor: 'pointer', fontWeight: 700
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
