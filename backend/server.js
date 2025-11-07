import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  path: "/socket.io/", // Explicitly set Socket.io path
  cors: {
    origin: "*", // Allow all origins (change in production)
    methods: ["GET", "POST"],
    allowedHeaders: ["ngrok-skip-browser-warning"],
    credentials: true,
  },
  transports: ["polling", "websocket"], // Support both polling and websocket
  allowEIO3: true, // Allow older Engine.IO clients
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
// CORS configuration - allow all origins for development
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "ngrok-skip-browser-warning",
    ],
    credentials: false, // Set to true if you need to send cookies
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Handle preflight requests explicitly
app.options("*", cors());
app.use(express.json());

// Ensure Socket.io paths are not handled by Express
app.use((req, res, next) => {
  if (req.path.startsWith("/socket.io/")) {
    // Let Socket.io handle this path
    return next();
  }
  next();
});

// In-memory storage for messages (in production, use a database)
let messagesStore = new Map(); // phoneNumber -> messages array

// Load messages from file if exists (persistence)
const MESSAGES_FILE = path.join(__dirname, "messages.json");

function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, "utf8");
      const messages = JSON.parse(data);
      messagesStore = new Map(Object.entries(messages));
      console.log("✅ Loaded messages from file");
    }
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function saveMessages() {
  try {
    const messagesObj = Object.fromEntries(messagesStore);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesObj, null, 2));
  } catch (error) {
    console.error("Error saving messages:", error);
  }
}

// Load messages on startup
loadMessages();

// ✅ 1️⃣ VERIFY WEBHOOK (Meta sends a GET request here)
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "test_whatsapp_webhook_2025"; // Use environment variable or default

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Verification failed. Token mismatch or invalid mode.");
    res.sendStatus(403);
  }
});

// ✅ 2️⃣ RECEIVE MESSAGES OR STATUS UPDATES
app.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("📩 New webhook event:", JSON.stringify(body, null, 2));

  if (body.object === "whatsapp_business_account") {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];

    if (changes?.field === "messages") {
      const value = changes.value;

      // Handle incoming messages
      if (value.messages) {
        value.messages.forEach((message) => {
          const from = message.from; // sender phone number
          const text = message.text?.body || "";
          const messageId = message.id;
          const timestamp = message.timestamp || Date.now();
          const type = message.type || "text";
          const profile = value.contacts?.[0]?.profile;

          console.log(`💬 New message from ${from}: ${text}`);

          // Store message - normalize phone number consistently
          let normalizedFrom = from.replace(/\s/g, "").replace(/[-\s()]/g, "");
          if (!normalizedFrom.startsWith("+")) {
            normalizedFrom = `+${normalizedFrom}`;
          }
          console.log(`📱 Normalized phone number: ${from} -> ${normalizedFrom}`);
          if (!messagesStore.has(normalizedFrom)) {
            messagesStore.set(normalizedFrom, []);
          }

          const messageObj = {
            id: messageId,
            from: normalizedFrom,
            to: "me",
            text: message.text ? { body: text } : null,
            type: type,
            timestamp: timestamp * 1000, // Convert to milliseconds
            direction: "incoming",
            status: "received",
            profile: profile,
          };

          const messages = messagesStore.get(normalizedFrom);

          // Check if message already exists (prevent duplicates)
          const exists = messages.some((msg) => msg.id === messageId);
          if (exists) {
            console.log(`⚠️ Message ${messageId} already exists, skipping duplicate`);
            return; // Skip this message, continue with next
          }

          messages.push(messageObj);

          // Keep only last 1000 messages per contact
          if (messages.length > 1000) {
            messages.splice(0, messages.length - 1000);
          }

          messagesStore.set(normalizedFrom, messages);
          saveMessages(); // Persist to file

          console.log(`📤 Emitting Socket.io event for new message from ${normalizedFrom}`);

          // Emit new message to all connected clients via Socket.io
          io.emit("new_message", {
            phoneNumber: normalizedFrom,
            message: messageObj,
          });

          console.log(`📤 Socket.io event emitted: new_message`, {
            phoneNumber: normalizedFrom,
            messageId: messageObj.id,
          });

          // Also emit to contacts update (for sidebar refresh)
          io.emit("contact_update", {
            phoneNumber: normalizedFrom,
            name: profile?.name || normalizedFrom,
            lastMessage: text,
            timestamp: messageObj.timestamp,
          });
        });
      }

      // Handle status updates
      if (value.statuses) {
        value.statuses.forEach((status) => {
          const messageId = status.id;
          const statusValue = status.status; // sent, delivered, read, failed
          const recipientId = status.recipient_id;

          console.log(
            `📦 Message status update: ${messageId} → ${statusValue} (recipient: ${recipientId})`
          );

          // Find and update message status in all contacts
          let messageUpdated = false;
          messagesStore.forEach((messages, phoneNumber) => {
            const messageIndex = messages.findIndex((msg) => msg.id === messageId);
            if (messageIndex !== -1) {
              const message = messages[messageIndex];

              // Only update status for outgoing messages
              if (message.direction === "outgoing") {
                // Map WhatsApp status to our status values
                let newStatus = message.status;
                if (statusValue === "sent") {
                  newStatus = "sent";
                } else if (statusValue === "delivered") {
                  newStatus = "delivered";
                } else if (statusValue === "read") {
                  newStatus = "read";
                } else if (statusValue === "failed") {
                  newStatus = "failed";
                }

                // Only update if status is progressing (sent -> delivered -> read)
                const statusOrder = { sent: 1, delivered: 2, read: 3, failed: 0 };
                const currentOrder = statusOrder[message.status] || 0;
                const newOrder = statusOrder[newStatus] || 0;

                if (newOrder > currentOrder || statusValue === "failed") {
                  messages[messageIndex] = {
                    ...message,
                    status: newStatus,
                  };
                  messageUpdated = true;
                  console.log(
                    `✅ Updated message ${messageId} status: ${message.status} → ${newStatus}`
                  );
                }
              }
            }
          });

          if (messageUpdated) {
            saveMessages(); // Persist to file

            // Emit status update to all connected clients via Socket.io
            io.emit("message_status_update", {
              messageId: messageId,
              status: statusValue,
              recipientId: recipientId,
            });

            console.log(`📤 Emitted status update event: ${messageId} → ${statusValue}`);
          }
        });
      }
    }
  }

  // Respond quickly (Meta requires a 200 OK within 20 seconds)
  res.sendStatus(200);
});

