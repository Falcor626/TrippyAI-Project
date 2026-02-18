import { useState } from 'react';
import { supabase } from '../supabaseClient';

function SignUp({ toggleForm, onLogin }) {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    //  Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            // Sign up the user with Supabase Auth
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        full_name: fullname,
                        phone: phone
                    },
                    emailRedirectTo: `${window.location.origin}/login`
                }
            });

            if (signUpError) throw signUpError;

            // Show success modal
            setShowModal(true);
            
            // Clear form
            setEmail('');
            setUsername('');
            setPassword('');
            setFullname('');
            setPhone('');
            
        } catch (error) {
            setError(error.message || 'An error occurred during registration');
            console.error('Sign Up Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Close modal handler
    const closeModal = () => {
        setShowModal(false);
        setError('');
        onLogin();
    };

    // Render the sign-up form
    return (
        <>
            <div className="form-container">
                <h2>Sign Up</h2>
                
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}
                
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
                        <label htmlFor="username">Username:</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            placeholder="Choose a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
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
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="fullname">Full Name:</label>
                        <input
                            type="text"
                            id="fullname"
                            name="fullname"
                            placeholder="Enter your full name"
                            value={fullname}
                            onChange={(e) => setFullname(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="phone">Phone Number:</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            placeholder="Enter your phone number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="button-group">
                        <button type="submit" disabled={loading}>
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                        <button type="button" className="secondary-button" onClick={toggleForm}>
                            Back to Login
                        </button>
                    </div>
                </form>
            </div>

            {/* Verification Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Registration Complete! ✓</h3>
                        </div>
                        <div className="modal-body">
                            <p>Please verify your account in your email address.</p>
                            <p className="modal-subtext">We've sent a verification link to <strong>{email}</strong></p>
                        </div>
                        <div className="modal-footer">
                            <button className="modal-button" onClick={closeModal}>
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default SignUp;