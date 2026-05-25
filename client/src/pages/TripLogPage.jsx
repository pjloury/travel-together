// Trip Log — chronological timeline of casual/frequent trips
import { useState, useEffect, useCallback } from 'react';
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

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.get('/trip-logs');
      setLogs(result.data || []);
    } catch (err) {
      console.error('Failed to load trip logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleSaved(newLog) {
    setCreatorOpen(false);
    setLogs(prev => [newLog, ...prev]);
  }

  function handleEntryClick(log) {
    setSelectedLog(log);
  }

  function handleDetailClose() {
    setSelectedLog(null);
  }

  function handleDetailUpdate(updatedPin) {
    setLogs(prev => prev.map(l => l.id === updatedPin.id ? { ...l, ...updatedPin } : l));
    setSelectedLog(prev => prev ? { ...prev, ...updatedPin } : null);
  }

  function handleDetailDelete(pinId) {
    setLogs(prev => prev.filter(l => l.id !== pinId));
    setSelectedLog(null);
  }

  return (
    <Layout>
      <div className="trip-log-page">
        <div className="trip-log-page-header">
          <div>
            <h1 className="trip-log-page-title">Trip Log</h1>
            <p className="trip-log-page-subtitle">
              Everyday adventures, weekend trips, and frequent favorites
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

        {loading ? (
          <div className="trip-log-loading">Loading your trip log…</div>
        ) : (
          <TripLogTimeline logs={logs} onEntryClick={handleEntryClick} />
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
            onClose={handleDetailClose}
            onUpdate={handleDetailUpdate}
            onDelete={handleDetailDelete}
          />
        )}
      </div>
    </Layout>
  );
}
