import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header>
        <h1>Travel Together</h1>
        <div className="user-info">
          <span>Welcome, {user?.displayName}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      
      <main>
        <h2>Dashboard</h2>
        <p>You're logged in! Explore your travel data below.</p>
        
        <nav className="main-nav">
          <Link to="/travels">My Travels</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/friends">Friends</Link>
          <Link to="/lets-travel">Let's Travel</Link>
        </nav>
      </main>
    </div>
  );
}
