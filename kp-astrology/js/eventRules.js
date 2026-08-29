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

const EVENT_RULES = {
  // --- Relationships ---
  marriage: { label: 'Marriage', category: 'Relationships', requiredHouses: [2, 7, 11], supportingHouses: [5], opposingHouses: [1, 6, 10] },
  engagement: { label: 'Engagement', category: 'Relationships', requiredHouses: [7, 11], supportingHouses: [2, 5], opposingHouses: [1, 6, 10] },
  relationship_development: { label: 'Relationship Development', category: 'Relationships', requiredHouses: [5, 7], supportingHouses: [11], opposingHouses: [6, 12] },
  separation_divorce: { label: 'Separation / Divorce', category: 'Relationships', requiredHouses: [1, 6, 10], supportingHouses: [12], opposingHouses: [2, 7, 11] },

  // --- Career ---
  job: { label: 'Job', category: 'Career', requiredHouses: [2, 6, 10, 11], supportingHouses: [], opposingHouses: [5, 8, 12] },
  job_change: { label: 'Job Change', category: 'Career', requiredHouses: [3, 6, 10, 11], supportingHouses: [], opposingHouses: [4, 8] },
  promotion: { label: 'Promotion', category: 'Career', requiredHouses: [2, 6, 10, 11], supportingHouses: [], opposingHouses: [5, 8, 12] },
  transfer: { label: 'Transfer', category: 'Career', requiredHouses: [3, 6, 10, 12], supportingHouses: [], opposingHouses: [4] },
  retirement: { label: 'Retirement', category: 'Career', requiredHouses: [10, 12], supportingHouses: [4], opposingHouses: [6] },
  business: { label: 'Business', category: 'Career', requiredHouses: [2, 7, 10, 11], supportingHouses: [], opposingHouses: [6, 8, 12] },

  // --- Finance ---
  financial_gain: { label: 'Financial Gain', category: 'Finance', requiredHouses: [2, 11], supportingHouses: [5, 9], opposingHouses: [6, 8, 12] },
  major_expenditure: { label: 'Major Expenditure', category: 'Finance', requiredHouses: [12], supportingHouses: [8], opposingHouses: [2, 11] },
  investment: { label: 'Investment', category: 'Finance', requiredHouses: [2, 5, 11], supportingHouses: [8], opposingHouses: [12] },
  loan: { label: 'Loan', category: 'Finance', requiredHouses: [6, 11], supportingHouses: [2], opposingHouses: [12] },
  debt_recovery: { label: 'Debt Recovery', category: 'Finance', requiredHouses: [2, 6, 11], supportingHouses: [], opposingHouses: [12] },

  // --- Property ---
  property_purchase: { label: 'Property Purchase', category: 'Property', requiredHouses: [4, 11], supportingHouses: [2], opposingHouses: [8, 12] },
  property_sale: { label: 'Property Sale', category: 'Property', requiredHouses: [4, 11], supportingHouses: [2, 10], opposingHouses: [4] },
  house_construction: { label: 'House Construction', category: 'Property', requiredHouses: [4, 11], supportingHouses: [12], opposingHouses: [8] },
  vehicle_purchase: { label: 'Vehicle Purchase', category: 'Property', requiredHouses: [4, 11], supportingHouses: [3], opposingHouses: [8, 12] },

  // --- Education ---
  education: { label: 'Education', category: 'Education', requiredHouses: [4, 5, 9, 11], supportingHouses: [], opposingHouses: [3, 8, 12] },
  examination: { label: 'Examination', category: 'Education', requiredHouses: [4, 5, 11], supportingHouses: [9], opposingHouses: [8, 12] },
  higher_education: { label: 'Higher Education', category: 'Education', requiredHouses: [5, 9, 11], supportingHouses: [4], opposingHouses: [3, 8, 12] },
  competitive_examination: { label: 'Competitive Examination', category: 'Education', requiredHouses: [5, 9, 11], supportingHouses: [10], opposingHouses: [8, 12] },

  // --- Family ---
  childbirth: { label: 'Childbirth', category: 'Family', requiredHouses: [2, 5, 11], supportingHouses: [9], opposingHouses: [1, 4, 12] },
  marriage_of_child: { label: 'Marriage of Child', category: 'Family', requiredHouses: [2, 5, 11], supportingHouses: [7, 9], opposingHouses: [6, 12] },
  family_event: { label: 'Family Event', category: 'Family', requiredHouses: [2, 4, 11], supportingHouses: [], opposingHouses: [6, 8, 12] },

  // --- Travel ---
  foreign_travel: { label: 'Foreign Travel', category: 'Travel', requiredHouses: [3, 9, 12], supportingHouses: [], opposingHouses: [4] },
  foreign_settlement: { label: 'Foreign Settlement', category: 'Travel', requiredHouses: [4, 9, 12], supportingHouses: [], opposingHouses: [] },
  long_distance_travel: { label: 'Long-Distance Travel', category: 'Travel', requiredHouses: [3, 9, 12], supportingHouses: [], opposingHouses: [4] },

  // --- Legal ---
  litigation: { label: 'Litigation', category: 'Legal', requiredHouses: [6, 7], supportingHouses: [10, 11], opposingHouses: [12] },
  court_result: { label: 'Court Result', category: 'Legal', requiredHouses: [6, 7, 11], supportingHouses: [10], opposingHouses: [8, 12] },
  legal_settlement: { label: 'Legal Settlement', category: 'Legal', requiredHouses: [6, 7, 11], supportingHouses: [], opposingHouses: [8, 12] }
};

const EVENT_CATEGORIES = [...new Set(Object.values(EVENT_RULES).map(e => e.category))];

if (typeof module !== 'undefined') {
  module.exports = { EVENT_RULES, EVENT_CATEGORIES };
}
