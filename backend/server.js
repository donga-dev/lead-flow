import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  path: "/socket.io/", // Explicitly set Socket.io path
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://lead-flow-gqlq.vercel.app",
        "https://unexigent-felisha-calathiform.ngrok-free.dev",
      ];

      // Allow if origin is in allowed list or is an ngrok URL
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.ngrok-free\.dev$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for development (change in production)
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "ngrok-skip-browser-warning",
      "lead-flow-gqlq.vercel.app",
    ],
    credentials: false,
  },
  transports: ["polling", "websocket"], // Support both polling and websocket
  allowEIO3: true, // Allow older Engine.IO clients
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
// CORS configuration - allow all origins for development
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://lead-flow-gqlq.vercel.app",
  "https://unexigent-felisha-calathiform.ngrok-free.dev",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if origin is an ngrok URL
    if (/^https:\/\/.*\.ngrok-free\.dev$/.test(origin)) {
      return callback(null, true);
    }

    // For development, allow all origins
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "ngrok-skip-browser-warning",
    "lead-flow-gqlq.vercel.app",
    "Accept",
    "Origin",
  ],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly (cors middleware should handle this, but this ensures it works)
app.options("*", cors(corsOptions));
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

// Token storage helper functions
const TOKENS_DIR = path.join(__dirname, "tokens");

// Ensure tokens directory exists
if (!fs.existsSync(TOKENS_DIR)) {
  fs.mkdirSync(TOKENS_DIR, { recursive: true });
  console.log("✅ Created tokens directory");
}

/**
 * Migrate old separate token files to new combined format
 * This function will be called on startup to convert existing files
 */
function migrateTokenFiles() {
  try {
    const files = fs.readdirSync(TOKENS_DIR);
    const userIds = new Set();

    // Find all user IDs from old format files
    files.forEach((file) => {
      const match = file.match(/^(\d+)_(?:user|page)_access_token\.json$/);
      if (match) {
        userIds.add(match[1]);
      }
    });

    if (userIds.size === 0) {
      return; // No old files to migrate
    }

    console.log(
      `🔄 Migrating ${userIds.size} user(s) from old token file format to new combined format...`
    );

    userIds.forEach((userId) => {
      try {
        const userTokenFile = path.join(TOKENS_DIR, `${userId}_user_access_token.json`);
        const pageTokenFile = path.join(TOKENS_DIR, `${userId}_page_access_token.json`);
        const newTokenFile = path.join(TOKENS_DIR, `${userId}_tokens.json`);

        // Skip if new format already exists
        if (fs.existsSync(newTokenFile)) {
          // Delete old files if new format exists
          if (fs.existsSync(userTokenFile)) {
            fs.unlinkSync(userTokenFile);
          }
          if (fs.existsSync(pageTokenFile)) {
            fs.unlinkSync(pageTokenFile);
          }
          return;
        }

        let userTokenData = null;
        let pageTokenData = null;

        // Load user token if exists
        if (fs.existsSync(userTokenFile)) {
          try {
            const data = fs.readFileSync(userTokenFile, "utf8");
            userTokenData = JSON.parse(data);
          } catch (error) {
            console.warn(`⚠️ Could not parse user token file for ${userId}:`, error);
          }
        }

        // Load page token if exists
        if (fs.existsSync(pageTokenFile)) {
          try {
            const data = fs.readFileSync(pageTokenFile, "utf8");
            pageTokenData = JSON.parse(data);
          } catch (error) {
            console.warn(`⚠️ Could not parse page token file for ${userId}:`, error);
          }
        }

        // Create new combined file
        const tokensData = {
          userAccessToken: userTokenData || null,
          pageAccessToken: pageTokenData || null,
        };

        fs.writeFileSync(newTokenFile, JSON.stringify(tokensData, null, 2));
        console.log(`✅ Migrated tokens for userId: ${userId}`);

        // Delete old files after successful migration
        if (fs.existsSync(userTokenFile)) {
          fs.unlinkSync(userTokenFile);
        }
        if (fs.existsSync(pageTokenFile)) {
          fs.unlinkSync(pageTokenFile);
        }
      } catch (error) {
        console.error(`❌ Error migrating tokens for userId ${userId}:`, error);
      }
    });

    console.log(`✅ Token migration completed`);
  } catch (error) {
    console.error("❌ Error during token migration:", error);
  }
}

// Run migration on startup
migrateTokenFiles();

/**
 * Save both user and page access tokens to a single JSON file
 * Updates existing file if userId already exists
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} userToken - User access token
 * @param {string} pageToken - Page access token
 * @param {number} expiresIn - Expiration time in seconds
 * @param {string} pageId - Optional page ID
 */
