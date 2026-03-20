import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// ENHANCED AUTO-SUGGEST MAPPING ALGORITHM
// Features: Synonyms, Abbreviations, Levenshtein Distance, Word Stemming
// ============================================================================

/**
 * Synonym dictionary - maps related terms together
 * Each group contains words that mean the same thing
 */
const SYNONYM_GROUPS: string[][] = [
  // Names & Identity
  ["name", "fullname", "title", "label", "identifier"],
  ["sender", "shipper", "consignor", "from", "origin", "source"],
  ["receiver", "recipient", "consignee", "to", "destination", "dest"],
  
  // Address & Location
  ["address", "location", "addr", "place", "street", "fulladdress"],
  ["city", "town", "municipality"],
  ["state", "province", "region"],
  ["country", "nation"],
  ["zip", "zipcode", "postal", "postalcode", "pincode", "pin"],
  
  // Contact
  ["phone", "telephone", "tel", "mobile", "cell", "contact", "number"],
  ["email", "mail", "emailaddress"],
  
  // Shipping & Tracking
  ["shipment", "shipping", "ship", "consignment", "order"],
  ["tracking", "track", "trackingnumber", "trackingid", "awb", "waybill"],
  ["weight", "wt", "mass", "kg", "kilograms", "lbs", "pounds"],
  ["dimensions", "dim", "dims", "size", "measurements", "lxwxh"],
  ["quantity", "qty", "count", "units", "pieces", "pcs"],
  
  // Dates
  ["date", "dt", "datetime", "timestamp"],
  ["shipdate", "shippingdate", "shipped", "dispatchdate", "dispatch"],
  ["delivery", "deliverydate", "eta", "expecteddelivery", "arrival", "duedate"],
  ["created", "createdat", "datecreated", "creationdate"],
  
  // Documents
  ["invoice", "inv", "bill", "receipt"],
  ["document", "doc", "file", "record"],
  ["id", "identifier", "number", "num", "no", "code", "ref", "reference"],
  
  // Money & Amounts
  ["amount", "total", "sum", "value", "price", "cost", "charge"],
  ["insurance", "insured", "insurancevalue", "coverage"],
  ["freight", "freightcharge", "shippingcost", "carriagecharge"],
  
  // Status & Priority
  ["status", "state", "condition"],
  ["priority", "urgency", "level", "importance"],
  
  // Cargo & Package
  ["package", "pkg", "parcel", "cargo", "goods", "item"],
  ["description", "desc", "details", "info", "information"],
  ["hazmat", "hazardous", "dangerous", "dg", "dangerousgoods"],
  ["instructions", "notes", "remarks", "comments", "special"],
];

/**
 * Abbreviation mappings - expands common abbreviations
 */
const ABBREVIATIONS: Record<string, string[]> = {
  "dob": ["date", "of", "birth", "dateofbirth", "birthdate"],
  "eta": ["estimated", "time", "arrival", "expectedarrival", "deliverydate"],
  "etd": ["estimated", "time", "departure", "expecteddelivery"],
  "qty": ["quantity", "count", "units"],
  "amt": ["amount", "total", "value"],
  "addr": ["address", "location"],
  "tel": ["telephone", "phone", "contact"],
  "inv": ["invoice", "bill"],
  "ref": ["reference", "id", "number"],
  "no": ["number", "id"],
  "num": ["number", "id"],
  "wt": ["weight", "mass"],
  "kg": ["kilogram", "weight"],
  "lbs": ["pounds", "weight"],
  "dt": ["date", "datetime"],
  "desc": ["description", "details"],
  "info": ["information", "details"],
  "pcs": ["pieces", "quantity", "units"],
  "pkg": ["package", "parcel"],
  "doc": ["document", "file"],
  "msg": ["message", "note"],
  "src": ["source", "origin", "sender"],
  "dst": ["destination", "receiver", "recipient"],
  "awb": ["airwaybill", "tracking", "waybill"],
  "bol": ["billoflading", "bill", "lading"],
  "lr": ["lorryreceipt", "receipt", "document"],
  "po": ["purchaseorder", "order"],
  "so": ["salesorder", "order"],
  "dn": ["deliverynote", "delivery"],
  "grn": ["goodsreceiptnote", "receipt"],
};

