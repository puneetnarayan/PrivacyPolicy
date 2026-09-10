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
  ['RULE C (Workspace direction — a SECONDARY / OPTIONAL alignment factor, not a primary career indicator): the sign on the 10th cusp (falling back to the 2nd, then the 11th, if the 10th\'s sign is unavailable) is mapped by element to a direction — Fire (Aries/Leo/Sagittarius) -> East, Earth (Taurus/Virgo/Capricorn) -> South, Air (Gemini/Libra/Aquarius) -> West, Water (Cancer/Scorpio/Pisces) -> North.'],
  ['RULE D (Dynamic Dasha/Bhukti overlay): the static Job/Business scores above are recombined with an Active Period Score computed the SAME way (same scoreFromHouses, same job/business house sets) but from the "script" (the lord itself + its own Star Lord + its own Sub Lord) of the CURRENT Mahadasha (Dasha) and Antardasha (Bhukti) lords (dasha.js\'s findActivePeriod, unchanged) — Final Score = 0.4×Static + 0.4×Bhukti + 0.2×Dasha, per side (Job, Business). Two specific period-conflict alerts are checked: static heavily favoring Business (≥20-point gap) while the Bhukti lord\'s script strongly signifies Career Obstacle houses (2 or more of 5/8/12); and static heavily favoring Job (≥20-point gap) while the Bhukti lord\'s script strongly signifies the Resignation/Break combination houses (2 or more of 1/5/9).'],
  ['RULE E (Hybrid career spectrum): the SAME combined house union from Rule A is additionally scored against four overlapping house patterns — Corporate/Employment (6,10,11, with 7 absent), Independent Business (7,10,11, with 6 absent), Freelancing/Consulting (6, 7, AND 3 all present), Equity/Partnership (7, 8, 11) — shown as a 4-way percentage spectrum (not mutually exclusive weights, since real careers often blend these) plus a single best-fit classification checked in that priority order.'],
  ['RULE F (Confidence & Caution scoring): every insight above starts at 100% confidence, then loses points for: (1) −25% if any of that insight\'s own Sub Lord(s) signifies BOTH a supporting house (2,6,10,11) AND an obstacle house (5,8,12) at once; (2) −15% if that Sub Lord\'s own house placement itself has no strong primary career signification; (3) −20%, for the Job/Business insight only, if the static reading and the active Bhukti lord\'s own leaning point opposite ways. Below 65% (or any deduction at all), the insight is shown in a distinct Caution/Hazy block instead of (or alongside) its normal card, with the specific reason and a practical mitigation step — never silently smoothed over.'],
  [''],
  ['Caveat: this entire tab is ONE specific, explicitly documented rule set (as specified for this feature) — not independently verified against a published KP career-analysis reference, and not mixed into any other tab\'s (KP Default/Four-Step/Khullar/Bhaskaran/Naadi) own significator logic. Treat it as a structured screening aid, not a certainty. All percentages are rounded to the nearest 5.']
];

const CAREER_HYBRID_HOUSES = {
  corporate: [6, 10, 11],
  enterprise: [7, 10, 11],
  freelance: [6, 7, 3],
  equity: [7, 8, 11]
};

const CAREER_HYBRID_LABELS = {
  corporate: 'Corporate Job / Employment',
  enterprise: 'Independent Business / Enterprise',
  freelance: 'Freelancing / Consulting / Gig Economy',
  equity: 'Equity / Partnership / Joint Venture'
};

// Rounds to the nearest multiple of 5, per the requested scoring convention.
function round5(x) {
  return Math.round(x / 5) * 5;
}

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
  const jobPct = totalJB ? round5((job.score / totalJB) * 100) : 50;
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
    flagged, hits, houses, chain6, chain10,
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

// --- Rule D: Dynamic Dasha/Bhukti Timing Overlay ---
// "Script" of a period lord = itself + its own Star Lord + its own Sub
// Lord — scored against the SAME job/business house sets as the static
// CSL chains, via the same scoreFromHouses().
function periodLordScript(lordName, planets) {
  if (!lordName) return [];
  const lordPlanet = findPlanetRecord(planets, lordName);
  return [lordName, lordPlanet ? lordPlanet.starLord : null, lordPlanet ? lordPlanet.subLord : null].filter(Boolean);
}
function scriptHouses(scriptPlanets, significators) {
  return [...new Set(scriptPlanets.flatMap(p => planetSignificatorHouses(significators, p)))].sort((a, b) => a - b);
}