function saveTokens(userId, userToken, pageToken, expiresIn, pageId = null) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
    const fileExists = fs.existsSync(filePath);
    const expiresAt = Date.now() + expiresIn * 1000;

    let tokensData;
    if (fileExists) {
      // Load existing data to preserve createdAt
      try {
        const existingData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        tokensData = {
          userAccessToken: {
            token: userToken,
            expiresAt: expiresAt,
            createdAt: existingData.userAccessToken?.createdAt || Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageAccessToken: {
            token: pageToken,
            expiresAt: expiresAt,
            createdAt: existingData.pageAccessToken?.createdAt || Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageId: pageId || existingData.pageId || null,
        };
        console.log(`🔄 Updated tokens for userId: ${userId}`);
      } catch (parseError) {
        // If file exists but can't be parsed, create new
        tokensData = {
          userAccessToken: {
            token: userToken,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageAccessToken: {
            token: pageToken,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageId: pageId || null,
        };
        console.log(`✅ Saved tokens for userId: ${userId} (recreated after parse error)`);
      }
    } else {
      // New file
      tokensData = {
        userAccessToken: {
          token: userToken,
          expiresAt: expiresAt,
          createdAt: Date.now(),
          expiresIn: expiresIn,
        },
        pageAccessToken: {
          token: pageToken,
          expiresAt: expiresAt,
          createdAt: Date.now(),
          expiresIn: expiresIn,
        },
        pageId: pageId || null,
      };
      console.log(`✅ Created new tokens file for userId: ${userId}`);
    }

    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
  } catch (error) {
    console.error(`❌ Error saving tokens for ${userId}:`, error);
    throw error;
  }
}

/**
 * Save user access token (updates existing combined file)
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} token - Access token
 * @param {number} expiresIn - Expiration time in seconds
 */
function saveUserAccessToken(userId, token, expiresIn) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
    const fileExists = fs.existsSync(filePath);
    const expiresAt = Date.now() + expiresIn * 1000;

    let tokensData;
    if (fileExists) {
      try {
        tokensData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        tokensData.userAccessToken = {
          token: token,
          expiresAt: expiresAt,
          createdAt: tokensData.userAccessToken?.createdAt || Date.now(),
          updatedAt: Date.now(),
          expiresIn: expiresIn,
        };
        // Preserve page token if it exists
        if (!tokensData.pageAccessToken) {
          tokensData.pageAccessToken = null;
        }
      } catch (parseError) {
        tokensData = {
          userAccessToken: {
            token: token,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageAccessToken: null,
        };
      }
    } else {
      tokensData = {
        userAccessToken: {
          token: token,
          expiresAt: expiresAt,
          createdAt: Date.now(),
          expiresIn: expiresIn,
        },
        pageAccessToken: null,
      };
    }

    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
    console.log(`✅ Updated user access token for userId: ${userId}`);
  } catch (error) {
    console.error(`❌ Error saving user access token for ${userId}:`, error);
    throw error;
  }
}

/**
 * Save page access token (updates existing combined file)
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} token - Page access token
 * @param {number} expiresIn - Expiration time in seconds
 */
function savePageAccessToken(userId, token, expiresIn) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
    const fileExists = fs.existsSync(filePath);
    const expiresAt = Date.now() + expiresIn * 1000;

    let tokensData;
    if (fileExists) {
      try {
        tokensData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        tokensData.pageAccessToken = {
          token: token,
          expiresAt: expiresAt,
          createdAt: tokensData.pageAccessToken?.createdAt || Date.now(),
          updatedAt: Date.now(),
          expiresIn: expiresIn,
        };
        // Preserve user token if it exists
        if (!tokensData.userAccessToken) {
          tokensData.userAccessToken = null;
        }
      } catch (parseError) {
        tokensData = {
          userAccessToken: null,
          pageAccessToken: {
            token: token,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
        };
      }
    } else {
      tokensData = {
        userAccessToken: null,
        pageAccessToken: {
          token: token,
          expiresAt: expiresAt,
          createdAt: Date.now(),
          expiresIn: expiresIn,
        },
      };
    }

    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
    console.log(`✅ Updated page access token for userId: ${userId}`);
  } catch (error) {
    console.error(`❌ Error saving page access token for ${userId}:`, error);
    throw error;
  }
}

/**
 * Load all tokens from JSON file
 * @param {string} userId - User ID (Instagram account ID)
 * @returns {Object|null} Tokens data or null if not found
 */
function loadTokens(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    const tokensData = JSON.parse(data);

    return tokensData;
  } catch (error) {
    console.error(`❌ Error loading tokens for ${userId}:`, error);
    return null;
  }
}

/**
 * Load user access token from JSON file
 * @param {string} userId - User ID (Instagram account ID)
 * @returns {Object|null} Token data or null if not found/expired
 */
function loadUserAccessToken(userId) {
  try {
    const tokensData = loadTokens(userId);
    if (!tokensData || !tokensData.userAccessToken) {
      return null;
    }

    const tokenData = tokensData.userAccessToken;

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log(`⚠️ User access token for ${userId} has expired`);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error(`❌ Error loading user access token for ${userId}:`, error);
    return null;
  }
}

/**
 * Load page access token from JSON file
 * @param {string} userId - User ID (Instagram account ID)
 * @returns {Object|null} Token data or null if not found/expired
 */
function loadPageAccessToken(userId) {
  try {
    const tokensData = loadTokens(userId);
    if (!tokensData || !tokensData.pageAccessToken) {
      return null;
    }

    const tokenData = tokensData.pageAccessToken;

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log(`⚠️ Page access token for ${userId} has expired`);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error(`❌ Error loading page access token for ${userId}:`, error);
    return null;
  }
}

/**
 * Delete tokens file (both user and page tokens)
 * @param {string} userId - User ID (Instagram account ID)
 */
