// Configurable event definitions for the Event Timing & Fructification
// Engine. This is deliberately plain, JSON-serializable data — not code —
// so it can later be edited, exported, or moved into a JSON file/database
// without touching program logic. Nothing here is hardcoded into the UI or
// the scoring engine; both just read this table.
//
// Each event: { label, category, requiredHouses, supportingHouses,
//               opposingHouses } — houses are 1-12, per the same KP house
// numbering used throughout this app (significators.js, lifePromise.js).
// These are starting/default rule sets, consistent with standard KP house
// groupings already used elsewhere in this app (see lifePromise.js's
// LIFE_TOPICS) — edit freely; nothing else in the app depends on the exact
// values here.

// topicCuspHouse: added for Horary Prediction (horaryEngine.js) — the single
// "topic cusp" whose SUB LORD is checked for connection to requiredHouses,
// per standard KP horary practice (e.g. 7th cusp sub lord for a business/
// partnership query). These are this app's proposed KP defaults, one per
// event — reasonable starting points, not the only valid convention; edit
// freely if your own practice uses a different topic cusp for a given event.
const EVENT_RULES = {
  // --- Relationships ---
  marriage: { label: 'Marriage', category: 'Relationships', requiredHouses: [2, 7, 11], supportingHouses: [5], opposingHouses: [1, 6, 10], topicCuspHouse: 7 },
  engagement: { label: 'Engagement', category: 'Relationships', requiredHouses: [7, 11], supportingHouses: [2, 5], opposingHouses: [1, 6, 10], topicCuspHouse: 7 },
  relationship_development: { label: 'Relationship Development', category: 'Relationships', requiredHouses: [5, 7], supportingHouses: [11], opposingHouses: [6, 12], topicCuspHouse: 7 },
  separation_divorce: { label: 'Separation / Divorce', category: 'Relationships', requiredHouses: [1, 6, 10], supportingHouses: [12], opposingHouses: [2, 7, 11], topicCuspHouse: 6 },

  // --- Career ---
  job: { label: 'Job', category: 'Career', requiredHouses: [2, 6, 10, 11], supportingHouses: [], opposingHouses: [5, 8, 12], topicCuspHouse: 6 },
  job_change: { label: 'Job Change', category: 'Career', requiredHouses: [3, 6, 10, 11], supportingHouses: [], opposingHouses: [4, 8], topicCuspHouse: 6 },
  promotion: { label: 'Promotion', category: 'Career', requiredHouses: [2, 6, 10, 11], supportingHouses: [], opposingHouses: [5, 8, 12], topicCuspHouse: 10 },
  transfer: { label: 'Transfer', category: 'Career', requiredHouses: [3, 6, 10, 12], supportingHouses: [], opposingHouses: [4], topicCuspHouse: 3 },
  retirement: { label: 'Retirement', category: 'Career', requiredHouses: [10, 12], supportingHouses: [4], opposingHouses: [6], topicCuspHouse: 10 },
  business: { label: 'Business', category: 'Career', requiredHouses: [2, 7, 10, 11], supportingHouses: [], opposingHouses: [6, 8, 12], topicCuspHouse: 7 },

  // --- Finance ---
  financial_gain: { label: 'Financial Gain', category: 'Finance', requiredHouses: [2, 11], supportingHouses: [5, 9], opposingHouses: [6, 8, 12], topicCuspHouse: 11 },
  major_expenditure: { label: 'Major Expenditure', category: 'Finance', requiredHouses: [12], supportingHouses: [8], opposingHouses: [2, 11], topicCuspHouse: 12 },
  investment: { label: 'Investment', category: 'Finance', requiredHouses: [2, 5, 11], supportingHouses: [8], opposingHouses: [12], topicCuspHouse: 5 },
  loan: { label: 'Loan', category: 'Finance', requiredHouses: [6, 11], supportingHouses: [2], opposingHouses: [12], topicCuspHouse: 6 },
  debt_recovery: { label: 'Debt Recovery', category: 'Finance', requiredHouses: [2, 6, 11], supportingHouses: [], opposingHouses: [12], topicCuspHouse: 6 },

  // --- Property ---
  property_purchase: { label: 'Property Purchase', category: 'Property', requiredHouses: [4, 11], supportingHouses: [2], opposingHouses: [8, 12], topicCuspHouse: 4 },
  property_sale: { label: 'Property Sale', category: 'Property', requiredHouses: [4, 11], supportingHouses: [2, 10], opposingHouses: [4], topicCuspHouse: 4 },
  house_construction: { label: 'House Construction', category: 'Property', requiredHouses: [4, 11], supportingHouses: [12], opposingHouses: [8], topicCuspHouse: 4 },
  vehicle_purchase: { label: 'Vehicle Purchase', category: 'Property', requiredHouses: [4, 11], supportingHouses: [3], opposingHouses: [8, 12], topicCuspHouse: 4 },

  // --- Education ---
  education: { label: 'Education', category: 'Education', requiredHouses: [4, 5, 9, 11], supportingHouses: [], opposingHouses: [3, 8, 12], topicCuspHouse: 4 },
  examination: { label: 'Examination', category: 'Education', requiredHouses: [4, 5, 11], supportingHouses: [9], opposingHouses: [8, 12], topicCuspHouse: 4 },
  higher_education: { label: 'Higher Education', category: 'Education', requiredHouses: [5, 9, 11], supportingHouses: [4], opposingHouses: [3, 8, 12], topicCuspHouse: 9 },
  competitive_examination: { label: 'Competitive Examination', category: 'Education', requiredHouses: [5, 9, 11], supportingHouses: [10], opposingHouses: [8, 12], topicCuspHouse: 9 },

  // --- Family ---
  childbirth: { label: 'Childbirth', category: 'Family', requiredHouses: [2, 5, 11], supportingHouses: [9], opposingHouses: [1, 4, 12], topicCuspHouse: 5 },
  marriage_of_child: { label: 'Marriage of Child', category: 'Family', requiredHouses: [2, 5, 11], supportingHouses: [7, 9], opposingHouses: [6, 12], topicCuspHouse: 5 },
  family_event: { label: 'Family Event', category: 'Family', requiredHouses: [2, 4, 11], supportingHouses: [], opposingHouses: [6, 8, 12], topicCuspHouse: 4 },

  // --- Travel ---
  foreign_travel: { label: 'Foreign Travel', category: 'Travel', requiredHouses: [3, 9, 12], supportingHouses: [], opposingHouses: [4], topicCuspHouse: 12 },
  foreign_settlement: { label: 'Foreign Settlement', category: 'Travel', requiredHouses: [4, 9, 12], supportingHouses: [], opposingHouses: [], topicCuspHouse: 12 },
  long_distance_travel: { label: 'Long-Distance Travel', category: 'Travel', requiredHouses: [3, 9, 12], supportingHouses: [], opposingHouses: [4], topicCuspHouse: 3 },

  // --- Legal ---
  litigation: { label: 'Litigation', category: 'Legal', requiredHouses: [6, 7], supportingHouses: [10, 11], opposingHouses: [12], topicCuspHouse: 6 },
  court_result: { label: 'Court Result', category: 'Legal', requiredHouses: [6, 7, 11], supportingHouses: [10], opposingHouses: [8, 12], topicCuspHouse: 6 },
  legal_settlement: { label: 'Legal Settlement', category: 'Legal', requiredHouses: [6, 7, 11], supportingHouses: [], opposingHouses: [8, 12], topicCuspHouse: 6 }
};

const EVENT_CATEGORIES = [...new Set(Object.values(EVENT_RULES).map(e => e.category))];

if (typeof module !== 'undefined') {
  module.exports = { EVENT_RULES, EVENT_CATEGORIES };
}
