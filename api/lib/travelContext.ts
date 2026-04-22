/**
 * Destination-aware context for itinerary generation.
 *
 * Given a location string ("Bishkek, Kyrgyzstan") and trip dates, produces
 * country / currency / units / holidays / religious-period data that the
 * prompt layer injects into the model's system + user messages. Without
 * this, the model defaults to Italian examples and Euros for every trip.
 */

import Holidays from 'date-holidays';

// ISO-3166 alpha-2 -> { currency (ISO-4217), units } for the ~70 most-traveled
// countries. Lookup falls through to USD + metric if a country isn't listed,
// which is a sane global default.
const COUNTRY_META: Record<string, { currency: string; units: 'metric' | 'imperial' }> = {
  // Europe
  IT: { currency: 'EUR', units: 'metric' },
  FR: { currency: 'EUR', units: 'metric' },
  ES: { currency: 'EUR', units: 'metric' },
  DE: { currency: 'EUR', units: 'metric' },
  PT: { currency: 'EUR', units: 'metric' },
  NL: { currency: 'EUR', units: 'metric' },
  BE: { currency: 'EUR', units: 'metric' },
  AT: { currency: 'EUR', units: 'metric' },
  GR: { currency: 'EUR', units: 'metric' },
  IE: { currency: 'EUR', units: 'metric' },
  FI: { currency: 'EUR', units: 'metric' },
  HR: { currency: 'EUR', units: 'metric' },
  CZ: { currency: 'CZK', units: 'metric' },
  PL: { currency: 'PLN', units: 'metric' },
  HU: { currency: 'HUF', units: 'metric' },
  RO: { currency: 'RON', units: 'metric' },
  BG: { currency: 'BGN', units: 'metric' },
  CH: { currency: 'CHF', units: 'metric' },
  NO: { currency: 'NOK', units: 'metric' },
  SE: { currency: 'SEK', units: 'metric' },
  DK: { currency: 'DKK', units: 'metric' },
  IS: { currency: 'ISK', units: 'metric' },
  GB: { currency: 'GBP', units: 'metric' },
  AL: { currency: 'ALL', units: 'metric' },
  RS: { currency: 'RSD', units: 'metric' },
  TR: { currency: 'TRY', units: 'metric' },
  UA: { currency: 'UAH', units: 'metric' },
  // Americas
  US: { currency: 'USD', units: 'imperial' },
  CA: { currency: 'CAD', units: 'metric' },
  MX: { currency: 'MXN', units: 'metric' },
  BR: { currency: 'BRL', units: 'metric' },
  AR: { currency: 'ARS', units: 'metric' },
  CL: { currency: 'CLP', units: 'metric' },
  PE: { currency: 'PEN', units: 'metric' },
  CO: { currency: 'COP', units: 'metric' },
  CR: { currency: 'CRC', units: 'metric' },
  CU: { currency: 'CUP', units: 'metric' },
  // Asia
  JP: { currency: 'JPY', units: 'metric' },
  CN: { currency: 'CNY', units: 'metric' },
  KR: { currency: 'KRW', units: 'metric' },
  TH: { currency: 'THB', units: 'metric' },
  VN: { currency: 'VND', units: 'metric' },
  ID: { currency: 'IDR', units: 'metric' },
  MY: { currency: 'MYR', units: 'metric' },
  SG: { currency: 'SGD', units: 'metric' },
  PH: { currency: 'PHP', units: 'metric' },
  IN: { currency: 'INR', units: 'metric' },
  NP: { currency: 'NPR', units: 'metric' },
  LK: { currency: 'LKR', units: 'metric' },
  KG: { currency: 'KGS', units: 'metric' },
  KZ: { currency: 'KZT', units: 'metric' },
  UZ: { currency: 'UZS', units: 'metric' },
  GE: { currency: 'GEL', units: 'metric' },
  AM: { currency: 'AMD', units: 'metric' },
  AZ: { currency: 'AZN', units: 'metric' },
  MN: { currency: 'MNT', units: 'metric' },
  AE: { currency: 'AED', units: 'metric' },
  SA: { currency: 'SAR', units: 'metric' },
  IL: { currency: 'ILS', units: 'metric' },
  JO: { currency: 'JOD', units: 'metric' },
  // Africa
  MA: { currency: 'MAD', units: 'metric' },
  EG: { currency: 'EGP', units: 'metric' },
  ZA: { currency: 'ZAR', units: 'metric' },
  KE: { currency: 'KES', units: 'metric' },
  TZ: { currency: 'TZS', units: 'metric' },
  ET: { currency: 'ETB', units: 'metric' },
  NG: { currency: 'NGN', units: 'metric' },
  GH: { currency: 'GHS', units: 'metric' },
  ML: { currency: 'XOF', units: 'metric' },
  SN: { currency: 'XOF', units: 'metric' },
  // Oceania
  AU: { currency: 'AUD', units: 'metric' },
  NZ: { currency: 'NZD', units: 'metric' },
  FJ: { currency: 'FJD', units: 'metric' },
};