function deleteTokens(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted tokens for userId: ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting tokens for ${userId}:`, error);
  }
}

/**
 * Delete user access token (legacy function - now deletes entire tokens file)
 * @param {string} userId - User ID (Instagram account ID)
 */
function deleteUserAccessToken(userId) {
  deleteTokens(userId);
}

/**
 * Delete page access token (legacy function - now deletes entire tokens file)
 * @param {string} userId - User ID (Instagram account ID)
 */
function deletePageAccessToken(userId) {
  deleteTokens(userId);
}

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
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

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
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

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

// Exchange Instagram OAuth code for access token (using Facebook OAuth for Instagram Business API)
app.post("/api/instagram/exchange-token", async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Authorization code is required",
      });
    }

    const appId = process.env.REACT_APP_FACEBOOK_APP_ID || "1599198441064709";
    const appSecret = process.env.FACEBOOK_APP_SECRET || "12a042d6c5d3013e0921c382f84072f7";
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

    if (!appSecret) {
      console.error("❌ FACEBOOK_APP_SECRET environment variable is not set");
      return res.status(500).json({
        success: false,
        error: "Server configuration error: App secret not configured",
      });
    }

    // Step 1: Exchange code for Facebook user access token
    const tokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri:
        redirectUri || `${process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000"}/channels`,
      code: code,
    });

    console.log(`🔐 Step 1: Exchanging Instagram OAuth code for Facebook access token...`);

    const tokenResponse = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("❌ Token exchange failed:", errorData);
      return res.status(tokenResponse.status).json({
        success: false,
        error: errorData.error?.message || "Failed to exchange code for access token",
        details: errorData,
      });
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;
    console.log(`✅ Step 1: Successfully exchanged code for Facebook user access token`);

    // Step 2: Exchange for long-lived token (optional but recommended)
    console.log(`🔐 Step 2: Exchanging for long-lived token...`);
    const longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: userAccessToken,
    });

    const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    let longLivedToken = userAccessToken;
    let longLivedData = null;
    if (longLivedResponse.ok) {
      longLivedData = await longLivedResponse.json();
      longLivedToken = longLivedData.access_token;
      console.log(`✅ Step 2: Successfully obtained long-lived token`);
    } else {
      console.log(`⚠️ Step 2: Could not get long-lived token, using short-lived token`);
    }

    // Step 3: Get user's Facebook Pages
    console.log(`🔐 Step 3: Fetching Facebook Pages...`);
    const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts`;
    const pagesResponse = await fetch(`${pagesUrl}?access_token=${longLivedToken}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      console.error("❌ Failed to fetch pages:", errorData);
      return res.status(pagesResponse.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch Facebook Pages",
        details: errorData,
      });
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];
    console.log(`✅ Step 3: Found ${pages.length} Facebook Page(s)`);

    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "No Facebook Pages found. Please create a Facebook Page and connect it to an Instagram Business Account.",
      });
    }

    // Step 4: Get Instagram Business Account for each page
    let instagramAccount = null;
    let pageAccessToken = null;
    let pageId = null;

    for (const page of pages) {
      console.log(
        `🔐 Step 4: Checking page "${page.name}" (ID: ${page.id}) for Instagram account...`
      );

      // Get page access token (this is what we need for Instagram API)
      pageAccessToken = page.access_token;
      pageId = page.id;

      // Get Instagram Business Account connected to this page
      const instagramUrl = `https://graph.facebook.com/${graphVersion}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`;
      const instagramResponse = await fetch(instagramUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (instagramResponse.ok) {
        const instagramData = await instagramResponse.json();
        if (instagramData.instagram_business_account) {
          instagramAccount = instagramData.instagram_business_account;
          console.log(`✅ Step 4: Found Instagram Business Account (ID: ${instagramAccount.id})`);
          break;
        }
      }
    }

    if (!instagramAccount) {
      return res.status(400).json({
        success: false,
        error:
          "No Instagram Business Account found. Please connect an Instagram Business Account to your Facebook Page.",
      });
    }

    // Step 5: Verify Instagram access token by getting account info
    console.log(`🔐 Step 5: Verifying Instagram access token...`);
    const verifyUrl = `https://graph.facebook.com/${graphVersion}/${instagramAccount.id}?fields=id,username&access_token=${pageAccessToken}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      console.error("❌ Failed to verify Instagram token:", errorData);
      return res.status(verifyResponse.status).json({
        success: false,
        error: errorData.error?.message || "Failed to verify Instagram access token",
        details: errorData,
      });
    }

    const accountInfo = await verifyResponse.json();
    console.log(`✅ Step 5: Instagram account verified - @${accountInfo.username || "N/A"}`);

    // Use Instagram account ID as userId
    const userId = instagramAccount.id;
    // Use expires_in from long-lived token if available, otherwise use from initial token, or default to 60 days
    const expiresIn = longLivedData?.expires_in || tokenData.expires_in || 5184000;

    // Save tokens to JSON file (will update existing file if userId already exists)
    try {
      saveTokens(userId, longLivedToken, pageAccessToken, expiresIn, pageId);
      console.log(`✅ Tokens processed for userId: ${userId} (updated if existed, created if new)`);
    } catch (saveError) {
      console.error("❌ Error saving tokens to files:", saveError);
      // Continue even if save fails, but log the error
    }

    // Return both tokens (for backward compatibility, but frontend should not store in localStorage):
    // - user_access_token: For user-level API calls like /me/accounts
    // - access_token (page token): For Instagram API calls
    res.json({
      success: true,
      access_token: pageAccessToken, // This is the Instagram access token (page token) - use for Instagram API
      user_access_token: longLivedToken, // Use this for /me/accounts and other user-level calls
      token_type: "bearer",
      expires_in: expiresIn,
      instagram_account_id: instagramAccount.id,
      instagram_username: accountInfo.username,
      page_id: pageId,
      page_name: pages.find((p) => p.id === pageId)?.name,
      userId: userId, // Include userId in response
    });
  } catch (error) {
    console.error("❌ Error exchanging token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to exchange code for access token",
    });
  }
});

// Verify Instagram access token (supports both Instagram Basic Display API and Facebook Graph API)
app.post("/api/verify-instagram-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      });
    }

    console.log(`🔍 Verifying Instagram token...`);

    // Try Instagram Basic Display API first (graph.instagram.com)
    try {
      const instagramUrl = `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${token}`;
      const instagramResponse = await fetch(instagramUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (instagramResponse.ok) {
        const instagramData = await instagramResponse.json();
        console.log(
          `✅ Instagram Basic Display API token verified successfully for account: @${
            instagramData.username || instagramData.id
          }`
        );

        return res.json({
          success: true,
          message: "Token verified successfully",
          accountInfo: {
            instagram_account_id: instagramData.id,
            instagram_username: instagramData.username,
            account_type: instagramData.account_type,
          },
        });
      }
    } catch (instagramError) {
      console.log(
        `⚠️ Token is not an Instagram Basic Display API token, trying Facebook Graph API...`
      );
    }

    // Fallback to Facebook Graph API (for Instagram Business accounts)
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    let userInfo = null;
    let isUserToken = false;

    try {
      const userUrl = `https://graph.facebook.com/${graphVersion}/me?fields=id,name&access_token=${token}`;
      const userResponse = await fetch(userUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (userResponse.ok) {
        userInfo = await userResponse.json();
        isUserToken = true;
        console.log(`✅ Token is a Facebook user token for: ${userInfo.name || userInfo.id}`);
      }
    } catch (error) {
      console.log(`⚠️ Token is not a user token, trying as page token...`);
    }

    let instagramAccount = null;
    let pageInfo = null;

    if (isUserToken) {
      // It's a user token, get pages and find Instagram account
      const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${token}`;
      const pagesResponse = await fetch(pagesUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!pagesResponse.ok) {
        const errorData = await pagesResponse.json();
        console.error("❌ Failed to fetch pages:", errorData);
        return res.status(pagesResponse.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch Facebook Pages",
          details: errorData,
        });
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      // Find page with Instagram account
      for (const page of pages) {
        if (page.instagram_business_account) {
          pageInfo = {
            id: page.id,
            name: page.name,
            access_token: page.access_token,
          };
          instagramAccount = page.instagram_business_account;
          break;
        }
      }

      // If not found in initial response, try fetching individually
      if (!instagramAccount) {
        for (const page of pages) {
          const pageUrl = `https://graph.facebook.com/${graphVersion}/${page.id}?fields=instagram_business_account&access_token=${token}`;
          const pageResponse = await fetch(pageUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            if (pageData.instagram_business_account) {
              pageInfo = {
                id: page.id,
                name: page.name,
                access_token: page.access_token,
              };
              instagramAccount = pageData.instagram_business_account;
              break;
            }
          }
        }
      }
    } else {
      // It's likely a page token, try to get page info and Instagram account
      try {
        const pageUrl = `https://graph.facebook.com/${graphVersion}/me?fields=id,name,instagram_business_account&access_token=${token}`;
        const pageResponse = await fetch(pageUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          pageInfo = {
            id: pageData.id,
            name: pageData.name,
          };
          if (pageData.instagram_business_account) {
            instagramAccount = pageData.instagram_business_account;
          }
        } else {
          const errorData = await pageResponse.json();
          console.error("❌ Failed to fetch page info:", errorData);
          return res.status(pageResponse.status).json({
            success: false,
            error: errorData.error?.message || "Invalid token. Please check and try again.",
            details: errorData,
          });
        }
      } catch (error) {
        console.error("Error fetching page info:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to verify token. Please check your token and try again.",
        });
      }
    }

    if (!instagramAccount) {
      return res.status(400).json({
        success: false,
        error:
          "No Instagram Business Account found. Please ensure your Facebook Page is connected to an Instagram Business Account.",
      });
    }

    // Verify Instagram account by getting its details
    const instagramUrl = `https://graph.facebook.com/${graphVersion}/${instagramAccount.id}?fields=id,username,name,profile_picture_url&access_token=${token}`;
    const instagramResponse = await fetch(instagramUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!instagramResponse.ok) {
      const errorData = await instagramResponse.json();
      console.error("❌ Token verification failed:", errorData);
      return res.status(instagramResponse.status).json({
        success: false,
        error: errorData.error?.message || "Invalid token. Please check and try again.",
        details: errorData,
      });
    }

    const instagramData = await instagramResponse.json();
    console.log(
      `✅ Instagram Business API token verified successfully for account: @${
        instagramData.username || instagramData.id
      }`
    );

    res.json({
      success: true,
      message: "Token verified successfully",
      accountInfo: {
        instagram_account_id: instagramData.id,
        instagram_username: instagramData.username,
        instagram_name: instagramData.name,
        profile_picture_url: instagramData.profile_picture_url,
        page_id: pageInfo?.id,
        page_name: pageInfo?.name,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying Instagram token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to verify token",
    });
  }
});

