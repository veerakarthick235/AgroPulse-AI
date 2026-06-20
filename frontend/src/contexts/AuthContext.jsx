import { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  // Load user profile if token exists
  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/api/auth/profile');
          const profile = res.data.profile;
          if (profile.role === 'seller') profile.role = 'buyer';
          setUser({ uid: profile.id, email: profile.email });
          setUserProfile(profile);
        } catch (error) {
          console.error('Failed to load profile:', error);
          localStorage.removeItem('token');
          setUser(null);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    };

    loadProfile();
  }, []);

  // ── Email/Password Login ───────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, user: profile } = res.data;
    
    localStorage.setItem('token', token);
    if (profile.role === 'seller') profile.role = 'buyer';
    setUser({ uid: profile.id, email: profile.email });
    setUserProfile(profile);
    return res;
  };

  // ── Google Login ──────────────────────────────────────────────────────────
  const loginWithGoogle = async (googleToken) => {
    const res = await api.post('/api/auth/google-login', { token: googleToken });
    const { token, user: profile } = res.data;
    
    localStorage.setItem('token', token);
    if (profile.role === 'seller') profile.role = 'buyer';
    setUser({ uid: profile.id, email: profile.email });
    setUserProfile(profile);
    return res;
  };

  // ── Email Registration ─────────────────────────────────────────────────────
  const register = async (userData) => {
    // API expects: email, password, displayName, phone, address, etc.
    const res = await api.post('/api/auth/register', userData);
    const { token, user: profile } = res.data;
    
    localStorage.setItem('token', token);
    if (profile.role === 'seller') profile.role = 'buyer';
    setUser({ uid: profile.id, email: profile.email });
    setUserProfile(profile);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserProfile(null);
  };

  // We could implement a real-time polling mechanism if required, 
  // but for now relying on route transitions / manual refresh is usually enough 
  // for a REST-based frontend. Alternatively, the refresh function can be exported.
  const refreshProfile = async () => {
    try {
      const res = await api.get('/api/auth/profile');
      const profile = res.data.profile;
      if (profile.role === 'seller') profile.role = 'buyer';
      setUserProfile(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const role       = userProfile?.role       || null;
  const isApproved = userProfile?.isApproved ?? false;

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading, role, isApproved,
      login, loginWithGoogle, register, logout, refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