function analyzeDashaBhuktiOverlay(chartData, runningLords) {
  const { planets, significators } = chartData;
  const dashaLord = (runningLords && runningLords.mahadasha) || null;
  const bhuktiLord = (runningLords && runningLords.antardasha) || null;
  const available = !!(dashaLord && bhuktiLord);

  const dashaScript = periodLordScript(dashaLord, planets);
  const bhuktiScript = periodLordScript(bhuktiLord, planets);
  const dashaHouses = scriptHouses(dashaScript, significators);
  const bhuktiHouses = scriptHouses(bhuktiScript, significators);

  return {
    available, dashaLord, bhuktiLord, dashaScript, bhuktiScript, dashaHouses, bhuktiHouses,
    jobDasha: scoreFromHouses(dashaHouses, CAREER_HOUSE_RULES.job),
    businessDasha: scoreFromHouses(dashaHouses, CAREER_HOUSE_RULES.business),
    jobBhukti: scoreFromHouses(bhuktiHouses, CAREER_HOUSE_RULES.job),
    businessBhukti: scoreFromHouses(bhuktiHouses, CAREER_HOUSE_RULES.business)
  };
}

// Final Career Score = 0.4×Static + 0.4×Bhukti + 0.2×Dasha, computed
// separately for the Job side and the Business side, then re-normalized
// into a percentage exactly like the static-only calculation did.
function computeFinalCareerScore(jb, overlay) {
  if (!overlay.available) {
    return {
      usedOverlay: false,
      finalJobScore: jb.job.score, finalBusinessScore: jb.business.score,
      finalJobPct: jb.jobPct, finalBusinessPct: jb.businessPct, finalRecommendation: jb.recommendation
    };
  }
  const finalJobScore = 0.4 * jb.job.score + 0.4 * overlay.jobBhukti.score + 0.2 * overlay.jobDasha.score;
  const finalBusinessScore = 0.4 * jb.business.score + 0.4 * overlay.businessBhukti.score + 0.2 * overlay.businessDasha.score;
  const totalFinal = finalJobScore + finalBusinessScore;
  const finalJobPct = totalFinal ? round5((finalJobScore / totalFinal) * 100) : 50;
  const finalBusinessPct = 100 - finalJobPct;

  let finalRecommendation;
  if (Math.abs(finalJobPct - finalBusinessPct) < 15) finalRecommendation = 'Hybrid / Freelancing / Contractual';
  else if (finalJobPct > finalBusinessPct) finalRecommendation = 'Strongly Suited for Job';
  else finalRecommendation = 'Strongly Suited for Business';

  return { usedOverlay: true, finalJobScore, finalBusinessScore, finalJobPct, finalBusinessPct, finalRecommendation };
}

// Active Period Impact Alerts — the two specific period-conflict triggers
// from the spec, each checked independently (both, one, or neither may fire).
function checkPeriodStatusWarnings(jb, overlay) {
  const warnings = [];
  if (!overlay.available) return warnings;

  const staticFavorsBusiness = jb.businessPct - jb.jobPct >= 20; // "heavily favors" — documented threshold
  const staticFavorsJob = jb.jobPct - jb.businessPct >= 20;
  const bhuktiObstacleHits = CAREER_HOUSE_RULES.negative.filter(h => overlay.bhuktiHouses.includes(h));
  const bhuktiBreakHits = CAREER_HOUSE_RULES.resignationCombo.filter(h => overlay.bhuktiHouses.includes(h));

  if (staticFavorsBusiness && bhuktiObstacleHits.length >= 2) {
    warnings.push({
      type: 'business-risk', evidence: bhuktiObstacleHits,
      message: 'Strong native business potential, but current period indicates high operational risk/financial stress. Avoid major expansions right now.'
    });
  }
  if (staticFavorsJob && bhuktiBreakHits.length >= 2) {
    warnings.push({
      type: 'job-break', evidence: bhuktiBreakHits,
      message: 'High probability of career break, resignation, or job transition during this active period.'
    });
  }
  return warnings;
}