/**
 * Common word stems - maps variations to root form
 */
const STEMS: Record<string, string> = {
  "shipping": "ship",
  "shipped": "ship",
  "shipper": "ship",
  "shipment": "ship",
  "tracking": "track",
  "tracked": "track",
  "tracker": "track",
  "receiving": "receive",
  "received": "receive",
  "receiver": "receive",
  "sending": "send",
  "sender": "send",
  "delivering": "deliver",
  "delivered": "deliver",
  "delivery": "deliver",
  "creating": "create",
  "created": "create",
  "creation": "create",
  "updating": "update",
  "updated": "update",
  "weighing": "weigh",
  "weighted": "weigh",
  "weight": "weigh",
  "packaging": "package",
  "packaged": "package",
  "numbering": "number",
  "numbered": "number",
  "addressing": "address",
  "addressed": "address",
  "invoicing": "invoice",
  "invoiced": "invoice",
  "ordering": "order",
  "ordered": "order",
  "dating": "date",
  "dated": "date",
  "naming": "name",
  "named": "name",
  "pricing": "price",
  "priced": "price",
  "costing": "cost",
  "costed": "cost",
  "charging": "charge",
  "charged": "charge",
  "insuring": "insure",
  "insured": "insure",
  "insurance": "insure",
};

/**
 * Extract all JSON paths from an object
 */
export function extractJsonPaths(obj: unknown, prefix = "$"): string[] {
  const paths: string[] = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const key in obj as Record<string, unknown>) {
      const path = `${prefix}.${key}`;
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        paths.push(...extractJsonPaths(value, path));
      } else {
        paths.push(path);
      }
    }
  }
  return paths;
}

/**
 * Normalize a string for comparison (lowercase, remove separators)
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[_\-.\s()]/g, "");
}

/**
 * Tokenize a string into words
 */
function tokenize(str: string): string[] {
  // Split on separators and camelCase
  return str
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\-.\s()]+/)
    .filter(t => t.length > 0);
}

/**
 * Get the stem of a word
 */
function stem(word: string): string {
  const lower = word.toLowerCase();
  return STEMS[lower] || lower;
}

/**
 * Expand abbreviations to possible meanings
 */
function expandAbbreviation(word: string): string[] {
  const lower = word.toLowerCase();
  return ABBREVIATIONS[lower] || [lower];
}

/**
 * Find all synonyms for a word
 */
function getSynonyms(word: string): string[] {
  const lower = word.toLowerCase();
  const synonyms = new Set<string>([lower]);
  
  // Add abbreviation expansions
  expandAbbreviation(lower).forEach(exp => synonyms.add(exp));
  
  // Add stem
  synonyms.add(stem(lower));
  
  // Find synonym group
  for (const group of SYNONYM_GROUPS) {
    if (group.some(w => w === lower || w === stem(lower))) {
      group.forEach(w => synonyms.add(w));
    }
  }
  
  return Array.from(synonyms);
}

/**
 * Levenshtein distance - measures string similarity with typo tolerance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Quick checks
  if (m === 0) return n;
  if (n === 0) return m;
  if (str1 === str2) return 0;
  
  // Create distance matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate Levenshtein similarity (0-1)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate similarity score between a field and a JSON path
 * Uses synonyms, abbreviations, stemming, and Levenshtein distance
 */
