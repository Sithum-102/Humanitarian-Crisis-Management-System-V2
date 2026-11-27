/**
 * Phone number validation and normalization utility.
 * Supports Sri Lankan local formats (0712345678, 712345678)
 * and international E.164 formats (+94712345678, +14155552671).
 */
export function validatePhone(input, { required = false } = {}) {
  if (!input || !input.trim()) {
    return {
      isValid: !required,
      error: required ? 'Phone number is required.' : null,
      normalized: ''
    };
  }

  const raw = input.trim();
  // Strip whitespace, hyphens, brackets, dots
  let compact = raw.replace(/[\s\-().]/g, '');

  // Normalize leading 00 to +
  if (compact.startsWith('00')) {
    compact = '+' + compact.slice(2);
  }
  // Local Sri Lankan format: 07x xxx xxxx -> +947x xxx xxxx
  else if (compact.startsWith('0') && compact.length === 10) {
    compact = '+94' + compact.slice(1);
  }
  // 9-digit local without leading 0: 7x xxx xxxx -> +947x xxx xxxx
  else if (/^\d{9}$/.test(compact)) {
    compact = '+94' + compact;
  }
  // Missing + on 94: 947x xxx xxxx -> +947x xxx xxxx
  else if (compact.startsWith('94') && compact.length === 11) {
    compact = '+' + compact;
  }

  // E.164 international regex check: + followed by 8 to 15 digits
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(compact)) {
    return {
      isValid: false,
      error: 'Enter a valid phone number (e.g. 077 123 4567 or +94 77 123 4567).',
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized: compact
  };
}

/**
 * Standard email format validator
 */
export function validateEmail(input, { required = false } = {}) {
  if (!input || !input.trim()) {
    return {
      isValid: !required,
      error: required ? 'Email is required.' : null,
      normalized: ''
    };
  }
  const email = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 254) {
    return {
      isValid: false,
      error: 'Enter a valid email address.',
      normalized: null
    };
  }
  return {
    isValid: true,
    error: null,
    normalized: email
  };
}
