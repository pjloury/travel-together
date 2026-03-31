// Shared country name → flag emoji utility
// Used by PinCard (card corner) and PinMap (marker icons)

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
  'United Kingdom':'GB','UK':'GB','United States':'US','USA':'US','Uruguay':'UY',
  'Uzbekistan':'UZ','Venezuela':'VE','Vietnam':'VN','Yemen':'YE','Zambia':'ZM',
  'Zimbabwe':'ZW','Maldives':'MV','Laos':'LA','Palestine':'PS','Cambodia':'KH',
  'Myanmar':'MM','Iceland':'IS',
};

/**
 * Convert a country name to its flag emoji (regional indicator symbols).
 * Returns null if the country is not in the lookup table.
 */
export function countryFlag(countryName) {
  if (!countryName) return null;
  const code = COUNTRY_CODES[countryName];
  if (!code) return null;
  return Array.from(code.toUpperCase()).map(
    c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)
  ).join('');
}