// Country name -> ISO-2 for the last comma-separated segment of a Mapbox-style
// place string. Mapbox always terminates with the country name in the user's
// display locale, so this covers the common path. Unknown country -> undefined.
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  // Europe
  Italy: 'IT', France: 'FR', Spain: 'ES', Germany: 'DE', Portugal: 'PT',
  Netherlands: 'NL', Belgium: 'BE', Austria: 'AT', Greece: 'GR', Ireland: 'IE',
  Finland: 'FI', Croatia: 'HR', 'Czech Republic': 'CZ', Czechia: 'CZ',
  Poland: 'PL', Hungary: 'HU', Romania: 'RO', Bulgaria: 'BG', Switzerland: 'CH',
  Norway: 'NO', Sweden: 'SE', Denmark: 'DK', Iceland: 'IS',
  'United Kingdom': 'GB', UK: 'GB', England: 'GB', Scotland: 'GB', Wales: 'GB',
  Albania: 'AL', Serbia: 'RS', Turkey: 'TR', Türkiye: 'TR', Ukraine: 'UA',
  // Americas
  'United States': 'US', USA: 'US', 'United States of America': 'US',
  Canada: 'CA', Mexico: 'MX', Brazil: 'BR', Argentina: 'AR', Chile: 'CL',
  Peru: 'PE', Colombia: 'CO', 'Costa Rica': 'CR', Cuba: 'CU',
  // Asia
  Japan: 'JP', China: 'CN', 'South Korea': 'KR', Korea: 'KR',
  Thailand: 'TH', Vietnam: 'VN', Indonesia: 'ID', Malaysia: 'MY',
  Singapore: 'SG', Philippines: 'PH', India: 'IN', Nepal: 'NP',
  'Sri Lanka': 'LK', Kyrgyzstan: 'KG', Kazakhstan: 'KZ', Uzbekistan: 'UZ',
  Georgia: 'GE', Armenia: 'AM', Azerbaijan: 'AZ', Mongolia: 'MN',
  'United Arab Emirates': 'AE', UAE: 'AE', 'Saudi Arabia': 'SA',
  Israel: 'IL', Jordan: 'JO',
  // Africa
  Morocco: 'MA', Egypt: 'EG', 'South Africa': 'ZA', Kenya: 'KE',
  Tanzania: 'TZ', Ethiopia: 'ET', Nigeria: 'NG', Ghana: 'GH',
  Mali: 'ML', Senegal: 'SN',
  // Oceania
  Australia: 'AU', 'New Zealand': 'NZ', Fiji: 'FJ',
};

export interface TransportHint {
  /** How to travel between cities / regions (trains, flights, ferries, etc.) */
  intercity: string;
  /** How to get around within a city (metro, buses, rideshare apps, etc.) */
  intracity: string;
  /** Key rideshare / transit apps for this country */
  apps: string[];
  /** Booking lead-time warnings tied to busy seasons (optional) */
  bookingWarning?: string;
  /** Seasonal access caveats — passes, roads, weather closures (optional) */
  seasonalWarning?: string;
}

export interface TravelContext {
  countryIso2?: string;
  countryName?: string;
  currency: string; // ISO-4217
  units: 'metric' | 'imperial';
  holidays: Array<{ date: string; name: string }>; // YYYY-MM-DD, within trip window
  religiousPeriods: Array<{ name: string; overlap: string }>; // human-readable
  /** B3: per-country transport guidance injected into the prompt */
  transportHints: TransportHint[];
}

/** Parse the country from a Mapbox-style "Locality, Region, Country" string. */
function inferCountry(location: string): { iso2?: string; name?: string } {
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  // Walk from the end — the country is almost always the last segment, but
  // occasionally Mapbox appends a postal code. Try the last two segments.
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
    const iso = COUNTRY_NAME_TO_ISO[parts[i]];
    if (iso) return { iso2: iso, name: parts[i] };
  }
  return {};
}

// ---------------------------------------------------------------------------
// B3: Transport hints — intercity, intracity, apps, booking warnings, seasonal
// ---------------------------------------------------------------------------

/**
 * Per-country transport guidance keyed by ISO 3166 alpha-2.
 *
 * Rules:
 * - `intercity`: how to travel between cities / regions.
 * - `intracity`: how to navigate within a city.
 * - `apps`: rideshare / transit apps that actually work there.
 * - `bookingWarning`: optional — only set when advance booking is genuinely
 *   critical (e.g. Japan Golden Week, Tết, peak-season ferries).
 * - `seasonalWarning`: optional — road/pass closures, weather access limits.
 */