// ✅ 3️⃣ API ENDPOINTS FOR FRONTEND

// Get all messages for a specific contact
app.get("/api/messages/:phoneNumber", (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, ngrok-skip-browser-warning");

    // Decode URL-encoded phone number (e.g., %2B917359275948 -> +917359275948)
    let phoneNumber = req.params.phoneNumber;
    try {
      // Express auto-decodes, but handle edge cases where it might still be encoded
      if (phoneNumber.includes("%")) {
        phoneNumber = decodeURIComponent(phoneNumber);
      }
    } catch (decodeError) {
      console.warn("Failed to decode phone number:", decodeError);
    }

    // Normalize phone number consistently
    const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");

    // Validate phone number
    if (!normalized || normalized.length < 3 || normalized === "+") {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number",
        received: req.params.phoneNumber,
        normalized: normalized,
      });
    }

    const messages = messagesStore.get(normalized) || [];

    // Sort by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    res.json({
      success: true,
      phoneNumber: normalized,
      messages: sortedMessages,
      count: sortedMessages.length,
    });
  } catch (error) {
    console.error("Error in /api/messages/:phoneNumber:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get all contacts with messages
app.get("/api/contacts", (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, ngrok-skip-browser-warning");

    const contacts = [];

    messagesStore.forEach((messages, phoneNumber) => {
      try {
        // Validate phone number
        if (!phoneNumber || typeof phoneNumber !== "string") {
          return; // Skip invalid phone numbers
        }

        // Validate messages array
        if (!Array.isArray(messages)) {
          return; // Skip invalid message arrays
        }

        // Find name from any message's profile (prefer most recent message with profile)
        let contactName = phoneNumber;
        let lastMessage = null;
        let lastTimestamp = 0;

        // Search through messages to find name and get the last message
        // Iterate backwards to get the most recent name first
        for (let i = messages.length - 1; i >= 0; i--) {
          try {
            const msg = messages[i];

            // Skip invalid messages
            if (!msg || typeof msg !== "object") {
              continue;
            }

            // Get name from profile if available (use first one found when iterating backwards = most recent)
            if (msg.profile?.name && contactName === phoneNumber) {
              contactName = msg.profile.name;
            }

            // Track the most recent message by timestamp
            if (msg.timestamp && msg.timestamp > lastTimestamp) {
              lastTimestamp = msg.timestamp;
              lastMessage = msg;
            }
          } catch (msgError) {
            // Continue with next message if this one fails
            continue;
          }
        }

        // If no last message found by timestamp, use the last message in array
        if (!lastMessage && messages.length > 0) {
          // Find first valid message
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i] && typeof messages[i] === "object") {
              lastMessage = messages[i];
              break;
            }
          }
        }

        // Include contact even if there are no messages (name will be phoneNumber)
        contacts.push({
          phoneNumber: phoneNumber,
          name: contactName, // Will be phoneNumber if no profile name found in any message
          hasMessages: messages.length > 0,
          lastMessage: lastMessage?.text?.body || "",
          timestamp: lastMessage?.timestamp || 0,
          messageCount: messages.length,
        });
      } catch (contactError) {
        // Log error but continue processing other contacts
        console.warn(`Error processing contact ${phoneNumber}:`, contactError);
      }
    });

    // Sort by most recent message
    contacts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    res.json({
      success: true,
      contacts: contacts,
      count: contacts.length,
    });
  } catch (error) {
    console.error("Error in /api/contacts:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get new messages (for polling)
app.get("/api/messages/new/:phoneNumber", (req, res) => {
  const phoneNumber = req.params.phoneNumber;
  const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
  const since = parseInt(req.query.since) || 0; // Timestamp to get messages after

  const messages = messagesStore.get(normalized) || [];
  const newMessages = messages.filter((msg) => msg.timestamp > since);

  res.json({
    success: true,
    phoneNumber: normalized,
    messages: newMessages,
    count: newMessages.length,
  });
});

// Store a sent message (called from frontend)
app.post("/api/messages", (req, res) => {
  const { phoneNumber, message } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({
      success: false,
      error: "Phone number and message are required",
    });
  }

  const normalized = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
  if (!messagesStore.has(normalized)) {
    messagesStore.set(normalized, []);
  }

  const messages = messagesStore.get(normalized);

  // Check if message already exists (prevent duplicates)
  const messageId = message.id || `msg_${message.timestamp}_${Date.now()}`;
  const exists = messages.some((msg) => msg.id === messageId);
  if (exists) {
    console.log(`⚠️ Message ${messageId} already exists, skipping duplicate`);
    return res.json({
      success: true,
      message: "Message already exists, skipped duplicate",
    });
  }

  // Ensure message has an ID
  if (!message.id) {
    message.id = messageId;
  }

  messages.push(message);

  // Keep only last 1000 messages per contact
  if (messages.length > 1000) {
    messages.splice(0, messages.length - 1000);
  }

  messagesStore.set(normalized, messages);
  saveMessages();

  res.json({
    success: true,
    message: "Message stored successfully",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    messageCount: Array.from(messagesStore.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    contactCount: messagesStore.size,
  });
});

// Verify WhatsApp Business API token
app.post("/api/verify-whatsapp-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      });
    }

    // Try to verify token by calling WhatsApp Business Account API
    // We'll use a simple endpoint that requires authentication
    const WHATSAPP_BUSINESS_ACCOUNT_ID =
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1448116102966034";

    const graphApiUrl = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}`;

    console.log(`🔍 Verifying WhatsApp token...`);

    const response = await fetch(graphApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Token verification failed:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Invalid token. Please check and try again.",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(`✅ Token verified successfully for account: ${data.name || "Unknown"}`);

    res.json({
      success: true,
      message: "Token verified successfully",
      accountInfo: {
        id: data.id,
        name: data.name,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to verify token",
    });
  }
});

// Get message templates from Facebook Graph API
app.get("/api/templates", async (req, res) => {
  try {
    // Get WhatsApp Business Account ID and Access Token from environment or config
    // You can also pass it in the request body or use a config file
    const WHATSAPP_BUSINESS_ACCOUNT_ID =
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1448116102966034";

    // Try to get access token from multiple sources
    let ACCESS_TOKEN =
      process.env.WHATSAPP_ACCESS_TOKEN ||
      "EAAfJ3UKE5xIBP4VTZAK8BPkKWaYqlKZCBkCCZCDFZCaaNDZA3cvHMOjosxZASC8wcv3028KbZBjeM9UdGdupe2vSI8feJPDGdP8pL8zWpuShBra3bDtvnh39jYsn9XZCjm3pXFEMn2qDIk3vIi5ZCCFdpOTlZBDDtjkx0Gzzz6T3RkEofwVrE7USvWu5S2PN4jtTZAZBnRql3NRvIBOZBsd5qgeAfONZAdeOTw4fLvCaViiRUJJ5MAIZA4BDsEiq2bJEMErH1QTWzmuNYa9A4v25ZA662ZB7P";
    if (!ACCESS_TOKEN) {
      ACCESS_TOKEN = req.headers.authorization?.replace("Bearer ", "");
    }
    if (!ACCESS_TOKEN && req.body?.accessToken) {
      ACCESS_TOKEN = req.body.accessToken;
    }

    if (!ACCESS_TOKEN) {
      return res.status(400).json({
        success: false,
        error:
          "Access token is required. Set WHATSAPP_ACCESS_TOKEN environment variable or provide Authorization header.",
      });
    }

    const graphApiUrl = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

    console.log(`📋 Fetching message templates from: ${graphApiUrl}`);

    const response = await fetch(graphApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Error fetching templates:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch message templates",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.data?.length || 0} message templates`);

    res.json({
      success: true,
      templates: data.data || [],
      count: data.data?.length || 0,
    });
  } catch (error) {
    console.error("❌ Error in /api/templates:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch message templates",
    });
  }
});

// Socket.io connection handler (must be before server starts)
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  console.log("📡 Socket.io connection established");

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// ✅ 4️⃣ START SERVER
// Use port 3001 for backend (3000 is usually used by React dev server)
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io: http://localhost:${PORT}/socket.io/`);
  console.log(`🔌 Socket.io ready to accept connections`);
  console.log(
    `🔐 Verify Token: ${process.env.WEBHOOK_VERIFY_TOKEN || "test_whatsapp_webhook_2025"}`
  );
});
