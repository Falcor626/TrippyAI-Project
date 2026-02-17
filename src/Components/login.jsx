import { useState } from 'react';

function Login({ toggleForm }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    //  Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Login:', { username, password });
    };

    // Render the login form
    return (
        <div className="form-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username">Username:</label>
                    <input 
                        type="text" 
                        id="username"
                        name="username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
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
                    />
                </div>
                <div className="button-group">
                    <button type="submit">Submit</button>
                    <button type="button" className="secondary-button" onClick={toggleForm}>
                        Sign Up
                    </button>
                </div>
            </form>
        </div>
    );
}

export default Login;