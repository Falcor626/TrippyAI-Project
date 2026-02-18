import { useState } from 'react';
import { supabase } from '../supabaseClient';

function Login({ toggleForm, onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [forgotPasswordError, setForgotPasswordError] = useState('');
    const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
    const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Sign in with Supabase
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (signInError) throw signInError;

            if (data.user) {
                onLogin();
                setEmail('');
                setPassword('');
            }
        } catch (err) {
            setError(err.message || 'Failed to login');
            console.error('Login Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const openForgotPasswordModal = () => {
        setShowForgotPasswordModal(true);
        setForgotPasswordError('');
        setForgotPasswordSuccess('');
        setForgotPasswordEmail('');
    };

    const closeForgotPasswordModal = (e) => {
        // Only close if clicking on the overlay, not the modal content
        if (e.target.className === 'forgot-password-overlay') {
            setShowForgotPasswordModal(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setForgotPasswordError('');
        setForgotPasswordSuccess('');
        setForgotPasswordLoading(true);

        // Validate inputs
        if (!forgotPasswordEmail) {
            setForgotPasswordError('Email is required');
            setForgotPasswordLoading(false);
            return;
        }

        try {
            // For client-side password reset, we need to use the password reset email flow
            // This sends an email with a reset link to the user
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                forgotPasswordEmail,
                {
                    redirectTo: `${window.location.origin}`
                }
            );

            if (resetError) {
                throw resetError;
            }

            setForgotPasswordSuccess('Password reset link sent to your email! Check your inbox.');
            // Keep modal open so user can see the message
            setForgotPasswordEmail('');
            
            setTimeout(() => {
                setShowForgotPasswordModal(false);
            }, 3000);
        } catch (err) {
            setForgotPasswordError(err.message || 'Failed to send reset email. Please try again.');
            console.error('Forgot Password Error:', err);
        } finally {
            setForgotPasswordLoading(false);
        }
    };

    // Render the login form
    return (
        <div className="form-container">
            <h2>Login</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input 
                        type="email" 
                        id="email"
                        name="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div>
                    <label htmlFor="password">Password:</label>
                    <input 
                        type="password" 
                        id="password"
                        name="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="button-group">
                    <button type="submit" disabled={loading}>
                        {loading ? 'Logging in...' : 'Submit'}
                    </button>
                    <button type="button" className="secondary-button" onClick={toggleForm} disabled={loading}>
                        Sign Up
                    </button>
                </div>
                <div className="forgot-password">
                    <button type="button" className="forgot-password-btn" onClick={openForgotPasswordModal} disabled={loading}>
                        Forgot Password
                    </button>
                </div>
            </form>

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="forgot-password-overlay" onClick={closeForgotPasswordModal}>
                    <div className="forgot-password-modal">
                        <h3>Reset Password</h3>
                        {forgotPasswordError && <div className="error-message">{forgotPasswordError}</div>}
                        {forgotPasswordSuccess && <div className="success-message">{forgotPasswordSuccess}</div>}
                        <form onSubmit={handleForgotPasswordSubmit}>
                            <div>
                                <label htmlFor="forgot-email">Email:</label>
                                <input 
                                    type="email" 
                                    id="forgot-email"
                                    placeholder="Enter your email"
                                    value={forgotPasswordEmail}
                                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                    required
                                    disabled={forgotPasswordLoading}
                                />
                            </div>
                            <p className="reset-info">We will send a password reset link to your email.</p>
                            <button type="submit" disabled={forgotPasswordLoading}>
                                {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Login;