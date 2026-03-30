// TabSwitcher component - PAST/FUTURE tab toggle.
//
// Spec: docs/app/spec.md Section 4 (Tab Switcher Implementation)
// @implements REQ-NAV-001, REQ-NAV-003, REQ-NAV-004

import { useRef, useCallback } from 'react';
import api from '../api/client';

/**
 * TabSwitcher renders PAST | FUTURE tabs with instant client-side switching.
 *
 * @implements REQ-NAV-001 (PAST/FUTURE tab switcher)
 * @implements REQ-NAV-003 (instant SPA switch, no reload)
 * @implements REQ-NAV-004 (tab memory stored server-side; debounced 1s persist)
 *
 * @param {Object} props
 * @param {'memory'|'dream'} props.activeTab - Currently active tab
 * @param {function} props.onTabChange - Callback when tab changes, receives 'memory' or 'dream'
 */
export default function TabSwitcher({ activeTab, onTabChange, isOwnBoard }) {
  const debounceRef = useRef(null);

  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;

    // Instant local switch per REQ-NAV-003
    onTabChange(tab);

    // Debounced 1s server persist per REQ-NAV-004
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (isOwnBoard) {
      debounceRef.current = setTimeout(() => {
        api.put('/users/preferences', { lastTab: tab }).catch(() => {
          // Fire-and-forget: don't block UI on server response
        });
      }, 1000);
    }
  }, [activeTab, onTabChange, isOwnBoard]);

  return (
    <div className="tab-switcher">
      <button
        className={`tab-btn tab-past ${activeTab === 'memory' ? 'tab-active' : ''}`}
        onClick={() => handleTabChange('memory')}
        aria-pressed={activeTab === 'memory'}
      >
        PAST
      </button>
      <button
        className={`tab-btn tab-future ${activeTab === 'dream' ? 'tab-active' : ''}`}
        onClick={() => handleTabChange('dream')}
        aria-pressed={activeTab === 'dream'}
      >
        FUTURE
      </button>
    </div>
  );
}
