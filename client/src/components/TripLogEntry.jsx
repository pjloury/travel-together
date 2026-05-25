// Single entry card in the trip log timeline
export default function TripLogEntry({ log, onClick }) {
  const photo = log.unsplashImageUrl || log.photoUrl;
  const tag = log.tags?.[0];
  const extraTagCount = (log.tags?.length || 0) - 1;

  return (
    <button className="trip-log-entry" onClick={() => onClick(log)} type="button">
      {photo ? (
        <div className="trip-log-entry-photo" style={{ backgroundImage: `url(${photo})` }} />
      ) : (
        <div className="trip-log-entry-emoji">{tag?.emoji || '📍'}</div>
      )}
      <div className="trip-log-entry-body">
        <span className="trip-log-entry-place">{log.placeName}</span>
        {log.normalizedCountry && (
          <span className="trip-log-entry-country">{log.normalizedCountry}</span>
        )}
        {tag && (
          <span className="trip-log-entry-tag">
            {tag.emoji} {tag.shortName || tag.name}
            {extraTagCount > 0 && <span className="trip-log-entry-tag-more"> +{extraTagCount}</span>}
          </span>
        )}
        {log.note && <p className="trip-log-entry-note">{log.note}</p>}
      </div>
      {log.rating != null && (
        <span className="trip-log-entry-rating">{'❤️'.repeat(log.rating)}</span>
      )}
    </button>
  );
}
