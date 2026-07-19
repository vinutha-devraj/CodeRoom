import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';

function Auth() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isLogin && !username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setLoading(true);
    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      result = await register(username, email, password);
    }
    setLoading(false);

    if (result.success) {
      toast.success(isLogin ? 'Welcome back!' : 'Account registered successfully!');
    } else {
      toast.error(result.message);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-container">
      <div className="auth-glass-card">
        <div className="auth-logo">
          <Terminal className="logo-icon" size={40} />
          <h1>CodeRoom</h1>
          <p>{isLogin ? 'Collaborate on code in real-time' : 'Create an account to start coding'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  id="username"
                  placeholder="john_doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-auth btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner-small"></span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-toggle-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={toggleMode} className="toggle-mode-btn" disabled={loading}>
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;