const TRANSPORT_HINTS: Record<string, Omit<TransportHint, 'bookingWarning' | 'seasonalWarning'> & Partial<Pick<TransportHint, 'bookingWarning' | 'seasonalWarning'>>> = {
  // Europe
  IT: {
    intercity: 'Trenitalia and Italo high-speed trains for major cities; Regionali are cheap for day trips. Buses (FlixBus, Marino) fill gaps. Domestic flights only for Sicily/Sardinia.',
    intracity: 'Walking and metro in Rome/Milan/Naples; ATAC/ATM city buses and trams; Vaporetti in Venice.',
    apps: ['Trenitalia', 'Italo', 'Moovit', 'BlaBlaCar'],
  },
  FR: {
    intercity: 'TGV (SNCF) is fast and covers most cities; Ouigo is the budget high-speed option. FlixBus for slower/cheaper. Blablacar for rural gaps.',
    intracity: 'Metro + RER in Paris (buy a Navigo card); TCL in Lyon; tram networks in most cities.',
    apps: ['SNCF Connect', 'Ouigo', 'Citymapper', 'BlaBlaCar'],
  },
  ES: {
    intercity: 'Renfe AVE high-speed for Madrid–Barcelona–Seville corridor. Alvia/Avant for regional. ALSA buses for rural areas.',
    intracity: 'Metro in Madrid and Barcelona (T-Casual card for 10 trips); EMT buses; bike-share (BiciMAD).',
    apps: ['Renfe', 'ALSA', 'Citymapper', 'Cabify'],
  },
  DE: {
    intercity: 'Deutsche Bahn ICE/IC for intercity; DB Regional (RE/RB) covered by Deutschlandticket (€49/month). FlixBus for budget.',
    intracity: 'U-Bahn + S-Bahn + tram in all major cities. Deutschlandticket covers all local transit nationwide.',
    apps: ['DB Navigator', 'FlixBus', 'BVG Fahrinfo', 'Moovit'],
  },
  PT: {
    intercity: 'CP trains for Lisbon–Porto (2h10); Rede Expressos buses for most destinations. Trains can be slow on regional lines.',
    intracity: 'Metro in Lisbon (Viva Viagem card) and Porto (Andante card); trams (iconic but slow).',
    apps: ['CP – Comboios de Portugal', 'Rede Expressos', 'Moovit'],
  },
  GB: {
    intercity: 'National Rail for intercity; book in advance online for cheapest fares (Advance tickets). Megabus/National Express for budget.',
    intracity: 'London: Oyster/contactless card covers Tube, bus, Overground, Elizabeth line. Cities: trams and buses.',
    apps: ['Trainline', 'National Rail', 'Citymapper', 'Uber'],
  },
  NL: {
    intercity: 'NS intercity trains are fast and frequent. OV-chipkaart covers trains + buses + trams + metro.',
    intracity: 'Bikes are fastest in most cities. GVB trams in Amsterdam; NS for intercity.',
    apps: ['NS', '9292', 'OV-chipkaart'],
  },
  CH: {
    intercity: 'SBB trains are punctual and cover most of the country; Swiss Travel Pass gives unlimited access. Scenic routes (Glacier Express, Bernina) need reservations.',
    intracity: 'ZVV trams/buses in Zurich; TL in Lausanne; Swiss Pass covers city transit too.',
    apps: ['SBB Mobile', 'Swiss Travel Pass'],
    bookingWarning: 'Glacier Express and Bernina Express scenic trains require seat reservations; book ahead in summer.',
    seasonalWarning: 'High alpine passes (Gotthard, Susten) may close Nov–May; check conditions before driving.',
  },
  NO: {
    intercity: 'Vy trains for Oslo–Bergen–Trondheim corridor. Hurtigruten ferry along the coast. Domestic flights for far north (SAS, Norwegian).',
    intracity: 'Oslo T-bane metro + trams; Ruter app for all public transport.',
    apps: ['Vy', 'Ruter', 'Entur'],
    seasonalWarning: 'Mountain roads may close Oct–May; fjord ferry schedules reduced in winter.',
  },
  SE: {
    intercity: 'SJ trains for Stockholm–Gothenburg–Malmö. Flygbussarna for airport connections. Flixbus for budget.',
    intracity: 'Stockholm: SL metro + buses + trams (SL Access card). Gothenburg: Västtrafik.',
    apps: ['SJ', 'SL', 'Västtrafik'],
  },
  CZ: {
    intercity: 'Czech Railways (ČD) for main cities; RegioJet and Leo Express are cheaper private operators on Prague–Brno–Ostrava. Buses (FlixBus, RegioJet) often faster for some routes.',
    intracity: 'Prague: metro (lines A/B/C) + trams; 90-min tickets cover all modes.',
    apps: ['Můj vlak', 'RegioJet', 'PID Lítačka'],
  },
  PL: {
    intercity: 'PKP Intercity for main cities; IC/EIP trains fast on Warsaw–Kraków–Wrocław. FlixBus for budget. Book ahead for weekends.',
    intracity: 'Warsaw: metro lines 1&2 + trams; Kraków: trams and buses. SKM suburban rail in Warsaw.',
    apps: ['PKP Intercity', 'jakdojade', 'Koleo'],
  },
  HU: {
    intercity: 'MÁV trains between cities; slow on rural lines. FlixBus for Vienna/Bratislava. Budapest is the clear transit hub.',
    intracity: 'Budapest: metro lines M1–M4 + trams + buses; BKK app for tickets.',
    apps: ['MÁV-START', 'BKK Futár', 'Bolt'],
  },
  HR: {
    intercity: 'Buses (FlixBus, Arriva) faster than trains on most Dalmatian coast routes. Ferries essential for islands (Jadrolinija).',
    intracity: 'ZET buses in Zagreb; walking in Split/Dubrovnik old towns.',
    apps: ['Jadrolinija', 'GetByBus', 'Bolt'],
    seasonalWarning: 'Ferry schedules to smaller islands are reduced Oct–Apr; check Jadrolinija timetable in advance.',
  },
  TR: {
    intercity: 'Turkish Airlines and Pegasus for cheap domestics (Istanbul–Ankara–Antalya). TCDD high-speed trains on Istanbul–Ankara (4h). Intercity buses (Metro Turizm, Ulusoy) are cheap and comfortable.',
    intracity: 'Istanbul: Metro + tram + Marmaray tunnel + ferries (Istanbulkart covers all). Izmir: Metro + buses.',
    apps: ['Pegasus', 'BiTaksi', 'Uber (Istanbul)', 'Moovit'],
  },
  // Americas
  US: {
    intercity: 'Domestic flights are cheapest for distances over 400 miles. Amtrak for Northeast Corridor (Boston–NYC–DC). Greyhound/FlixBus for budget. Car rental essential outside major cities.',
    intracity: 'Uber/Lyft in all cities. NYC: subway (MetroCard). Chicago: L train (Ventra). LA/SF: BART + Muni + bus.',
    apps: ['Uber', 'Lyft', 'Google Maps', 'Transit'],
  },
  CA: {
    intercity: 'Domestic flights for Vancouver–Toronto–Montreal. VIA Rail scenic but slow. Greyhound/FlixBus for budget.',
    intracity: 'Toronto: TTC subway + streetcars (PRESTO card). Vancouver: SkyTrain + buses (Compass card). Montreal: STM metro.',
    apps: ['Uber', 'Lyft', 'Transit', 'Moovit'],
  },
  MX: {
    intercity: 'ADO and ETN buses are excellent and cover most routes. Domestic flights cheap (Aeromexico, Volaris, Viva Aerobus). New Maya Train for Yucatán.',
    intracity: 'Mexico City: Metro is cheap and extensive (buy rechargeable card). Uber works nationwide. ECOBICI bike-share in CDMX.',
    apps: ['Uber', 'inDrive', 'Moovit'],
  },
  BR: {
    intercity: 'Domestic flights essential for large distances (LATAM, Gol, Azul). Intercity buses (RodoVia) for shorter hops. São Paulo–Rio: 6h bus or 1h flight.',
    intracity: 'São Paulo: Metro lines + CPTM suburban rail (bilhete único card). Rio: Metro + BRT. Uber works well.',
    apps: ['Uber', '99 (local Uber alternative)', 'Moovit'],
  },
  AR: {
    intercity: 'Aerolíneas Argentinas for long distances. Long-distance buses (Andesmar, Chevallier) are good and cheap. Buenos Aires to Mendoza: 13h bus or 2h flight.',
    intracity: 'Buenos Aires: Subte metro + colectivos (buses) — SUBE card for all. Taxis and Uber.',
    apps: ['Uber', 'Cabify', 'Moovit'],
  },
  PE: {
    intercity: 'Buses (Cruz del Sur, Oltursa) for coast routes. Flights for Lima–Cusco (altitude jump). IncaRail/PeruRail for Machu Picchu — book weeks ahead in high season.',
    intracity: 'Lima: Metropolitano BRT + combis minibuses. Taxis (agree price before), InDriver.',
    apps: ['InDriver', 'Uber', 'IncaRail'],
    bookingWarning: 'Machu Picchu train tickets (IncaRail/PeruRail) and site entrance sell out weeks ahead Jun–Sep.',
    seasonalWarning: 'Inca Trail closed each February for maintenance; Andean mountain passes may be difficult Jun–Aug in rain shadow zones.',
  },
  CO: {
    intercity: 'Domestic flights cheap (Avianca, Latam, Wingo) for Bogotá–Medellín–Cartagena. Buses for shorter hops.',
    intracity: 'Bogotá: TransMilenio BRT + Metro line 1 (2024). Medellín: Metro + Metrocable. Uber banned but working; use InDriver.',
    apps: ['InDriver', 'Cabify', 'Moovit'],
  },
  // Asia
  JP: {
    intercity: 'Shinkansen (JR Pass for tourists covers most lines — buy before arriving). JR local trains and overnight buses for budget. IC Card (Suica or Pasmo) for everything in cities.',
    intracity: 'Tokyo: Metro + JR Yamanote line (IC card). Osaka: Midosuji line. Kyoto: buses + one subway line. IC card covers all.',
    apps: ['Google Maps (works excellently)', 'Hyperdia', 'Japan Official Travel App'],
    bookingWarning: 'Shinkansen seats sell out during Golden Week (late Apr–early May), Obon (mid-Aug), and New Year (Dec 28–Jan 4) — book 1 month ahead.',
  },
  CN: {
    intercity: 'High-speed rail (G/D trains) is excellent — covers most cities in hours. Domestic flights for longer distances. Book on Trip.com or 12306 (requires Chinese ID workaround for foreigners).',
    intracity: 'Metro in all major cities (WeChat Pay / UnionPay or buy single-use card). DiDi for rideshare (set up before you go — requires foreign card).',
    apps: ['DiDi', 'Trip.com', 'Amap (AutoNavi)'],
    bookingWarning: 'Chinese New Year (Jan/Feb) triggers the world\'s largest annual migration — trains and flights sell out weeks ahead. Avoid travel the week before and after if possible.',
  },
  KR: {
    intercity: 'KTX high-speed rail for Seoul–Busan (2h20) and major cities. KORAIL + express buses cover everywhere. T-money card for all transit.',
    intracity: 'Seoul: Metro (9 lines) + buses (T-money card). Kakao Maps for navigation.',
    apps: ['Kakao T (taxi + transit)', 'Naver Map', 'KorailTalk'],
  },
  TH: {
    intercity: 'Domestic flights (AirAsia, Nok Air) cheap for northern/southern routes. Night trains Bangkok–Chiang Mai (book in advance). Buses for everything else.',
    intracity: 'Bangkok: BTS Skytrain + MRT metro + river ferry (get Rabbit Card). Tuk-tuks for short hops. Grab for rideshare.',
    apps: ['Grab', 'Bolt', 'ViaBus'],
    bookingWarning: 'Songkran (Thai New Year, Apr 13–15): buses and trains to northern provinces sell out 2 weeks ahead.',
    seasonalWarning: 'Southern islands (Koh Samui, Koh Tao) may have limited or cancelled ferries Jun–Oct during monsoon season.',
  },
  VN: {
    intercity: 'Reunification Express train Hanoi–Ho Chi Minh City (30h) or shorter segments. Domestic flights cheap (VietJet, Bamboo). Open-tour sleeper buses for backpackers.',
    intracity: 'Hanoi/HCMC: Grab is essential. Motorbike taxis (xe om) for quick hops. Metro lines opening in both cities.',
    apps: ['Grab', 'Be (local)', 'VinBus'],
    bookingWarning: 'Tết (Vietnamese New Year, Jan/Feb): buses and trains sell out 3–4 weeks ahead; many restaurants and shops closed for 3–7 days.',
  },
  ID: {
    intercity: 'Domestic flights essential for inter-island travel (Lion Air, Garuda, Batik Air). Ferries between Bali–Lombok–Gili (Gili Fast Boat). Java: trains (KAI) are good.',
    intracity: 'Bali: scooter rental is king; Grab works in tourist areas. Jakarta: MRT + Transjakarta BRT.',
    apps: ['Grab', 'Gojek', 'KAI Access'],
    seasonalWarning: 'Bali and Java rainy season Nov–Mar can affect mountain treks and coastal roads. Komodo ferry schedules reduced in rough seas.',
  },
  MY: {
    intercity: 'ETS trains KL–Penang (3h) and KL–Ipoh. Buses everywhere cheap. Domestic flights for Borneo (Kota Kinabalu, Kuching).',
    intracity: 'Kuala Lumpur: LRT + MRT + Monorail + KTM (Touch \'n Go card). Grab throughout Malaysia.',
    apps: ['Grab', 'myBAS', 'KTM'],
    bookingWarning: 'Chinese New Year (Jan/Feb): book KL–Penang trains and buses 2–3 weeks ahead.',
  },
  SG: {
    intercity: 'Singapore is a city-state. Bus to JB (Malaysia) for day trips. Ferry to Batam/Bintan (Indonesia).',
    intracity: 'MRT + buses — best transit network in Southeast Asia. EZ-Link card or SimplyGo contactless. Grab for late night.',
    apps: ['MyTransport.SG', 'Grab', 'Transit'],
  },
  IN: {
    intercity: 'Indian Railways is extensive — book on IRCTC weeks ahead for Tatkal/AC classes (fills fast). IndiGo/Air India for longer hops. Volvo AC buses for hill stations.',
    intracity: 'Delhi/Mumbai/Bangalore/Chennai/Hyderabad/Kolkata: metro systems. Ola + Uber for taxis. Auto-rickshaws (bargain or use meter).',
    apps: ['IRCTC Rail Connect', 'Ola', 'Uber', 'Google Maps'],
    bookingWarning: 'Trains book out weeks ahead during Diwali (Oct/Nov), Holi (Mar), and summer holidays (May–Jun). Book as soon as dates are fixed.',
  },
  NP: {
    intercity: 'Tourist buses Kathmandu–Pokhara (7h) or flight (25 min). Local buses cheap but slow. Jeeps for mountain trailheads.',
    intracity: 'Kathmandu: taxis (agree price upfront), tempo minibuses, Pathao bike-taxi app.',
    apps: ['Pathao', 'Tootle'],
    bookingWarning: 'Everest Base Camp trek permits sell out quickly in Oct–Nov peak season; book 2–3 months ahead.',
    seasonalWarning: 'Monsoon (Jun–Sep) makes many mountain treks difficult and some roads impassable. Mountain flights to Lukla cancel frequently in fog (Oct–Nov).',
  },
  LK: {
    intercity: 'Scenic train Kandy–Ella is world-famous — book 1st/2nd class observation car weeks ahead. Buses cheap and frequent everywhere.',
    intracity: 'Colombo: Uber + PickMe. Tuk-tuks for short hops (negotiate firmly).',
    apps: ['PickMe', 'Uber'],
    bookingWarning: 'Kandy–Ella observation car train tickets sell out 1–2 months ahead in high season (Dec–Apr); book on 12go.asia.',
  },
  KG: {
    intercity: 'Shared marshrutkas (minibuses) between cities — depart when full from main bazaars. Taxis for flexibility. No domestic rail. Bishkek–Osh by shared taxi (10–12h) or flight.',
    intracity: 'Bishkek: Yandex Go for taxis (set up before arriving). Marshrutkas for budget in-city.',
    apps: ['Yandex Go', 'Яндекс Такси'],
  },
  KZ: {
    intercity: 'Air Astana flights between Almaty and Astana (2h). Trains between major cities (book on railways.kz). Shared taxis for shorter distances.',
    intracity: 'Almaty: metro (5 stations, limited) + buses + Yandex Go. Astana: Yandex Go.',
    apps: ['Yandex Go', 'inDrive'],
  },
  UZ: {
    intercity: 'Afrosiyob high-speed train Tashkent–Samarkand (2h10) and Samarkand–Bukhara (1h30) — excellent, book online. Shared taxis for Fergana Valley.',
    intracity: 'Tashkent: metro (3 lines, cheap). Yandex Go in all cities. Shared taxis in smaller towns.',
    apps: ['Yandex Go', 'My Tashkent'],
  },
  GE: {
    intercity: 'Marshrutkas Tbilisi–Batumi (5h) / Tbilisi–Kutaisi (3h). Trains slower but scenic. Yandex Go for intercity shared taxi.',
    intracity: 'Tbilisi: Metro (2 lines) + buses (Metromoney card). Bolt and Yandex Go for taxis.',
    apps: ['Bolt', 'Yandex Go'],
  },
  AM: {
    intercity: 'Marshrutkas and shared taxis from Yerevan to main towns. No domestic flights needed (country is small).',
    intracity: 'Yerevan: metro (cheap, limited coverage) + buses. Yandex Go and GG for taxis.',
    apps: ['GG Taxi', 'Yandex Go'],
  },
  AZ: {
    intercity: 'Trains and buses from Baku to Ganja (4h). Shared taxis for Sheki. Domestic flight to Nakhchivan.',
    intracity: 'Baku: metro + buses (BakuCard). Bolt for taxis.',
    apps: ['Bolt', 'BakuBus'],
  },
  MN: {
    intercity: 'Shared jeeps and minivans for most countryside routes — there are almost no paved roads outside Ulaanbaatar. Trans-Mongolian railway for Ulaanbaatar–Gobi. Domestic flights (Hunnu Air, MIAT) for far provinces.',
    intracity: 'Ulaanbaatar: local buses + Yandex Go.',
    apps: ['Yandex Go', 'E-Mongol'],
    seasonalWarning: 'Most countryside roads and river crossings are only passable Jun–Sep; "dzud" winter storms can close all roads. Mountain passes may have snow from Oct.',
  },
  AE: {
    intercity: 'Etihad/Emirates for Abu Dhabi–Dubai (or just take a taxi/bus, 1.5h). No intercity rail yet.',
    intracity: 'Dubai: Metro Red + Green lines (Nol card). Buses. Careem/Uber for everything else.',
    apps: ['Careem', 'Uber', 'RTA Dubai'],
  },
  SA: {
    intercity: 'Saudia/flynas/flyadeal for domestic flights. Haramain high-speed train Riyadh–Mecca–Medina–Jeddah (fast and cheap).',
    intracity: 'Riyadh: Metro (6 lines, opened 2024). Careem + Uber + Jeeny across all cities.',
    apps: ['Careem', 'Uber', 'Jeeny'],
    bookingWarning: 'Hajj (10 days in the Islamic calendar) and Ramadan make Mecca and Medina extremely crowded; book accommodation and transport months ahead.',
  },
  IL: {
    intercity: 'Israel Railways connects Tel Aviv–Jerusalem–Haifa–Beer Sheva well. Buses (Egged, Dan) cover everywhere else. Shared sherut taxis on Shabbat when transit stops.',
    intracity: 'Tel Aviv: LightRail line 1 + Dan buses + Moovit. Jerusalem: LightRail + buses.',
    apps: ['Moovit', 'Gett', 'Waze Carpool'],
  },
  JO: {
    intercity: 'Buses (JETT) and shared taxis (service) between Amman–Petra–Aqaba. Car rental recommended for flexibility.',
    intracity: 'Amman: no real public transit — taxis (Careem, Uber) are affordable.',
    apps: ['Careem', 'Uber'],
  },
  // Africa
  MA: {
    intercity: 'ONCF trains Casablanca–Marrakech–Fès–Tangier — fast and comfortable. CTM buses for destinations not on rail. Shared grand taxis for flexibility.',
    intracity: 'Casablanca: Tramway. Rabat: Tramway. Medinas: walking only (no cars). Petit taxis for city transport.',
    apps: ['Careem', 'Heetch'],
  },
  EG: {
    intercity: 'Egyptian Railways for Cairo–Alexandria (2h) and Cairo–Luxor–Aswan overnight sleeper. Buses (Go Bus, West & Mid Delta) for Sinai. Domestic flights for south.',
    intracity: 'Cairo: Metro (3 lines, cheap) + CTA buses. Uber and Careem for taxis.',
    apps: ['Uber', 'Careem', 'inDrive'],
  },
  ZA: {
    intercity: 'Domestic flights (Kulula, FlySafair) essential for Joburg–Cape Town–Durban. Intercape buses for budget. Car rental critical outside cities.',
    intracity: 'Cape Town: MyCiTi BRT bus + ride-hail. Joburg: Gautrain (airport + Sandton). Uber widely used.',
    apps: ['Uber', 'Bolt', 'inDriver'],
    seasonalWarning: 'Cape Town Garden Route and Drakensberg mountain roads can be affected by flooding Jun–Aug.',
  },
  KE: {
    intercity: 'Standard Gauge Railway Nairobi–Mombasa (4.5h) — book ahead. Matatu minibuses everywhere else. Domestic flights (Safarilink, Fly540) for game parks.',
    intracity: 'Nairobi: matatus + Uber/Bolt. Mombasa: tuk-tuks + boda-boda motorbikes.',
    apps: ['Uber', 'Bolt', 'Little Cab'],
    bookingWarning: 'Safari game park accommodation and park entry fees (Masai Mara, Amboseli) fill up months ahead Jul–Oct migration season.',
  },
  TZ: {
    intercity: 'Domestic flights (Coastal Aviation, Precision Air) for Zanzibar + national parks. Ferries Dar es Salaam–Zanzibar (Fast Ferry: 1.5h). Buses for mainland routes.',
    intracity: 'Dar es Salaam: daladala minibuses + Bolt. Stone Town (Zanzibar): walking + tuk-tuks.',
    apps: ['Bolt', 'Uber'],
  },
  // Oceania
  AU: {
    intercity: 'Domestic flights essential for long distances (Qantas, Jetstar, Virgin Australia). XPT trains and NSW Trainlink for east coast. Greyhound buses.',
    intracity: 'Sydney: Opal card for trains/buses/ferries. Melbourne: Myki card for trams/trains/buses. Uber nationwide.',
    apps: ['Uber', 'DiDi', 'Transport NSW', 'PTV'],
  },
  NZ: {
    intercity: 'Domestic flights Air New Zealand for South/North Island. InterIslander or Bluebridge ferries Picton–Wellington (3.5h). InterCity buses nationwide.',
    intracity: 'Auckland: AT Hop card for buses + trains. Wellington: Snapper card. Uber in main cities.',
    apps: ['Uber', 'AT Mobile', 'Intercity'],
    seasonalWarning: 'South Island mountain passes (Haast, Lewis, Lindis) may have snow Jun–Sep; check NZTA road conditions.',
  },
  FJ: {
    intercity: 'Ferries between islands essential — book Awesome Adventures (Mamanuca/Yasawa) or Patterson Brothers (outer islands) ahead in peak season. Sunbeam bus for Viti Levu coastal route.',
    intracity: 'Nadi/Suva: local buses cheap. Taxis from stands (agree price). Transfers to resorts usually included.',
    apps: ['Fiji Airways app for inter-island flights'],
    seasonalWarning: 'Cyclone season Nov–Apr can disrupt inter-island ferries and flights. Travel insurance strongly recommended.',
  },
};

