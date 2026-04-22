/**
 * C2: "Before you go" practical travel info — static, zero-latency.
 *
 * Covers ~60 countries with five fast-reference fields a backpacker needs
 * before landing: visa, SIM/eSIM, tipping convention, water safety, and
 * power adapter type. Injected as a concise block at the top of the prompt
 * so the model can surface this in a dedicated "Before you go" section.
 *
 * All data is static — no API calls, no async, <1ms to evaluate.
 */

export interface PracticalInfo {
  /** Short visa guidance; passport-agnostic for the most common passports. */
  visa: string;
  /** Best SIM / eSIM options for travelers. */
  sim: string;
  /** Tipping norms. */
  tipping: string;
  /** Tap water safety verdict. */
  water: string;
  /** Power socket type(s) and voltage. */
  power: string;
}

export interface PracticalContext {
  countryName: string;
  info: PracticalInfo;
}

// ---------------------------------------------------------------------------
// Static data (ISO-2 → PracticalInfo)
// ---------------------------------------------------------------------------

const PRACTICAL_INFO: Record<string, PracticalInfo> = {
  // ── Europe ──────────────────────────────────────────────────────────────
  IT: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'TIM or Iliad tourist SIMs at airports/phone shops (~€10–15 for 15–30 days data). Airalo eSIM works before arrival.',
    tipping: 'Not mandatory. Rounding up bills or leaving €1–2/person at sit-down restaurants is appreciated. Coperto (cover charge) is separate.',
    water: 'Tap water is safe and excellent across Italy. Refill at public "nasoni" fountains for free.',
    power: 'Type C/F/L (230V). EU plugs work everywhere. USB-C charges fine.',
  },
  FR: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'Free or Orange tourist SIMs at airports/phone shops (~€10–20). Airalo eSIM works.',
    tipping: 'Service included by law. Small tip (€1–2) for good service is appreciated but entirely optional.',
    water: 'Tap water is safe throughout France.',
    power: 'Type C/E (230V). EU plugs work everywhere.',
  },
  ES: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'Orange, Vodafone, or Lebara tourist SIMs at airports/supermarkets (~€10–15). Airalo eSIM works.',
    tipping: 'Not expected. Rounding up or leaving €1–2 is a kind gesture at restaurants. No tipping at bars.',
    water: 'Tap water is generally safe, though taste varies by region. Locals often prefer bottled.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  DE: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'Congstar, Aldi Talk, or Lebara SIMs at supermarkets/airports (~€10–15). Airalo eSIM works.',
    tipping: '10% is standard at restaurants if service was good. Round up taxi fares.',
    water: 'Tap water is excellent quality throughout Germany.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  PT: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'NOS or MEO tourist SIMs at airports (~€10–15). Airalo eSIM works.',
    tipping: 'Not mandatory. 5–10% is appreciated at restaurants; rounding up taxis is fine.',
    water: 'Tap water is safe throughout Portugal, though Lisbon tap has a slight taste — bottled preferred by many.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  NL: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'KPN or T-Mobile tourist SIMs at airports (~€10–20). Airalo eSIM works.',
    tipping: '10% is common at restaurants; round up taxi fares. Not tipping is fine too.',
    water: 'Tap water is excellent quality throughout the Netherlands.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  BE: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'Proximus or Base SIMs at airports (~€10–20). Airalo eSIM works.',
    tipping: 'Not mandatory. 5–10% is kind at sit-down restaurants.',
    water: 'Tap water is safe throughout Belgium.',
    power: 'Type C/E (230V). EU plugs work everywhere.',
  },
  AT: {
    visa: 'Schengen area: EU/EEA/CH: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'A1 or Drei tourist SIMs at airports (~€10–20). Airalo eSIM works.',
    tipping: '5–10% is customary at restaurants. Round up taxi fares.',
    water: 'Vienna tap water is world-class. Safe throughout Austria.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  CH: {
    visa: 'Not in EU but Schengen: EU/US/UK/CA/AU/NZ: 90-day visa-free. Others: check sem.admin.ch.',
    sim: 'Sunrise or Salt tourist SIMs at airports (~CHF 20–30). Airalo eSIM works. Swiss e-SIM: Salt Go is popular.',
    tipping: 'Service included. Rounding up is appreciated; 5–10% for very good service at nicer restaurants.',
    water: 'Tap water is exceptional quality. Swiss alpine water — drink freely everywhere.',
    power: 'Type J (230V) — unique to Switzerland. Bring a Swiss/EU adapter; many sockets also accept Type C.',
  },
  GB: {
    visa: 'UK (not Schengen): EU citizens need passport (not ID card since 2024). US/CA/AU/NZ/EU: visa-free up to 6 months. Others: check gov.uk/check-uk-visa.',
    sim: 'Three, GiffGaff, or EE SIMs at airports (~£10–15). Airalo eSIM works. Buy at any convenience store.',
    tipping: '10–15% at sit-down restaurants (check if service already included). Not expected at pubs or takeaways.',
    water: 'Tap water is safe throughout the UK.',
    power: 'Type G (230V) — UK-specific 3-pin plug. Bring a UK adapter or buy one at the airport.',
  },
  IE: {
    visa: 'Not in Schengen: EU/US/CA/AU/NZ: visa-free. Others: check irishimmigration.ie.',
    sim: 'Three or Vodafone Ireland SIMs at airports (~€10–20). Airalo eSIM works.',
    tipping: '10–15% at sit-down restaurants. Not expected at pubs.',
    water: 'Tap water is safe throughout Ireland.',
    power: 'Type G (230V) — UK-style 3-pin plug. Bring a UK/Irish adapter.',
  },
  GR: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check visaforeurope.eu.',
    sim: 'Cosmote or Vodafone Greece SIMs at airports (~€10–15). Airalo eSIM works.',
    tipping: 'Not mandatory. Leaving a few euros at tavernas is appreciated. Round up taxis.',
    water: 'Tap water is safe on the mainland and most islands. Some islands (especially smaller ones) have salty/brackish tap — ask locally or use bottled.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  NO: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check udi.no.',
    sim: 'Telenor or Telia tourist SIMs at airports (~NOK 100–200). Airalo eSIM works.',
    tipping: 'Not expected, but 10% is appreciated at restaurants. Rounding up is fine.',
    water: 'Tap water is excellent quality throughout Norway.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  SE: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check migrationsverket.se.',
    sim: 'Tele2 or Comviq SIMs at airports/supermarkets (~SEK 100–150). Airalo eSIM works.',
    tipping: 'Not expected, but 10% for good service at restaurants. Sweden is increasingly cashless.',
    water: 'Tap water is excellent quality throughout Sweden.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  DK: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check newtodenmark.dk.',
    sim: 'TDC or YouSee SIMs at airports/supermarkets (~DKK 80–150). Airalo eSIM works.',
    tipping: 'Service included. Rounding up is nice but not expected.',
    water: 'Tap water is excellent quality throughout Denmark.',
    power: 'Type C/F/K (230V). EU plugs work everywhere; Type K is unique to Denmark but Type C/F fit too.',
  },
  FI: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check migri.fi.',
    sim: 'Elisa or DNA tourist SIMs at airports (~€10–20). Airalo eSIM works.',
    tipping: 'Not customary in Finland. Service charge included in prices.',
    water: 'Tap water is excellent quality throughout Finland.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  IS: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check utl.is.',
    sim: 'Síminn or Nova SIMs at Keflavík Airport (ISK 1,500–3,000). Airalo eSIM works. Coverage is excellent on Ring Road.',
    tipping: 'Not customary. Iceland includes service in all prices.',
    water: 'Tap water is among the world\'s best — straight from glaciers. Drink freely everywhere.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  CZ: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check mzv.cz.',
    sim: 'T-Mobile or O2 Czech tourist SIMs at airports/shops (~CZK 200–400). Airalo eSIM works.',
    tipping: '10% is standard at restaurants. Round up taxi fares.',
    water: 'Tap water is safe throughout the Czech Republic.',
    power: 'Type C/E (230V). EU plugs work everywhere.',
  },
  PL: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check msz.gov.pl.',
    sim: 'Play or Plus tourist SIMs at airports/shops (~PLN 20–40). Airalo eSIM works.',
    tipping: '10% is appreciated at restaurants. Round up taxis.',
    water: 'Tap water is safe throughout Poland.',
    power: 'Type C/E (230V). EU plugs work everywhere.',
  },
  HU: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check bmbah.hu.',
    sim: 'Telekom or Yettel tourist SIMs at airports/shops (~HUF 3,000–5,000). Airalo eSIM works.',
    tipping: '10–15% is customary at restaurants (not automatic). Round up taxis.',
    water: 'Tap water is safe throughout Hungary. Budapest tap is fine to drink.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  HR: {
    visa: 'Schengen area: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free. Others: check mvep.gov.hr.',
    sim: 'A1 or T-Mobile Croatia SIMs at airports/shops (~EUR 10–15). Airalo eSIM works.',
    tipping: '10% is appreciated at sit-down restaurants. Not expected at konobas or causal spots.',
    water: 'Tap water is safe throughout Croatia.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  RO: {
    visa: 'EU member (partial Schengen as of 2024): EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free.',
    sim: 'Digi or Orange Romania SIMs at airports/shops (~RON 20–40). Airalo eSIM works.',
    tipping: '10% is appreciated at restaurants. Round up taxis.',
    water: 'Tap water is technically safe in cities but most locals drink bottled. Use bottled to be safe.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  BG: {
    visa: 'EU member: EU/EEA: free entry. US/UK/CA/AU/NZ: 90-day visa-free.',
    sim: 'A1 or Yettel Bulgaria SIMs at airports/shops (~BGN 10–20). Airalo eSIM works.',
    tipping: '10% is appreciated at restaurants.',
    water: 'Tap water varies — safe in Sofia and major cities, bottled recommended in smaller towns.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  AL: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 1 year. Others: check punetejashtme.gov.al.',
    sim: 'Vodafone or ALBtelecom SIMs at airports/shops (~ALL 500–1,000). Airalo eSIM works.',
    tipping: '10% is appreciated. Not always expected at local qebaptore or traditional restaurants.',
    water: 'Use bottled water. Tap water is inconsistent outside Tirana.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  RS: {
    visa: 'EU/US/UK/CA/AU/NZ: 30–90 day visa-free (varies by passport). Check mfa.gov.rs.',
    sim: 'mt:s or SBB SIMs at airports/shops (~RSD 500–1,000). Airalo eSIM works.',
    tipping: '10% is appreciated at restaurants. Not strictly expected.',
    water: 'Tap water is safe in Belgrade and major cities. Bottled preferred by many locals outside cities.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  TR: {
    visa: 'US/UK/CA/AU: e-Visa required (~$50–80, apply at evisa.gov.tr before travel). EU: visa-free 90 days. Others: check konsolosluk.gov.tr.',
    sim: 'Turkcell or Vodafone Turkey SIMs at airports (~TRY 300–600 for 7–15 days). Register within 3 months or it\'ll be blocked. Airalo eSIM avoids registration hassle.',
    tipping: '10–15% at sit-down restaurants. Not expected at lokantası (local diners) or street food.',
    water: 'Bottled only. Tap water is not recommended for drinking throughout Turkey.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },
  UA: {
    visa: 'EU/US/UK/CA/AU/NZ: 90-day visa-free. Check mfa.gov.ua for current travel advisories.',
    sim: 'Kyivstar or Vodafone Ukraine SIMs at shops (~UAH 100–200). Check coverage given current situation.',
    tipping: '10% is appreciated at restaurants.',
    water: 'Bottled recommended. Tap water quality varies across regions.',
    power: 'Type C/F (230V). EU plugs work everywhere.',
  },

  // ── Americas ─────────────────────────────────────────────────────────────
  US: {
    visa: 'EU/UK/CA/AU/NZ/JP/KR: ESTA required (apply online at esta.cbp.dhs.gov, ~$21, valid 2 years). Others: tourist visa from US embassy.',
    sim: 'T-Mobile or AT&T tourist SIMs at airports/Best Buy (~$30–50/month). T-Mobile has best coverage in rural areas. Airalo eSIM works well.',
    tipping: 'Tipping is mandatory culture: 18–22% at restaurants, $1–2/drink at bars, $2–5/bag for bellhops, 15–20% for taxis/rideshares.',
    water: 'Tap water is safe throughout the US. NYC and Chicago tap water is excellent.',
    power: 'Type A/B (120V). Non-US devices need a voltage converter (not just a plug adapter) unless dual-voltage.',
  },
  CA: {
    visa: 'EU/UK/AU/NZ/JP: eTA required (apply online at canada.ca/en/immigration, ~CAD 7). US: visa-free. Others: check ircc.canada.ca.',
    sim: 'Fido or Koodo tourist SIMs at airports/electronics stores (~CAD 30–50). Airalo eSIM works.',
    tipping: '15–20% at restaurants is standard. 10–15% for taxis.',
    water: 'Tap water is safe throughout Canada.',
    power: 'Type A/B (120V). Same as USA — non-US devices may need voltage converter.',
  },
  MX: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 180 days. Others: check gob.mx/inm.',
    sim: 'Telcel or AT&T Mexico tourist SIMs at airports (~MXN 200–400 for 7–15 days). Airalo eSIM works.',
    tipping: '10–15% at sit-down restaurants. Not expected at taquerías and street food.',
    water: 'Bottled only. Never drink tap water anywhere in Mexico, including hotels.',
    power: 'Type A/B (127V). US-style plugs fit but voltage is slightly lower — dual-voltage devices are fine.',
  },
  BR: {
    visa: 'US/CA/AU: visa-free since 2024. EU/UK/NZ: visa-free. Others: check gov.br/mre.',
    sim: 'Vivo or TIM Brazil tourist SIMs at airports (~BRL 40–80). Airalo eSIM works.',
    tipping: '10% is included ("serviço") at most restaurants — check the bill. Additional tip optional.',
    water: 'Bottled recommended outside São Paulo and major cities where tap may be safe but tastes treated.',
    power: 'Type C/N (127V/220V varies by state). Brazil\'s voltage is inconsistent — use dual-voltage devices and check before plugging in.',
  },
  AR: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 90 days. Others: check cancilleria.gob.ar.',
    sim: 'Personal or Claro Argentina SIMs at airports (~ARS varies; eSIM often easier). Airalo eSIM strongly recommended given volatile exchange rates.',
    tipping: '10% is appreciated at restaurants. Not mandatory.',
    water: 'Tap water is safe in Buenos Aires and major cities. Bottled preferred in the provinces.',
    power: 'Type C/I (220V). Argentina uses Type I (Australian-style 3-pin) — unique to South America. Bring a universal adapter.',
  },
  CL: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 90 days. Others: check minrel.gob.cl.',
    sim: 'Entel or Claro Chile SIMs at airports (~CLP 5,000–10,000). Airalo eSIM works.',
    tipping: '10% is standard at restaurants (included as "propina" on the bill — confirm before adding more).',
    water: 'Tap water is safe in Santiago and most cities. Bottled preferred in northern desert regions.',
    power: 'Type C/L (220V). EU and Italian (Type L) plugs work. Universal adapter recommended.',
  },
  PE: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 90–183 days. Others: check rree.gob.pe.',
    sim: 'Claro or Bitel Peru SIMs at airports (~PEN 15–30). Airalo eSIM works but coverage spotty in Andes/jungle.',
    tipping: '10% is appreciated at sit-down restaurants. Not expected at mercados or street food.',
    water: 'Bottled only. Never drink tap water in Peru, including ice — use bottled or purified water throughout.',
    power: 'Type A/C (220V). Bring a universal adapter; sockets vary by building age.',
  },
  CO: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 90–180 days. Others: check cancilleria.gov.co.',
    sim: 'Claro or Movistar Colombia SIMs at airports (~COP 20,000–40,000). Airalo eSIM works.',
    tipping: '10% is included ("propina voluntaria") on restaurant bills — you can decline. Additional optional.',
    water: 'Bottled recommended. Tap water is safe in Bogotá and Medellín but visitors often react; bottled is safer.',
    power: 'Type A/B (110V). US-style plugs fit. Dual-voltage devices are fine.',
  },
  CR: {
    visa: 'EU/US/UK/CA/AU/NZ: visa-free up to 90–180 days. Others: check migracion.go.cr.',
    sim: 'Kolbi or Claro Costa Rica SIMs at airports (~CRC 5,000–10,000). Airalo eSIM works.',
    tipping: '10% included by law as "cargo por servicio". Additional tip optional.',
    water: 'Tap water is safe throughout Costa Rica — one of the few Central American countries where this is true.',
    power: 'Type A/B (120V). US-style plugs fit.',
  },
  CU: {
    visa: 'Tourist card required for most nationalities (~$25 at airport or from airline). US citizens: authorized travel categories only.',
    sim: 'Cubacel SIMs available to tourists (~$1–3/day data). Coverage is basic. Consider downloading offline maps.',
    tipping: 'Tipping is important in Cuba — $1–5 CUC/USD for meals, musicians, housekeeping. Cash only.',
    water: 'Bottled only. Never drink tap water in Cuba.',
    power: 'Type A/B/C mixed (110V/220V). Bring a universal adapter and check voltage before plugging in.',
  },

  // ── Asia ─────────────────────────────────────────────────────────────────
  JP: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: visa-free 90 days (waiver registration from 2025 — check mofa.go.jp for current status).',
    sim: 'IIJmio or b-mobile data SIMs from vending machines at NRT/HND/KIX/CTS (~¥3,000–5,000/2 weeks). Pocket Wi-Fi also popular. Airalo eSIM works.',
    tipping: 'Tipping is considered rude in Japan. Never tip — it creates confusion and embarrassment.',
    water: 'Tap water is safe throughout Japan. Tokyo tap water is excellent quality.',
    power: 'Type A (100V) — Japan runs on 100V. Most modern devices (laptops, phones) are dual-voltage and fine. Older single-voltage devices may be damaged.',
  },
  CN: {
    visa: 'EU/US/UK: 144-hour visa-free transit at major airports. 30-day visa-free for EU/NZ/AU. Others: tourist visa from Chinese embassy. Check mfa.gov.cn.',
    sim: 'China Unicom or China Mobile tourist SIMs at airports (~CNY 50–100). Note: Google/WhatsApp/Instagram blocked — use VPN. Airalo eSIM works but VPN still needed.',
    tipping: 'Not customary in mainland China. Refusing a tip is normal — don\'t be offended.',
    water: 'Never drink tap water in China. Always bottled — available everywhere from ¥2.',
    power: 'Type A/C/I mixed (220V). Universal adapter recommended. Sockets vary by building age.',
  },
  KR: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: visa-free 90 days (K-ETA digital registration required for most — apply at k-eta.go.kr).',
    sim: 'KT or SKT tourist SIMs at Incheon Airport vending machines (~KRW 20,000–40,000/week). Airalo eSIM works well.',
    tipping: 'Not customary in South Korea. Service is included; adding a tip causes awkwardness.',
    water: 'Tap water is safe in Seoul and major cities, though many locals prefer bottled due to taste.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  TH: {
    visa: 'EU/US/UK/CA/AU/NZ + 60+ countries: 60-day visa on arrival free (as of 2024). Others: tourist e-visa at thaievisa.go.th.',
    sim: 'AIS or DTAC tourist SIMs at Suvarnabhumi/DMK airport counters (~THB 299–599 for 7–15 days unlimited data). Best setup before leaving arrivals.',
    tipping: 'Not compulsory. Leave THB 20–50 at sit-down restaurants for good service. Skip at street stalls. Round up taxi meters.',
    water: 'Bottled only. Tap water is unsafe throughout Thailand. Large bottles ~THB 12 at 7-Eleven.',
    power: 'Type A/B/C mixed (220V). US plugs and EU plugs both work in most sockets.',
  },
  VN: {
    visa: 'EU/US/UK/CA/AU/NZ + 45+ countries: 45-day e-visa (apply at evisa.xuatnhapcanh.gov.vn, ~$25, 3 days processing). Visa on arrival also available via approval letter.',
    sim: 'Viettel or Vietnamobile SIMs at airports (~VND 150,000–250,000 for 30 days data). Buy from official counters only to avoid scams.',
    tipping: 'Not a strong local custom but appreciated. VND 20,000–50,000 at restaurants, VND 10,000–20,000 for quick services. Tip tour guides VND 50,000–100,000+.',
    water: 'Bottled only. Never drink tap water in Vietnam, including ice from unknown sources.',
    power: 'Type A/C/F mixed (220V). EU and US plugs both fit in most sockets. Universal adapter ideal.',
  },
  ID: {
    visa: 'EU/US/UK/CA/AU/NZ + 90+ countries: 30-day visa on arrival at major airports (~$35 USD). Bali is easy. Extendable once.',
    sim: 'Telkomsel or XL Axiata tourist SIMs at airports (~IDR 50,000–150,000 for 7–30 days). Register with your passport. Excellent coverage across Bali, Java, Lombok.',
    tipping: '10% service charge included at most hotels/restaurants. Additional tip (IDR 20,000–50,000) appreciated for guides, drivers.',
    water: 'Bottled only. Never drink tap water anywhere in Indonesia.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  MY: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: 90-day visa-free. Others: check imi.gov.my.',
    sim: 'Maxis or Celcom tourist SIMs at KLIA counters (~MYR 30–50 for 7–14 days). Airalo eSIM works.',
    tipping: '10% service charge included at hotels/restaurants. Additional tip optional — 5–10 MYR for guides.',
    water: 'Bottled recommended. KL tap water is technically treated, but visitors often react; bottled safer.',
    power: 'Type G (240V) — UK-style 3-pin plug. Bring a UK adapter.',
  },
  SG: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: 30–90 days visa-free. Others: check ica.gov.sg.',
    sim: 'Singtel, StarHub or M1 tourist SIMs at Changi Airport (~SGD 15–25 for 7 days). Airalo eSIM works. Singapore has excellent coverage.',
    tipping: '10% service charge + 9% GST included at restaurants. No additional tipping needed or expected.',
    water: 'Tap water is safe and excellent quality in Singapore — one of the best in Asia.',
    power: 'Type G (230V) — UK-style 3-pin plug. Bring a UK adapter.',
  },
  PH: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: 30-day visa-free, extendable. Others: check dfa.gov.ph.',
    sim: 'Globe or Smart tourist SIMs at Manila/Cebu airports (~PHP 300–600 for 7–15 days). Buy from official kiosks only.',
    tipping: '10% service charge included at most restaurants. Additional tip of PHP 20–50 appreciated.',
    water: 'Bottled only. Never drink tap water in the Philippines.',
    power: 'Type A/B/C mixed (220V). US and EU plugs both fit in most sockets.',
  },
  IN: {
    visa: 'Most nationalities: e-Visa required (apply at indianvisaonline.gov.in, ~$25–80, 48–72hr processing). Avoid procrastinating — rejections happen.',
    sim: 'Airtel or Jio tourist SIMs — register with passport at major airports (~INR 300–600 for 28 days). Airalo eSIM works but register for calls if needed.',
    tipping: '10–15% at sit-down restaurants if not already included. 10–20 INR for auto-rickshaws. Skip at dhabas and street stalls.',
    water: 'Bottled or purified only. Never drink tap water anywhere in India, including ice.',
    power: 'Type C/D/M mixed (230V). Type D is unique to India — bring a universal adapter.',
  },
  NP: {
    visa: 'Most nationalities: Tourist visa on arrival at Kathmandu Airport (~$30/15 days, $50/30 days, $125/90 days). Also available at nepalimmigration.gov.np.',
    sim: 'Ncell or Nepal Telecom tourist SIMs at airport (~NPR 500–1,000). Coverage in Kathmandu and trekking routes is good; remote areas spotty.',
    tipping: '10% at sit-down restaurants. Tip trekking guides NPR 1,000–2,000+/day; porters NPR 500–800+/day.',
    water: 'Bottled or purified only. Never drink tap water or unbottled water anywhere in Nepal.',
    power: 'Type C/D/M mixed (230V). Bring a universal adapter. Power cuts (load shedding) can occur — especially outside Kathmandu.',
  },
  LK: {
    visa: 'Most nationalities: e-Visa required (apply at eta.gov.lk, $35/30 days). Apply at least 3 days before travel.',
    sim: 'Dialog or Mobitel SIMs at Colombo airport (~LKR 500–1,500 for 7–14 days). Coverage is good on major tourist routes.',
    tipping: '10% at restaurants (check if included). Tip tuk-tuk drivers by rounding up.',
    water: 'Bottled only. Never drink tap water in Sri Lanka.',
    power: 'Type D/G/M (230V). UK-style Type G most common in modern buildings. Bring universal adapter.',
  },
  KG: {
    visa: 'EU/US/UK/CA/AU/NZ + 60+ countries: visa-free 30–60 days. Others: e-Visa at evisa.e-gov.kg (~$30/30 days, 3 working days).',
    sim: 'Beeline or O! Kyrgyzstan SIMs at Manas Airport, Bishkek (~KGS 200–400). Coverage excellent in cities, patchy in mountains.',
    tipping: 'Not a strong custom. Round up at restaurants or leave a small tip (KGS 50–100) for good service.',
    water: 'Bottled recommended. Tap water in Bishkek is treated but visitors often react; bottled preferred.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  KZ: {
    visa: 'EU/US/UK/CA/AU/NZ + many countries: visa-free 30–90 days. Check mfa.kz for current list.',
    sim: 'Kcell or Beeline Kazakhstan SIMs at Almaty/Astana airports (~KZT 2,000–4,000). Good urban coverage.',
    tipping: '10% appreciated at restaurants. Not universal.',
    water: 'Bottled recommended. Tap water in Almaty and Astana is treated but bottled preferred.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  UZ: {
    visa: 'EU/US/UK/CA/AU/NZ + 90+ countries: visa-free 30 days. Others: e-Visa at e-visa.uz (~$20/30 days).',
    sim: 'Ucell or Beeline Uzbekistan SIMs at Tashkent Airport (~UZS 30,000–60,000). Good coverage on main tourist route (Tashkent–Samarkand–Bukhara).',
    tipping: 'Small tips appreciated (UZS 5,000–20,000) but not expected. Bargaining at bazaars is the norm.',
    water: 'Bottled only. Never drink tap water in Uzbekistan.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  GE: {
    visa: 'EU/US/UK/CA/AU/NZ + 90+ countries: visa-free 365 days (!) — one of the most generous visa policies in the world.',
    sim: 'Magti or Geocell SIMs at Tbilisi Airport or phone shops (~GEL 10–20 for 30 days). Excellent urban coverage.',
    tipping: '10% appreciated at restaurants. Not strictly expected.',
    water: 'Tap water is safe in Tbilisi and main cities. Bottled preferred outside cities.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  AM: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: visa-free 180 days. Others: e-Visa at evisa.mfa.am.',
    sim: 'Viva-MTS or Ucom SIMs at Yerevan Airport (~AMD 3,000–5,000). Good coverage in Yerevan and major roads.',
    tipping: '10% appreciated at sit-down restaurants. Not universal.',
    water: 'Tap water is safe in Yerevan — piped from springs. Bottled outside the capital.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  AZ: {
    visa: 'EU/US/UK/CA/AU/NZ + many countries: e-Visa at evisa.gov.az (~$20/30 days, instant approval).',
    sim: 'Azercell or Bakcell SIMs at Baku Airport (~AZN 5–15). Good coverage in Baku and main roads.',
    tipping: '10% appreciated at restaurants. Not always expected.',
    water: 'Bottled recommended. Tap water quality varies across Baku.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  MN: {
    visa: 'EU/US/UK/CA/AU/NZ + 40+ countries: visa-free 30–90 days. Others: check legalinfo.mn.',
    sim: 'Mobicom or Unitel SIMs at Ulaanbaatar Airport (~MNT 10,000–20,000). Coverage in UB is good; almost none in rural steppe.',
    tipping: 'Not customary. Small tip (MNT 2,000–5,000) appreciated at gers and restaurants serving tourists.',
    water: 'Bottled only. Never drink tap or river water in Mongolia.',
    power: 'Type C/E (220V). EU plugs work in cities. Bring a power bank for ger camps — no electricity.',
  },
  AE: {
    visa: 'EU/US/UK/CA/AU/NZ + 50+ countries: 30–90 days visa on arrival free. Others: e-Visa at icp.gov.ae.',
    sim: 'Du or Etisalat (e&) tourist SIMs at Dubai/Abu Dhabi airports (~AED 50–100 for 7–10 days). Excellent coverage. Note: VoIP apps (WhatsApp calls) are restricted.',
    tipping: '10–15% at restaurants (often service included). Round up taxis. AED 5–20 for hotel staff.',
    water: 'Tap water is technically safe but heavily desalinated and tastes mineral-heavy — bottled preferred.',
    power: 'Type G (220V) — UK-style 3-pin plug. Bring a UK adapter.',
  },
  SA: {
    visa: 'EU/US/UK/CA/AU/NZ + 50+ countries: e-Visa or visa on arrival (~SAR 300, valid 90 days). Apply at visa.visitsaudi.com.',
    sim: 'STC or Zain tourist SIMs at King Abdulaziz/King Khalid airports (~SAR 30–80). Good coverage.',
    tipping: '10–15% at restaurants (often service included). Round up taxis.',
    water: 'Bottled preferred. Tap water is treated but heavily desalinated; bottled is much better.',
    power: 'Type G (220V). UK-style plugs widely used.',
  },
  IL: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: 90-day visa-free. Note: Israeli stamps may cause issues entering some Arab countries — ask for a separate paper stamp.',
    sim: 'Cellcom or Hot Mobile tourist SIMs at Ben Gurion Airport (~ILS 50–100 for 7–30 days). Airalo eSIM works.',
    tipping: '10–15% at restaurants. Tipping is common and appreciated.',
    water: 'Tap water is safe throughout Israel — highly filtered and treated.',
    power: 'Type C/H (230V). Type H is unique to Israel. Bring a universal adapter — most places also accept EU Type C.',
  },
  JO: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: Jordan Pass combines e-Visa fee + Petra entry (~JOD 70–80 — buy before arrival). Worth it if visiting Petra.',
    sim: 'Zain or Orange Jordan SIMs at Amman Airport (~JOD 3–8). Good coverage on tourist routes.',
    tipping: '10% at sit-down restaurants. JOD 1–2 for guides and drivers.',
    water: 'Bottled only. Tap water is not safe to drink in Jordan.',
    power: 'Type C/D/G mixed (230V). Bring a universal adapter.',
  },

  // ── Africa ────────────────────────────────────────────────────────────────
  MA: {
    visa: 'EU/US/UK/CA/AU/NZ + 60+ countries: visa-free 90 days. Others: check diplomatie.ma.',
    sim: 'Maroc Telecom or Orange Morocco SIMs at Casablanca/Marrakech airports (~MAD 30–60). Good coverage in cities and between major destinations.',
    tipping: '10% at sit-down restaurants. MAD 10–20 for guides, MAD 5–10 for unofficial helpers (give small amounts). Haggling expected at souks.',
    water: 'Bottled only. Never drink tap water in Morocco.',
    power: 'Type C/E (220V). EU plugs work everywhere.',
  },
  EG: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: e-Visa required (apply at visa2egypt.gov.eg, ~$25/30 days, instant). Also on arrival at Cairo/Hurghada airports.',
    sim: 'Vodafone Egypt or Etisalat Egypt SIMs at Cairo Airport (~EGP 100–300). Register with your passport.',
    tipping: '"Baksheesh" culture — carry small bills (EGP 5–20) for porters, restroom attendants, unofficial guides. 10–15% at restaurants.',
    water: 'Bottled only. Never drink tap water in Egypt.',
    power: 'Type C/F (220V). EU plugs work everywhere.',
  },
  ZA: {
    visa: 'EU/US/UK/CA/AU/NZ + most countries: 90-day visa-free. Others: check dirco.gov.za.',
    sim: 'Vodacom or MTN tourist SIMs at OR Tambo/Cape Town airports (~ZAR 50–100). Airalo eSIM works.',
    tipping: '10–15% at restaurants. ZAR 10–20 for petrol attendants, parking attendants, informal helpers.',
    water: 'Tap water is safe in Cape Town and Johannesburg. Bottled preferred in rural areas.',
    power: 'Type M/N/C (230V). Type M is unique to South Africa — bring a universal adapter.',
  },
  KE: {
    visa: 'Most nationalities: e-Visa required (apply at evisa.go.ke, $51/single entry, 72 hours processing). EAC nationals: visa-free.',
    sim: 'Safaricom (best coverage) or Airtel Kenya SIMs at JKIA Nairobi (~KES 100–500). Register with passport. M-Pesa mobile money widely used.',
    tipping: '10% at restaurants (not always included). KES 200–500 for safari guides/drivers per day.',
    water: 'Bottled only. Never drink tap water in Kenya.',
    power: 'Type G (240V) — UK-style 3-pin plug. Bring a UK adapter.',
  },
  TZ: {
    visa: 'Most nationalities: e-Visa or visa on arrival at Dar es Salaam/Zanzibar airports (~$50/single entry). Apply online at immigration.go.tz.',
    sim: 'Vodacom Tanzania or Airtel Tanzania SIMs at airports (~TZS 5,000–15,000). Good coverage in Zanzibar and Northern Circuit.',
    tipping: '10% at sit-down restaurants. $10–20/day for safari guides; $5–10/day for lodge staff.',
    water: 'Bottled only. Never drink tap water in Tanzania.',
    power: 'Type D/G (230V). UK-style and Indian D-type plugs used. Bring universal adapter.',
  },
  ET: {
    visa: 'Most nationalities: e-Visa required (apply at evisa.et, $52/30 days, 3 days processing). Some African nationalities: visa-free.',
    sim: 'Safaricom Ethiopia or Ethio Telecom SIMs at Addis Ababa airport. Coverage improving but patchy outside cities.',
    tipping: '10% at restaurants. ETB 20–50 for service staff.',
    water: 'Bottled only. Never drink tap water in Ethiopia.',
    power: 'Type C/E/F/L mixed (220V). EU and Italian plugs work in most hotels.',
  },
  NG: {
    visa: 'Most nationalities: e-Visa required (apply at immigration.gov.ng). ECOWAS nationals: visa-free.',
    sim: 'MTN or Airtel Nigeria SIMs at Lagos/Abuja airports (~NGN 2,000–5,000). Good urban coverage.',
    tipping: '10% at restaurants. NGN 500–2,000 for guides and drivers.',
    water: 'Bottled only. Never drink tap water anywhere in Nigeria.',
    power: 'Type D/G (240V). UK-style 3-pin plugs most common. Bring universal adapter.',
  },
  GH: {
    visa: 'EU/US/UK/CA/AU + most: e-Visa required (apply at ghana.embassyapplication.com, ~$60/entry, 3–5 days). ECOWAS nationals: visa-free.',
    sim: 'MTN Ghana or AirtelTigo SIMs at Kotoka Airport (~GHS 30–60). Good urban coverage.',
    tipping: '10% at sit-down restaurants. GHS 10–30 for guides.',
    water: 'Bottled only. Never drink tap water in Ghana.',
    power: 'Type D/G (230V). UK-style and Indian plugs used. Universal adapter recommended.',
  },
  SN: {
    visa: 'EU/US/UK/CA/AU/NZ + most: visa-free 90 days. Others: check diplomatie.gouv.sn.',
    sim: 'Orange Sénégal or Free Sénégal SIMs at Dakar airport (~XOF 2,000–5,000). Register with passport.',
    tipping: '500–1,000 XOF at sit-down restaurants. French tipping norms apply loosely.',
    water: 'Bottled only. Never drink tap water in Senegal.',
    power: 'Type C/E (220V). EU plugs work everywhere.',
  },
  ML: {
    visa: 'EU/US/UK/CA/AU/NZ: e-Visa or visa on arrival. ECOWAS nationals: visa-free. Check current advisories at your government\'s travel warning site.',
    sim: 'Orange Mali or Malitel SIMs in Bamako (~XOF 2,000–5,000). Coverage limited outside cities.',
    tipping: 'Small tips appreciated; 500–1,000 XOF at restaurants.',
    water: 'Bottled only. Never drink tap water in Mali.',
    power: 'Type C/E (220V). EU plugs work.',
  },

  // ── Oceania ────────────────────────────────────────────────────────────────
  AU: {
    visa: 'EU/UK/US/CA/NZ: eVisitor or ETA required (free-$20, apply via Australian ETA app or eta.homeaffairs.gov.au, instant approval). Others: tourist visa.',
    sim: 'Telstra (best rural coverage) or Optus SIMs at Sydney/Melbourne airports (~AUD 30–40 for 28 days). Airalo eSIM works.',
    tipping: 'Not expected. Australians generally don\'t tip; 10% at fine dining is a kind gesture. Service staff are paid living wages.',
    water: 'Tap water is excellent quality throughout Australia.',
    power: 'Type I (230V) — Australia-style 3-pin angled plug. Bring an Australian adapter.',
  },
  NZ: {
    visa: 'EU/UK/US/CA/AU: NZeTA required (NZD 17, apply at immigration.govt.nz, instant). Tourist visa for others.',
    sim: 'Spark or Vodafone NZ SIMs at Auckland/Queenstown airports (~NZD 20–30 for 14–28 days). Airalo eSIM works.',
    tipping: 'Not expected. Service charge not added in NZ; tip only if you genuinely want to.',
    water: 'Tap water is safe throughout New Zealand.',
    power: 'Type I (230V) — same as Australia. Bring an Australian/NZ adapter.',
  },
  FJ: {
    visa: 'EU/US/UK/CA/AU/NZ + many countries: 4-month visa on arrival free. Others: check immigration.gov.fj.',
    sim: 'Vodafone Fiji or Digicel Fiji SIMs at Nadi Airport (~FJD 20–40 for 7 days). Coverage OK on main islands.',
    tipping: 'Not expected in Fijian culture. Saying "Vinaka" (thank you) and being friendly matters more.',
    water: 'Bottled recommended on outer islands. Tap water is generally safe in Suva and Nadi.',
    power: 'Type I (240V) — Australia-style plug. Bring an Australian adapter.',
  },
};

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Look up practical travel info for a country and return a PracticalContext
 * object, or undefined if the country is not in our database.
 */
export function buildPracticalContext(
  countryIso2?: string,
  countryName?: string
): PracticalContext | undefined {
  if (!countryIso2) return undefined;
  const info = PRACTICAL_INFO[countryIso2.toUpperCase()];
  if (!info) return undefined;
  return { countryName: countryName ?? countryIso2, info };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** Format the practical context as a prompt-ready block. */
export function renderPracticalContext(ctx: PracticalContext): string {
  const lines: string[] = [
    `**🧳 BEFORE YOU GO — ${ctx.countryName}:**`,
    `- **Visa:** ${ctx.info.visa}`,
    `- **SIM/eSIM:** ${ctx.info.sim}`,
    `- **Tipping:** ${ctx.info.tipping}`,
    `- **Water:** ${ctx.info.water}`,
    `- **Power:** ${ctx.info.power}`,
    `- Surface this as a "Before you go" section early in the itinerary — don't bury it.`,
  ];
  return lines.join('\n') + '\n';
}