// Get user access token by userId
app.get("/api/instagram/tokens/user/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const tokenData = loadUserAccessToken(userId);

    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: "User access token not found or expired",
      });
    }

    res.json({
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      createdAt: tokenData.createdAt,
      expiresIn: tokenData.expiresIn,
      isExpired: Date.now() > tokenData.expiresAt,
    });
  } catch (error) {
    console.error("Error loading user access token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to load user access token",
    });
  }
});

// Get page access token by userId
app.get("/api/instagram/tokens/page/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const tokenData = loadPageAccessToken(userId);

    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: "Page access token not found or expired",
      });
    }

    res.json({
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      createdAt: tokenData.createdAt,
      expiresIn: tokenData.expiresIn,
      isExpired: Date.now() > tokenData.expiresAt,
    });
  } catch (error) {
    console.error("Error loading page access token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to load page access token",
    });
  }
});

// Delete tokens by userId
app.delete("/api/instagram/tokens/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    deleteUserAccessToken(userId);
    deletePageAccessToken(userId);

    res.json({
      success: true,
      message: "Tokens deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tokens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete tokens",
    });
  }
});

// Get Instagram conversations for a user (using page ID)
app.get("/api/instagram/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 25, after, before, fields } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    // Load tokens
    const tokensData = loadTokens(userId);
    const pageTokenData = tokensData?.pageAccessToken;

    if (!pageTokenData || !pageTokenData.token) {
      return res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
    }

    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const pageAccessToken = pageTokenData.token;

    // Get page ID from stored tokens, or fetch it if not available
    let pageId = tokensData?.pageId;

    // If page ID not stored, try to fetch it
    if (!pageId) {
      const userTokenData = tokensData?.userAccessToken;
      if (userTokenData?.token) {
        try {
          const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,instagram_business_account&access_token=${userTokenData.token}`;
          const pagesResponse = await fetch(pagesUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (pagesResponse.ok) {
            const pagesData = await pagesResponse.json();
            const pages = pagesData.data || [];

            // Find the page with matching Instagram Business Account
            for (const page of pages) {
              const pageDetailsUrl = `https://graph.facebook.com/${graphVersion}/${page.id}?fields=instagram_business_account&access_token=${pageAccessToken}`;
              const pageDetailsResponse = await fetch(pageDetailsUrl, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (pageDetailsResponse.ok) {
                const pageDetails = await pageDetailsResponse.json();
                if (pageDetails.instagram_business_account?.id === userId) {
                  pageId = page.id;
                  // Save the page ID for future use
                  if (tokensData) {
                    tokensData.pageId = pageId;
                    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
                    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
                  }
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.warn("⚠️ Could not fetch page ID:", error);
        }
      }
    }

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: "Page ID not found. Please reconnect your Instagram account.",
      });
    }

    const accountId = pageId;

    // Build query parameters
    const params = new URLSearchParams({
      platform: "instagram",
      access_token: pageAccessToken,
    });

    // Add fields parameter - default to participants and updated_time if not provided
    const fieldsParam = fields || "participants,updated_time,messages{from,to}";
    params.append("fields", fieldsParam);

    if (limit) params.append("limit", limit.toString());
    if (after) params.append("after", after);
    if (before) params.append("before", before);

    const conversationsUrl = `https://graph.facebook.com/${graphVersion}/${accountId}/conversations?${params.toString()}`;

    console.log(
      `📱 Fetching Instagram conversations for ${
        pageId ? `pageId: ${pageId}` : `userId: ${userId}`
      }`
    );

    const response = await fetch(conversationsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to fetch Instagram conversations:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch Instagram conversations",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.data?.length || 0} Instagram conversations`);
    console.log("📦 Raw Instagram conversations response:", JSON.stringify(data, null, 2));

    // Process conversations to ensure proper structure
    const conversations = (data.data || []).map((conversation) => {
      return {
        id: conversation.id,
        participants: conversation.participants || { data: [] },
        updated_time: conversation.updated_time,
        messages: conversation.messages || { data: [] },
      };
    });

    res.json({
      success: true,
      conversations: conversations,
      paging: data.paging || null,
      count: conversations.length,
    });
  } catch (error) {
    console.error("❌ Error fetching Instagram conversations:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch Instagram conversations",
    });
  }
});

