import { toast } from "react-toastify";
import { API_CONFIG } from "../config/api.config";

/**
 * WhatsApp API Service
 * Handles all communication with Facebook Graph API for WhatsApp
 */
class WhatsAppAPI {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.phoneNumberId = API_CONFIG.PHONE_NUMBER_ID;
    this.whatsappBusinessAccountId = API_CONFIG.WHATSAPP_BUSINESS_ACCOUNT_ID;
    this.accessToken = API_CONFIG.ACCESS_TOKEN;
    // Cache for ongoing requests to prevent duplicates
    this.requestCache = new Map();
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Store recipient phone number in localStorage
   * @param {string} phoneNumber - Recipient phone number to store
   * @param {string} name - Optional name for the recipient
   */
  storeRecipient(phoneNumber, name = null) {
    try {
      const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");

      // Don't store if it's the sender number
      if (normalized.includes(this.phoneNumberId)) {
        return;
      }

      const stored = localStorage.getItem("whatsapp_recipients");
      const recipients = stored ? JSON.parse(stored) : [];

      // Check if recipient already exists
      const existingIndex = recipients.findIndex((r) => r.phoneNumber === normalized);
      if (existingIndex >= 0) {
        // Update existing recipient
        recipients[existingIndex].hasMessages = true;
        recipients[existingIndex].timestamp = Date.now();
        if (name) {
          recipients[existingIndex].name = name;
        }
      } else {
        // Add new recipient
        recipients.push({
          phoneNumber: normalized,
          name: name || normalized,
          isRegistered: true,
          hasMessages: true,
          isSender: false,
          lastMessage: null,
          timestamp: Date.now(),
        });
      }

      // Sort by timestamp (most recent first)
      recipients.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      localStorage.setItem("whatsapp_recipients", JSON.stringify(recipients));
    } catch (error) {
      console.warn("Could not store recipient:", error);
    }
  }

  /**
   * Get stored recipients from localStorage
   * @returns {Array} Array of stored recipient phone numbers
   */
  getStoredRecipients() {
    try {
      const stored = localStorage.getItem("whatsapp_recipients");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn("Could not get stored recipients:", error);
      return [];
    }
  }

  /**
   * Normalize phone number for API (remove + prefix and spaces)
   * WhatsApp Business API accepts phone numbers without + prefix
   * @param {string} phoneNumber - Phone number to normalize
   * @returns {string} Normalized phone number
   */
  normalizePhoneNumberForAPI(phoneNumber) {
    if (!phoneNumber) return "";
    // Remove + prefix, spaces, and any special characters
    return phoneNumber
      .replace(/^\+/, "")
      .replace(/\s/g, "")
      .replace(/[-\s()]/g, "");
  }

