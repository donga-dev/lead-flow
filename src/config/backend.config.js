// Backend API Configuration
export const BACKEND_CONFIG = {
  // Backend API URL - change this to your backend server URL
  // Backend runs on port 3001 (React dev server uses 3000)
  API_URL:
    process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev",

  // API Endpoints
  ENDPOINTS: {
    MESSAGES: (phoneNumber) => `/api/messages/${phoneNumber}`,
    NEW_MESSAGES: (phoneNumber) => `/api/messages/new/${phoneNumber}`,
    CONTACTS: "/api/contacts",
    STORE_MESSAGE: "/api/messages",
    HEALTH: "/health",
  },
};
