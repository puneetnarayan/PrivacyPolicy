// "Profession & Career" tab: KP-style Job vs. Business suitability, a few
// functional signal checks (interview/scheduling, payment risk, foreign/
// offsite potential), and Vastu-style workspace direction guidance — all
// built as a rule set ON TOP of this app's existing chart data (cusps'
// Sub Lords, each planet's own Star/Sub Lord, significators.js's
// reverse-lookup) and existing dasha engine. No new astronomical
// calculation; no existing calculation file modified.
//
// IMPORTANT: the specific house-weighting rules here (which houses count
// as "primary" vs "secondary" for Job vs Business, the interview/payment/
// foreign trigger conditions, the sign->direction mapping) are exactly the
// rule set you specified in your request — not independently sourced from
// a published KP career-analysis text. Flagged here, and in the tab's own
// UI, as ONE specific, documented rule set rather than settled classical
// doctrine, consistent with how every other methodology tab in this app
// (Four-Step, Khullar, Bhaskaran, Naadi) is captioned.

const CAREER_LOGIC_TEXT = [
  ['Profession & Career — Logic and Sequence'],
  [''],
  ['RULE A (Job vs. Business): for the 10th, 6th, and 7th cusp Sub Lords (CSL) — plus each CSL\'s own Star Lord and Sub Lord — the union of all houses they signify (significators.js, reverse-indexed) is scored against two house sets: Job (primary 2,6,10,11; secondary 1,3) and Business (primary 2,7,10,11; secondary 3,9). Each primary-house hit counts double a secondary-house hit. Job% / Business% are that pair of scores normalized to 100%; a gap under 15 points reads as "Hybrid / Freelancing / Contractual" rather than forcing a one-sided call.'],
  ['Career Obstacle houses (5, 8, 12) and the Resignation/Break combination (1, 5, 9 all three present) are tracked the same way, from the same union of houses, and reported separately rather than folded silently into the Job/Business percentages.'],
  ['RULE B (Functional signals): (1) Interview/Scheduling — flagged when the 3rd cusp\'s Sub Lord or its own Star Lord signifies 5, 8, or 12 WITHOUT also signifying 10 or 11. (2) Payment/Cashflow Risk — flagged when the 2nd/11th cusp chain (CSL + its Star/Sub Lord) signifies 5 or 8 without also signifying 2 or 11. (3) Foreign/Offsite Potential — flagged when the 6th/10th cusp chain signifies at least 2 of {9, 12, 3}.'],
  ['RULE C (Workspace direction): the sign on the 10th cusp (falling back to the 2nd, then the 11th, if the 10th\'s sign is unavailable) is mapped by element to a direction — Fire (Aries/Leo/Sagittarius) -> East, Earth (Taurus/Virgo/Capricorn) -> South, Air (Gemini/Libra/Aquarius) -> West, Water (Cancer/Scorpio/Pisces) -> North.'],
  [''],
  ['Caveat: this entire tab is ONE specific, explicitly documented rule set (as specified for this feature) — not independently verified against a published KP career-analysis reference, and not mixed into any other tab\'s (KP Default/Four-Step/Khullar/Bhaskaran/Naadi) own significator logic. Treat it as a structured screening aid, not a certainty.']
];

const CAREER_HOUSE_RULES = {
  job: { primary: [2, 6, 10, 11], secondary: [1, 3] },
  business: { primary: [2, 7, 10, 11], secondary: [3, 9] },
  negative: [5, 8, 12],
  resignationCombo: [1, 5, 9]
};

const SIGN_ELEMENT_DIRECTION = {
  Aries: { element: 'Fire', direction: 'East' }, Leo: { element: 'Fire', direction: 'East' }, Sagittarius: { element: 'Fire', direction: 'East' },
  Taurus: { element: 'Earth', direction: 'South' }, Virgo: { element: 'Earth', direction: 'South' }, Capricorn: { element: 'Earth', direction: 'South' },
  Gemini: { element: 'Air', direction: 'West' }, Libra: { element: 'Air', direction: 'West' }, Aquarius: { element: 'Air', direction: 'West' },
  Cancer: { element: 'Water', direction: 'North' }, Scorpio: { element: 'Water', direction: 'North' }, Pisces: { element: 'Water', direction: 'North' }
};

