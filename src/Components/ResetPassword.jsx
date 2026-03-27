import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function ResetPassword({ onResetComplete }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        // Check if user has a valid session from the reset token
        const checkSession = async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                setError('Invalid or expired reset link. Please request a new password reset.');
            }
        };
        
        checkSession();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Validate inputs
        if (!newPassword || !confirmPassword) {
            setError('Both password fields are required');
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        try {
            // Update the user's password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setSuccess('Password reset successful! Redirecting to login...');
            setNewPassword('');
            setConfirmPassword('');

            // Redirect to login after 2 seconds
            setTimeout(() => {
                onResetComplete();
            }, 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password');
            console.error('Reset Password Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <h2>Reset Password</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="new-password">New Password:</label>
                    <input 
                        type="password" 
                        id="new-password"
                        name="new-password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div>
                    <label htmlFor="confirm-password">Confirm Password:</label>
                    <input 
                        type="password" 
                        id="confirm-password"
                        name="confirm-password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="button-group">
                    <button type="submit" disabled={loading}>
                        {loading ? 'Resetting Password...' : 'Reset Password'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ResetPassword;
