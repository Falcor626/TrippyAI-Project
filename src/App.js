import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Components/login';
import SignUp from './Components/signUp';
import Settings from './Components/Settings';
import ProfileSettings from './Components/ProfileSettings';
import MainMenu from './Components/MainMenu';
import ResetPassword from './Components/ResetPassword';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Restore dark mode preference on app load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode && JSON.parse(savedDarkMode)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Check for password reset token in URL
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, []);

  const toggleForm = () => {
    setShowLogin(!showLogin);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const toggleProfile = () => {
    setShowProfile(!showProfile);
  };

  const loadUserProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return;
      }

      const { data: profile, error: fetchError } = await supabase
        .from('userProfiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading profile:', fetchError);
        return;
      }

      if (profile && profile.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowSettings(false);
    loadUserProfile();
  };

  const onAvatarUpdate = (newAvatarUrl) => {
    setAvatarUrl(newAvatarUrl);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLogin(true);
    setShowProfile(false);
    setAvatarUrl(null);
  };

  const handleResetComplete = () => {
    setShowResetPassword(false);
    setShowLogin(true);
    // Clear the URL fragment to remove the reset token
    window.history.replaceState(null, '', window.location.pathname);
  };

  return (
    <div className="App">
      <h1 className="app-title">TrippyAI</h1>
      <div className="icon-buttons">
        {isLoggedIn && (
          <button className="profile-btn" onClick={toggleProfile} title="Profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="profile-avatar" />
            ) : (
              '👤'
            )}
          </button>
        )}
        <button className="settings-btn" onClick={toggleSettings} title="Settings">
          ⚙️
        </button>
      </div>
      {showResetPassword ? (
        <ResetPassword onResetComplete={handleResetComplete} />
      ) : showSettings ? (
        <Settings toggleForm={toggleSettings} />
      ) : showProfile ? (
        <ProfileSettings toggleProfile={toggleProfile} onAvatarUpdate={onAvatarUpdate} />
      ) : isLoggedIn ? (
        <MainMenu onLogout={handleLogout} />
      ) : showLogin ? (
        <Login toggleForm={toggleForm} onLogin={handleLogin} />
      ) : (
        <SignUp toggleForm={toggleForm} onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
