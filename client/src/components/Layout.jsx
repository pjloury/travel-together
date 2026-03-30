// Layout component - simplified navigation per spec.md Section 4.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-001, REQ-NAV-005, REQ-NAV-007, REQ-NOTIF-001, SCN-NOTIF-001-01

import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
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
    <div className="layout">
      <header className="main-header">
        <NavLink to="/" className="logo">Travel Together</NavLink>
        <nav className="nav-links">
          <NavLink to="/" end className="nav-icon-link" title="Home">
            <span className="nav-icon">&#8962;</span>
            <span className="nav-label">Home</span>
          </NavLink>
          <NavLink to="/search" className="nav-icon-link" title="Search">
            <span className="nav-icon">&#128269;</span>
            <span className="nav-label">Search</span>
          </NavLink>
          <NavLink to="/friends" className="nav-icon-link" title="Friends">
            <span className="nav-icon">&#128101;</span>
            <span className="nav-label">Friends</span>
          </NavLink>
          <NavLink to="/settings" className="nav-icon-link" title="Settings">
            <span className="nav-icon">&#9881;</span>
            <span className="nav-label">Settings</span>
          </NavLink>
        </nav>
        <div className="user-menu">
          <div className="notification-bell-container" ref={notifPanelRef}>
            <button
              className="notification-bell"
              onClick={handleBellClick}
              title="Notifications"
            >
              <span className="bell-icon">&#128276;</span>
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {/* Notification dropdown panel */}
            {/* @implements REQ-NOTIF-001, SCN-NOTIF-001-01 */}
            {notifPanelOpen && (
              <div className="notification-panel">
                <div className="notification-panel-header">
                  <h3>Notifications</h3>
                </div>
                <div className="notification-panel-list">
                  {notifLoading && (
                    <div className="notification-panel-loading">Loading...</div>
                  )}
                  {!notifLoading && notifications.length === 0 && (
                    <div className="notification-panel-empty">
                      {'\u2728'} No activity yet
                    </div>
                  )}
                  {!notifLoading && notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`notification-item${!notif.read ? ' notification-item-unread' : ''}`}
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
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="user-display-name">{user?.displayName}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
