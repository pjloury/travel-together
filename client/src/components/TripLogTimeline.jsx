// Chronological timeline: year sections → month rows → horizontal trip cards
import TripLogEntry from './TripLogEntry';

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupLogs(logs) {
  const groups = {};
  for (const log of logs) {
    const year = log.visitYear ?? 'Unknown';
    const month = log.visitMonth ?? 0;
    if (!groups[year]) groups[year] = {};
    if (!groups[year][month]) groups[year][month] = [];
    groups[year][month].push(log);
  }
  return groups;
}

function sortedYears(groups) {
  return Object.keys(groups).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });
}

function sortedMonths(monthMap) {
  return Object.keys(monthMap).map(Number).sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return b - a;
  });
}

export default function TripLogTimeline({ logs, onEntryClick, onAddToYear, onDateEdit, yearSectionRefs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="trip-log-empty">
        <span className="trip-log-empty-icon">🗺️</span>
        <p>No trips yet. Log your first one!</p>
      </div>
    );
  }

  const groups = groupLogs(logs);
  const years = sortedYears(groups);

  return (
    <div className="tl-timeline">
      {years.map(year => {
        const monthMap = groups[year];
        const months = sortedMonths(monthMap);
        const allLogs = months.flatMap(month => monthMap[month]);
        const totalTrips = allLogs.length;
        const numericYear = year === 'Unknown' ? null : parseInt(year);

        return (
          <div
            key={year}
            className="tl-year-section"
            data-year={year}
            ref={el => { if (yearSectionRefs) yearSectionRefs.current[year] = el; }}
          >
            <div className="tl-year-heading">
              <h2 className="tl-year-number">{year}</h2>
              <span className="tl-year-count">{totalTrips} {totalTrips === 1 ? 'trip' : 'trips'}</span>
              <button
                type="button"
                className="tl-year-add-btn"
                onClick={() => onAddToYear(numericYear, null)}
              >
                + Trip
              </button>
            </div>

            <div className="tl-cards-row">
              {allLogs.map(log => (
                <TripLogEntry
                  key={log.id}
                  log={log}
                  onClick={() => onEntryClick(log)}
                  onDateEdit={onDateEdit}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { groupLogs, sortedYears, sortedMonths };