// Builds one cusp's "CSL chain": the cusp's own Sub Lord, that lord's own
// Star Lord, and that lord's own Sub Lord — plus the union of houses all
// three signify (significators.js's reverse lookup, unchanged).
function careerCuspChain(houseNum, cusps, planets, significators) {
  const cusp = cusps.find(c => Number(c.house) === houseNum);
  if (!cusp) return { house: houseNum, csl: null, cslStarLord: null, cslSubLord: null, chainPlanets: [], houses: [] };

  const csl = cusp.subLord;
  const cslPlanet = findPlanetRecord(planets, csl);
  const cslStarLord = cslPlanet ? cslPlanet.starLord : null;
  const cslSubLord = cslPlanet ? cslPlanet.subLord : null;
  const chainPlanets = [csl, cslStarLord, cslSubLord].filter(Boolean);
  const houses = [...new Set(chainPlanets.flatMap(p => planetSignificatorHouses(significators, p)))].sort((a, b) => a - b);

  return { house: houseNum, csl, cslStarLord, cslSubLord, chainPlanets, houses };
}

function scoreFromHouses(houses, rule) {
  const primaryHits = rule.primary.filter(h => houses.includes(h));
  const secondaryHits = rule.secondary.filter(h => houses.includes(h));
  return { score: primaryHits.length * 2 + secondaryHits.length, primaryHits, secondaryHits };
}

// --- Rule A: Job vs. Business Suitability Engine ---
function analyzeJobVsBusiness(chartData) {
  const { cusps, planets, significators } = chartData;
  const chain10 = careerCuspChain(10, cusps, planets, significators);
  const chain6 = careerCuspChain(6, cusps, planets, significators);
  const chain7 = careerCuspChain(7, cusps, planets, significators);
  const unionHouses = [...new Set([...chain10.houses, ...chain6.houses, ...chain7.houses])].sort((a, b) => a - b);

  const job = scoreFromHouses(unionHouses, CAREER_HOUSE_RULES.job);
  const business = scoreFromHouses(unionHouses, CAREER_HOUSE_RULES.business);
  const negativeHits = CAREER_HOUSE_RULES.negative.filter(h => unionHouses.includes(h));
  const resignationComboHits = CAREER_HOUSE_RULES.resignationCombo.filter(h => unionHouses.includes(h));
  const resignationComboComplete = resignationComboHits.length === CAREER_HOUSE_RULES.resignationCombo.length;
  const obstacleScore = negativeHits.length * 2 + (resignationComboComplete ? 3 : 0);

  const totalJB = job.score + business.score;
  const jobPct = totalJB ? Math.round((job.score / totalJB) * 100) : 50;
  const businessPct = 100 - jobPct;

  let recommendation;
  if (Math.abs(jobPct - businessPct) < 15) recommendation = 'Hybrid / Freelancing / Contractual';
  else if (jobPct > businessPct) recommendation = 'Strongly Suited for Job';
  else recommendation = 'Strongly Suited for Business';

  return {
    chain10, chain6, chain7, unionHouses,
    job, business, negativeHits, resignationComboHits, resignationComboComplete, obstacleScore,
    jobPct, businessPct, recommendation
  };
}

// --- Rule B.1: Interview & Schedule Status (3rd house check) ---
function analyzeInterviewStatus(chartData) {
  const { cusps, planets, significators } = chartData;
  const cusp3 = cusps.find(c => Number(c.house) === 3);
  if (!cusp3) return { flagged: false, houses: [], message: 'Not available — 3rd cusp not found in the currently loaded chart.' };

  const cslPlanet = findPlanetRecord(planets, cusp3.subLord);
  const chainPlanets = [cusp3.subLord, cslPlanet ? cslPlanet.starLord : null].filter(Boolean);
  const houses = [...new Set(chainPlanets.flatMap(p => planetSignificatorHouses(significators, p)))].sort((a, b) => a - b);

  const hasNegative = houses.some(h => [5, 8, 12].includes(h));
  const hasSupport = houses.some(h => [10, 11].includes(h));
  const flagged = hasNegative && !hasSupport;

  return {
    flagged, chainPlanets, houses,
    message: flagged
      ? 'Interview delays or scheduling obstacles likely.'
      : 'No strong indication of interview/scheduling obstacles from this chain.'
  };
}

