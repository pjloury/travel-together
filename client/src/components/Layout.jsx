import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      <header className="main-header">
        <NavLink to="/" className="logo">Travel Together</NavLink>
        <nav className="nav-links">
          <NavLink to="/travels">My Travels</NavLink>
          <NavLink to="/wishlist">Wishlist</NavLink>
          <NavLink to="/friends">Friends</NavLink>
          <NavLink to="/lets-travel">Let's Travel</NavLink>
        </nav>
        <div className="user-menu">
          <span>{user?.displayName}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