// Get messages for a specific Instagram conversation
app.get("/api/instagram/conversations/:userId/:conversationId/messages", async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    const { limit = 25, after, before, fields } = req.query;

    if (!userId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: "User ID and Conversation ID are required",
      });
    }

    // Load page access token
    const pageTokenData = loadPageAccessToken(userId);
    if (!pageTokenData || !pageTokenData.token) {
      return res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
    }

    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const pageAccessToken = pageTokenData.token;

    // Build query parameters
    const params = new URLSearchParams({
      access_token: pageAccessToken,
    });

    // Add fields parameter - default to from, message, created_time if not provided
    const fieldsParam = fields || "id,from,message,created_time";
    params.append("fields", fieldsParam);

    if (limit) params.append("limit", limit.toString());
    if (after) params.append("after", after);
    if (before) params.append("before", before);

    const messagesUrl = `https://graph.facebook.com/${graphVersion}/${conversationId}/messages?${params.toString()}`;

    console.log(`💬 Fetching messages for conversation ${conversationId} (userId: ${userId})`);

    const response = await fetch(messagesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to fetch conversation messages:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch conversation messages",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(
      `✅ Successfully fetched ${
        data.data?.length || 0
      } messages for conversation ${conversationId}`
    );
    console.log("📦 Raw Instagram API response:", JSON.stringify(data, null, 2));

    // Return in Instagram API format (with 'data' field) for consistency
    const messagesData = data.data || [];
    console.log("📨 Processed messages data:", messagesData.length, "messages");

    res.json({
      success: true,
      conversationId: conversationId,
      data: messagesData, // Instagram API format - matches Postman response
      messages: messagesData, // Also include for backward compatibility
      paging: data.paging || null,
      count: messagesData.length,
    });
  } catch (error) {
    console.error("❌ Error fetching conversation messages:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch conversation messages",
    });
  }
});

