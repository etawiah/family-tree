const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;

// Practical email check: one @, non-empty local/domain, domain has a dot.
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  const value = normalizeEmail(email);
  if (!value || value.length > MAX_EMAIL_LENGTH) return false;
  if (value.includes("..")) return false;
  return EMAIL_RE.test(value);
}

export function capName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function validateSubmission({ name, email }) {
  const cappedName = capName(name);
  const normalizedEmail = normalizeEmail(email);
  if (!cappedName || !isValidEmail(normalizedEmail)) {
    return { ok: false, name: cappedName, email: normalizedEmail };
  }
  return { ok: true, name: cappedName, email: normalizedEmail };
}

export function parseAdminEmails(csv) {
  return String(csv ?? "")
    .split(",")
    .map((s) => normalizeEmail(s))
    .filter(Boolean);
}

export function isAdminEmail(email, adminEmailsCsv) {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  return parseAdminEmails(adminEmailsCsv).includes(needle);
}

export { MAX_NAME_LENGTH, MAX_EMAIL_LENGTH };
