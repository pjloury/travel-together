// Layout component - simplified navigation per spec.md Section 4.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-001, REQ-NAV-005, REQ-NAV-007, REQ-NOTIF-001, SCN-NOTIF-001-01

import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

/**
 * Compute relative time string from a date.
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time (e.g. "2 hours ago")
 */
function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Build display text for a notification based on its type and data.
 * @param {Object} notif - Notification object from API
 * @returns {string}
 */
function getNotificationText(notif) {
  if (notif.displayText) return notif.displayText;
  const actorName = notif.actor?.displayName || 'Someone';
  const pinName = notif.pin?.placeName || 'a pin';
  if (notif.type === 'inspired') {
    return `${actorName} saved a dream inspired by your ${pinName} pin`;
  }
  if (notif.type === 'interest') {
    return `${actorName} expressed interest in your ${pinName} pin`;
  }
  return `${actorName} interacted with your ${pinName} pin`;
}

/**
 * Layout is the app shell with header navigation and notification panel.
 *
 * @implements REQ-NAV-001 (PAST/FUTURE tab accessible from header)
 * @implements REQ-NAV-005 (search accessible from nav)
 * @implements REQ-NAV-007 (friends management accessible from nav)
 * @implements REQ-NOTIF-001 (notification bell with badge + dropdown panel)
 * @implements SCN-NOTIF-001-01 (chronological list, inline highlight, mark-all-read on open)
 */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification panel state
  // @implements REQ-NOTIF-001, SCN-NOTIF-001-01
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifPanelRef = useRef(null);

  // Account menu state
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifPanelOpen) return;
    function handleClickOutside(e) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifPanelOpen]);

  // Close account menu on outside click
  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClickOutside(e) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  async function fetchNotificationCount() {
    try {
      const response = await api.get('/notifications?limit=1');
      setUnreadCount(response.data?.unreadCount || response.unreadCount || 0);
    } catch {
      // Silently fail - notification count is non-critical
    }
  }

  /**
   * Toggle notification panel open/closed.
   * On open: fetch notifications and mark all as read.
   * @implements SCN-NOTIF-001-01
   */
  async function handleBellClick() {
    if (notifPanelOpen) {
      setNotifPanelOpen(false);
      return;
    }

    setNotifPanelOpen(true);
    setNotifLoading(true);

    try {
      const response = await api.get('/notifications');
      const notifData = response.data?.notifications || response.notifications || [];
      setNotifications(notifData);

      // Mark all as read on open
      if (unreadCount > 0) {
        try {
          await api.put('/notifications/read', { all: true });
          setUnreadCount(0);
        } catch {
          // Non-critical
        }
      }
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <header className="nav-bar">
        <NavLink to={user ? '/' : '/discover'} className="nav-brand">Travel Together</NavLink>

        <nav className="nav-center">
          {user && <NavLink to="/" end className="nav-link">Home</NavLink>}
          <NavLink to="/discover" className="nav-link">Discover</NavLink>
          {user && <NavLink to="/friends" className="nav-link">Friends</NavLink>}
        </nav>

        <div className="nav-actions">
          {!user && (
            <NavLink to="/login" className="nav-signin-link">Sign in</NavLink>
          )}

          {/* Notification bell @implements REQ-NOTIF-001, SCN-NOTIF-001-01 */}
          {user && <div className="notification-bell-container" ref={notifPanelRef}>
            <button
              className="notification-bell"
              onClick={handleBellClick}
              title="Notifications"
            >
              &#9825;
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {notifPanelOpen && (
              <div className="notification-panel">
                <div className="notification-panel-header">
                  <h3>Notifications</h3>
                </div>
                <div className="notification-panel-list">
                  {notifLoading && (
                    <div className="notification-panel-loading">Loading…</div>
                  )}
                  {!notifLoading && notifications.length === 0 && (
                    <div className="notification-panel-empty">No activity yet</div>
                  )}
                  {!notifLoading && notifications.map(notif => {
                    const actorId = notif.actor?.id || notif.actorId;
                    return (
                      <div
                        key={notif.id}
                        className={`notification-item${!notif.read ? ' notification-item-unread' : ''}${actorId ? ' notification-item-clickable' : ''}`}
                        onClick={actorId ? () => { setNotifPanelOpen(false); navigate(`/user/${actorId}`); } : undefined}
                      >
                        <div className="notification-item-avatar">
                          {notif.actor?.avatarUrl ? (
                            <img src={notif.actor.avatarUrl} alt={notif.actor.displayName} className="notification-avatar-img" />
                          ) : (
                            <div className="notification-avatar-placeholder">
                              {(notif.actor?.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="notification-item-body">
                          <p className="notification-item-text">{getNotificationText(notif)}</p>
                          <span className="notification-item-time">{relativeTime(notif.createdAt)}</span>
                        </div>
                        {!notif.read && <span className="notification-unread-dot" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>}

          {/* Account menu */}
          {user && (
            <div className="account-menu-container" ref={accountMenuRef}>
              <button
                className="account-menu-trigger"
                onClick={() => setAccountMenuOpen(o => !o)}
                title={user?.displayName}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="account-avatar-img" />
                ) : (
                  <div className="account-avatar-placeholder">
                    {(user?.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {accountMenuOpen && (
                <div className="account-menu-dropdown">
                  <div className="account-menu-header">
                    <span className="account-menu-name">{user?.displayName}</span>
                    {user?.username && (
                      <span className="account-menu-username">@{user.username}</span>
                    )}
                  </div>
                  <div className="account-menu-divider" />
                  <Link
                    to="/settings"
                    className="account-menu-item"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button className="account-menu-item account-menu-signout" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
