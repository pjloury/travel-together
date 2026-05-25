// Chronological timeline: groups trip log entries by year → month
import TripLogEntry from './TripLogEntry';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Group logs into { year: { month: [log, ...] } }
// Entries without a year go under 'Unknown'
function groupLogs(logs) {
  const groups = {}; // { year -> { month -> [log] } }
  for (const log of logs) {
    const year = log.visitYear ?? 'Unknown';
    const month = log.visitMonth ?? 0; // 0 = no month
    if (!groups[year]) groups[year] = {};
    if (!groups[year][month]) groups[year][month] = [];
    groups[year][month].push(log);
  }
  return groups;
}

// Sorted year keys: numerics descending, 'Unknown' last
function sortedYears(groups) {
  return Object.keys(groups).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });
}

// Sorted month keys within a year: descending (12 → 1), 0 (no month) last
function sortedMonths(monthMap) {
  return Object.keys(monthMap)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return b - a;
    });
}

export default function TripLogTimeline({ logs, onEntryClick }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="trip-log-empty">
        <span className="trip-log-empty-icon">🗺️</span>
        <p>No trips yet. Add your first trip log entry!</p>
      </div>
    );
  }

  const groups = groupLogs(logs);
  const years = sortedYears(groups);

  return (
    <div className="trip-log-timeline">
      {years.map(year => {
        const monthMap = groups[year];
        const months = sortedMonths(monthMap);
        return (
          <div key={year} className="trip-log-year-group">
            <h2 className="trip-log-year-label">{year}</h2>
            <div className="trip-log-year-body">
              {months.map(month => {
                const entries = monthMap[month];
                return (
                  <div key={month} className="trip-log-month-group">
                    {month !== 0 && (
                      <div className="trip-log-month-header">
                        <span className="trip-log-month-label">{MONTH_NAMES[month]}</span>
                        <div className="trip-log-month-line" />
                      </div>
                    )}
                    <div className="trip-log-entries">
                      {entries.map(log => (
                        <TripLogEntry key={log.id} log={log} onClick={onEntryClick} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
