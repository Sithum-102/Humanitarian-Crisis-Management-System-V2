/**
 * Phone number validation and sanitization utility.
 * Enforces strictly digits (with optional leading '+') and max 14 digits.
 */
export function sanitizePhoneInput(value) {
  if (!value) return '';
  // Allow leading + if typed first, but only digits otherwise
  const hasLeadingPlus = value.startsWith('+');
  const digitsOnly = value.replace(/\D/g, '').slice(0, 14);
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

export function validatePhone(input, { required = false } = {}) {
  if (!input || !input.trim()) {
    return {
      isValid: !required,
      error: required ? 'Phone number is required.' : null,
      normalized: ''
    };
  }

  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');

  if (digits.length < 9) {
    return {
      isValid: false,
      error: 'Phone number is too short (min 9 digits, e.g. 0771234567).',
      normalized: null
    };
  }

  if (digits.length > 14) {
    return {
      isValid: false,
      error: 'Phone number cannot exceed 14 digits.',
      normalized: null
    };
  }

  // Normalize to international E.164
  let compact = digits;
  if (compact.startsWith('00')) {
    compact = compact.slice(2);
  } else if (compact.startsWith('0') && compact.length === 10) {
    compact = '94' + compact.slice(1);
  } else if (compact.length === 9) {
    compact = '94' + compact;
  }

  return {
    isValid: true,
    error: null,
    normalized: `+${compact}`
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
