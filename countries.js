// Country list (grouped by continent) and the rule that decides who gets the pill.
// Shared by the page script (content.js) and the settings popup (popup.js).
const ALIEN_COUNTRIES = {
  NA: ['United States', 'Canada', 'Mexico', 'Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Costa Rica',
    'Cuba', 'Dominica', 'Dominican Republic', 'El Salvador', 'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica',
    'Nicaragua', 'Panama', 'Puerto Rico', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Trinidad and Tobago'],
  SA: ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname',
    'Uruguay', 'Venezuela'],
  EU: ['Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia',
    'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland',
    'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco',
    'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino',
    'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican City'],
  AF: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon',
    'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Democratic Republic of the Congo', "Côte d'Ivoire",
    'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea',
    'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius',
    'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles',
    'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda',
    'Zambia', 'Zimbabwe'],
  AS: ['Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China',
    'Georgia', 'Hong Kong', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait',
    'Kyrgyzstan', 'Laos', 'Lebanon', 'Macao', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea',
    'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka',
    'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Türkiye', 'Turkmenistan', 'United Arab Emirates',
    'Uzbekistan', 'Vietnam', 'Yemen'],
  OC: ['Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'New Zealand', 'Palau',
    'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu'],
};

// Different spellings X (or anyone) might use for the same place.
const ALIEN_ALIASES = {
  'united states of america': 'united states', 'usa': 'united states', 'us': 'united states',
  'uk': 'united kingdom', 'great britain': 'united kingdom',
  'turkey': 'turkiye', 'czech republic': 'czechia', 'ivory coast': "cote d'ivoire",
  'russian federation': 'russia', 'korea': 'south korea', 'republic of korea': 'south korea',
  'viet nam': 'vietnam', 'uae': 'united arab emirates', 'burma': 'myanmar', 'swaziland': 'eswatini',
  'cape verde': 'cabo verde', 'macau': 'macao', 'east timor': 'timor-leste',
  'dr congo': 'democratic republic of the congo', 'drc': 'democratic republic of the congo',
  'congo - kinshasa': 'democratic republic of the congo', 'congo - brazzaville': 'congo',
  'republic of the congo': 'congo', 'myanmar (burma)': 'myanmar',
  'hong kong sar china': 'hong kong', 'macao sar china': 'macao',
  'palestinian territories': 'palestine', 'state of palestine': 'palestine',
  'saint vincent and grenadines': 'saint vincent and the grenadines',
  'gambia, the': 'gambia', 'bahamas, the': 'bahamas', 'holy see': 'vatican city',
  'federated states of micronesia': 'micronesia',
};

const alienNorm = (s) => {
  let n = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase().trim().replace(/^the\s+/, '')
    .replace(/\s*&\s*/g, ' and ').replace(/^st\.? /, 'saint ').replace(/\s+/g, ' ');
  return ALIEN_ALIASES[n] || n;
};

const ALIEN_CONTINENT_OF = (() => {
  const map = {};
  for (const code of Object.keys(ALIEN_COUNTRIES)) {
    for (const name of ALIEN_COUNTRIES[code]) map[alienNorm(name)] = code;
  }
  return map;
})();

const ALIEN_ALL_COUNTRIES = Object.values(ALIEN_COUNTRIES).flat().sort((a, b) => a.localeCompare(b));

// X sometimes shows a broad region ("South Asia", "Europe") instead of a country.
const alienRegionContinents = (value) => {
  const n = alienNorm(value);
  const hits = [];
  if (/north america/.test(n)) hits.push('NA');
  if (/south america|latin america/.test(n)) hits.push('SA', 'NA');
  if (/europe/.test(n)) hits.push('EU');
  if (/africa/.test(n) && !ALIEN_CONTINENT_OF[n]) hits.push('AF');
  if (/asia|middle east/.test(n)) hits.push('AS');
  if (/oceania|australasia|pacific/.test(n)) hits.push('OC');
  return hits;
};

// Places that count as the same home (a country plus its territories).
const ALIEN_SAME_HOME = [
  ['United States', 'Puerto Rico', 'Guam', 'U.S. Virgin Islands', 'US Virgin Islands',
    'United States Virgin Islands', 'American Samoa', 'Northern Mariana Islands'].map(alienNorm),
];

// The whole rule: an account is "alien" when it is based outside the home country.
// Returns { alien: true/false, region: true/false }.
const alienClassify = (basedIn, homeCountry) => {
  if (!basedIn) return { alien: false, region: false };
  const value = alienNorm(basedIn);
  const home = alienNorm(homeCountry);
  if (value === home) return { alien: false, region: false };
  // A country and its territories count as the same home.
  for (const group of ALIEN_SAME_HOME) {
    if (group.includes(value) && group.includes(home)) return { alien: false, region: false };
  }
  if (ALIEN_CONTINENT_OF[value]) return { alien: true, region: false };
  const regions = alienRegionContinents(basedIn);
  if (regions.length) {
    // A region that contains the home country can't be told apart from home, so no pill.
    return { alien: !regions.includes(ALIEN_CONTINENT_OF[home]), region: true };
  }
  return { alien: true, region: false };
};

// ---------- home country from the computer's time zone ----------
const ALIEN_CANON = (() => {
  const map = {};
  for (const name of ALIEN_ALL_COUNTRIES) map[alienNorm(name)] = name;
  return map;
})();

// Works out which country a time zone (e.g. "America/New_York") belongs to,
// using the browser's built-in region data. Returns a name from the list above, or null.
// Some time zones were renamed over the years and browsers differ on which name they report.
const ALIEN_TZ_RENAMES = [
  ['Asia/Kolkata', 'Asia/Calcutta'], ['Europe/Kyiv', 'Europe/Kiev'], ['Asia/Ho_Chi_Minh', 'Asia/Saigon'],
  ['Asia/Kathmandu', 'Asia/Katmandu'], ['Asia/Yangon', 'Asia/Rangoon'], ['Asia/Dhaka', 'Asia/Dacca'],
  ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'], ['Africa/Asmara', 'Africa/Asmera'],
  ['Atlantic/Faroe', 'Atlantic/Faeroe'], ['America/Nuuk', 'America/Godthab'],
  ['Pacific/Kanton', 'Pacific/Enderbury'], ['Asia/Thimphu', 'Asia/Thimbu'],
  ['Asia/Ulaanbaatar', 'Asia/Ulan_Bator'], ['Asia/Macau', 'Asia/Macao'],
  ['America/Indiana/Indianapolis', 'America/Indianapolis'], ['America/Kentucky/Louisville', 'America/Louisville'],
];

const alienCountryForTimeZone = (tz) => {
  if (!tz) return null;
  const wanted = [tz];
  for (const pair of ALIEN_TZ_RENAMES) {
    if (pair.includes(tz)) wanted.push(pair[0], pair[1]);
  }
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of A) {
      for (const b of A) {
        let zones;
        try {
          const loc = new Intl.Locale('und-' + a + b);
          zones = typeof loc.getTimeZones === 'function' ? loc.getTimeZones() : loc.timeZones;
        } catch (e) { continue; }
        if (!zones || !wanted.some((z) => zones.includes(z))) continue;
        const match = ALIEN_CANON[alienNorm(names.of(a + b))];
        if (match) return match;
      }
    }
  } catch (e) {}
  return null;
};

const alienDetectHome = () => {
  try {
    return alienCountryForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch (e) {
    return null;
  }
};
