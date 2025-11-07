/**
 * Phone number utility functions
 */

/**
 * Format phone number with country code
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove any whitespace
  phone = phone.trim();
  
  // If already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Add + prefix if not present
  return `+${phone}`;
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  
  // Remove + and whitespace
  const cleaned = phone.replace(/[\s+]/g, '');
  
  // Should contain only digits and be at least 10 digits
  return /^\d{10,15}$/.test(cleaned);
};

/**
 * Extract country code from phone number
 * @param {string} phone - Phone number
 * @returns {string} Country code
 */
export const extractCountryCode = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\s/g, '');
  const match = cleaned.match(/^\+?(\d{1,4})/);
  
  return match ? match[1] : '';
};

