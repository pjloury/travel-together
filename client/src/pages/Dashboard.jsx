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
        <p>You're logged in! More features coming soon...</p>
        
        <nav className="main-nav">
          <a href="/travels">My Travels</a>
          <a href="/wishlist">Wishlist</a>
          <a href="/friends">Friends</a>
          <a href="/lets-travel">Let's Travel</a>
        </nav>
      </main>
    </div>
  );
}