// ---------------------------------------------------------------------------
// Booking lead-time warnings tied to religious / cultural periods
// ---------------------------------------------------------------------------

/**
 * For countries where a cultural period (Ramadan, CNY, Tết, Golden Week, etc.)
 * overlaps the trip, inject an additional booking warning if the country's
 * transport hints don't already include one.
 */
const PERIOD_BOOKING_WARNINGS: Array<{
  iso2Set: Set<string>;
  periodKey: string; // partial match against religiousPeriods[].name
  warning: string;
}> = [
  {
    iso2Set: new Set(['JP']),
    periodKey: 'Golden Week',
    warning: 'Golden Week (late Apr–early May): shinkansen and limited express seats sell out 1 month ahead. Book as soon as dates are confirmed.',
  },
  {
    iso2Set: new Set(['CN', 'SG', 'MY', 'VN', 'TW']),
    periodKey: 'Chinese New Year',
    warning: 'Chinese New Year: trains, buses, and flights fill up 2–3 weeks before the holiday. Book early and expect higher prices.',
  },
  {
    iso2Set: new Set(['VN']),
    periodKey: 'Tết',
    warning: 'Tết: sleeper buses and trains sell out 3–4 weeks ahead; many local businesses close for 5–7 days.',
  },
  {
    iso2Set: new Set(['TH']),
    periodKey: 'Songkran',
    warning: 'Songkran (Apr 13–15): buses and trains to Chiang Mai sell out 2 weeks ahead; expect road closures in old city areas.',
  },
  {
    iso2Set: new Set(['MA', 'EG', 'ID', 'MY', 'TR', 'KG', 'UZ']),
    periodKey: 'Ramadan',
    warning: 'Ramadan: intercity buses still run normally but may leave early (before iftar). Taxis scarce at iftar sunset rush.',
  },
];

