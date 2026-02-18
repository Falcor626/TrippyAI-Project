import { useState, useEffect } from 'react';
import Login from './Components/login';
import SignUp from './Components/signUp';
import Settings from './Components/Settings';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <div className="App">
      <h1 className="app-title">TrippyAI</h1>
      <button className="settings-btn" onClick={toggleSettings} title="Settings">
        ⚙️
      </button>
      {showSettings ? (
        <Settings toggleForm={toggleSettings} />
      ) : showLogin ? (
        <Login toggleForm={toggleForm} />
      ) : (
        <SignUp toggleForm={toggleForm} />
      )}
    </div>
  );
}

export default App;
