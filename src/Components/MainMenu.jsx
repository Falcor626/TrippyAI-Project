import './MainMenu.css';

function MainMenu({ onLogout, onStartPlan, onViewPlans }) {
    return (
        <div className="menu-container">
            <h2>Main Menu</h2>
            <div className="menu-buttons">
                <button className="menu-btn start-plan-btn" onClick={onStartPlan}>
                    Start New Plan
                </button>
                <button className="menu-btn view-plans-btn" onClick={onViewPlans}>
                    View Plans
                </button>
            </div>
            <button className="logout-btn" onClick={onLogout}>
                Logout
            </button>
        </div>
    );
}

export default MainMenu;
