// Compact photo card for the trip timeline month rows
const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#fd7943,#e7432d)',
  'linear-gradient(135deg,#0ba360,#3cba92)',
];

function pickGradient(placeName) {
  const idx = (placeName || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

export default function TripLogEntry({ log, onClick, onDateEdit }) {
  const photo = log.unsplashImageUrl || log.photoUrl;
  const tag = log.tags?.[0];
  const emoji = tag?.emoji || '📍';
  const noMonth = !log.visitMonth;

  return (
    <div className="tl-trip-card-wrap">
      <button
        className="tl-trip-card"
        onClick={onClick}
        type="button"
        style={photo
          ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: pickGradient(log.placeName) }
        }
      >
        {!photo && <span className="tl-trip-card-emoji">{emoji}</span>}
        <div className="tl-trip-card-overlay">
          <span className="tl-trip-card-place">{log.placeName}</span>
          {log.rating > 0 && (
            <span className="tl-trip-card-rating">{'♥'.repeat(log.rating)}</span>
          )}
        </div>
      </button>

      {/* Date edit badge — always visible for no-month cards, hover-only otherwise */}
      <button
        type="button"
        className={`tl-trip-card-date-btn${noMonth ? ' tl-trip-card-date-btn-missing' : ''}`}
        onClick={e => { e.stopPropagation(); onDateEdit(log); }}
        title={noMonth ? 'Add date' : 'Edit date'}
        aria-label={noMonth ? 'Add trip date' : 'Edit trip date'}
      >
        {noMonth ? '+ date' : '✎'}
      </button>
    </div>
  );
}
