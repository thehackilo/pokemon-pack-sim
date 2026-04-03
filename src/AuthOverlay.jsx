import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthOverlay({ onLogin }) {
  const [username, setUsername] = useState('');
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

    // Build the internal email (mapping username to dummy domain if email is missing)
    let finalEmail = email;
    if (!email && username) {
      // Internal dummy email mapping
      finalEmail = `${username.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}@packsim.user`;
    }

    if (isSignUp) {
      if (!username) {
        setError("Username is required for new accounts!");
        setLoading(false);
        return;
      }
      
      const { data, error: err } = await supabase.auth.signUp({ 
        email: finalEmail, 
        password,
        options: {
          data: { 
            display_name: username 
          }
        }
      });
      authError = err;
      
      if (!err && data.user) {
        // Create initial profile record with username
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username,
          wallet: 25.00,
          auto_sell_threshold: 0
        });
        
        if (!data.session) {
          setError("Account created! Please verify your email if provided, or try logging in now.");
          setLoading(false);
          return;
        }
      }
    } else {
      // Login attempt
      const { error: err } = await supabase.auth.signInWithPassword({ 
        email: finalEmail, 
        password 
      });
      authError = err;
    }

    if (authError) {
      setError(authError.message === "Invalid login credentials" ? "Invalid Username/Email or Password" : authError.message);
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
        width: '100%', maxWidth: 400, padding: "32px 24px",
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
            Join the Community Leaderboard
          </div>
        </div>

        {!isConfigured && (
          <div style={{ padding: 12, background: '#ef444422', border: '1px solid #ef444455', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            <b>⚠️ Backend offline!</b> Authentication requires Supabase keys.
            <button onClick={() => onLogin({id: "guest"})} style={{ marginTop: 8, width: '100%', padding: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
              Bypass (Play Local Only)
            </button>
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp ? (
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 700, marginBottom: 6 }}>CHOOSE USERNAME</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Champion123"
                style={{ width: '100%', padding: '12px 16px', background: '#ffffff0a', border: '1px solid #ffffff22', borderRadius: 12, color: '#fff', outline: 'none' }} />
            </div>
          ) : (
             <div>
              <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 700, marginBottom: 6 }}>USERNAME OR EMAIL</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', background: '#ffffff0a', border: '1px solid #ffffff22', borderRadius: 12, color: '#fff', outline: 'none' }} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#fff6', fontWeight: 700, marginBottom: 6 }}>EMAIL {isSignUp && <span style={{color: '#fff3'}}>(OPTIONAL)</span>}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={isSignUp ? "For account recovery" : ""}
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
