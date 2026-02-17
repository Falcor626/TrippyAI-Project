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
      <h1 className="app-title">TrippyAI</h1>
      {showLogin ? <Login toggleForm={toggleForm} /> : <SignUp toggleForm={toggleForm} />}
    </div>
  );
}

export default App;
