import { useState } from 'react';
import { supabase } from '../supabaseClient';

function Login({ toggleForm, onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
            </form>
        </div>
    );
}

export default Login;