import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const EPODS_ROOT = path.join(ROOT, 'EPODs');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'epodExtractedShipments.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'epod-extracted-data-report.md');

const CITY_TOKENS = [
  'AMRITSAR',
  'AURANGABAD',
  'MUMBAI',
  'BHIWANDI',
  'LUDHIANA',
  'JAIPUR',
  'BENGALURU',
  'BANGALORE',
  'SECUNDERABAD',
  'HYDERABAD',
  'DELHI',
  'NEW DELHI',
  'PUNE',
  'CHENNAI',
  'KOLKATA',
  'AHMEDABAD',
  'SURAT',
  'NAGPUR',
  'INDORE',
  'PATNA',
  'RANCHI',
  'GUWAHATI',
  'KANPUR',
  'LUCKNOW',
];

const STATE_BY_CITY = {
  AMRITSAR: 'Punjab',
  AURANGABAD: 'Maharashtra',
  MUMBAI: 'Maharashtra',
  BHIWANDI: 'Maharashtra',
  LUDHIANA: 'Punjab',
  JAIPUR: 'Rajasthan',
  BENGALURU: 'Karnataka',
  BANGALORE: 'Karnataka',
  SECUNDERABAD: 'Telangana',
  HYDERABAD: 'Telangana',
  DELHI: 'Delhi',
  'NEW DELHI': 'Delhi',
  PUNE: 'Maharashtra',
  CHENNAI: 'Tamil Nadu',
  KOLKATA: 'West Bengal',
  AHMEDABAD: 'Gujarat',
  SURAT: 'Gujarat',
  NAGPUR: 'Maharashtra',
  INDORE: 'Madhya Pradesh',
  PATNA: 'Bihar',
  RANCHI: 'Jharkhand',
  GUWAHATI: 'Assam',
  KANPUR: 'Uttar Pradesh',
  LUCKNOW: 'Uttar Pradesh',
};

const KEYWORD_STOPWORDS = new Set([
  'RECEIVER',
  'RECEIVED',
  'CONSIGNEE',
  'CONTACT',
  'PERSON',
  'PHONE',
  'FAX',
  'MASS',
  'EXPRESS',
  'CARGO',
  'PVT',
  'LTD',
  'LOGISTICS',
  'SAFEXPRESS',
  'SERVICE',
  'CHARGES',
  'BOOKING',
  'COPY',
  'NUMBER',
  'NO',
  'DATE',
  'TIME',
  'TOTAL',
  'DESCRIPTION',
  'PACKING',
  'STICKER',
  'STARTING',
  'ENDING',
  'WEIGHT',
  'INSURED',
  'NON',
  'RISK',
  'OWNER',
  'CARRIERS',
  'DELIVERY',
  'POD',
  'MDC',
  'LABS',
  'MASS',
  'OM',
  'SAFE',
  'EXPRESS',
  'ALONG',
  'WITH',
  'ONLY',
  'STANDARD',
  'CONDITIONS',
  'REVERSE',
  'APPLICABLE',
]);

function titleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeMarkdownValue(value) {
  const cleaned = value
    .replace(/`/g, '')
    .replace(/^✅\s*/g, '')
    .replace(/^❌\s*/g, '')
    .trim();

  return cleaned === '—' || cleaned === '-' ? null : cleaned;
}

function deriveCityFromAddress(address) {
  if (!address) return null;

  const cleaned = address.replace(/\s+/g, ' ').trim();
  const cityFromCatalog = extractCity(cleaned, '');
  if (cityFromCatalog) return cityFromCatalog;

  const segments = cleaned.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  return segments[segments.length - 1];
}

function parseReportEntries() {
  if (!fs.existsSync(REPORT_PATH)) {
    return new Map();
  }

  const markdown = fs.readFileSync(REPORT_PATH, 'utf-8');
  const sections = markdown.split(/^###\s+\d+\.\s+/m).slice(1);
  const entries = new Map();

  for (const section of sections) {
    const fileMatch = section.match(/\| \*\*File\*\* \| `([^`]+)` \|/);
    if (!fileMatch) continue;

    const filePath = fileMatch[1];
    const fileName = path.basename(filePath);
    const transporter = filePath.split(path.sep).includes('EPODs')
      ? filePath.split('/')[1] || null
      : null;

    const fields = {};
    const tableMatches = [...section.matchAll(/\|\s+\*\*([^*]+)\*\*\s+\|\s+(.+?)\s+\|/g)];
    for (const match of tableMatches) {
      fields[match[1].trim()] = normalizeMarkdownValue(match[2]);
    }

    entries.set(fileName, {
      awbNumber: fields['AWB / Docket Number'] || path.parse(fileName).name,
      shipmentId: deriveShipmentId(fields['AWB / Docket Number'] || path.parse(fileName).name),
      transporter,
      fileName,
      origin: fields['Consignor Name'] || null,
      originCity: fields['From City'] || deriveCityFromAddress(fields['Consignor Address']),
      consigneeName: fields['Consignee Name'] || null,
      destination: fields['To City'] || deriveCityFromAddress(fields['Consignee Address']),
      deliveredDate: fields['Delivery Date'] || fields['Booking Date'] || null,
      packageCount: Number.parseInt(fields['No. of Packages'] || '1', 10) || 1,
      ocrSource: 'report',
      extractedTextSnippet: null,
    });
  }

  return entries;
}

function sanitizeText(value) {
  return value
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function runTesseract(filePath, psm) {
  const result = spawnSync('/opt/homebrew/bin/tesseract', [filePath, 'stdout', '--psm', String(psm)], {
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    return '';
  }

  return sanitizeText(result.stdout || '');
}

function isCredibleName(value) {
  const cleaned = value.replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 5) return false;

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 2) return false;
  if (words.some((word) => word.length < 2)) return false;
  if (words.some((word) => KEYWORD_STOPWORDS.has(word.toUpperCase()))) return false;

  const shortWords = words.filter((word) => word.length <= 3).length;
  const longWords = words.filter((word) => word.length >= 5).length;
  if (longWords === 0) return false;
  if (shortWords > 1) return false;

  const alphaChars = cleaned.replace(/[^A-Za-z]/g, '').length;
  return alphaChars >= Math.max(6, cleaned.length * 0.6);
}

function extractKeywordField(text, keywords) {
  const upperText = text.toUpperCase();

  for (const keyword of keywords) {
    const index = upperText.indexOf(keyword);
    if (index === -1) continue;

    const tail = text.slice(index + keyword.length).replace(/^[:\-\s]+/, '');
    const match = tail.match(/^([A-Za-z0-9&.,()\-\/ ]{4,60})/);
    if (!match) continue;

    const candidate = match[1]
      .replace(/\b(?:PHONE|FAX|CONTACT|PERSON|DATE|TIME|COPY|NO)\b.*$/i, '')
      .replace(/[|_]+/g, ' ')
      .trim();

    if (candidate.length < 4) continue;

    const words = candidate
      .toUpperCase()
      .split(/\s+/)
      .filter((word) => word.length > 1 && !KEYWORD_STOPWORDS.has(word));

    if (words.length === 0) continue;

    const normalized = titleCase(words.join(' '))
      .replace(/^(?:[A-Za-z]{1,2}\s+)/, '')
      .trim();
    if (isCredibleName(normalized)) {
      return normalized;
    }
  }

  return null;
}

function extractFuzzyReceiverField(text) {
  const match = text.toUpperCase().match(/(?:RECEIV\w*|ECEIV\w*|PECEIV\w*|RCCEIV\w*|RCEIVER)\s+([A-Z][A-Z ]{4,40})/);
  if (!match) return null;

  const candidate = titleCase(match[1].replace(/\s+/g, ' ').trim())
    .replace(/^(?:[A-Za-z]{1,2}\s+)/, '')
    .trim();
  return isCredibleName(candidate) ? candidate : null;
}

function extractCity(text, transporter) {
  const upperText = text.toUpperCase();
  const blocked = transporter === 'MEC' ? new Set(['PUNE']) : new Set();

  for (const city of CITY_TOKENS) {
    if (blocked.has(city)) continue;
    if (!upperText.includes(city)) continue;

    const normalizedCity = city === 'BANGALORE' ? 'BENGALURU' : city;
    const state = STATE_BY_CITY[normalizedCity];
    return state ? `${titleCase(normalizedCity)}, ${state}` : titleCase(normalizedCity);
  }

  return null;
}

function extractDate(text) {
  const match = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
  return match ? match[1] : null;
}

function deriveShipmentId(awbNumber) {
  return `PTL-${awbNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 12).padEnd(8, '0')}`;
}

function readFiles() {
  if (!fs.existsSync(EPODS_ROOT)) return [];

  return fs.readdirSync(EPODS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dirEntry) => {
      const transporter = dirEntry.name;
      const dirPath = path.join(EPODS_ROOT, transporter);
      return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
        .map((entry) => ({
          transporter,
          fileName: entry.name,
          filePath: path.join(dirPath, entry.name),
        }));
    });
}

function buildManifestEntry(file, index) {
  const awbNumber = path.parse(file.fileName).name;

  return {
    awbNumber,
    shipmentId: deriveShipmentId(awbNumber),
    transporter: file.transporter,
    fileName: file.fileName,
    origin: null,
    originCity: null,
    consigneeName: null,
    destination: null,
    deliveredDate: null,
    packageCount: 0,
    ocrSource: 'none',
    extractedTextSnippet: null,
    sortOrder: index,
  };
}

const files = readFiles();
const reportEntries = parseReportEntries();
const manifest = files.map((file, index) => {
  const reportRecord = reportEntries.get(file.fileName);
  if (reportRecord) {
    return {
      ...reportRecord,
      transporter: reportRecord.transporter || file.transporter,
      sortOrder: index,
    };
  }

  return buildManifestEntry(file, index);
});

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote ${manifest.length} extracted shipment records to ${OUTPUT_PATH}`);