  /**
   * Send a WhatsApp message
   * Matches the exact curl API structure:
   * POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages
   * @param {string} to - Recipient phone number (with or without country code, e.g., +919106886226 or 919106886226)
   * @param {string} message - Message text (for text messages)
   * @param {object} template - Template object (for template messages)
   * @returns {Promise} API response
   */
  async sendMessage(to, message = null, template = null) {
    try {
      // Normalize phone number for API (remove + prefix as per curl example)
      const normalizedTo = this.normalizePhoneNumberForAPI(to);

      if (!normalizedTo) {
        throw new Error("Phone number is required");
      }

      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;

      // Build payload matching exact curl structure:
      // {
      //   "messaging_product": "whatsapp",
      //   "to": "919067661018",
      //   "type": "template",
      //   "template": {
      //     "name": "hello_world",
      //     "language": {
      //       "code": "en_US"
      //     }
      //   }
      // }
      let payload = {
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: template ? "template" : "text",
      };

      if (template) {
        // Template structure matches curl exactly - same nested structure
        payload.template = {
          name: template.name,
          language: {
            code: template.language?.code || "en_US",
          },
        };
        // Add components if present (for template parameters)
        if (template.components && template.components.length > 0) {
          payload.template.components = template.components;
        }
      } else if (message) {
        // Text message payload
        payload.text = {
          body: message,
        };
      } else {
        throw new Error("Either message or template must be provided");
      }

      // Log payload for debugging (matches curl structure exactly)
      console.log("Sending WhatsApp message with payload:", JSON.stringify(payload, null, 2));

      // Make API call with exact headers as in curl
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to send message");
      }

      const data = await response.json();

      // Store recipient if message was sent successfully
      // Store with original phone number format (with +) for consistency
      if (data.messages && data.messages.length > 0) {
        this.storeRecipient(to);
      }

      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("WhatsApp not connected. Please Connect to WhatsApp from the Channels page", {
        autoClose: 5000,
      });
      return null;
    }
  }

  /**
   * Send a template message
   * Creates payload matching exact curl structure:
   * {
   *   "messaging_product": "whatsapp",
   *   "to": "919067661018",
   *   "type": "template",
   *   "template": {
   *     "name": "hello_world",
   *     "language": {
   *       "code": "en_US"
   *     }
   *   }
   * }
   * @param {string} to - Recipient phone number
   * @param {string} templateName - Template name (e.g., 'hello_world')
   * @param {string} languageCode - Language code (e.g., 'en_US')
   * @param {array} parameters - Optional template parameters
   * @returns {Promise} API response
   */
  async sendTemplateMessage(to, templateName, languageCode = "en_US", parameters = []) {
    // Build template object matching exact curl structure
    const template = {
      name: templateName,
      language: {
        code: languageCode,
      },
    };

    // Add template components if parameters are provided
    if (parameters.length > 0) {
      template.components = [
        {
          type: "body",
          parameters: parameters.map((param) => ({
            type: "text",
            text: param,
          })),
        },
      ];
    }

    // sendMessage will create the exact payload structure matching curl
    return this.sendMessage(to, null, template);
  }

  /**
   * Get all users who have messaged the business phone number
   * Note: WhatsApp Business API doesn't support GET /messages endpoint
   * Messages are received via webhooks only. This method gets contacts from:
   * 1. Backend API (if available)
   * 2. Stored messages in localStorage (from webhooks)
   * @returns {Promise} Array of contacts who have messaged the business
   */
  async getIncomingMessageContacts() {
    try {
      const contactsMap = new Map();

      // 1. Try to get contacts from backend API first
      // Prevent duplicate requests
      const cacheKey = "getIncomingMessageContacts_api";
      let apiContacts = [];

      if (this.requestCache.has(cacheKey)) {
        const cachedRequest = this.requestCache.get(cacheKey);
        if (cachedRequest instanceof Promise) {
          // If there's an ongoing request, wait for it
          try {
            apiContacts = await cachedRequest;
          } catch (error) {
            // If cached request failed, continue with new request
            this.requestCache.delete(cacheKey);
          }
        } else {
          // Cached result
          apiContacts = cachedRequest;
        }
      }

      // Create the request promise if not cached
      if (!this.requestCache.has(cacheKey)) {
        const requestPromise = (async () => {
          try {
            const backendUrl =
              process.env.REACT_APP_BACKEND_URL ||
              "https://unexigent-felisha-calathiform.ngrok-free.dev";
            const response = await fetch(`${backendUrl}/api/contacts`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
              },
              mode: "cors",
              credentials: "omit",
            });

            const contacts = [];
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.contacts) {
                data.contacts.forEach((contact) => {
                  const normalized = contact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
                  contacts.push({
                    phoneNumber: normalized,
                    name: contact.name || normalized,
                    hasMessages: true,
                    lastMessage: contact.lastMessage || "",
                    timestamp: contact.timestamp || Date.now(),
                    messageType: "backend",
                  });
                });
              }
            } else {
              console.warn(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
            }
            return contacts;
          } catch (error) {
            console.warn("Backend not available, using localStorage:", error);
            return []; // Return empty array on error
          } finally {
            // Remove from cache after completion
            this.requestCache.delete(cacheKey);
          }
        })();

        // Store the promise to prevent duplicate calls
        this.requestCache.set(cacheKey, requestPromise);

        // Wait for the request and get the result
        apiContacts = await requestPromise;
      }

      // Add API contacts to the map
      apiContacts.forEach((contact) => {
        contactsMap.set(contact.phoneNumber, contact);
      });

      // 2. Get stored incoming messages from localStorage (from webhooks)
      try {
        const storedMessages = localStorage.getItem("whatsapp_incoming_messages");
        if (storedMessages) {
          const messages = JSON.parse(storedMessages);
          messages.forEach((message) => {
            if (message.from) {
              const normalized = message.from.replace(/\s/g, "").replace(/^\+?/, "+");
              if (!normalized.includes(this.phoneNumberId)) {
                if (!contactsMap.has(normalized)) {
                  contactsMap.set(normalized, {
                    phoneNumber: normalized,
                    name: message.profile?.name || normalized,
                    hasMessages: true,
                    lastMessage: message.text?.body || message.type || "",
                    timestamp: message.timestamp || Date.now(),
                    messageType: "webhook",
                  });
                } else {
                  // Update if newer
                  const existing = contactsMap.get(normalized);
                  const messageTime = message.timestamp || 0;
                  if (messageTime > (existing.timestamp || 0)) {
                    existing.lastMessage =
                      message.text?.body || message.type || existing.lastMessage;
                    existing.timestamp = messageTime;
                    if (message.profile?.name) {
                      existing.name = message.profile.name;
                    }
                  }
                }
              }
            }
          });
        }
      } catch (error) {
        console.warn("Could not get stored incoming messages:", error);
      }

      // Convert map to array and sort by timestamp (most recent first)
      const contacts = Array.from(contactsMap.values());
      contacts.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA; // Most recent first
      });

      return contacts;
    } catch (error) {
      console.error("Error getting incoming message contacts:", error);
      return [];
    }
  }

  /**
   * Get all contacts (users who have messaged the business + recipients)
   * This method combines:
   * 1. Users who have messaged the business (incoming messages)
   * 2. Recipients we have sent messages to
   * @returns {Promise} Array of contacts with message status
   */
  async getContacts() {
    try {
      const contactsMap = new Map();

      // 1. Get all users who have messaged the business (incoming messages)
      const incomingContacts = await this.getIncomingMessageContacts();
      incomingContacts.forEach((contact) => {
        const normalized = contact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
        contactsMap.set(normalized, {
          ...contact,
          isRegistered: false,
          messageDirection: "incoming", // User messaged the business
        });
      });

      // 2. Get recipients we have sent messages to
      const storedRecipients = this.getStoredRecipients();
      storedRecipients.forEach((recipient) => {
        const normalized = recipient.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
        if (contactsMap.has(normalized)) {
          // Update existing contact (user has both sent and received messages)
          const existing = contactsMap.get(normalized);
          existing.messageDirection = "both";
          existing.hasMessages = true;
          // Keep the most recent timestamp
          if (recipient.timestamp > (existing.timestamp || 0)) {
            existing.timestamp = recipient.timestamp;
          }
        } else {
          // Add new recipient (we sent messages to them)
          contactsMap.set(normalized, {
            phoneNumber: normalized,
            name: recipient.name || normalized,
            hasMessages: true,
            lastMessage: recipient.lastMessage || "",
            timestamp: recipient.timestamp || Date.now(),
            isRegistered: recipient.isRegistered || false,
            messageDirection: "outgoing", // We messaged them
          });
        }
      });

      // Convert map to array and sort by timestamp (most recent first)
      const contacts = Array.from(contactsMap.values());
      contacts.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA; // Most recent first
      });

      return contacts;
    } catch (error) {
      console.error("Error getting contacts:", error);
      return [];
    }
  }

  /**
   * Get conversation messages
   * @param {string} phoneNumber - Phone number to get messages for
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise} Array of messages
   */
  async getMessages(phoneNumber, limit = 50) {
    try {
      // Note: WhatsApp Business API doesn't have a direct endpoint to retrieve past messages
      // This is a placeholder for future implementation or webhook integration
      // Messages are typically received via webhooks, not retrieved via API

      console.warn("WhatsApp Business API does not support retrieving past messages via REST API");
      console.warn("Messages are received via webhooks. Please implement webhook handling.");

      return [];
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  }

  /**
   * Get message status
   * @param {string} messageId - Message ID to check status
   * @returns {Promise} Message status
   */
  async getMessageStatus(messageId) {
    try {
      const url = `${this.baseURL}/${messageId}`;

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to get message status");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting message status:", error);
      throw error;
    }
  }
}

// Export singleton instance
const whatsappAPI = new WhatsAppAPI();
export default whatsappAPI;