// --- Rule E: Modern Blended & Hybrid Career Scenarios ---
// Same combined house union Rule A already computed, scored against four
// overlapping patterns instead of a single Job/Business binary. Percentages
// are proportional shares of the four raw activation counts (rounded to
// the nearest 5, with rounding drift corrected on the largest bucket so
// the four always sum to exactly 100).
function analyzeHybridSpectrum(unionHouses) {
  const has = h => unionHouses.includes(h);
  const raw = {};
  Object.keys(CAREER_HYBRID_HOUSES).forEach(key => {
    raw[key] = CAREER_HYBRID_HOUSES[key].filter(has).length;
  });
  const total = Object.values(raw).reduce((a, b) => a + b, 0);

  const percentages = {};
  Object.keys(raw).forEach(key => { percentages[key] = round5(total ? (raw[key] / total) * 100 : 25); });
  const roundedTotal = Object.values(percentages).reduce((a, b) => a + b, 0);
  if (roundedTotal !== 100) {
    const largestKey = Object.keys(percentages).reduce((a, b) => (percentages[a] >= percentages[b] ? a : b));
    percentages[largestKey] += (100 - roundedTotal);
  }

  // Strict pattern classification, most-specific dual/triple-signal
  // patterns checked first; falls back to whichever raw bucket scored
  // highest if no pattern cleanly matches (never left unclassified).
  let classification;
  if (has(6) && has(7) && has(3)) classification = CAREER_HYBRID_LABELS.freelance;
  else if (has(7) && has(8) && has(11)) classification = CAREER_HYBRID_LABELS.equity;
  else if (has(6) && has(10) && has(11) && !has(7)) classification = CAREER_HYBRID_LABELS.corporate;
  else if (has(7) && has(10) && has(11) && !has(6)) classification = CAREER_HYBRID_LABELS.enterprise;
  else {
    const topKey = Object.keys(raw).reduce((a, b) => (raw[a] >= raw[b] ? a : b));
    classification = raw[topKey] > 0
      ? `${CAREER_HYBRID_LABELS[topKey]} (closest fit — no pattern fully matched)`
      : 'Hybrid / Mixed Career Path (no strong pattern in the current chain)';
  }

  return { raw, percentages, classification };
}

// --- Rule F: Confidence & Caution Scoring ---
// subLordPlanets: the specific Sub Lord planet name(s) THIS insight is
// directly built from (e.g. a cusp's own Sub Lord) — "at the Sub Lord
// level" per the spec. opts.periodMismatch (Job/Business insight only)
// adds the third deduction rule.
function evaluateConfidence(featureName, subLordPlanets, chartData, opts) {
  const { planets, significators } = chartData;
  opts = opts || {};
  let confidence = 100;
  const reasons = [];

  [...new Set(subLordPlanets.filter(Boolean))].forEach(subLord => {
    const houses = planetSignificatorHouses(significators, subLord);
    const positiveHits = houses.filter(h => [2, 6, 10, 11].includes(h));
    const negativeHits = houses.filter(h => [5, 8, 12].includes(h));
    if (positiveHits.length && negativeHits.length) {
      confidence -= 25;
      reasons.push(`${abbr(subLord)} signifies both a supporting house (${houseListText(positiveHits)}) and an obstacle house (${houseListText(negativeHits)}) at the Sub Lord level — conflicting signals.`);
    }
    const subLordPlanetRecord = findPlanetRecord(planets, subLord);
    const ownHouse = subLordPlanetRecord ? Number(subLordPlanetRecord.house) : null;
    if (ownHouse && ![2, 6, 7, 10, 11].includes(ownHouse)) {
      confidence -= 15;
      reasons.push(`${abbr(subLord)} is posited in house ${ownHouse}, which carries no strong primary career signification — a neutral/weak placement.`);
    }
  });

  if (opts.periodMismatch) {
    confidence -= 20;
    reasons.push(opts.periodMismatchReason || 'The static Cusp Sub Lord reading and the active Bhukti lord\'s own leaning point in opposite directions.');
  }

  confidence = Math.max(0, round5(confidence));
  const flagged = confidence < 65 || reasons.length > 0;
  const badge = !flagged ? null
    : opts.periodMismatch ? 'Caution: Period Conflict'
    : 'Low Confidence / Mixed Signals';

  return { featureName, confidence, reasons, flagged, badge };
}

