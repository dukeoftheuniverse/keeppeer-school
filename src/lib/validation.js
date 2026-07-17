export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function validateRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function validateDate(date) {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

export function validateTimeOrder(start, end) {
  return String(start) < String(end);
}

export function isWithinSchoolHours(time, schoolStart = '07:00', schoolEnd = '17:00') {
  return String(time) >= schoolStart && String(time) <= schoolEnd;
}

export function getFieldError(value, rules) {
  if (rules.required && !validateRequired(value)) return `${rules.label || 'This field'} is required`;
  if (value && rules.email && !validateEmail(value)) return 'Please enter a valid email address';
  if (value && rules.phone && !validatePhone(value)) return 'Please enter a valid phone number (10-13 digits)';
  if (value && rules.min && String(value).length < rules.min) return `Must be at least ${rules.min} characters`;
  if (value && rules.unique !== undefined && rules.unique === false) return `${rules.label || 'This value'} already exists`;
  return null;
}

export function validateForm(data, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    const err = getFieldError(data[field], { ...rules, label: rules.label || field });
    if (err) errors[field] = err;
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}