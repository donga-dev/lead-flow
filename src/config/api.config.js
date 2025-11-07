// WhatsApp API Configuration
export const API_CONFIG = {
  BASE_URL: "https://graph.facebook.com/v22.0",
  PHONE_NUMBER_ID: "824773660719459", // Your WhatsApp Business Phone Number ID
  WHATSAPP_BUSINESS_ACCOUNT_ID: "1448116102966034", // Your WhatsApp Business Account ID
  ACCESS_TOKEN:
    localStorage.getItem("whatsapp_token") ||
    "EAAfJ3UKE5xIBP9NmdoqOazQUN0uWUlTHNS2rmcYugqHPw1G9Jq4kgWG9OksvZCVBuY0rvoNLR0xgKeRAlz6RHiLSW0GToIPtJkrCEoZBaTMeVupySUrEe4qASkDFtEZCJt67FjhZB9TQ2mftJX1h4ixVlSaDXRN27VnGCevyKYC6RZC4XtM9EQTdprviQwtbnBJbSl1Q2MJZAd2yzsXdLZBdB8UfJtgS3Y4rGRmkxmEsLn0ZBUS9bWMUYsne2eCxjAIKZCsJJACvJyreQ9SpN6aNZB",
  VERSION: "v22.0",
};

// Note: In production, store these in environment variables (.env file)
// Use process.env.REACT_APP_WHATSAPP_ACCESS_TOKEN instead
