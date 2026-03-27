import { useState, useEffect } from 'react';

function Settings({ toggleForm }) {
    const [darkMode, setDarkMode] = useState(() => {
        // Check if dark mode preference is saved in localStorage
        const savedDarkMode = localStorage.getItem('darkMode');
        return savedDarkMode ? JSON.parse(savedDarkMode) : false;
    });

    // Update dark mode in local storage and apply to document
    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
        
        if (darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }, [darkMode]);

    const handleDarkModeToggle = () => {
        setDarkMode(!darkMode);
    };

    return (
        <div className="form-container settings-container">
            <h2>Settings</h2>
            
            <div className="settings-section">
                <div className="settings-item">
                    <div className="settings-label">
                        <label htmlFor="darkMode">Dark Mode</label>
                        <p className="settings-description">Enable dark theme for the application</p>
                    </div>
                    <div className="toggle-switch">
                        <input
                            type="checkbox"
                            id="darkMode"
                            checked={darkMode}
                            onChange={handleDarkModeToggle}
                            className="toggle-checkbox"
                        />
                        <label htmlFor="darkMode" className="toggle-label"></label>
                    </div>
                </div>
            </div>

            <div className="button-group">
                <button type="button" className="secondary-button" onClick={toggleForm}>
                    Back
                </button>
            </div>
        </div>
    );
}

export default Settings;
