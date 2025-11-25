import express from "express";
import { optionalAuthenticate } from "../middleware/auth.js";

/**
 * Create Facebook Messenger API router
 * @param {Function} loadFacebookPageAccessToken - Function to load Facebook page access token
 * @param {Function} setCorsHeaders - Function to set CORS headers
 * @returns {express.Router} Facebook Messenger API router
 */
export const createFacebookRouter = (loadFacebookPageAccessToken, setCorsHeaders) => {
  const router = express.Router();

  /**
   * Get Facebook Messenger Conversations
   * GET /api/facebook/conversations/:userId
   * Query params:
   *   - limit (optional) - Number of conversations to retrieve (default: 25)
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get("/conversations/:userId", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId } = req.params;
      const { limit = 25, fields } = req.query;
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      // Get appUserId from authenticated user if available
      const appUserId = req.user?._id?.toString() || null;

      // Load page access token (userId here is platformUserId)
      const pageTokenData = await loadFacebookPageAccessToken(appUserId, userId);
      if (!pageTokenData || !pageTokenData.token) {
        return res.status(404).json({
          success: false,
          error:
            "Facebook page access token not found or expired. Please reconnect your Facebook account.",
        });
      }

      const pageAccessToken = pageTokenData.token;

      // Build query parameters
      const params = new URLSearchParams({
        access_token: pageAccessToken,
        platform: "messenger",
      });

      // Add fields parameter - default fields if not provided
      const fieldsParam =
        fields || "id,participants,updated_time,message_count,unread_count,can_reply,is_supported";
      params.append("fields", fieldsParam);

      if (limit) params.append("limit", limit.toString());

      const conversationsUrl = `https://graph.facebook.com/${graphVersion}/me/conversations?${params.toString()}`;

      console.log(`💬 Fetching Facebook Messenger conversations for userId: ${userId}`);

      const response = await fetch(conversationsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch Facebook conversations:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch conversations",
          details: errorData,
        });
      }

      const data = await response.json();
      console.log(`✅ Successfully fetched ${data.data?.length || 0} Facebook conversations`);

      res.json({
        success: true,
        conversations: data.data || [],
        paging: data.paging || null,
        count: data.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching Facebook conversations:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Messages for a Facebook Conversation
   * GET /api/facebook/conversations/:userId/:conversationId/messages
   * Query params:
   *   - limit (optional) - Number of messages to retrieve (default: 25)
   *   - after (optional) - Cursor for pagination
   *   - before (optional) - Cursor for pagination
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get(
    "/conversations/:userId/:conversationId/messages",
    optionalAuthenticate,
    async (req, res) => {
      try {
        setCorsHeaders(res);

        const { userId, conversationId } = req.params;
        const { limit = 25, after, before, fields } = req.query;
        const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

        if (!userId || !conversationId) {
          return res.status(400).json({
            success: false,
            error: "User ID and Conversation ID are required",
          });
        }

        // Get appUserId from authenticated user if available
        const appUserId = req.user?._id?.toString() || null;

        // Load page access token (userId here is platformUserId)
        const pageTokenData = await loadFacebookPageAccessToken(appUserId, userId);
        if (!pageTokenData || !pageTokenData.token) {
          return res.status(404).json({
            success: false,
            error:
              "Facebook page access token not found or expired. Please reconnect your Facebook account.",
          });
        }

        const pageAccessToken = pageTokenData.token;

        // Build query parameters
        const params = new URLSearchParams({
          access_token: pageAccessToken,
          platform: "messenger",
        });

        // Add fields parameter - default fields if not provided
        const fieldsParam = fields || "id,from,message,created_time,attachments";
        params.append("fields", fieldsParam);

        if (limit) params.append("limit", limit.toString());
        if (after) params.append("after", after);
        if (before) params.append("before", before);

        const messagesUrl = `https://graph.facebook.com/${graphVersion}/${conversationId}/messages?${params.toString()}`;

        console.log(
          `💬 Fetching messages for Facebook conversation ${conversationId} (userId: ${userId})`
        );

        const response = await fetch(messagesUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ Failed to fetch Facebook messages:", errorData);
          return res.status(response.status).json({
            success: false,
            error: errorData.error?.message || "Failed to fetch messages",
            details: errorData,
          });
        }

        const data = await response.json();
        console.log(`✅ Successfully fetched ${data.data?.length || 0} Facebook messages`);

        res.json({
          success: true,
          messages: data.data || [],
          paging: data.paging || null,
          count: data.data?.length || 0,
        });
      } catch (error) {
        console.error("Error fetching Facebook messages:", error);
        setCorsHeaders(res);
        res.status(500).json({
          success: false,
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  );

  /**
   * Send a Facebook Messenger Message
   * POST /api/facebook/send-message
   * Body:
   *   - userId (required) - Facebook user ID
   *   - recipientId (required) - Recipient's Facebook user ID or conversation ID
   *   - message (required) - Message text
   *   - messageTag (optional) - Message tag for messages outside 24-hour window
   *                            Options: HUMAN_AGENT, CUSTOMER_FEEDBACK, CONFIRMED_EVENT_UPDATE, etc.
   */
  router.post("/send-message", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, recipientId, message, messageTag } = req.body;

      if (!userId || !recipientId || !message) {
        return res.status(400).json({
          success: false,
          error: "User ID, recipient ID, and message are required",
        });
      }

      // Get appUserId from authenticated user if available
      const appUserId = req.user?._id?.toString() || null;

      // Load page access token (userId here is platformUserId)
      const pageTokenData = await loadFacebookPageAccessToken(appUserId, userId);
      if (!pageTokenData || !pageTokenData.token) {
        return res.status(404).json({
          success: false,
          error:
            "Facebook page access token not found or expired. Please reconnect your Facebook account.",
        });
      }

      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";
      const pageAccessToken = pageTokenData.token;

      // Helper function to send message with optional tag
      const sendMessageWithTag = async (tag = null) => {
        // Build the request payload
        const payload = {
          recipient: {
            id: recipientId,
          },
          message: {
            text: message,
          },
        };

        // Add messaging_type and tag if provided (for messages outside 24-hour window)
        if (tag) {
          payload.messaging_type = "MESSAGE_TAG";
          payload.tag = tag;
        } else {
          payload.messaging_type = "RESPONSE";
        }

        // Build the URL with platform parameter
        const messagesUrl = `https://graph.facebook.com/${graphVersion}/me/messages?platform=messenger&access_token=${pageAccessToken}`;

        console.log(
          `💬 Sending Facebook Messenger message to ${recipientId} (userId: ${userId})${
            tag ? ` with tag: ${tag}` : ""
          }`
        );
        console.log(`📤 Message payload:`, JSON.stringify(payload, null, 2));

        const response = await fetch(messagesUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pageAccessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json();
        return { ok: response.ok, status: response.status, data: responseData };
      };

      // First, try sending without a tag (for messages within 24-hour window)
      let result = await sendMessageWithTag();

      // If it fails with error code 10 (outside allowed window), retry with a message tag
      if (!result.ok && result.data?.error?.code === 10) {
        console.log("⚠️ Message outside 24-hour window, retrying with message tag...");

        // Use provided tag or default to HUMAN_AGENT (appropriate for customer service)
        const tagToUse = messageTag || "HUMAN_AGENT";
        result = await sendMessageWithTag(tagToUse);
      }

      if (!result.ok) {
        const errorData = result.data;
        console.error("❌ Failed to send Facebook message:", errorData);
        return res.status(result.status).json({
          success: false,
          error: errorData.error?.message || "Failed to send Facebook message",
          details: errorData,
        });
      }

      const data = result.data;
      console.log(`✅ Successfully sent Facebook message:`, data);

      res.json({
        success: true,
        messageId: data.message_id || data.id,
        recipientId: recipientId,
      });
    } catch (error) {
      console.error("Error sending Facebook message:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  return router;
};