// ---------------------------------------------------------------------------
// Seasonal access warnings by country + month range
// ---------------------------------------------------------------------------

interface SeasonalRule {
  iso2Set: Set<string>;
  /** Months (1-indexed) when the warning is relevant */
  months: number[];
  warning: string;
}

const SEASONAL_RULES: SeasonalRule[] = [
  {
    iso2Set: new Set(['NP']),
    months: [6, 7, 8, 9],
    warning: 'Monsoon season (Jun–Sep): many mountain trekking routes are muddy/dangerous; some roads impassable. Consider alternative routes or postpone high-altitude treks.',
  },
  {
    iso2Set: new Set(['ID']),
    months: [11, 12, 1, 2, 3],
    warning: 'West monsoon (Nov–Mar): heavy rain can affect Bali/Java coastal roads and some mountain trails. Komodo ferries may cancel in rough seas.',
  },
  {
    iso2Set: new Set(['TH', 'MY', 'VN', 'PH']),
    months: [6, 7, 8, 9, 10],
    warning: 'Monsoon season: southern islands may have rough ferry conditions and some beaches close. Check specific island conditions — north Thailand stays dry when south is wet.',
  },
  {
    iso2Set: new Set(['MN']),
    months: [10, 11, 12, 1, 2, 3, 4, 5],
    warning: 'Outside Jun–Sep, many countryside roads and river crossings are impassable. Stick to paved routes around Ulaanbaatar.',
  },
  {
    iso2Set: new Set(['NZ']),
    months: [6, 7, 8],
    warning: 'South Island mountain passes may have snow (Jun–Aug); carry chains and check NZTA conditions before driving alpine roads.',
  },
  {
    iso2Set: new Set(['CH', 'AT', 'NO']),
    months: [11, 12, 1, 2, 3],
    warning: 'High alpine passes may be closed Nov–May due to snow; check current conditions via national road authorities.',
  },
  {
    iso2Set: new Set(['FJ']),
    months: [11, 12, 1, 2, 3, 4],
    warning: 'Cyclone season (Nov–Apr): inter-island ferries and small aircraft may be cancelled with short notice. Keep flexibility and have travel insurance.',
  },
  {
    iso2Set: new Set(['KG']),
    months: [10, 11, 12, 1, 2, 3, 4],
    warning: 'Mountain passes (Torugart, Irkeshtam, Son-Kul) are snowbound Oct–May. Some roads in Alay valley require 4WD in shoulder seasons.',
  },
  {
    iso2Set: new Set(['MA']),
    months: [12, 1, 2],
    warning: 'High Atlas passes (Tizi n\'Tichka, Tizi n\'Test) can close with snow Dec–Feb. Check conditions before self-driving.',
  },
];

