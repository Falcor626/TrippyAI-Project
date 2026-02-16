import { useState } from 'react';
import Login from './Components/login';
import SignUp from './Components/signUp';

function App() {
  const [showLogin, setShowLogin] = useState(true);

  const toggleForm = () => {
    setShowLogin(!showLogin);
  };

  return (
    <div className="App">
      <button onClick={toggleForm}>
        {showLogin ? 'Switch to Sign Up' : 'Switch to Login'}
      </button>
      {showLogin ? <Login /> : <SignUp />}
    </div>
  );
}

export default App;