// --- Top-level: full Career analysis for the currently loaded chart ---
function analyzeCareer(chartData, birthDateTime) {
  const { planets, cusps, significators } = chartData;
  const moonPlanet = findPlanetRecord(planets, 'Moon');
  const moonLon = moonPlanet ? parseFloat(moonPlanet.longitude) : NaN;
  const dashaResult = (!isNaN(moonLon) && birthDateTime) ? computeVimshottariDasha(moonLon, birthDateTime, { levels: 4 }) : null;
  const runningLords = dashaResult ? (findActivePeriod(dashaResult, new Date()) || {}) : {};

  const jobVsBusiness = analyzeJobVsBusiness(chartData);
  const interview = analyzeInterviewStatus(chartData);
  const paymentRisk = analyzePaymentRisk(chartData);
  const foreignOpportunity = analyzeForeignOpportunity(chartData);
  const workspaceDirection = analyzeWorkspaceDirection(cusps);

  const dashaBhuktiOverlay = analyzeDashaBhuktiOverlay(chartData, runningLords);
  const finalScore = computeFinalCareerScore(jobVsBusiness, dashaBhuktiOverlay);
  const periodWarnings = checkPeriodStatusWarnings(jobVsBusiness, dashaBhuktiOverlay);
  const hybridSpectrum = analyzeHybridSpectrum(jobVsBusiness.unionHouses);

  // Period-mismatch check for the Job/Business confidence rating: does the
  // static reading's leaning agree with the active Bhukti lord's own?
  const staticLeansJob = jobVsBusiness.jobPct >= jobVsBusiness.businessPct;
  const bhuktiLeansJob = dashaBhuktiOverlay.available
    ? dashaBhuktiOverlay.jobBhukti.score >= dashaBhuktiOverlay.businessBhukti.score
    : staticLeansJob;
  const periodMismatch = dashaBhuktiOverlay.available && staticLeansJob !== bhuktiLeansJob;

  const confidence = {
    jobVsBusiness: evaluateConfidence('Job vs. Business Classification',
      [jobVsBusiness.chain10.cslSubLord, jobVsBusiness.chain6.cslSubLord, jobVsBusiness.chain7.cslSubLord],
      chartData, { periodMismatch, periodMismatchReason: `Static reading leans ${staticLeansJob ? 'Job' : 'Business'}, but the active Bhukti lord's (${abbr(dashaBhuktiOverlay.bhuktiLord)}) own script leans ${bhuktiLeansJob ? 'Job' : 'Business'}.` }),
    interview: evaluateConfidence('Interview Success Projection', interview.chainPlanets.slice(0, 1), chartData, {}),
    paymentRisk: evaluateConfidence('Payment & Cashflow Risk', [paymentRisk.chain2.cslSubLord, paymentRisk.chain11.cslSubLord], chartData, {}),
    foreignOpportunity: evaluateConfidence('Foreign / Offsite Opportunity', [foreignOpportunity.chain6.cslSubLord, foreignOpportunity.chain10.cslSubLord], chartData, {}),
    workspaceDirection: workspaceDirection.house
      ? evaluateConfidence('Workspace Vastu Direction', [(cusps.find(c => Number(c.house) === workspaceDirection.house) || {}).subLord], chartData, {})
      : { featureName: 'Workspace Vastu Direction', confidence: 0, reasons: ['No 10th/2nd/11th cusp sign available in the currently loaded chart.'], flagged: true, badge: 'Low Confidence / Mixed Signals' }
  };

  return {
    jobVsBusiness, interview, paymentRisk, foreignOpportunity, workspaceDirection,
    dashaBhuktiOverlay, finalScore, periodWarnings, hybridSpectrum, confidence,
    runningLords, dashaAvailable: !!dashaResult
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CAREER_LOGIC_TEXT, CAREER_HOUSE_RULES, CAREER_HYBRID_HOUSES, CAREER_HYBRID_LABELS, SIGN_ELEMENT_DIRECTION,
    round5, careerCuspChain, scoreFromHouses,
    analyzeJobVsBusiness, analyzeInterviewStatus, analyzePaymentRisk, analyzeForeignOpportunity,
    analyzeWorkspaceDirection, analyzeDashaBhuktiOverlay, computeFinalCareerScore, checkPeriodStatusWarnings,
    analyzeHybridSpectrum, evaluateConfidence, analyzeCareer
  };
}
