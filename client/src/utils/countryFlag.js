// Shared country name → flag emoji utility
// Used by PinCard (card corner) and PinMap (marker icons)

export const COUNTRY_CODES = {
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
  'Zimbabwe':'ZW','Maldives':'MV','Laos':'LA','Palestine':'PS',
  // Filling gaps that surfaced as un-flagged dream pins on prod —
  // any normalized_country we ship from server normalization needs a
  // matching ISO code here or PinCard / CountriesModal silently drop
  // the flag.
  'Bhutan':'BT','Hong Kong':'HK','Antarctica':'AQ','French Polynesia':'PF',
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

/**
 * Try to extract a country flag from a free-form place name.
 * Handles:
 *   - Direct country names ("Jordan")
 *   - "City, Country" format ("Petra, Jordan")
 *   - "City, Region, Country" ("Amman, Capital, Jordan")
 * Returns { flag, country } or null.
 */
// Major-city → country fallback. Used when a pin's placeName is just
// the city ("Barcelona") with no normalized_country populated yet —
// without this we'd fail to flag the card. Keep this list focused on
// well-known cities where city→country is unambiguous (no Springfield).
const CITY_TO_COUNTRY = {
  // Europe
  'Barcelona':'Spain','Madrid':'Spain','Seville':'Spain','Sevilla':'Spain',
  'Granada':'Spain','Valencia':'Spain','Bilbao':'Spain','Mallorca':'Spain',
  'Palma':'Spain','Ibiza':'Spain','San Sebastian':'Spain','Sitges':'Spain',
  'Toledo':'Spain','Cordoba':'Spain','Salamanca':'Spain','Marbella':'Spain',
  'Paris':'France','Lyon':'France','Marseille':'France','Nice':'France',
  'Bordeaux':'France','Cannes':'France','Strasbourg':'France','Toulouse':'France',
  'Avignon':'France','Aix-en-Provence':'France','Saint-Tropez':'France',
  'Antibes':'France','Chamonix':'France','Courchevel':'France',
  'Mont Blanc':'France','Mont Saint-Michel':'France','Mont-Saint-Michel':'France',
  'Provence':'France','Normandy':'France','Brittany':'France','Loire Valley':'France',
  'Rome':'Italy','Milan':'Italy','Florence':'Italy','Venice':'Italy',
  'Naples':'Italy','Bologna':'Italy','Verona':'Italy','Turin':'Italy',
  'Pisa':'Italy','Siena':'Italy','Palermo':'Italy','Catania':'Italy',
  'Sorrento':'Italy','Positano':'Italy','Amalfi':'Italy','Capri':'Italy',
  'Cinque Terre':'Italy','Lake Como':'Italy','Como':'Italy','Ravello':'Italy',
  'Genoa':'Italy','Portofino':'Italy','Lecce':'Italy','Bari':'Italy',
  'London':'United Kingdom','Edinburgh':'United Kingdom','Manchester':'United Kingdom',
  'Glasgow':'United Kingdom','Liverpool':'United Kingdom','Oxford':'United Kingdom',
  'Cambridge':'United Kingdom','Bath':'United Kingdom','York':'United Kingdom',
  'Belfast':'United Kingdom','Cardiff':'United Kingdom',
  'Berlin':'Germany','Munich':'Germany','Hamburg':'Germany','Frankfurt':'Germany',
  'Cologne':'Germany','Dresden':'Germany','Heidelberg':'Germany',
  'Vienna':'Austria','Salzburg':'Austria','Innsbruck':'Austria','Hallstatt':'Austria',
  'Amsterdam':'Netherlands','Rotterdam':'Netherlands','The Hague':'Netherlands','Utrecht':'Netherlands',
  'Brussels':'Belgium','Bruges':'Belgium','Ghent':'Belgium','Antwerp':'Belgium',
  'Zurich':'Switzerland','Geneva':'Switzerland','Lucerne':'Switzerland',
  'Bern':'Switzerland','Zermatt':'Switzerland','St. Moritz':'Switzerland','Interlaken':'Switzerland',
  'Lisbon':'Portugal','Porto':'Portugal','Sintra':'Portugal','Madeira':'Portugal','Algarve':'Portugal',
  'Athens':'Greece','Mykonos':'Greece','Santorini':'Greece','Crete':'Greece',
  'Rhodes':'Greece','Corfu':'Greece','Thessaloniki':'Greece',
  'Reykjavik':'Iceland','Stockholm':'Sweden','Copenhagen':'Denmark','Oslo':'Norway',
  'Helsinki':'Finland','Bergen':'Norway','Tromso':'Norway',
  'Budapest':'Hungary','Prague':'Czech Republic','Warsaw':'Poland','Krakow':'Poland',
  'Gdansk':'Poland','Bratislava':'Slovakia','Ljubljana':'Slovenia',
  'Dubrovnik':'Croatia','Split':'Croatia','Zagreb':'Croatia','Hvar':'Croatia',
  'Istanbul':'Turkey','Cappadocia':'Turkey','Ankara':'Turkey','Bodrum':'Turkey',
  'Antalya':'Turkey','Izmir':'Turkey',
  'Dublin':'Ireland','Galway':'Ireland','Cork':'Ireland',
  'Tbilisi':'Georgia','Yerevan':'Armenia','Baku':'Azerbaijan',
  'Sofia':'Bulgaria','Bucharest':'Romania','Belgrade':'Serbia','Tirana':'Albania',
  // Africa + Middle East
  'Marrakech':'Morocco','Marrakesh':'Morocco','Casablanca':'Morocco','Fez':'Morocco',
  'Fes':'Morocco','Essaouira':'Morocco','Chefchaouen':'Morocco','Tangier':'Morocco',
  'Cairo':'Egypt','Luxor':'Egypt','Aswan':'Egypt','Sharm El Sheikh':'Egypt',
  'Cape Town':'South Africa','Johannesburg':'South Africa','Stellenbosch':'South Africa',
  'Nairobi':'Kenya','Maasai Mara':'Kenya','Mombasa':'Kenya',
  'Serengeti':'Tanzania','Zanzibar':'Tanzania','Arusha':'Tanzania',
  'Kigali':'Rwanda','Addis Ababa':'Ethiopia','Lagos':'Nigeria',
  'Dakar':'Senegal','Accra':'Ghana','Tunis':'Tunisia',
  'Dubai':'United Arab Emirates','Abu Dhabi':'United Arab Emirates',
  'Doha':'Qatar','Muscat':'Oman','Manama':'Bahrain','Riyadh':'Saudi Arabia',
  'Jeddah':'Saudi Arabia','Petra':'Jordan','Amman':'Jordan','Aqaba':'Jordan',
  'Beirut':'Lebanon','Tel Aviv':'Israel','Jerusalem':'Israel',
  // Asia + Pacific
  'Tokyo':'Japan','Kyoto':'Japan','Osaka':'Japan','Hokkaido':'Japan','Nara':'Japan',
  'Hiroshima':'Japan','Sapporo':'Japan','Fukuoka':'Japan','Okinawa':'Japan',
  'Beijing':'China','Shanghai':'China','Hong Kong':'Hong Kong','Macau':'China',
  'Xian':'China','Chengdu':'China','Guilin':'China','Shenzhen':'China',
  'Seoul':'South Korea','Busan':'South Korea','Jeju':'South Korea',
  'Bangkok':'Thailand','Phuket':'Thailand','Chiang Mai':'Thailand','Krabi':'Thailand',
  'Koh Samui':'Thailand','Ayutthaya':'Thailand','Pai':'Thailand',
  'Hanoi':'Vietnam','Ho Chi Minh City':'Vietnam','Saigon':'Vietnam','Hoi An':'Vietnam',
  'Hue':'Vietnam','Da Nang':'Vietnam','Halong Bay':'Vietnam','Sapa':'Vietnam',
  'Bali':'Indonesia','Jakarta':'Indonesia','Ubud':'Indonesia','Yogyakarta':'Indonesia',
  'Lombok':'Indonesia','Komodo':'Indonesia','Sumba':'Indonesia',
  'Singapore':'Singapore','Kuala Lumpur':'Malaysia','Penang':'Malaysia','Langkawi':'Malaysia',
  'Manila':'Philippines','Cebu':'Philippines','Palawan':'Philippines','Boracay':'Philippines',
  'Phnom Penh':'Cambodia','Siem Reap':'Cambodia','Angkor':'Cambodia',
  'Vientiane':'Laos','Luang Prabang':'Laos','Yangon':'Myanmar','Bagan':'Myanmar',
  'Mumbai':'India','Delhi':'India','Jaipur':'India','Goa':'India','Agra':'India',
  'Bangalore':'India','Kerala':'India','Udaipur':'India','Jodhpur':'India',
  'Varanasi':'India','Rishikesh':'India','Kolkata':'India',
  'Kathmandu':'Nepal','Pokhara':'Nepal','Thimphu':'Bhutan','Paro':'Bhutan',
  'Colombo':'Sri Lanka','Kandy':'Sri Lanka','Galle':'Sri Lanka',
  'Male':'Maldives','Maldives':'Maldives','Taipei':'Taiwan',
  'Sydney':'Australia','Melbourne':'Australia','Brisbane':'Australia','Perth':'Australia',
  'Cairns':'Australia','Adelaide':'Australia','Tasmania':'Australia','Uluru':'Australia',
  'Auckland':'New Zealand','Queenstown':'New Zealand','Wellington':'New Zealand',
  'Rotorua':'New Zealand','Christchurch':'New Zealand',
  'Bora Bora':'French Polynesia','Tahiti':'French Polynesia','Moorea':'French Polynesia',
  'Fiji':'Fiji','Suva':'Fiji',
  // Americas
  'New York':'United States','NYC':'United States','Los Angeles':'United States',
  'San Francisco':'United States','Chicago':'United States','Boston':'United States',
  'Miami':'United States','Seattle':'United States','Portland':'United States',
  'Austin':'United States','Nashville':'United States','New Orleans':'United States',
  'Las Vegas':'United States','Honolulu':'United States','Maui':'United States',
  'Hawaii':'United States','Big Sur':'United States','Aspen':'United States',
  'Jackson':'United States','Yellowstone':'United States','Yosemite':'United States',
  'Grand Canyon':'United States','Sedona':'United States','Napa':'United States',
  'Santa Fe':'United States','Charleston':'United States','Savannah':'United States',
  'Toronto':'Canada','Vancouver':'Canada','Montreal':'Canada','Quebec':'Canada',
  'Quebec City':'Canada','Banff':'Canada','Whistler':'Canada','Calgary':'Canada',
  'Tofino':'Canada','Ottawa':'Canada',
  'Mexico City':'Mexico','Cancun':'Mexico','Tulum':'Mexico','Cabo':'Mexico',
  'Cabo San Lucas':'Mexico','Oaxaca':'Mexico','Playa del Carmen':'Mexico',
  'Puerto Vallarta':'Mexico','Mérida':'Mexico','San Miguel de Allende':'Mexico',
  'Guadalajara':'Mexico',
  'Havana':'Cuba','San Juan':'Puerto Rico','Punta Cana':'Dominican Republic',
  'Santo Domingo':'Dominican Republic','Nassau':'Bahamas','Montego Bay':'Jamaica',
  'Kingston':'Jamaica',
  'Buenos Aires':'Argentina','Patagonia':'Argentina','Mendoza':'Argentina',
  'Bariloche':'Argentina','Iguazu':'Argentina','Iguaçu':'Brazil',
  'Rio de Janeiro':'Brazil','Sao Paulo':'Brazil','Salvador':'Brazil',
  'Florianopolis':'Brazil','Manaus':'Brazil',
  'Lima':'Peru','Cusco':'Peru','Machu Picchu':'Peru','Arequipa':'Peru',
  'Santiago':'Chile','Valparaiso':'Chile','Atacama':'Chile','Torres del Paine':'Chile',
  'Bogota':'Colombia','Cartagena':'Colombia','Medellin':'Colombia',
  'Quito':'Ecuador','Galapagos':'Ecuador','La Paz':'Bolivia','Uyuni':'Bolivia',
  'Caracas':'Venezuela','Montevideo':'Uruguay','Asuncion':'Paraguay',
  'Panama City':'Panama','San Jose':'Costa Rica','Antigua':'Guatemala',
};

export function countryFlagFromPlace(placeName) {
  if (!placeName) return null;
  // Try the full string first
  const direct = countryFlag(placeName.trim());
  if (direct) return { flag: direct, country: placeName.trim() };
  // Try each comma-separated part from right to left
  const parts = placeName.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const f = countryFlag(parts[i]);
    if (f) return { flag: f, country: parts[i] };
  }
  // Last fallback: well-known city → country map (handles bare city
  // names like "Barcelona" or "Tokyo" with no country in the string).
  for (let i = parts.length - 1; i >= 0; i--) {
    const country = CITY_TO_COUNTRY[parts[i]];
    if (country) {
      const f = countryFlag(country);
      if (f) return { flag: f, country };
    }
  }
  return null;
}
