import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthOverlay({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  // If Supabase isn't configured, we can allow a "bypass" for local dev
  const isConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== "https://placeholder-url.supabase.co";

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!isConfigured) {
      setError("Supabase is not configured! Check your .env.local file.");
      return;
    }

    setLoading(true);
    setError(null);
    let authError = null;

    if (isSignUp) {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      authError = err;
      if (!err && data.user) {
        // Create initial profile row
        const { error: profileErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          wallet: 25.00,
          stats: {packs:0,common:0,uncommon:0,rare:0,ultra:0,legendary:0},
          auto_sell_threshold: 0
        });
        if (profileErr) console.error("Failed to make profile:", profileErr);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      authError = err;
    }

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // successful login triggers App.jsx session watcher
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10, 15, 24, 0.95)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '100%', maxWidth: 400, padding: 32,
        background: 'linear-gradient(160deg, #161b2a, #10131f)',
        borderRadius: 24, border: '1px solid #ffffff11',
        boxShadow: '0 16px 64px #000a'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{
            fontSize: 28, fontWeight: 900, color: '#FFD700', letterSpacing: 2, margin: 0,
            textShadow: '0 0 20px #FFD70044'
          }}>POKÉMON PACK SIM</h2>
          <div style={{ fontSize: 13, color: '#fff6', marginTop: 8 }}>
            Cloud Save & Online Collection
          </div>
        </div>

        {!isConfigured && (
          <div style={{ padding: 12, background: '#ef444422', border: '1px solid #ef444455', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            <b>⚠️ Backend offline!</b> You must paste your Supabase keys in `.env.local` to use authentication.
            <button onClick={() => onLogin({id: "guest"})} style={{ marginTop: 8, width: '100%', padding: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
              Bypass (Play Local Only)
            </button>
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 700, marginBottom: 6 }}>EMAIL</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: '#ffffff0a', border: '1px solid #ffffff22', borderRadius: 12, color: '#fff', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 700, marginBottom: 6 }}>PASSWORD</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: '#ffffff0a', border: '1px solid #ffffff22', borderRadius: 12, color: '#fff', outline: 'none' }} />
          </div>

          {error && <div style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            padding: '14px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#000',
            fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8,
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Secure Login')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#fff6' }}>
          {isSignUp ? "Already have a vault?" : "New here?"}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{
            background: 'none', border: 'none', color: '#FFD700', fontWeight: 700, cursor: 'pointer', marginLeft: 6
          }}>
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
