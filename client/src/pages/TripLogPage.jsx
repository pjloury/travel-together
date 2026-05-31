// Trip Log — chronological timeline of all trips (memories + trip-log entries)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import TripLogTimeline from '../components/TripLogTimeline';
import TripLogCreator from '../components/TripLogCreator';
import MemoryDetail from '../components/MemoryDetail';
import api from '../api/client';
import './TripLogPage.css';

export default function TripLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [activeYear, setActiveYear] = useState(null);

  const yearNavRef = useRef(null);
  const yearSectionRefs = useRef({});

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.get('/trip-logs');
      const data = result.data?.data || result.data || [];
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load trip logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const years = useMemo(
    () => [...new Set(logs.map(l => l.visitYear).filter(Boolean))].sort((a, b) => b - a),
    [logs]
  );

  // Initialize active year to most recent
  useEffect(() => {
    if (years.length > 0 && activeYear === null) setActiveYear(years[0]);
  }, [years, activeYear]);

  // Update active year pill as the user scrolls
  useEffect(() => {
    if (!years.length) return;
    function onScroll() {
      const offsetPx = 80;
      let current = years[0];
      for (const year of [...years].reverse()) {
        const el = yearSectionRefs.current[year];
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= offsetPx) { current = year; break; }
        }
      }
      setActiveYear(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [years]);

  function scrollToYear(year) {
    const el = yearSectionRefs.current[year];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveYear(year);
    // Keep the active tab visible in the nav strip
    const tabEl = yearNavRef.current?.querySelector(`[data-year="${year}"]`);
    tabEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function handleSaved(newLog) {
    setCreatorOpen(false);
    setLogs(prev => [newLog, ...prev]);
  }

  const totalTrips = logs.length;

  return (
    <Layout>
      <div className="trip-log-page">
        <div className="trip-log-page-header">
          <div>
            <h1 className="trip-log-page-title">Trip Timeline</h1>
            <p className="trip-log-page-subtitle">
              {totalTrips > 0
                ? `${totalTrips} trips across ${years.length} year${years.length !== 1 ? 's' : ''}`
                : 'Your travel history'}
            </p>
          </div>
          <button
            className="trip-log-add-btn"
            onClick={() => setCreatorOpen(true)}
            type="button"
          >
            + Log a Trip
          </button>
        </div>

        {years.length > 1 && (
          <div className="tl-year-nav" ref={yearNavRef}>
            {years.map(year => (
              <button
                key={year}
                data-year={year}
                type="button"
                className={`tl-year-tab${activeYear === year ? ' tl-year-tab-active' : ''}`}
                onClick={() => scrollToYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="trip-log-loading">Loading your trip timeline…</div>
        ) : (
          <TripLogTimeline
            logs={logs}
            onEntryClick={setSelectedLog}
            yearSectionRefs={yearSectionRefs}
          />
        )}

        <TripLogCreator
          isOpen={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          onSaved={handleSaved}
        />

        {selectedLog && (
          <MemoryDetail
            pin={selectedLog}
            isOwner={true}
            onClose={() => setSelectedLog(null)}
            onUpdate={updatedPin => {
              setLogs(prev => prev.map(l => l.id === updatedPin.id ? { ...l, ...updatedPin } : l));
              setSelectedLog(prev => prev ? { ...prev, ...updatedPin } : null);
            }}
            onDelete={pinId => {
              setLogs(prev => prev.filter(l => l.id !== pinId));
              setSelectedLog(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