// --- Rule B.2: Payment & Cashflow Risk (2nd/11th financial script check) ---
function analyzePaymentRisk(chartData) {
  const { cusps, planets, significators } = chartData;
  const chain2 = careerCuspChain(2, cusps, planets, significators);
  const chain11 = careerCuspChain(11, cusps, planets, significators);
  const financeHouses = [...new Set([...chain2.houses, ...chain11.houses])].sort((a, b) => a - b);

  const hasRisk = [5, 8].some(h => financeHouses.includes(h));
  const hasSupport = [2, 11].some(h => financeHouses.includes(h));
  const flagged = hasRisk && !hasSupport;

  return {
    flagged, chain2, chain11, financeHouses,
    message: flagged
      ? 'High risk of delayed or blocked payments. Recommendation: Collect advance payments.'
      : 'No strong indication of payment/cashflow risk from the 2nd/11th chain.'
  };
}

// --- Rule B.3: Foreign / Offsite Opportunities (6th/10th -> 9th/12th/3rd check) ---
function analyzeForeignOpportunity(chartData) {
  const { cusps, planets, significators } = chartData;
  const chain6 = careerCuspChain(6, cusps, planets, significators);
  const chain10 = careerCuspChain(10, cusps, planets, significators);
  const houses = [...new Set([...chain6.houses, ...chain10.houses])].sort((a, b) => a - b);

  const targetHouses = [9, 12, 3];
  const hits = targetHouses.filter(h => houses.includes(h));
  const flagged = hits.length >= 2; // "connects with 9, 12, and 3" read as at least 2 of the 3

  return {
    flagged, hits, houses,
    message: flagged
      ? 'Strong potential for work-from-home, foreign client projects, or overseas transfer.'
      : 'No strong foreign/offsite indication from the 6th/10th chain currently.'
  };
}

// --- Rule C: Workspace Direction Guidance ---
function analyzeWorkspaceDirection(cusps) {
  for (const h of [10, 2, 11]) {
    const cusp = cusps.find(c => Number(c.house) === h);
    if (cusp && cusp.sign && SIGN_ELEMENT_DIRECTION[cusp.sign]) {
      return { house: h, sign: cusp.sign, ...SIGN_ELEMENT_DIRECTION[cusp.sign] };
    }
  }
  return { house: null, sign: null, element: null, direction: null };
}

// --- Top-level: full Career analysis for the currently loaded chart ---
function analyzeCareer(chartData, birthDateTime) {
  const { planets, cusps } = chartData;
  const moonPlanet = findPlanetRecord(planets, 'Moon');
  const moonLon = moonPlanet ? parseFloat(moonPlanet.longitude) : NaN;
  const dashaResult = (!isNaN(moonLon) && birthDateTime) ? computeVimshottariDasha(moonLon, birthDateTime, { levels: 4 }) : null;
  const runningLords = dashaResult ? (findActivePeriod(dashaResult, new Date()) || {}) : {};

  return {
    jobVsBusiness: analyzeJobVsBusiness(chartData),
    interview: analyzeInterviewStatus(chartData),
    paymentRisk: analyzePaymentRisk(chartData),
    foreignOpportunity: analyzeForeignOpportunity(chartData),
    workspaceDirection: analyzeWorkspaceDirection(cusps),
    runningLords,
    dashaAvailable: !!dashaResult
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CAREER_LOGIC_TEXT, CAREER_HOUSE_RULES, SIGN_ELEMENT_DIRECTION,
    careerCuspChain, scoreFromHouses,
    analyzeJobVsBusiness, analyzeInterviewStatus, analyzePaymentRisk, analyzeForeignOpportunity,
    analyzeWorkspaceDirection, analyzeCareer
  };
}
