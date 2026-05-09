import { useState, useEffect } from 'react';
import { deleteUserAccount } from '../services/userService';

function Settings({ toggleForm }) {
    const [darkMode, setDarkMode] = useState(() => {
        // Check if dark mode preference is saved in localStorage
        const savedDarkMode = localStorage.getItem('darkMode');
        return savedDarkMode ? JSON.parse(savedDarkMode) : false;
    });

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

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

    const handleDeleteAccountClick = () => {
        setShowDeleteConfirm(true);
        setDeleteError(null);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const result = await deleteUserAccount();
            if (result.success) {
                // Redirect to login or home page after successful deletion
                window.location.href = '/';
            }
        } catch (error) {
            setDeleteError(error.message);
            setIsDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteError(null);
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

            <div className="settings-section">
                <div className="settings-item danger-zone">
                    <div className="settings-label">
                        <label htmlFor="deleteAccount">Delete Account</label>
                        <p className="settings-description">Permanently delete your account and all associated data</p>
                    </div>
                    <button
                        type="button"
                        className="danger-button"
                        onClick={handleDeleteAccountClick}
                        id="deleteAccount"
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            <div className="button-group">
                <button type="button" className="secondary-button" onClick={toggleForm}>
                    Back
                </button>
            </div>

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content delete-confirmation">
                        <h3>Delete Account</h3>
                        <p className="delete-warning">
                            Are you sure you want to delete your account? This action is <strong>permanent</strong> and cannot be undone.
                        </p>
                        <p className="delete-warning">
                            All your data will be deleted, including:
                        </p>
                        <ul className="delete-list">
                            <li>Travel itineraries and plans</li>
                            <li>Trip requests and preferences</li>
                            <li>Chat sessions and messages</li>
                            <li>Feedback and ratings</li>
                            <li>User profile information</li>
                        </ul>
                        
                        {deleteError && (
                            <div className="error-message">
                                {deleteError}
                            </div>
                        )}
                        
                        <div className="modal-buttons">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={handleCancelDelete}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="danger-button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings;
