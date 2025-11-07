/**
 * Utility functions for tracking read/unread messages
 */

/**
 * Get the last read timestamp for a contact
 * @param {string} phoneNumber - Normalized phone number
 * @returns {number} Last read timestamp (0 if never read)
 */
export const getLastReadTimestamp = (phoneNumber) => {
  try {
    const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
    const key = `whatsapp_last_read_${normalized}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.warn("Error getting last read timestamp:", error);
    return 0;
  }
};

/**
 * Set the last read timestamp for a contact
 * @param {string} phoneNumber - Normalized phone number
 * @param {number} timestamp - Timestamp to set (defaults to current time)
 */
export const setLastReadTimestamp = (phoneNumber, timestamp = Date.now()) => {
  try {
    const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
    const key = `whatsapp_last_read_${normalized}`;
    localStorage.setItem(key, timestamp.toString());
  } catch (error) {
    console.warn("Error setting last read timestamp:", error);
  }
};

/**
 * Calculate unread message count for a contact
 * @param {string} phoneNumber - Normalized phone number
 * @param {Array} messages - Array of messages for the contact
 * @returns {number} Count of unread messages
 */
export const getUnreadCount = (phoneNumber, messages = []) => {
  try {
    if (!messages || messages.length === 0) return 0;

    const lastReadTimestamp = getLastReadTimestamp(phoneNumber);

    // Count incoming messages that are newer than last read timestamp
    const unreadMessages = messages.filter((message) => {
      return message.direction === "incoming" && message.timestamp > lastReadTimestamp;
    });

    return unreadMessages.length;
  } catch (error) {
    console.warn("Error calculating unread count:", error);
    return 0;
  }
};

/**
 * Mark all messages as read for a contact
 * @param {string} phoneNumber - Normalized phone number
 * @param {Array} messages - Array of messages for the contact
 */
export const markMessagesAsRead = (phoneNumber, messages = []) => {
  try {
    if (!messages || messages.length === 0) {
      setLastReadTimestamp(phoneNumber);
      return;
    }

    // Find the latest incoming message timestamp
    const incomingMessages = messages.filter((msg) => msg.direction === "incoming");
    if (incomingMessages.length > 0) {
      const latestTimestamp = Math.max(...incomingMessages.map((msg) => msg.timestamp || 0));
      setLastReadTimestamp(phoneNumber, latestTimestamp);
    } else {
      // If no incoming messages, just set current time
      setLastReadTimestamp(phoneNumber);
    }
  } catch (error) {
    console.warn("Error marking messages as read:", error);
  }
};
