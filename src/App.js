import { useState, useEffect } from 'react';
import Login from './Components/login';
import SignUp from './Components/signUp';
import Settings from './Components/Settings';
import MainMenu from './Components/MainMenu';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Restore dark mode preference on app load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode && JSON.parse(savedDarkMode)) {
      document.documentElement.setAttribute('data-theme', 'dark');
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

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowSettings(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLogin(true);
  };
  return (
    <div className="App">
      <h1 className="app-title">TrippyAI</h1>
      <div className="icon-buttons">
        {isLoggedIn && (
          <button className="profile-btn" onClick={toggleProfile} title="Profile">
            👤
          </button>
        )}
        <button className="settings-btn" onClick={toggleSettings} title="Settings">
          ⚙️
        </button>
      </div>
      {showSettings ? (
        <Settings toggleForm={toggleSettings} />
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