// Send Instagram message
app.post("/api/instagram/send-message", async (req, res) => {
  try {
    const { userId, recipientId, message } = req.body;

    if (!userId || !recipientId || !message) {
      return res.status(400).json({
        success: false,
        error: "User ID, recipient ID, and message are required",
      });
    }

    // Load page access token
    const pageTokenData = loadPageAccessToken(userId);
    if (!pageTokenData || !pageTokenData.token) {
      return res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
    }

    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const pageAccessToken = pageTokenData.token;

    // Build the request payload
    const payload = {
      recipient: {
        id: recipientId,
      },
      message: {
        text: message,
      },
    };

    // Build the URL with platform parameter
    const messagesUrl = `https://graph.facebook.com/${graphVersion}/me/messages?platform=instagram&access_token=${pageAccessToken}`;

    console.log(`💬 Sending Instagram message to ${recipientId} (userId: ${userId})`);
    console.log(`📤 Message payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to send Instagram message:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Failed to send Instagram message",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully sent Instagram message:`, data);

    res.json({
      success: true,
      messageId: data.message_id || data.id,
      recipientId: "24609143302098989" || recipientId,
      data: data,
    });
  } catch (error) {
    console.error("❌ Error sending Instagram message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send Instagram message",
    });
  }
});

// Get a specific Instagram conversation details
app.get("/api/instagram/conversations/:userId/:conversationId", async (req, res) => {
  try {
    const { userId, conversationId } = req.params;

    if (!userId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: "User ID and Conversation ID are required",
      });
    }

    // Load page access token
    const pageTokenData = loadPageAccessToken(userId);
    if (!pageTokenData || !pageTokenData.token) {
      return res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
    }

    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const pageAccessToken = pageTokenData.token;

    const conversationUrl = `https://graph.facebook.com/${graphVersion}/${conversationId}?access_token=${pageAccessToken}`;

    console.log(`📱 Fetching conversation details for ${conversationId} (userId: ${userId})`);

    const response = await fetch(conversationUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to fetch conversation details:", errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch conversation details",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched conversation details for ${conversationId}`);

    res.json({
      success: true,
      conversation: data,
    });
  } catch (error) {
    console.error("❌ Error fetching conversation details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch conversation details",
    });
  }
});

// Manual token refresh endpoint (for testing or manual refresh)
app.post("/api/instagram/refresh-tokens", async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId) {
      // Refresh tokens for a specific user
      console.log(`🔄 Manual token refresh requested for userId: ${userId}`);
      const success = await refreshUserTokens(userId);

      if (success) {
        return res.json({
          success: true,
          message: `Tokens refreshed successfully for userId: ${userId}`,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: `Failed to refresh tokens for userId: ${userId}`,
        });
      }
    } else {
      // Refresh all tokens that need refresh
      const refreshInterval = process.env.TOKEN_REFRESH_INTERVAL_DAYS
        ? parseFloat(process.env.TOKEN_REFRESH_INTERVAL_DAYS)
        : 0.000694; // Default: 1 minute for testing
      console.log(
        `🔄 Manual token refresh requested for all users (last refreshed ${refreshInterval} days (${Math.round(
          refreshInterval * 24 * 60
        )} minutes) ago)`
      );
      await checkAndRefreshTokens(refreshInterval);

      return res.json({
        success: true,
        message: `Token refresh check completed for all users`,
      });
    }
  } catch (error) {
    console.error("❌ Error in manual token refresh:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to refresh tokens",
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

/**
 * Refresh user access token using Facebook Graph API
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} currentToken - Current user access token
 * @returns {Promise<Object|null>} New token data or null if failed
 */
async function refreshUserAccessToken(userId, currentToken) {
  try {
    const appId = process.env.REACT_APP_FACEBOOK_APP_ID || "1599198441064709";
    const appSecret = process.env.FACEBOOK_APP_SECRET || "12a042d6c5d3013e0921c382f84072f7";
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

    if (!appSecret) {
      console.error(`❌ Cannot refresh token for ${userId}: FACEBOOK_APP_SECRET not configured`);
      return null;
    }

    console.log(`🔄 Refreshing user access token for userId: ${userId}`);

    // Exchange current token for a new long-lived token
    const longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    });

    const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.json();
      console.error(`❌ Failed to refresh user access token for ${userId}:`, errorData);
      return null;
    }

    const longLivedData = await longLivedResponse.json();
    const newToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // Default to 60 days if not provided

    console.log(`✅ Successfully refreshed user access token for userId: ${userId}`);

    return {
      token: newToken,
      expiresIn: expiresIn,
    };
  } catch (error) {
    console.error(`❌ Error refreshing user access token for ${userId}:`, error);
    return null;
  }
}

/**
 * Refresh page access token by fetching it again from Facebook Pages API
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} userAccessToken - Current user access token
 * @returns {Promise<Object|null>} New page token data or null if failed
 */
async function refreshPageAccessToken(userId, userAccessToken) {
  try {
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

    console.log(`🔄 Refreshing page access token for userId: ${userId}`);

    // Get user's Facebook Pages
    const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts`;
    const pagesResponse = await fetch(`${pagesUrl}?access_token=${userAccessToken}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      console.error(`❌ Failed to fetch pages for ${userId}:`, errorData);
      return null;
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      console.error(`❌ No Facebook Pages found for userId: ${userId}`);
      return null;
    }

    // Find the page with Instagram Business Account matching userId
    let pageAccessToken = null;
    let pageId = null;

    for (const page of pages) {
      const instagramUrl = `https://graph.facebook.com/${graphVersion}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`;
      const instagramResponse = await fetch(instagramUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (instagramResponse.ok) {
        const instagramData = await instagramResponse.json();
        if (instagramData.instagram_business_account?.id === userId) {
          pageAccessToken = page.access_token;
          pageId = page.id;
          break;
        }
      }
    }

    if (!pageAccessToken) {
      console.error(`❌ No matching Instagram Business Account found for userId: ${userId}`);
      return null;
    }

    // Page access tokens typically have the same expiration as user tokens
    // We'll use the same expires_in from the user token refresh
    console.log(`✅ Successfully refreshed page access token for userId: ${userId}`);

    return {
      token: pageAccessToken,
      pageId: pageId,
    };
  } catch (error) {
    console.error(`❌ Error refreshing page access token for ${userId}:`, error);
    return null;
  }
}

/**
 * Refresh tokens for a specific user
 * @param {string} userId - User ID (Instagram account ID)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function refreshUserTokens(userId) {
  try {
    // Load current tokens
    const tokensData = loadTokens(userId);
    const userTokenData = tokensData?.userAccessToken;
    const existingPageId = tokensData?.pageId;

    if (!userTokenData) {
      console.log(`⚠️ No user access token found for userId: ${userId}, skipping refresh`);
      return false;
    }

    // Refresh user access token first
    const newUserTokenData = await refreshUserAccessToken(userId, userTokenData.token);
    if (!newUserTokenData) {
      console.error(`❌ Failed to refresh user access token for userId: ${userId}`);
      return false;
    }

    // Refresh page access token using the new user access token
    const newPageTokenData = await refreshPageAccessToken(userId, newUserTokenData.token);
    if (!newPageTokenData) {
      console.error(`❌ Failed to refresh page access token for userId: ${userId}`);
      // Still save the user token even if page token refresh fails
    }

    // Save refreshed tokens (preserve pageId if it exists)
    if (newPageTokenData) {
      saveTokens(
        userId,
        newUserTokenData.token,
        newPageTokenData.token,
        newUserTokenData.expiresIn,
        existingPageId || newPageTokenData.pageId || null
      );
    } else {
      // If page token refresh failed, only update user token
      saveUserAccessToken(userId, newUserTokenData.token, newUserTokenData.expiresIn);
    }

    console.log(`✅ Successfully refreshed all tokens for userId: ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error refreshing tokens for userId ${userId}:`, error);
    return false;
  }
}

/**
 * Get all user IDs from token files
 * @returns {Array<string>} Array of user IDs
 */
function getAllUserIds() {
  try {
    const files = fs.readdirSync(TOKENS_DIR);
    const userIds = new Set();

    files.forEach((file) => {
      // Extract userId from filename pattern: {userId}_tokens.json
      // Also support legacy files: {userId}_user_access_token.json or {userId}_page_access_token.json
      const match = file.match(/^(\d+)_(?:tokens|user_access_token|page_access_token)\.json$/);
      if (match) {
        userIds.add(match[1]);
      }
    });

    return Array.from(userIds);
  } catch (error) {
    console.error("❌ Error getting user IDs from token files:", error);
    return [];
  }
}

/**
 * Check and refresh tokens that haven't been refreshed in the specified interval
 * @param {number} daysSinceLastRefresh - Number of days since last refresh to trigger refresh (default: 50)
 */
async function checkAndRefreshTokens(daysSinceLastRefresh = 50) {
  try {
    const intervalMinutes = Math.round(daysSinceLastRefresh * 24 * 60);
    const intervalText =
      daysSinceLastRefresh < 1 ? `${intervalMinutes} minute(s)` : `${daysSinceLastRefresh} day(s)`;

    console.log(
      `\n🕐 Starting token refresh check (refreshing tokens last refreshed ${intervalText} ago)...`
    );

    const userIds = getAllUserIds();
    console.log(`📋 Found ${userIds.length} user(s) with tokens`);

    if (userIds.length === 0) {
      console.log("✅ No tokens to check");
      return;
    }

    const lastRefreshThreshold = Date.now() - daysSinceLastRefresh * 24 * 60 * 60 * 1000; // milliseconds
    let refreshedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const userId of userIds) {
      try {
        const tokensData = loadTokens(userId);
        const userTokenData = tokensData?.userAccessToken;

        if (!userTokenData) {
          console.log(`⚠️ No user token found for userId: ${userId}, skipping`);
          skippedCount++;
          continue;
        }

        // Check if token hasn't been refreshed in ~50 days
        const lastUpdated = userTokenData.updatedAt || userTokenData.createdAt || Date.now();
        const needsRefresh = lastUpdated <= lastRefreshThreshold;

        if (needsRefresh) {
          const timeSinceRefresh = Date.now() - lastUpdated;
          const minutesSinceRefresh = Math.floor(timeSinceRefresh / (60 * 1000));
          const daysSinceRefresh = Math.floor(timeSinceRefresh / (24 * 60 * 60 * 1000));

          const timeText =
            daysSinceLastRefresh < 1
              ? `${minutesSinceRefresh} minute(s)`
              : `${daysSinceRefresh} day(s)`;
          const thresholdText =
            daysSinceLastRefresh < 1
              ? `${Math.round(daysSinceLastRefresh * 24 * 60)} minute(s)`
              : `${daysSinceLastRefresh} day(s)`;

          console.log(
            `🔄 Token for userId ${userId} needs refresh (last refreshed ${timeText} ago, >= ${thresholdText})`
          );

          const success = await refreshUserTokens(userId);
          if (success) {
            refreshedCount++;
          } else {
            failedCount++;
          }
        } else {
          const timeSinceRefresh = Date.now() - lastUpdated;
          const minutesSinceRefresh = Math.floor(timeSinceRefresh / (60 * 1000));
          const daysSinceRefresh = Math.floor(timeSinceRefresh / (24 * 60 * 60 * 1000));

          const timeText =
            daysSinceLastRefresh < 1
              ? `${minutesSinceRefresh} minute(s)`
              : `${daysSinceRefresh} day(s)`;
          const thresholdText =
            daysSinceLastRefresh < 1
              ? `${Math.round(daysSinceLastRefresh * 24 * 60)} minute(s)`
              : `${daysSinceLastRefresh} day(s)`;

          console.log(
            `✅ Token for userId ${userId} is still valid (refreshed ${timeText} ago, < ${thresholdText})`
          );
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing tokens for userId ${userId}:`, error);
        failedCount++;
      }
    }

    console.log(
      `\n📊 Token refresh summary: ${refreshedCount} refreshed, ${skippedCount} skipped, ${failedCount} failed`
    );
  } catch (error) {
    console.error("❌ Error in token refresh check:", error);
  }
}

// Track last cron job execution time
const LAST_CRON_EXECUTION_FILE = path.join(__dirname, "tokens", ".last_cron_execution.json");

/**
 * Get the last cron job execution time
 * @returns {number|null} Last execution timestamp or null if never executed
 */
function getLastCronExecution() {
  try {
    if (fs.existsSync(LAST_CRON_EXECUTION_FILE)) {
      const data = fs.readFileSync(LAST_CRON_EXECUTION_FILE, "utf8");
      const json = JSON.parse(data);
      return json.lastExecution || null;
    }
    return null;
  } catch (error) {
    console.error("❌ Error reading last cron execution time:", error);
    return null;
  }
}

/**
 * Save the current cron job execution time
 */
function saveLastCronExecution() {
  try {
    const data = {
      lastExecution: Date.now(),
      lastExecutionDate: new Date().toISOString(),
    };
    fs.writeFileSync(LAST_CRON_EXECUTION_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error saving last cron execution time:", error);
  }
}

// Set to 50 days - cron job will only execute if 50 days have passed since last execution
// You can customize via TOKEN_REFRESH_INTERVAL_DAYS environment variable
const DAYS_SINCE_LAST_REFRESH = process.env.TOKEN_REFRESH_INTERVAL_DAYS
  ? parseFloat(process.env.TOKEN_REFRESH_INTERVAL_DAYS)
  : 50; // Default: 50 days

// Setup cron job to check weekly (but only executes if 50 days have passed)
// Cron format: minute hour day month dayOfWeek
// "0 2 * * 0" means: at 2:00 AM every Sunday
// The job checks if 50 days have passed since last execution, and only then runs the refresh
// You can customize via TOKEN_REFRESH_CRON environment variable
const CRON_SCHEDULE = process.env.TOKEN_REFRESH_CRON || "0 2 * * 0"; // Default: weekly on Sunday at 2 AM

cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`\n⏰ Cron job check triggered at ${new Date().toISOString()}`);

  const lastExecution = getLastCronExecution();
  const now = Date.now();
  const daysSinceLastExecution = lastExecution
    ? (now - lastExecution) / (24 * 60 * 60 * 1000)
    : Infinity;

  if (lastExecution && daysSinceLastExecution < DAYS_SINCE_LAST_REFRESH) {
    console.log(
      `⏭️  Skipping execution - last run was ${Math.floor(
        daysSinceLastExecution
      )} days ago (need ${DAYS_SINCE_LAST_REFRESH} days)`
    );
    return;
  }

  console.log(
    `✅ Executing token refresh (${
      lastExecution ? `${Math.floor(daysSinceLastExecution)} days` : "first run"
    } since last execution)`
  );

  await checkAndRefreshTokens(DAYS_SINCE_LAST_REFRESH);
  saveLastCronExecution();
});

// Also run immediately on startup (optional - comment out if not needed)
// Uncomment the line below if you want to check tokens on server startup
// checkAndRefreshTokens(DAYS_SINCE_LAST_REFRESH);

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
