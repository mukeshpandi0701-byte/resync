import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, CheckCircle2, Users, BarChart2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('Supervisor');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="login-split-container">
      <div className="login-left-hero">
        <div className="login-left-brand">
          <div className="brand-icon-shield" style={{ width: 44, height: 44 }}>
            <Shield size={24} fill="currentColor" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>ReSync</h2>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Offline Inspections • Stronger Together</p>
          </div>
        </div>

        <div className="login-hero-content">
          <h1>Field Work<br /><span>Never Stops</span></h1>
          <p>Safer Places. Healthier People. Stronger Together.</p>
          
          <div className="login-features-row">
            <div className="login-feature-item">
              <div className="login-feature-icon"><CheckCircle2 size={16} /></div>
              <span>Inspect</span>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon"><Users size={16} /></div>
              <span>Collaborate</span>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon"><BarChart2 size={16} /></div>
              <span>Resolve</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
          “Clean Today. Healthier Tomorrow.”
        </div>
      </div>

      <div className="login-right-form">
        <div className="login-card">
          <div className="login-card-logo">
            <div className="brand-icon-shield">
              <Shield size={22} fill="currentColor" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>ReSync</h2>
              <p style={{ fontSize: 11, color: '#697386' }}>Offline Inspections Stronger Together</p>
            </div>
          </div>

          <h3 className="login-card-title">Welcome Back</h3>
          <p className="login-card-sub">Sign in to continue to ReSync</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="input-field" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="input-field" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#697386' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: '#D92F45', textDecoration: 'none', fontWeight: 600 }}>
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              Sign In
            </button>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#697386' }}>
              New to ReSync? Contact your administrator.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
