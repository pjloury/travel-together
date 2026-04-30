// Country name → ISO 3166-1 alpha-2 code. Mirrors the client's
// COUNTRY_CODES map in client/src/utils/countryFlag.js. Kept as its
// own server-side module so backfill scripts and route handlers can
// derive the country_code that country_wishlist requires (CHAR(2)
// NOT NULL, UNIQUE(user_id, country_code)).
//
// Aliases below ("USA", "UK", etc.) match how the client and Claude
// normalization sometimes return country names. Lookup is
// case-insensitive via lookupCountryCode.

const COUNTRY_CODES = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR','Armenia':'AM',
  'Australia':'AU','Austria':'AT','Azerbaijan':'AZ','Bahamas':'BS','Bahrain':'BH',
  'Bangladesh':'BD','Belarus':'BY','Belgium':'BE','Bolivia':'BO','Bosnia and Herzegovina':'BA',
  'Brazil':'BR','Bulgaria':'BG','Cambodia':'KH','Canada':'CA','Chile':'CL','China':'CN',
  'Colombia':'CO','Costa Rica':'CR','Croatia':'HR','Cuba':'CU','Cyprus':'CY',
  'Czech Republic':'CZ','Czechia':'CZ','Denmark':'DK','Ecuador':'EC','Egypt':'EG',
  'El Salvador':'SV','Estonia':'EE','Ethiopia':'ET','Finland':'FI','France':'FR',
  'Georgia':'GE','Germany':'DE','Ghana':'GH','Greece':'GR','Guatemala':'GT',
  'Honduras':'HN','Hungary':'HU','Iceland':'IS','India':'IN','Indonesia':'ID',
  'Iran':'IR','Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT','Jamaica':'JM',
  'Japan':'JP','Jordan':'JO','Kazakhstan':'KZ','Kenya':'KE','Kosovo':'XK',
  'Kuwait':'KW','Latvia':'LV','Lebanon':'LB','Lithuania':'LT','Luxembourg':'LU',
  'Malaysia':'MY','Malta':'MT','Mexico':'MX','Moldova':'MD','Mongolia':'MN',
  'Montenegro':'ME','Morocco':'MA','Mozambique':'MZ','Myanmar':'MM','Nepal':'NP',
  'Netherlands':'NL','New Zealand':'NZ','Nicaragua':'NI','Nigeria':'NG','Norway':'NO',
  'Oman':'OM','Pakistan':'PK','Panama':'PA','Paraguay':'PY','Peru':'PE',
  'Philippines':'PH','Poland':'PL','Portugal':'PT','Qatar':'QA','Romania':'RO',
  'Russia':'RU','Rwanda':'RW','Saudi Arabia':'SA','Senegal':'SN','Serbia':'RS',
  'Singapore':'SG','Slovakia':'SK','Slovenia':'SI','South Africa':'ZA','South Korea':'KR',
  'Spain':'ES','Sri Lanka':'LK','Sweden':'SE','Switzerland':'CH','Syria':'SY',
  'Taiwan':'TW','Tanzania':'TZ','Thailand':'TH','Tunisia':'TN','Turkey':'TR',
  'Türkiye':'TR','Uganda':'UG','Ukraine':'UA','United Arab Emirates':'AE',
  'United Kingdom':'GB','UK':'GB','United States':'US','USA':'US','United States of America':'US',
  'Uruguay':'UY','Uzbekistan':'UZ','Venezuela':'VE','Vietnam':'VN','Yemen':'YE',
  'Zambia':'ZM','Zimbabwe':'ZW','Maldives':'MV','Laos':'LA','Palestine':'PS',
  'Hong Kong':'HK','Bhutan':'BT','Antarctica':'AQ','French Polynesia':'PF',
};

// Pre-build a lowercased lookup so callers don't need to know the
// canonical casing returned by Claude or stored on a pin.
const LC = {};
for (const [name, code] of Object.entries(COUNTRY_CODES)) LC[name.toLowerCase()] = code;

function lookupCountryCode(countryName) {
  if (!countryName) return null;
  return LC[String(countryName).trim().toLowerCase()] || null;
}

module.exports = { COUNTRY_CODES, lookupCountryCode };