function calculateSimilarity(fieldName: string, jsonPath: string): number {
  const normalizedField = normalize(fieldName);
  const fieldTokens = tokenize(fieldName);
  
  // Extract path segments
  const pathSegments = jsonPath.split(".");
  const lastSegment = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : "";
  
  const lastNormalized = normalize(lastSegment);
  const parentNormalized = normalize(parentSegment);
  const combinedPath = parentNormalized + lastNormalized;
  const pathTokens = tokenize(lastSegment);
  const allPathTokens = [...tokenize(parentSegment), ...pathTokens];
  
  let score = 0;
  
  // 1. EXACT MATCH (highest priority)
  if (normalizedField === lastNormalized) {
    return 1.0;
  }
  if (normalizedField === combinedPath) {
    return 0.98;
  }
  
  // 2. SYNONYM MATCH
  const fieldSynonyms = new Set(fieldTokens.flatMap(getSynonyms));
  const pathSynonyms = new Set(allPathTokens.flatMap(getSynonyms));
  
  // Check for synonym overlap
  const synonymOverlap = [...fieldSynonyms].filter(s => pathSynonyms.has(s));
  if (synonymOverlap.length > 0) {
    const overlapRatio = synonymOverlap.length / Math.max(fieldTokens.length, allPathTokens.length);
    score = Math.max(score, 0.7 + (0.25 * overlapRatio));
  }
  
  // 3. STEMMED MATCH
  const fieldStems = new Set(fieldTokens.map(stem));
  const pathStems = new Set(allPathTokens.map(stem));
  const stemOverlap = [...fieldStems].filter(s => pathStems.has(s));
  if (stemOverlap.length > 0) {
    const overlapRatio = stemOverlap.length / Math.max(fieldTokens.length, allPathTokens.length);
    score = Math.max(score, 0.65 + (0.25 * overlapRatio));
  }
  
  // 4. SUBSTRING MATCH
  if (normalizedField.includes(lastNormalized) || lastNormalized.includes(normalizedField)) {
    score = Math.max(score, 0.75);
  }
  if (normalizedField.includes(combinedPath) || combinedPath.includes(normalizedField)) {
    score = Math.max(score, 0.7);
  }
  
  // 5. LEVENSHTEIN SIMILARITY (typo tolerance)
  const levSimilarity = levenshteinSimilarity(normalizedField, lastNormalized);
  if (levSimilarity > 0.7) {
    score = Math.max(score, levSimilarity * 0.9);
  }
  
  // Also check Levenshtein against combined path
  const levCombined = levenshteinSimilarity(normalizedField, combinedPath);
  if (levCombined > 0.7) {
    score = Math.max(score, levCombined * 0.85);
  }
  
  // 6. TOKEN OVERLAP (fallback)
  if (score < 0.5) {
    const directOverlap = fieldTokens.filter(t => 
      allPathTokens.some(p => p.includes(t) || t.includes(p))
    );
    if (directOverlap.length > 0) {
      score = Math.max(score, 0.4 + (0.2 * directOverlap.length / fieldTokens.length));
    }
  }
  
  return score;
}

/**
 * Auto-suggest mappings by matching field names to JSON paths
 * Uses enhanced algorithm with synonyms, abbreviations, stemming, and Levenshtein distance
 * Returns a map of fieldId -> best matching jsonPath
 */
export function autoSuggestMappings(
  fields: { id: string; name: string }[],
  ocrOutput: unknown
): Record<string, string> {
  const jsonPaths = extractJsonPaths(ocrOutput);
  const suggestions: Record<string, string> = {};
  const usedPaths = new Set<string>(); // Prevent duplicate assignments
  
  // Score all field-path combinations
  const allScores: { fieldId: string; path: string; score: number }[] = [];
  
  for (const field of fields) {
    for (const path of jsonPaths) {
      const scoreById = calculateSimilarity(field.id, path);
      const scoreByName = calculateSimilarity(field.name, path);
      const maxScore = Math.max(scoreById, scoreByName);
      
      if (maxScore >= 0.45) {
        allScores.push({ fieldId: field.id, path, score: maxScore });
      }
    }
  }
  
  // Sort by score descending and assign greedily (best matches first)
  allScores.sort((a, b) => b.score - a.score);
  
  const assignedFields = new Set<string>();
  
  for (const { fieldId, path, score } of allScores) {
    if (!assignedFields.has(fieldId) && !usedPaths.has(path)) {
      suggestions[fieldId] = path;
      assignedFields.add(fieldId);
      usedPaths.add(path);
    }
  }
  
  return suggestions;
}