/**
 * Resolve transport hints for a set of ISO-2 country codes (for multi-stop trips).
 * Returns a deduplicated array of TransportHint objects, one per unique country.
 */
function resolveTransportHints(
  isoCodes: string[],
  startDate: string,
  _endDate: string,
  religiousPeriods: Array<{ name: string; overlap: string }>
): TransportHint[] {
  const startMonth = Number(startDate.slice(5, 7));
  const hints: TransportHint[] = [];
  const seen = new Set<string>();

  for (const iso2 of isoCodes) {
    if (!iso2 || seen.has(iso2)) continue;
    seen.add(iso2);

    const base = TRANSPORT_HINTS[iso2];
    if (!base) continue;

    let bookingWarning = base.bookingWarning;
    let seasonalWarning = base.seasonalWarning;

    // Overlay booking warning from religious/cultural period if not already set
    if (!bookingWarning) {
      for (const rule of PERIOD_BOOKING_WARNINGS) {
        if (
          rule.iso2Set.has(iso2) &&
          religiousPeriods.some((p) => p.name.includes(rule.periodKey))
        ) {
          bookingWarning = rule.warning;
          break;
        }
      }
    }

    // Overlay seasonal warning from month-based rules if not already set
    if (!seasonalWarning) {
      for (const rule of SEASONAL_RULES) {
        if (rule.iso2Set.has(iso2) && rule.months.includes(startMonth)) {
          seasonalWarning = rule.warning;
          break;
        }
      }
    }

    hints.push({ ...base, bookingWarning, seasonalWarning });
  }

  return hints;
}

