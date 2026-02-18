import './MainMenu.css';

function MainMenu({ onLogout }) {
    return (
        <div className="menu-container">
            <h2>Main Menu</h2>
            <div className="menu-buttons">
                <button className="menu-btn start-plan-btn">
                    Start New Plan
                </button>
                <button className="menu-btn view-plans-btn">
                    View Plans
                </button>
                <button className="menu-btn trippi-btn">
                    Trippi
                </button>
            </div>
            <button className="logout-btn" onClick={onLogout}>
                Logout
            </button>
        </div>
    );
}

export default MainMenu;