// Ramadan start/end (approximate — Saudi astronomical calendar). Covers the
// window we care about. Each year: [startYYYY-MM-DD, endYYYY-MM-DD].
const RAMADAN_WINDOWS: Record<number, [string, string]> = {
  2024: ['2024-03-11', '2024-04-09'],
  2025: ['2025-02-28', '2025-03-29'],
  2026: ['2026-02-17', '2026-03-18'],
  2027: ['2027-02-06', '2027-03-07'],
  2028: ['2028-01-27', '2028-02-24'],
  2029: ['2029-01-15', '2029-02-13'],
};

// Chinese New Year — affects travel in CN, HK, SG, MY, VN, TW, and tourist
// sites in Chinatowns globally. Just celebration day + ~1 week impact window.
const CNY_WINDOWS: Record<number, [string, string]> = {
  2024: ['2024-02-10', '2024-02-17'],
  2025: ['2025-01-29', '2025-02-04'],
  2026: ['2026-02-17', '2026-02-23'],
  2027: ['2027-02-06', '2027-02-12'],
  2028: ['2028-01-26', '2028-02-01'],
  2029: ['2029-02-13', '2029-02-19'],
};

// Country codes where Ramadan materially impacts restaurant/opening hours.
const RAMADAN_IMPACT_COUNTRIES = new Set([
  'MA', 'EG', 'SA', 'AE', 'JO', 'ML', 'SN', 'ID', 'MY', 'TR', 'KG', 'UZ', 'KZ',
]);
// Country codes where CNY materially impacts travel (closures, travel chaos).
const CNY_IMPACT_COUNTRIES = new Set(['CN', 'HK', 'SG', 'MY', 'VN', 'TW']);

function windowOverlaps(tripStart: string, tripEnd: string, win: [string, string]): boolean {
  return tripEnd >= win[0] && tripStart <= win[1];
}

/**
 * Build the full destination context for an itinerary request.
 *
 * `arrivalLocation` is used for the primary country lookup (currency/units/
 * holidays frame). `allLocations` (arrival + stops + departure) is used for
 * multi-country transport hints — each unique country gets its own hint block.
 */
export function buildTravelContext(
  arrivalLocation: string,
  startDate: string,
  endDate: string,
  allLocations?: string[]
): TravelContext {
  const { iso2, name } = inferCountry(arrivalLocation);
  const meta = iso2 ? COUNTRY_META[iso2] : undefined;

  // Public holidays via date-holidays, filtered to the trip window.
  let holidays: Array<{ date: string; name: string }> = [];
  if (iso2) {
    try {
      const hd = new Holidays(iso2);
      const startY = Number(startDate.slice(0, 4));
      const endY = Number(endDate.slice(0, 4));
      const years = startY === endY ? [startY] : [startY, endY];
      for (const y of years) {
        const list = hd.getHolidays(y) || [];
        for (const h of list) {
          const date = String(h.date).slice(0, 10); // YYYY-MM-DD
          if (date >= startDate && date <= endDate && (h.type === 'public' || h.type === 'bank')) {
            holidays.push({ date, name: h.name });
          }
        }
      }
    } catch (e) {
      console.warn('[travelContext] date-holidays failed for', iso2, e);
    }
  }

  // Religious / cultural periods with known regional impact.
  const religiousPeriods: Array<{ name: string; overlap: string }> = [];
  for (const [yStr, win] of Object.entries(RAMADAN_WINDOWS)) {
    if (windowOverlaps(startDate, endDate, win) && iso2 && RAMADAN_IMPACT_COUNTRIES.has(iso2)) {
      religiousPeriods.push({
        name: `Ramadan ${yStr}`,
        overlap: `${win[0]} to ${win[1]} — expect daytime restaurant closures, reduced hours, iftar rush at sunset`,
      });
      break;
    }
  }
  for (const [yStr, win] of Object.entries(CNY_WINDOWS)) {
    if (windowOverlaps(startDate, endDate, win) && iso2 && CNY_IMPACT_COUNTRIES.has(iso2)) {
      religiousPeriods.push({
        name: `Chinese New Year ${yStr}`,
        overlap: `${win[0]} to ${win[1]} — major closures, family travel crowds, book transport well in advance`,
      });
      break;
    }
  }

  // B3: Resolve transport hints for all unique countries in the trip
  const locationsToResolve = allLocations ?? [arrivalLocation];
  const allIsoCodes = locationsToResolve
    .map((loc) => inferCountry(loc).iso2)
    .filter((c): c is string => !!c);
  const transportHints = resolveTransportHints(allIsoCodes, startDate, endDate, religiousPeriods);

  return {
    countryIso2: iso2,
    countryName: name,
    currency: meta?.currency ?? 'USD',
    units: meta?.units ?? 'metric',
    holidays,
    religiousPeriods,
    transportHints,
  };
}
