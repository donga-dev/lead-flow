import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createLinkedInRouter } from "./routes/linkedin.js";
import { createFacebookRouter } from "./routes/facebook.js";
import authRouter from "./routes/auth.js";
import { optionalAuthenticate } from "./middleware/auth.js";
import {
  saveInstagramRefreshToken,
  deleteInstagramRefreshToken,
  saveFacebookRefreshToken,
  deleteFacebookRefreshToken,
  createRefreshTokenFunctions,
} from "./services/refreshTokens.js";
import {
  getLastInstagramCronExecution,
  saveLastInstagramCronExecution,
  getLastFacebookCronExecution,
  saveLastFacebookCronExecution,
  setupTokenRefreshCron,
} from "./services/cronJobs.js";
import { connectDB } from "./config/db.js";
import Integration from "./models/Integration.js";
import {
  saveInstagramTokens,
  loadInstagramTokens,
  saveInstagramRefreshToken as saveInstagramRefreshTokenDB,
  deleteInstagramTokens,
  saveFacebookTokens,
  loadFacebookTokens,
  saveFacebookRefreshToken as saveFacebookRefreshTokenDB,
  deleteFacebookTokens as deleteFacebookTokensDB,
  saveLinkedInToken,
  loadLinkedInToken,
  deleteLinkedInToken,
  getUserIntegrations,
} from "./services/tokenService.js";

// Load environment variables
dotenv.config();

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

// Add CORS middleware for all routes as a fallback
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
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
let messagesStore = new Map(); // phoneNumber -> messages array (WhatsApp)
let instagramMessagesStore = new Map(); // userId -> messages array (Instagram)
let facebookMessagesStore = new Map(); // userId -> messages array (Facebook Messenger)

// Load messages from file if exists (persistence)
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const INSTAGRAM_MESSAGES_FILE = path.join(__dirname, "instagram_messages.json");
const FACEBOOK_MESSAGES_FILE = path.join(__dirname, "facebook_messages.json");

function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, "utf8");
      const messages = JSON.parse(data);
      messagesStore = new Map(Object.entries(messages));
      console.log("✅ Loaded WhatsApp messages from file");
    }
  } catch (error) {
    console.error("Error loading WhatsApp messages:", error);
  }
}

function saveMessages() {
  try {
    const messagesObj = Object.fromEntries(messagesStore);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesObj, null, 2));
  } catch (error) {
    console.error("Error saving WhatsApp messages:", error);
  }
}

// Load Instagram messages from file if exists (persistence)
function loadInstagramMessages() {
  try {
    if (fs.existsSync(INSTAGRAM_MESSAGES_FILE)) {
      const data = fs.readFileSync(INSTAGRAM_MESSAGES_FILE, "utf8");
      const messages = JSON.parse(data);
      instagramMessagesStore = new Map(Object.entries(messages));
      console.log("✅ Loaded Instagram messages from file");
    }
  } catch (error) {
    console.error("Error loading Instagram messages:", error);
  }
}

function saveInstagramMessages() {
  try {
    const messagesObj = Object.fromEntries(instagramMessagesStore);
    fs.writeFileSync(INSTAGRAM_MESSAGES_FILE, JSON.stringify(messagesObj, null, 2));
  } catch (error) {
    console.error("Error saving Instagram messages:", error);
  }
}

// Load Facebook messages from file if exists (persistence)
function loadFacebookMessages() {
  try {
    if (fs.existsSync(FACEBOOK_MESSAGES_FILE)) {
      const data = fs.readFileSync(FACEBOOK_MESSAGES_FILE, "utf8");
      const messages = JSON.parse(data);
      facebookMessagesStore = new Map(Object.entries(messages));
      console.log("✅ Loaded Facebook messages from file");
    }
  } catch (error) {
    console.error("Error loading Facebook messages:", error);
  }
}

function saveFacebookMessages() {
  try {
    const messagesObj = Object.fromEntries(facebookMessagesStore);
    fs.writeFileSync(FACEBOOK_MESSAGES_FILE, JSON.stringify(messagesObj, null, 2));
  } catch (error) {
    console.error("Error saving Facebook messages:", error);
  }
}

// Load messages on startup
loadMessages();
loadInstagramMessages();
loadFacebookMessages();

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
 * DISABLED: Using database instead of files
 */
/* function migrateTokenFiles() {
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
// migrateTokenFiles(); // DISABLED: Using database instead of files

/**
 * Save both user and page access tokens to a single JSON file
 * Updates existing file if userId already exists
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} userToken - User access token
 * @param {string} pageToken - Page access token
 * @param {number} expiresIn - Expiration time in seconds
 * @param {string} pageId - Optional page ID
 * DISABLED: Using database instead of files
 */
/* function saveTokens(userId, userToken, pageToken, expiresIn, pageId = null) {
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
} */

/**
 * Save user access token (updates existing combined file)
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} token - Access token
 * @param {number} expiresIn - Expiration time in seconds
 * DISABLED: Using database instead of files
 */
/* function saveUserAccessToken(userId, token, expiresIn) {
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
} */

/**
 * Save page access token (updates existing combined file)
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} token - Page access token
 * @param {number} expiresIn - Expiration time in seconds
 * DISABLED: Using database instead of files
 */
/* function savePageAccessToken(userId, token, expiresIn) {
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
} */

/**
 * Load all tokens from database (with fallback to file for backward compatibility)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 * @returns {Object|null} Tokens data or null if not found
 */
async function loadTokens(appUserId, platformUserId) {
  if (!appUserId) {
    throw new Error("Application user ID is required to load tokens");
  }
  try {
    // Try database first - always filter by user
    const tokenData = await loadInstagramTokens(appUserId, platformUserId);
    if (tokenData) {
      // Convert to old format for backward compatibility
      return {
        userAccessToken: {
          token: tokenData.userAccessToken,
          expiresAt: null, // Will be calculated from expiresIn if needed
        },
        pageAccessToken: {
          token: tokenData.pageAccessToken,
          expiresAt: null,
        },
        pageId: tokenData.pageId,
      };
    }

    // Fallback to file for backward compatibility - DISABLED: Using database only
    /* const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } */

    return null;
  } catch (error) {
    console.error(
      `❌ Error loading tokens for appUserId: ${appUserId}, platformUserId: ${platformUserId}:`,
      error
    );
    return null;
  }
}

/**
 * Load user access token from database (with fallback to file)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 * @returns {Object|null} Token data or null if not found/expired
 */
async function loadUserAccessToken(appUserId, platformUserId) {
  try {
    const tokensData = await loadTokens(appUserId, platformUserId);
    if (!tokensData || !tokensData.userAccessToken) {
      return null;
    }

    const tokenData = tokensData.userAccessToken;

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log(`⚠️ User access token for ${platformUserId} has expired`);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error(`❌ Error loading user access token for ${platformUserId}:`, error);
    return null;
  }
}

/**
 * Load page access token from database (with fallback to file)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 * @returns {Object|null} Token data or null if not found/expired
 */
async function loadPageAccessToken(appUserId, platformUserId) {
  try {
    const tokensData = await loadTokens(appUserId, platformUserId);
    if (!tokensData || !tokensData.pageAccessToken) {
      return null;
    }

    const tokenData = tokensData.pageAccessToken;

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log(`⚠️ Page access token for ${platformUserId} has expired`);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error(`❌ Error loading page access token for ${platformUserId}:`, error);
    return null;
  }
}

/**
 * Delete tokens from database (both user and page tokens)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 * @param {string} appUserId - Optional application user ID (from authentication)
 */
async function deleteTokens(userId, appUserId = null) {
  try {
    // Delete from database
    await deleteInstagramTokens(appUserId, userId);

    // Also delete refresh token if it exists (file-based for now)
    try {
      deleteInstagramRefreshToken(userId);
    } catch (refreshError) {
      console.warn(`⚠️ Could not delete refresh token file for ${userId}:`, refreshError);
    }
  } catch (error) {
    console.error(`❌ Error deleting tokens for ${userId}:`, error);
    throw error;
  }
}

/**
 * Delete user access token (legacy function - now deletes entire tokens from database)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 * @param {string} appUserId - Optional application user ID (from authentication)
 */
async function deleteUserAccessToken(userId, appUserId = null) {
  await deleteTokens(userId, appUserId);
}

/**
 * Delete page access token (legacy function - now deletes entire tokens from database)
 * @param {string} userId - User ID (Instagram account ID / platformUserId)
 */
async function deletePageAccessToken(userId) {
  await deleteTokens(userId);
}

// ==================== INSTAGRAM REFRESH TOKEN STORAGE ====================
// Moved to ./services/refreshTokens.js

// ==================== FACEBOOK TOKEN STORAGE ====================

/**
 * Save Facebook access tokens to a JSON file
 * Updates existing file if userId already exists
 * @param {string} userId - Facebook user ID
 * @param {string} userAccessToken - Short-lived user access token
 * @param {string} longLivedToken - Long-lived access token
 * @param {number} expiresIn - Expiration time in seconds
 * @param {string} userName - Optional user name
 * @param {string} pageId - Optional page ID
 * @param {string} pageAccessToken - Optional page access token
 * @param {string} pageName - Optional page name
 */
// Legacy file-based function - kept for backward compatibility but should use database version
// DISABLED: Using database instead of files
/* function saveFacebookTokensToFile(
  userId,
  userAccessToken,
  longLivedToken,
  expiresIn,
  userName = null,
  pageId = null,
  pageAccessToken = null,
  pageName = null
) {
  try {
    const filePath = path.join(TOKENS_DIR, `facebook_${userId}_tokens.json`);
    const fileExists = fs.existsSync(filePath);
    const expiresAt = Date.now() + expiresIn * 1000;

    let tokensData;
    if (fileExists) {
      // Load existing data to preserve createdAt
      try {
        const existingData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        tokensData = {
          userAccessToken: {
            token: userAccessToken,
            expiresAt: existingData.userAccessToken?.expiresAt || Date.now() + 3600000, // Short-lived tokens expire in ~1 hour
            createdAt: existingData.userAccessToken?.createdAt || Date.now(),
            updatedAt: Date.now(),
          },
          longLivedToken: {
            token: longLivedToken,
            expiresAt: expiresAt,
            createdAt: existingData.longLivedToken?.createdAt || Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageAccessToken: {
            token: pageAccessToken || existingData.pageAccessToken?.token || null,
            expiresAt: existingData.pageAccessToken?.expiresAt || null,
            createdAt: existingData.pageAccessToken?.createdAt || Date.now(),
            updatedAt: pageAccessToken
              ? Date.now()
              : existingData.pageAccessToken?.updatedAt || null,
          },
          userId: userId,
          userName: userName || existingData.userName || null,
          pageId: pageId || existingData.pageId || null,
          pageName: pageName || existingData.pageName || null,
        };
        console.log(`🔄 Updated Facebook tokens for userId: ${userId}`);
      } catch (parseError) {
        // If file exists but can't be parsed, create new
        tokensData = {
          userAccessToken: {
            token: userAccessToken,
            expiresAt: Date.now() + 3600000, // Short-lived tokens expire in ~1 hour
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          longLivedToken: {
            token: longLivedToken,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresIn: expiresIn,
          },
          pageAccessToken: {
            token: pageAccessToken || null,
            expiresAt: null,
            createdAt: Date.now(),
            updatedAt: pageAccessToken ? Date.now() : null,
          },
          userId: userId,
          userName: userName || null,
          pageId: pageId || null,
          pageName: pageName || null,
        };
        console.log(`✅ Saved Facebook tokens for userId: ${userId} (recreated after parse error)`);
      }
    } else {
      // New file
      tokensData = {
        userAccessToken: {
          token: userAccessToken,
          expiresAt: Date.now() + 3600000, // Short-lived tokens expire in ~1 hour
          createdAt: Date.now(),
        },
        longLivedToken: {
          token: longLivedToken,
          expiresAt: expiresAt,
          createdAt: Date.now(),
          expiresIn: expiresIn,
        },
        pageAccessToken: {
          token: pageAccessToken || null,
          expiresAt: null,
          createdAt: Date.now(),
        },
        userId: userId,
        userName: userName || null,
        pageId: pageId || null,
        pageName: pageName || null,
      };
      console.log(`✅ Created new Facebook tokens file for userId: ${userId}`);
    }

    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
  } catch (error) {
    console.error(`❌ Error saving Facebook tokens for ${userId}:`, error);
    throw error;
  }
} */

/**
 * Load Facebook tokens from JSON file (legacy - kept for backward compatibility)
 * @param {string} userId - Facebook user ID
 * @returns {Object|null} Tokens data or null if not found
 * DISABLED: Using database instead of files
 */
/* function loadFacebookTokensFromFile(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `facebook_${userId}_tokens.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    const tokensData = JSON.parse(data);

    return tokensData;
  } catch (error) {
    console.error(`❌ Error loading Facebook tokens for ${userId}:`, error);
    return null;
  }
} */

/**
 * Load Facebook long-lived token from JSON file
 * @param {string} userId - Facebook user ID
 * @returns {Object|null} Token data or null if not found/expired
 * DISABLED: Using database instead of files
 */
/* function loadFacebookLongLivedToken(userId) {
  try {
    const tokensData = loadFacebookTokens(userId);
    if (!tokensData || !tokensData.longLivedToken) {
      return null;
    }

    const tokenData = tokensData.longLivedToken;

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log(`⚠️ Facebook long-lived token for ${userId} has expired`);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error(`❌ Error loading Facebook long-lived token for ${userId}:`, error);
    return null;
  }
}

/**
 * Load Facebook page access token from database
 * @param {string} appUserId - Application user ID (required)
 * @param {string} platformUserId - Facebook user ID (platformUserId)
 * @returns {Object|null} Token data or null if not found/expired
 */
async function loadFacebookPageAccessToken(appUserId, platformUserId) {
  if (!appUserId) {
    throw new Error("Application user ID is required to load Facebook tokens");
  }
  try {
    // Try database first - always filter by user
    const tokenData = await loadFacebookTokens(appUserId, platformUserId);
    if (tokenData && tokenData.pageAccessToken) {
      return {
        token: tokenData.pageAccessToken,
        expiresAt: null, // Will be calculated if needed
      };
    }

    // Fallback to file for backward compatibility - DISABLED: Using database only
    /* const tokensData = loadFacebookTokensFromFile(userId);
    if (!tokensData || !tokensData.pageAccessToken) {
      return null;
    }

    const tokenDataFile = tokensData.pageAccessToken;

    // Check if token is expired (page tokens usually don't expire, but check anyway)
    if (tokenDataFile.expiresAt && Date.now() > tokenDataFile.expiresAt) {
      console.log(`⚠️ Facebook page access token for ${userId} has expired`);
      return null;
    }

    return tokenDataFile; */
  } catch (error) {
    console.error(`❌ Error loading Facebook page access token for ${platformUserId}:`, error);
    return null;
  }
}

/**
 * Delete Facebook tokens from database
 * @param {string} userId - Facebook user ID (platformUserId)
 * @param {string} appUserId - Optional application user ID (from authentication)
 */
async function deleteFacebookTokens(userId, appUserId = null) {
  try {
    // Delete from database
    await deleteFacebookTokensDB(appUserId, userId);

    // Also delete refresh token if it exists (file-based for now)
    try {
      deleteFacebookRefreshToken(userId);
    } catch (refreshError) {
      console.warn(`⚠️ Could not delete Facebook refresh token file for ${userId}:`, refreshError);
    }
  } catch (error) {
    console.error(`❌ Error deleting Facebook tokens for ${userId}:`, error);
    throw error;
  }
}

// ==================== FACEBOOK REFRESH TOKEN STORAGE ====================
// Moved to ./services/refreshTokens.js

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

  // Log any unrecognized webhook events for debugging
  if (body.object !== "whatsapp_business_account") {
    console.log(`⚠️ Unrecognized webhook object type: ${body.object}`);
    console.log(`📩 Full webhook payload:`, JSON.stringify(body, null, 2));
  }

  // Always respond with 200 OK (Meta requires a response within 20 seconds)
  // Even if we don't recognize the webhook, we should respond to prevent retries
  res.sendStatus(200);
});

// ✅ INSTAGRAM WEBHOOK ENDPOINTS

// ✅ 1️⃣ VERIFY INSTAGRAM WEBHOOK (Meta sends a GET request here)
app.get("/webhook/instagram", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "test_instagram_webhook_2025"; // Use same token or set INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Instagram webhook verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Instagram webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Instagram webhook verification failed. Token mismatch or invalid mode.");
    res.sendStatus(403);
  }
});

// ✅ 2️⃣ RECEIVE INSTAGRAM MESSAGES OR STATUS UPDATES
app.post("/webhook/instagram", (req, res) => {
  const body = req.body;

  console.log("📩 New Instagram webhook event:", JSON.stringify(body, null, 2));

  // Instagram webhooks can come as object type "instagram" or "page"
  // If it's a "page" object, check if it's a Facebook page and skip it (Facebook has its own webhook)
  if (body.object === "instagram" || body.object === "page") {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const pageId = entry?.id || entry?.recipient?.id || changes?.value?.recipient?.id || null;

    // Helper function to check if this is a Facebook page (skip it, let Facebook webhook handle it)
    const isFacebookPage = (pageId) => {
      if (!pageId) return false;
      try {
        const tokensDir = path.join(__dirname, "tokens");
        const files = fs.readdirSync(tokensDir);
        for (const file of files) {
          if (file.startsWith("facebook_") && file.endsWith("_tokens.json")) {
            try {
              const filePath = path.join(tokensDir, file);
              const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
              if (data.pageId && String(data.pageId) === String(pageId)) {
                return true;
              }
            } catch (e) {
              // Skip invalid files
            }
          }
        }
      } catch (e) {
        console.error("Error checking Facebook page ID:", e);
      }
      return false;
    };

    // Skip if this is a Facebook page (Facebook has its own webhook endpoint)
    if (body.object === "page" && isFacebookPage(pageId)) {
      console.log(
        `⚠️ Skipping Facebook page webhook (Page ID: ${pageId}) - Facebook has its own webhook endpoint`
      );
      res.sendStatus(200);
      return;
    }

    console.log(`📸 Instagram webhook received - Object: ${body.object}`);
    console.log(`📸 Webhook entry structure:`, {
      hasEntry: !!entry,
      hasChanges: !!changes,
      hasMessaging: !!entry?.messaging,
      field: changes?.field,
      valueKeys: changes?.value ? Object.keys(changes.value) : [],
      pageId: pageId,
    });

    // Helper function to process a messaging event
    const processMessagingEvent = (messaging, value = null) => {
      const message = messaging.message;
      if (!message) return;

      // Check if this is an echo message (sent by the user themselves)
      const isEcho = message.is_echo === true || message.is_self === true;

      // Extract sender and recipient IDs
      const senderId = messaging.sender?.id || message.from?.id || entry?.id || "unknown";
      const recipientId = messaging.recipient?.id || entry?.id || "unknown";

      // For echo messages: message was sent BY the page/user TO another user
      // For incoming messages: message was sent BY another user TO the page/user
      let from, contactUserId, direction;

      if (isEcho) {
        // Echo message: sent by page/user, to another user
        // We want to show this in the conversation with the recipient
        from = senderId; // The page/user who sent it
        contactUserId = recipientId; // The other user (conversation partner)
        direction = "outgoing";
        console.log(`📸 Processing echo message (sent by ${from} to ${contactUserId})`);
      } else {
        // Incoming message: sent by another user, to page/user
        from = senderId; // The other user who sent it
        contactUserId = senderId; // The conversation is with the sender
        direction = "incoming";
        console.log(`📸 Processing incoming message from ${from}`);
      }

      // Extract message text
      const text = message.text || message.message?.text || "";

      const messageId = message.mid || message.id || `ig_${Date.now()}_${Math.random()}`;
      const timestamp = messaging.timestamp
        ? messaging.timestamp * 1000
        : message.timestamp
        ? message.timestamp * 1000
        : message.created_time
        ? new Date(message.created_time).getTime()
        : Date.now();

      const type = message.type || "text";
      const username = messaging.sender?.username || message.from?.username || null;

      console.log(
        `📱 Instagram message from ${from}: ${text.substring(
          0,
          50
        )}... (direction: ${direction}, contact: ${contactUserId})`
      );

      // Handle Instagram messages
      const instagramContactId = contactUserId;

      if (!instagramMessagesStore.has(instagramContactId)) {
        instagramMessagesStore.set(instagramContactId, []);
      }

      const messageObj = {
        id: messageId,
        from: from,
        to: isEcho ? contactUserId : "me",
        text: text ? { body: text } : null,
        type: type,
        timestamp: timestamp,
        direction: direction,
        status: isEcho ? "sent" : "received",
        username: username,
        platform: "instagram", // Mark as Instagram message
      };

      const messages = instagramMessagesStore.get(instagramContactId);

      // Check if message already exists (prevent duplicates)
      const exists = messages.some((msg) => msg.id === messageId);
      if (exists) {
        console.log(`⚠️ Instagram message ${messageId} already exists, skipping duplicate`);
        return; // Skip this message, continue with next
      }

      messages.push(messageObj);

      // Keep only last 1000 messages per contact
      if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
      }

      instagramMessagesStore.set(instagramContactId, messages);
      saveInstagramMessages(); // Persist to separate Instagram messages file

      console.log(`📤 Emitting Socket.io event for new Instagram message from ${contactUserId}`);

      // Get all messages for this contact from store (like WhatsApp does)
      const allMessages = instagramMessagesStore.get(instagramContactId) || [];
      const sortedMessages = [...allMessages].sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
      );

      // Emit new message to all connected clients via Socket.io
      io.emit("new_instagram_message", {
        contactId: instagramContactId,
        userId: contactUserId,
        message: messageObj,
      });

      console.log(`📤 Socket.io event emitted: new_instagram_message`, {
        contactId: instagramContactId,
        userId: contactUserId,
        messageId: messageObj.id,
        direction: direction,
      });

      // Emit all messages for this contact (to refresh UI with complete message list)
      io.emit("instagram_messages_refresh", {
        contactId: instagramContactId,
        userId: contactUserId,
        messages: sortedMessages,
      });

      console.log(`📤 Socket.io event emitted: instagram_messages_refresh`, {
        contactId: instagramContactId,
        userId: contactUserId,
        messageCount: sortedMessages.length,
      });

      // Also emit to contacts update (for sidebar refresh)
      io.emit("instagram_contact_update", {
        contactId: instagramContactId,
        userId: contactUserId,
        username: username || contactUserId,
        lastMessage: text,
        timestamp: messageObj.timestamp,
      });
    };

    // Handle Instagram messaging events
    // Instagram webhooks can have two structures:
    // 1. entry[0].changes[0].value.messaging (standard structure)
    // 2. entry[0].messaging (direct messaging structure)

    let messagesToProcess = [];
    let value = null;

    // Check for direct messaging in entry (newer structure)
    if (entry?.messaging && Array.isArray(entry.messaging)) {
      console.log(`📸 Found ${entry.messaging.length} messaging events in entry.messaging`);
      entry.messaging.forEach((messaging) => {
        processMessagingEvent(messaging);
      });
    } else if (entry?.messaging && !Array.isArray(entry.messaging)) {
      // Single messaging event
      console.log(`📸 Found single messaging event in entry.messaging`);
      processMessagingEvent(entry.messaging);
    }
    // Check for changes structure (older structure)
    else if (changes?.field === "messages" || changes?.field === "messaging") {
      value = changes.value;
      console.log(`📸 Processing Instagram messaging field: ${changes.field}`);

      // Instagram messages can be in different locations:
      // 1. value.messages (direct messages array)
      // 2. value.messaging.messages (nested in messaging object)
      // 3. value.messaging (contains sender, recipient, message)
      if (value.messages && Array.isArray(value.messages)) {
        // Direct messages array
        messagesToProcess = value.messages;
        console.log(`📸 Found ${messagesToProcess.length} messages in value.messages`);
      } else if (value.messaging) {
        // Check if messaging is an array or object
        if (Array.isArray(value.messaging)) {
          // Multiple messaging events
          value.messaging.forEach((messaging) => {
            processMessagingEvent(messaging, value);
          });
          console.log(
            `📸 Processed ${value.messaging.length} messaging events from value.messaging array`
          );
        } else if (value.messaging.message) {
          // Single messaging event with message
          processMessagingEvent(value.messaging, value);
          console.log(`📸 Processed message from value.messaging.message`);
        } else if (value.messaging.messages && Array.isArray(value.messaging.messages)) {
          messagesToProcess = value.messaging.messages;
          console.log(`📸 Found ${messagesToProcess.length} messages in value.messaging.messages`);
        }
      }

      // Process messages array if we found one
      if (messagesToProcess.length > 0) {
        messagesToProcess.forEach((message) => {
          // Extract sender ID - can be in different places
          const from =
            message.from?.id ||
            message.sender?.id ||
            value.sender?.id ||
            value.messaging?.sender?.id ||
            message.from ||
            "unknown";

          // Extract message text
          const text =
            message.text?.body || message.message?.text || message.text || message.message || "";

          const messageId = message.mid || message.id || `ig_${Date.now()}_${Math.random()}`;
          const timestamp = message.timestamp
            ? message.timestamp * 1000
            : message.created_time
            ? new Date(message.created_time).getTime()
            : Date.now();

          const type = message.type || message.message?.type || "text";
          const username =
            message.from?.username ||
            value.sender?.username ||
            value.messaging?.sender?.username ||
            null;

          console.log(`📸 New Instagram message from ${from}: ${text.substring(0, 50)}...`);

          // For Instagram, use userId as the key (stored in separate file)
          const instagramContactId = from;

          if (!instagramMessagesStore.has(instagramContactId)) {
            instagramMessagesStore.set(instagramContactId, []);
          }

          const messageObj = {
            id: messageId,
            from: from,
            to: "me",
            text: text ? { body: text } : null,
            type: type,
            timestamp: timestamp,
            direction: "incoming",
            status: "received",
            username: username,
            platform: "instagram", // Mark as Instagram message
          };

          const messages = instagramMessagesStore.get(instagramContactId);

          // Check if message already exists (prevent duplicates)
          const exists = messages.some((msg) => msg.id === messageId);
          if (exists) {
            console.log(`⚠️ Instagram message ${messageId} already exists, skipping duplicate`);
            return; // Skip this message, continue with next
          }

          messages.push(messageObj);

          // Keep only last 1000 messages per contact
          if (messages.length > 1000) {
            messages.splice(0, messages.length - 1000);
          }

          instagramMessagesStore.set(instagramContactId, messages);
          saveInstagramMessages(); // Persist to separate Instagram messages file

          console.log(`📤 Emitting Socket.io event for new Instagram message from ${from}`);

          // Get all messages for this contact from store (like WhatsApp does)
          const allMessages = instagramMessagesStore.get(instagramContactId) || [];
          const sortedMessages = [...allMessages].sort(
            (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
          );

          // Emit new message to all connected clients via Socket.io
          io.emit("new_instagram_message", {
            contactId: instagramContactId,
            userId: from,
            message: messageObj,
          });

          console.log(`📤 Socket.io event emitted: new_instagram_message`, {
            contactId: instagramContactId,
            userId: from,
            messageId: messageObj.id,
          });

          // Emit all messages for this contact (to refresh UI with complete message list)
          io.emit("instagram_messages_refresh", {
            contactId: instagramContactId,
            userId: from,
            messages: sortedMessages,
          });

          console.log(`📤 Socket.io event emitted: instagram_messages_refresh`, {
            contactId: instagramContactId,
            userId: from,
            messageCount: sortedMessages.length,
          });

          // Also emit to contacts update (for sidebar refresh)
          io.emit("instagram_contact_update", {
            contactId: instagramContactId,
            userId: from,
            username: username || from,
            lastMessage: text,
            timestamp: messageObj.timestamp,
          });
        });
      } else if (messagesToProcess.length === 0 && !entry?.messaging) {
        console.log(`⚠️ No Instagram messages found in webhook payload`);
        console.log(`📸 Full value structure:`, JSON.stringify(value, null, 2));
      }

      // Handle Instagram message status updates (if available)
      if (value?.statuses) {
        value.statuses.forEach((status) => {
          const messageId = status.id;
          const statusValue = status.status; // sent, delivered, read, failed
          const recipientId = status.recipient_id;

          console.log(
            `📦 Instagram message status update: ${messageId} → ${statusValue} (recipient: ${recipientId})`
          );

          // Find and update message status in all contacts
          let messageUpdated = false;
          messagesStore.forEach((messages, contactId) => {
            // Only check Instagram contacts
            if (!contactId.startsWith("instagram_")) {
              return;
            }

            const messageIndex = messages.findIndex((msg) => msg.id === messageId);
            if (messageIndex !== -1) {
              const message = messages[messageIndex];

              // Only update status for outgoing messages
              if (message.direction === "outgoing") {
                // Map Instagram status to our status values
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
                    `✅ Updated Instagram message ${messageId} status: ${message.status} → ${newStatus}`
                  );
                }
              }
            }
          });

          if (messageUpdated) {
            saveMessages(); // Persist to file

            // Emit status update to all connected clients via Socket.io
            io.emit("instagram_message_status_update", {
              messageId: messageId,
              status: statusValue,
              recipientId: recipientId,
            });

            console.log(`📤 Emitted Instagram status update event: ${messageId} → ${statusValue}`);
          }
        });
      }
    } else if (!entry?.messaging) {
      console.log(
        `⚠️ Instagram webhook received but field is not 'messages' or 'messaging': ${changes?.field}`
      );
    }
  } else {
    console.log(
      `⚠️ Instagram webhook received but object type is not 'instagram' or 'page': ${body.object}`
    );
  }

  // Always respond with 200 OK (Meta requires a response within 20 seconds)
  res.sendStatus(200);
});

// ✅ FACEBOOK WEBHOOK ENDPOINTS

// ✅ 1️⃣ VERIFY FACEBOOK WEBHOOK (Meta sends a GET request here)
app.get("/webhook/facebook", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "test_facebook_webhook_2025";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Facebook webhook verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Facebook webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Facebook webhook verification failed. Token mismatch or invalid mode.");
    res.sendStatus(403);
  }
});

// ✅ 2️⃣ RECEIVE FACEBOOK MESSENGER MESSAGES OR STATUS UPDATES
app.post("/webhook/facebook", async (req, res) => {
  const body = req.body;

  console.log("📩 New Facebook webhook event:", JSON.stringify(body, null, 2));

  // Facebook Messenger webhooks come as object type "page"
  if (body.object === "page") {
    console.log(`📘 Facebook Page webhook received`);
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];

    // Get page ID from entry to identify the Facebook page
    const pageId = entry?.id || entry?.recipient?.id || changes?.value?.recipient?.id || null;

    // Helper function to check if this is a Facebook page (not Instagram)
    const isFacebookPage = async (pageId) => {
      if (!pageId) return false;
      // Check if pageId matches any stored Facebook page ID in database
      try {
        const integration = await Integration.findOne({
          platform: "facebook",
          facebookPageId: String(pageId),
        });

        if (integration && integration.facebookPageId) {
          console.log(`✅ Found Facebook page in database: ${pageId}`);
          return true;
        }
      } catch (e) {
        console.error("Error checking Facebook page ID from database:", e);
      }
      return false;
    };

    const isFacebook = await isFacebookPage(pageId);

    if (!isFacebook) {
      console.log(`⚠️ Page ID ${pageId} is not a Facebook page, skipping...`);
      res.sendStatus(200);
      return;
    }

    console.log(`📘 Facebook Messenger webhook - Page ID: ${pageId}`);

    console.log(`📘 Webhook entry structure:`, {
      hasEntry: !!entry,
      hasChanges: !!changes,
      hasMessaging: !!entry?.messaging,
      field: changes?.field,
      valueKeys: changes?.value ? Object.keys(changes.value) : [],
      pageId: pageId,
    });

    // Helper function to process a Facebook messaging event
    const processFacebookMessagingEvent = (messaging, value = null) => {
      const message = messaging.message;
      if (!message) return;

      // Check if this is an echo message (sent by the page themselves)
      const isEcho = message.is_echo === true || message.is_self === true;

      // Extract sender and recipient IDs
      const senderId = messaging.sender?.id || message.from?.id || entry?.id || "unknown";
      const recipientId = messaging.recipient?.id || entry?.id || "unknown";

      // For echo messages: message was sent BY the page TO another user
      // For incoming messages: message was sent BY another user TO the page
      let from, contactUserId, direction;

      if (isEcho) {
        // Echo message: sent by page, to another user
        from = senderId; // The page who sent it
        contactUserId = recipientId; // The other user (conversation partner)
        direction = "outgoing";
        console.log(`📘 Processing Facebook echo message (sent by ${from} to ${contactUserId})`);
      } else {
        // Incoming message: sent by another user, to page
        from = senderId; // The other user who sent it
        contactUserId = senderId; // The conversation is with the sender
        direction = "incoming";
        console.log(`📘 Processing Facebook incoming message from ${from}`);
      }

      // Extract message text
      const text = message.text || message.message?.text || "";

      const messageId = message.mid || message.id || `fb_${Date.now()}_${Math.random()}`;
      const timestamp = messaging.timestamp
        ? messaging.timestamp * 1000
        : message.timestamp
        ? message.timestamp * 1000
        : message.created_time
        ? new Date(message.created_time).getTime()
        : Date.now();

      const type = message.type || "text";

      console.log(
        `📘 Facebook message from ${from}: ${text.substring(
          0,
          50
        )}... (direction: ${direction}, contact: ${contactUserId})`
      );

      // Use userId as the key for Facebook messages
      const facebookContactId = contactUserId;

      if (!facebookMessagesStore.has(facebookContactId)) {
        facebookMessagesStore.set(facebookContactId, []);
      }

      const messageObj = {
        id: messageId,
        from: from,
        to: isEcho ? contactUserId : "me",
        text: text ? { body: text } : null,
        type: type,
        timestamp: timestamp,
        direction: direction,
        status: isEcho ? "sent" : "received",
        platform: "facebook", // Mark as Facebook message
      };

      const messages = facebookMessagesStore.get(facebookContactId);

      // Check if message already exists (prevent duplicates)
      const exists = messages.some((msg) => msg.id === messageId);
      if (exists) {
        console.log(`⚠️ Facebook message ${messageId} already exists, skipping duplicate`);
        return; // Skip this message, continue with next
      }

      messages.push(messageObj);

      // Keep only last 1000 messages per contact
      if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
      }

      facebookMessagesStore.set(facebookContactId, messages);
      saveFacebookMessages(); // Persist to separate Facebook messages file

      console.log(`📤 Emitting Socket.io event for new Facebook message from ${contactUserId}`);

      // Get all messages for this contact from store
      const allMessages = facebookMessagesStore.get(facebookContactId) || [];
      const sortedMessages = [...allMessages].sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
      );

      // Emit new message to all connected clients via Socket.io
      io.emit("new_facebook_message", {
        contactId: facebookContactId,
        userId: contactUserId,
        message: messageObj,
      });

      console.log(`📤 Socket.io event emitted: new_facebook_message`, {
        contactId: facebookContactId,
        userId: contactUserId,
        messageId: messageObj.id,
        direction: direction,
      });

      // Emit all messages for this contact (to refresh UI with complete message list)
      io.emit("facebook_messages_refresh", {
        contactId: facebookContactId,
        userId: contactUserId,
        messages: sortedMessages,
      });

      console.log(`📤 Socket.io event emitted: facebook_messages_refresh`, {
        contactId: facebookContactId,
        userId: contactUserId,
        messageCount: sortedMessages.length,
      });

      // Also emit to contacts update (for sidebar refresh)
      io.emit("facebook_contact_update", {
        contactId: facebookContactId,
        userId: contactUserId,
        lastMessage: text,
        timestamp: messageObj.timestamp,
      });
    };

    // Handle Facebook messaging events
    // Facebook webhooks can have two structures:
    // 1. entry[0].changes[0].value.messaging (standard structure)
    // 2. entry[0].messaging (direct messaging structure)

    let value = null;

    // Check for direct messaging in entry (newer structure)
    if (entry?.messaging && Array.isArray(entry.messaging)) {
      console.log(`📘 Found ${entry.messaging.length} messaging events in entry.messaging`);
      entry.messaging.forEach((messaging) => {
        processFacebookMessagingEvent(messaging);
      });
    } else if (entry?.messaging && !Array.isArray(entry.messaging)) {
      // Single messaging event
      console.log(`📘 Found single messaging event in entry.messaging`);
      processFacebookMessagingEvent(entry.messaging);
    }
    // Check for changes structure (older structure)
    else if (changes?.field === "messages" || changes?.field === "messaging") {
      value = changes.value;
      console.log(`📘 Processing Facebook messaging field: ${changes.field}`);

      // Facebook messages can be in different locations:
      // 1. value.messaging (contains sender, recipient, message)
      if (value.messaging) {
        // Check if messaging is an array or object
        if (Array.isArray(value.messaging)) {
          // Multiple messaging events
          value.messaging.forEach((messaging) => {
            processFacebookMessagingEvent(messaging, value);
          });
          console.log(
            `📘 Processed ${value.messaging.length} messaging events from value.messaging array`
          );
        } else if (value.messaging.message) {
          // Single messaging event with message
          processFacebookMessagingEvent(value.messaging, value);
          console.log(`📘 Processed message from value.messaging.message`);
        }
      } else {
        console.log(`⚠️ No Facebook messages found in webhook payload`);
        console.log(`📘 Full value structure:`, JSON.stringify(value, null, 2));
      }
    } else if (!entry?.messaging) {
      console.log(
        `⚠️ Facebook webhook received but field is not 'messages' or 'messaging': ${changes?.field}`
      );
    }
  } else {
    console.log(`⚠️ Facebook webhook received but object type is not 'page': ${body.object}`);
  }

  // Always respond with 200 OK (Meta requires a response within 20 seconds)
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

// ✅ Instagram Message API Endpoints

// Get all messages for a specific Facebook user (from webhook store)
app.get("/api/facebook/messages/:userId", (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

    const userId = req.params.userId;

    // Validate user ID
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid Facebook user ID",
        received: userId,
      });
    }

    const facebookContactId = userId;
    const messages = facebookMessagesStore.get(facebookContactId) || [];

    // Sort by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    res.json({
      success: true,
      userId: userId,
      contactId: facebookContactId,
      messages: sortedMessages,
      count: sortedMessages.length,
    });
  } catch (error) {
    console.error("Error in /api/facebook/messages/:userId:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get all messages for a specific Instagram user
app.get("/api/instagram/messages/:userId", (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

    const userId = req.params.userId;

    // Validate user ID
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid Instagram user ID",
        received: userId,
      });
    }

    const instagramContactId = userId;
    const messages = instagramMessagesStore.get(instagramContactId) || [];

    // Sort by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    res.json({
      success: true,
      userId: userId,
      contactId: instagramContactId,
      messages: sortedMessages,
      count: sortedMessages.length,
    });
  } catch (error) {
    console.error("Error in /api/instagram/messages/:userId:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get stored messages and conversation info for a selected user
app.get("/api/instagram/stored-messages/:userId", async (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

    const userId = req.params.userId;

    // Validate user ID
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid Instagram user ID",
        received: userId,
      });
    }

    const instagramContactId = userId;
    const messages = instagramMessagesStore.get(instagramContactId) || [];

    // Sort by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Extract contact information from messages
    let contactName = userId;
    let contactUsername = null;
    let userName = null;
    let lastMessage = null;
    let lastTimestamp = 0;
    let userNameTimestamp = 0;

    // Search through messages to find contact info and last message
    // Iterate backwards to get the most recent information first
    for (let i = messages.length - 1; i >= 0; i--) {
      try {
        const msg = messages[i];

        // Skip invalid messages
        if (!msg || typeof msg !== "object") {
          continue;
        }

        // Get username from message - prefer incoming messages (from === userId)
        if (msg.username) {
          const msgTimestamp = msg.timestamp || 0;
          // If message is from the contact (incoming), prioritize that username
          if (msg.from === userId || msg.direction === "incoming") {
            if (!userName || msgTimestamp > userNameTimestamp) {
              userName = msg.username;
              contactUsername = msg.username;
              userNameTimestamp = msgTimestamp;
              if (contactName === userId) {
                contactName = msg.username;
              }
            }
          } else if (!userName) {
            // Fallback: use any username found if we don't have one yet
            userName = msg.username;
            contactUsername = msg.username;
            userNameTimestamp = msgTimestamp;
            if (contactName === userId) {
              contactName = msg.username;
            }
          }
        }

        // Get name from profile if available
        if (msg.profile?.name && contactName === userId) {
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
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i] && typeof messages[i] === "object") {
          lastMessage = messages[i];
          break;
        }
      }
    }

    // Try to get username from Facebook Graph API if available
    const pageAccessToken = await getAnyInstagramPageAccessToken();
    let graphApiUsername = null;
    if (pageAccessToken && (!userName || !contactUsername)) {
      try {
        graphApiUsername = await getInstagramUsernameFromGraphAPI(userId, pageAccessToken);
        if (graphApiUsername) {
          console.log(`✅ Fetched username from Graph API for ${userId}: ${graphApiUsername}`);
          if (!userName) {
            userName = graphApiUsername;
            contactUsername = graphApiUsername;
            if (contactName === userId) {
              contactName = graphApiUsername;
            }
          }
        }
      } catch (graphError) {
        console.warn(
          `⚠️ Error fetching username from Graph API for ${userId}:`,
          graphError.message
        );
      }
    }

    // Build conversation info
    const conversation = {
      userId: userId,
      contactId: instagramContactId,
      name: contactName,
      username: contactUsername,
      userName: userName || contactUsername || graphApiUsername,
      lastMessage: lastMessage?.text?.body || lastMessage?.message || null,
      lastMessageTime: lastMessage?.timestamp || null,
      messageCount: messages.length,
      hasMessages: messages.length > 0,
      platform: "instagram",
      source: "stored",
    };

    res.json({
      success: true,
      conversation: conversation,
      messages: sortedMessages,
      count: sortedMessages.length,
    });
  } catch (error) {
    console.error("Error in /api/instagram/stored-messages/:userId:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get all Instagram contacts with messages
app.get("/api/instagram/contacts", (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

    const contacts = [];

    instagramMessagesStore.forEach((messages, userId) => {
      try {
        // Validate user ID
        if (!userId || typeof userId !== "string") {
          return; // Skip invalid user IDs
        }

        // Validate messages array
        if (!Array.isArray(messages)) {
          return; // Skip invalid message arrays
        }

        // Find name from any message's username or profile
        let contactName = userId;
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

            // Get name from username if available
            if (msg.username && contactName === userId) {
              contactName = msg.username;
            }

            // Get name from profile if available
            if (msg.profile?.name && contactName === userId) {
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

        // Include contact even if there are no messages
        contacts.push({
          userId: userId,
          contactId: `instagram_${userId}`, // Keep for backward compatibility
          name: contactName, // Will be userId if no username/profile name found
          hasMessages: messages.length > 0,
          lastMessage: lastMessage?.text?.body || lastMessage?.message || "",
          timestamp: lastMessage?.timestamp || 0,
          messageCount: messages.length,
          platform: "instagram",
        });
      } catch (contactError) {
        // Log error but continue processing other contacts
        console.warn(`Error processing Instagram contact ${userId}:`, contactError);
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
    console.error("Error in /api/instagram/contacts:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Helper function to get Instagram username from user ID using Facebook Graph API
async function getInstagramUsernameFromGraphAPI(instagramUserId, pageAccessToken) {
  try {
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

    // Try to get username from Instagram user ID
    // Note: This requires the user ID to be accessible via the page access token
    const userInfoUrl = `https://graph.facebook.com/${graphVersion}/${instagramUserId}?fields=username&access_token=${pageAccessToken}`;

    const response = await fetch(userInfoUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.username) {
        return data.username;
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn(
        `⚠️ Could not fetch username for Instagram user ${instagramUserId}:`,
        errorData.error?.message || "Unknown error"
      );
    }
  } catch (error) {
    console.warn(
      `⚠️ Error fetching username for Instagram user ${instagramUserId}:`,
      error.message
    );
  }

  return null;
}

// Helper function to get any available page access token for Instagram
async function getAnyInstagramPageAccessToken() {
  try {
    // Query database for any Instagram integration with valid page access token
    const integrations = await Integration.find({
      platform: "instagram",
    });

    // Find the first integration with a valid (non-expired) page access token
    for (const integration of integrations) {
      if (
        integration.instagramPageAccessToken?.token &&
        !integration.isTokenExpired("instagramPageAccessToken")
      ) {
        console.log(
          `✅ Found valid Instagram page access token for platformUserId: ${integration.platformUserId}`
        );
        return integration.instagramPageAccessToken.token;
      }
    }

    console.log("⚠️ No valid Instagram page access token found in database");
    return null;
  } catch (error) {
    console.error("❌ Error getting Instagram page access token from database:", error);
    return null;
  }
}

// Get all conversations from stored messages (for displaying in conversation list)
app.get("/api/instagram/conversations/stored", async (req, res) => {
  try {
    // Set CORS headers explicitly
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app"
    );

    const conversations = [];

    // Get page access token for Graph API calls
    const pageAccessToken = await getAnyInstagramPageAccessToken();
    if (!pageAccessToken) {
      console.warn(
        "⚠️ No Instagram page access token available, will use usernames from stored messages only"
      );
    }

    // Process conversations - need to use for...of for async operations
    const userIds = Array.from(instagramMessagesStore.keys());

    for (const userId of userIds) {
      const messages = instagramMessagesStore.get(userId);

      try {
        // Validate user ID
        if (!userId || typeof userId !== "string") {
          continue; // Skip invalid user IDs
        }

        // Validate messages array
        if (!Array.isArray(messages)) {
          continue; // Skip invalid message arrays
        }

        // Find contact information from messages
        let contactName = userId;
        let contactUsername = null;
        let userName = null; // Store as userName (camelCase)
        let lastMessage = null;
        let lastTimestamp = 0;
        let userNameTimestamp = 0; // Track timestamp of username to get most recent
        let unreadCount = 0;

        // Search through messages to find contact info and last message
        // Iterate backwards to get the most recent information first
        for (let i = messages.length - 1; i >= 0; i--) {
          try {
            const msg = messages[i];

            // Skip invalid messages
            if (!msg || typeof msg !== "object") {
              continue;
            }

            // Get username from message - prefer incoming messages (from === userId)
            // or any message that has a username field
            if (msg.username) {
              const msgTimestamp = msg.timestamp || 0;
              // If message is from the contact (incoming), prioritize that username
              if (msg.from === userId || msg.direction === "incoming") {
                if (!userName || msgTimestamp > userNameTimestamp) {
                  userName = msg.username;
                  contactUsername = msg.username;
                  userNameTimestamp = msgTimestamp;
                  if (contactName === userId) {
                    contactName = msg.username;
                  }
                }
              } else if (!userName) {
                // Fallback: use any username found if we don't have one yet
                userName = msg.username;
                contactUsername = msg.username;
                userNameTimestamp = msgTimestamp;
                if (contactName === userId) {
                  contactName = msg.username;
                }
              }
            }

            // Get name from profile if available
            if (msg.profile?.name && contactName === userId) {
              contactName = msg.profile.name;
            }

            // Track the most recent message by timestamp
            // Normalize timestamp for comparison
            let msgTimestamp = msg.timestamp;
            if (typeof msgTimestamp === "number") {
              // If timestamp is very large (> 1e13), it's likely in microseconds, convert to milliseconds
              if (msgTimestamp > 1e13) {
                msgTimestamp = msgTimestamp / 1000;
              }
              // If timestamp is small (< 1e9), it's likely in seconds, convert to milliseconds
              else if (msgTimestamp < 1e9) {
                msgTimestamp = msgTimestamp * 1000;
              }
              // Otherwise assume it's already in milliseconds
            } else if (typeof msgTimestamp === "string") {
              msgTimestamp = new Date(msgTimestamp).getTime();
            } else {
              continue; // Skip messages without valid timestamps
            }

            if (msgTimestamp && msgTimestamp > lastTimestamp) {
              lastTimestamp = msgTimestamp;
              lastMessage = {
                ...msg,
                timestamp: msgTimestamp, // Store normalized timestamp
              };
            }

            // Count unread messages (you can customize this logic based on your needs)
            // For now, we'll skip unread count or implement based on read status
          } catch (msgError) {
            // Continue with next message if this one fails
            continue;
          }
        }

        // If no last message found by timestamp, use the last message in array
        if (!lastMessage && messages.length > 0) {
          // Find first valid message and normalize its timestamp
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i] && typeof messages[i] === "object") {
              const msg = messages[i];
              let msgTimestamp = msg.timestamp;
              if (typeof msgTimestamp === "number") {
                if (msgTimestamp > 1e13) {
                  msgTimestamp = msgTimestamp / 1000;
                } else if (msgTimestamp < 1e9) {
                  msgTimestamp = msgTimestamp * 1000;
                }
              } else if (typeof msgTimestamp === "string") {
                msgTimestamp = new Date(msgTimestamp).getTime();
              } else {
                msgTimestamp = Date.now();
              }
              lastMessage = {
                ...msg,
                timestamp: msgTimestamp,
              };
              break;
            }
          }
        }

        // Try to get username from Facebook Graph API if we have a token
        let graphApiUsername = null;
        if (pageAccessToken && (!userName || !contactUsername)) {
          try {
            graphApiUsername = await getInstagramUsernameFromGraphAPI(userId, pageAccessToken);
            if (graphApiUsername) {
              console.log(`✅ Fetched username from Graph API for ${userId}: ${graphApiUsername}`);
              // Use Graph API username if we don't have one from messages, or if Graph API returned one
              if (!userName) {
                userName = graphApiUsername;
                contactUsername = graphApiUsername;
                if (contactName === userId) {
                  contactName = graphApiUsername;
                }
              }
            }
          } catch (graphError) {
            console.warn(
              `⚠️ Error fetching username from Graph API for ${userId}:`,
              graphError.message
            );
          }
        }

        // Normalize last message timestamp if it exists
        let normalizedLastMessageTime = null;
        if (lastMessage && lastMessage.timestamp) {
          normalizedLastMessageTime = lastMessage.timestamp; // Already normalized above
        }

        // Extract last message text from various possible formats
        let lastMessageText = null;
        if (lastMessage) {
          lastMessageText =
            lastMessage.text?.body ||
            lastMessage.message ||
            lastMessage.text ||
            (typeof lastMessage.body === "string" ? lastMessage.body : null) ||
            null;
        }

        // Build conversation object
        const conversation = {
          id: userId, // Use userId as conversation ID
          conversationId: userId, // Use userId as conversationId
          userId: userId, // Contact's Instagram user ID
          name: contactName, // Display name (username or userId)
          username: contactUsername, // Username if available (for backward compatibility)
          userName: userName || contactUsername || graphApiUsername, // Username as userName (camelCase) - preferred field, from Graph API or messages
          lastMessage: lastMessageText,
          lastMessageTime: normalizedLastMessageTime,
          messageCount: messages.length,
          unreadCount: unreadCount,
          hasMessages: messages.length > 0,
          platform: "instagram",
          source: "stored", // Indicates from stored messages
          // Additional metadata
          updatedAt: normalizedLastMessageTime,
          createdAt:
            messages.length > 0
              ? (() => {
                  // Normalize first message timestamp
                  const firstMsg = messages[0];
                  if (!firstMsg || !firstMsg.timestamp) return null;
                  let firstTimestamp = firstMsg.timestamp;
                  if (typeof firstTimestamp === "number") {
                    if (firstTimestamp > 1e13) {
                      firstTimestamp = firstTimestamp / 1000;
                    } else if (firstTimestamp < 1e9) {
                      firstTimestamp = firstTimestamp * 1000;
                    }
                  } else if (typeof firstTimestamp === "string") {
                    firstTimestamp = new Date(firstTimestamp).getTime();
                  } else {
                    return null;
                  }
                  return firstTimestamp;
                })()
              : null,
        };

        conversations.push(conversation);
      } catch (conversationError) {
        // Log error but continue processing other conversations
        console.warn(`Error processing Instagram conversation ${userId}:`, conversationError);
      }
    }

    // Sort by most recent message (newest first)
    conversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

    res.json({
      success: true,
      conversations: conversations,
      count: conversations.length,
      source: "stored",
    });
  } catch (error) {
    console.error("Error in /api/instagram/conversations/stored:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Get new Instagram messages (for polling)
app.get("/api/instagram/messages/new/:userId", (req, res) => {
  const userId = req.params.userId;
  const instagramContactId = userId;
  const since = parseInt(req.query.since) || 0; // Timestamp to get messages after

  const messages = instagramMessagesStore.get(instagramContactId) || [];
  const newMessages = messages.filter((msg) => msg.timestamp > since);

  res.json({
    success: true,
    userId: userId,
    contactId: `instagram_${userId}`, // Keep for backward compatibility
    messages: newMessages,
    count: newMessages.length,
  });
});

// Store a sent Instagram message (called from frontend)
app.post("/api/instagram/messages", (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({
      success: false,
      error: "User ID and message are required",
    });
  }

  const instagramContactId = userId;
  if (!instagramMessagesStore.has(instagramContactId)) {
    instagramMessagesStore.set(instagramContactId, []);
  }

  const messages = instagramMessagesStore.get(instagramContactId);

  // Check if message already exists (prevent duplicates)
  const messageId = message.id || `msg_${message.timestamp}_${Date.now()}`;
  const exists = messages.some((msg) => msg.id === messageId);
  if (exists) {
    console.log(`⚠️ Instagram message ${messageId} already exists, skipping duplicate`);
    return res.json({
      success: true,
      message: "Message already exists, skipped duplicate",
    });
  }

  // Ensure message has an ID and platform marker
  if (!message.id) {
    message.id = messageId;
  }
  if (!message.platform) {
    message.platform = "instagram";
  }

  messages.push(message);

  // Keep only last 1000 messages per contact
  if (messages.length > 1000) {
    messages.splice(0, messages.length - 1000);
  }

  instagramMessagesStore.set(instagramContactId, messages);
  saveInstagramMessages();

  res.json({
    success: true,
    message: "Instagram message stored successfully",
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

// Webhook test endpoints - helps verify webhooks are accessible
app.get("/webhook/test", (req, res) => {
  res.json({
    status: "ok",
    message: "WhatsApp webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "test_whatsapp_webhook_2025",
    supportedObjects: ["whatsapp_business_account"],
    endpoints: {
      verification: "GET /webhook",
      receive: "POST /webhook",
    },
  });
});

app.get("/webhook/instagram/test", (req, res) => {
  res.json({
    status: "ok",
    message: "Instagram webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "test_instagram_webhook_2025",
    supportedObjects: ["instagram", "page"],
    endpoints: {
      verification: "GET /webhook/instagram",
      receive: "POST /webhook/instagram",
    },
  });
});

// Facebook webhook test endpoint
app.get("/webhook/facebook/test", (req, res) => {
  res.json({
    status: "ok",
    message: "Facebook webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "test_facebook_webhook_2025",
    supportedObjects: ["page"],
    endpoints: {
      verification: "GET /webhook/facebook",
      receive: "POST /webhook/facebook",
    },
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

// Handle OPTIONS preflight for Instagram exchange-token endpoint
app.options("/api/instagram/exchange-token", (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

// Exchange Instagram OAuth code for access token (using Facebook OAuth for Instagram Business API)
app.post("/api/instagram/exchange-token", optionalAuthenticate, async (req, res) => {
  // Set CORS headers explicitly
  setCorsHeaders(res);

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
    let refreshToken = null;
    if (longLivedResponse.ok) {
      longLivedData = await longLivedResponse.json();
      longLivedToken = longLivedData.access_token;
      refreshToken = longLivedData.refresh_token || null; // Capture refresh token if available
      if (refreshToken) {
        console.log(`✅ Step 2: Successfully obtained long-lived token with refresh token`);
      } else {
        console.log(`✅ Step 2: Successfully obtained long-lived token (no refresh token)`);
      }
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

    // Use Instagram account ID as platformUserId
    const platformUserId = instagramAccount.id;
    // Use expires_in from long-lived token if available, otherwise use from initial token, or default to 60 days
    const expiresIn = longLivedData?.expires_in || tokenData.expires_in || 5184000;

    // Get user ID from request (required)
    const userId = req.user?._id?.toString() || req.body?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required. Please authenticate or provide userId in request body.",
      });
    }

    // Save tokens to database (will update existing record if platformUserId already exists)
    try {
      await saveInstagramTokens(userId, platformUserId, {
        userAccessToken: longLivedToken,
        pageAccessToken: pageAccessToken,
        expiresIn: expiresIn,
        pageId: pageId,
        pageName: pages.find((p) => p.id === pageId)?.name,
        accountId: instagramAccount.id,
        username: accountInfo.username,
        refreshToken: refreshToken,
      });
      console.log(
        `✅ Instagram tokens saved to database for platformUserId: ${platformUserId} (updated if existed, created if new)`
      );

      // Also save refresh token separately if available (for backward compatibility with refresh token service)
      if (refreshToken) {
        try {
          await saveInstagramRefreshTokenDB(userId, platformUserId, refreshToken);
          console.log(
            `✅ Instagram refresh token saved to database for platformUserId: ${platformUserId}`
          );
        } catch (refreshError) {
          console.error("❌ Error saving refresh token to database:", refreshError);
          // Continue even if refresh token save fails
        }
      }
    } catch (saveError) {
      console.error("❌ Error saving tokens to database:", saveError);
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
      userId: platformUserId, // Include platformUserId in response (for backward compatibility)
    });
  } catch (error) {
    console.error("❌ Error exchanging token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to exchange code for access token",
    });
  }
});

// Exchange Facebook OAuth code for access token

app.post("/api/facebook/exchange-token", optionalAuthenticate, async (req, res) => {
  // Set CORS headers explicitly
  setCorsHeaders(res);

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
        `${redirectUri}` ||
        `${
          process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000"
        }/channels?facebook_connected=true`,
      code: code,
    });

    console.log(`🔐 Step 1: Exchanging Facebook OAuth code for Facebook access token...`);

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
    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token;
    const refreshToken = longLivedData.refresh_token || null; // Capture refresh token if available
    if (refreshToken) {
      console.log(`✅ Step 2: Successfully obtained long-lived token with refresh token`);
    } else {
      console.log(`✅ Step 2: Successfully obtained long-lived token (no refresh token)`);
    }

    // Step 3: Get user's Facebook info
    console.log(`🔐 Step 3: Fetching Facebook user info...`);
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/me?fields=id,name&access_token=${longLivedToken}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json();
      console.error("❌ Failed to fetch user info:", errorData);
      return res.status(userInfoResponse.status).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch user info",
        details: errorData,
      });
    }
    const userInfoData = await userInfoResponse.json();
    console.log("🔍 User info:", userInfoData);
    const userId = userInfoData.id;
    const userName = userInfoData.name;

    // Step 4: Get user's Facebook Pages
    console.log(`🔐 Step 4: Fetching Facebook Pages...`);
    const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`;
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
    console.log(`✅ Step 4: Found ${pages.length} Facebook Page(s)`);

    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No Facebook Pages found. Please create a Facebook Page first.",
      });
    }

    // Select the first page (or you can add logic to select a specific page)
    const selectedPage = pages[0];
    const pageId = selectedPage.id;
    const pageName = selectedPage.name;
    const pageAccessToken = selectedPage.access_token;

    console.log(`✅ Step 4: Selected page "${pageName}" (ID: ${pageId})`);

    // Use expires_in from long-lived token if available, otherwise default to 60 days
    const expiresIn = longLivedData.expires_in || 5184000;

    // Get user ID from request (required)
    console.log("req.user", req.user);
    const appUserId = req.user?._id?.toString() || req.body?.userId;

    if (!appUserId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required. Please authenticate or provide userId in request body.",
      });
    }

    // Use Facebook user ID as platformUserId
    const platformUserId = userId;

    // Save tokens to database (will update existing record if platformUserId already exists)
    try {
      await saveFacebookTokens(appUserId, platformUserId, {
        userAccessToken: longLivedToken, // Use longLivedToken as userAccessToken (same as Instagram)
        pageAccessToken: pageAccessToken,
        expiresIn: expiresIn,
        userName: userName,
        pageId: pageId,
        pageName: pageName,
        refreshToken: refreshToken,
      });
      console.log(
        `✅ Facebook tokens saved to database for platformUserId: ${platformUserId} (updated if existed, created if new)`
      );

      // Also save refresh token separately if available (for backward compatibility with refresh token service)
      if (refreshToken) {
        try {
          await saveFacebookRefreshTokenDB(appUserId, platformUserId, refreshToken);
          console.log(
            `✅ Facebook refresh token saved to database for platformUserId: ${platformUserId}`
          );
        } catch (refreshError) {
          console.error("❌ Error saving refresh token to database:", refreshError);
          // Continue even if refresh token save fails
        }
      }
    } catch (saveError) {
      console.error("❌ Error saving Facebook tokens to database:", saveError);
      // Continue even if save fails, but log the error
    }

    res.json({
      success: true,
      access_token: pageAccessToken, // This is the Facebook page access token - use for Facebook API
      user_access_token: longLivedToken, // Use this for /me/accounts and other user-level calls (same as Instagram)
      token_type: "bearer",
      expires_in: expiresIn,
      facebook_user_id: userId, // Include userId in response
      facebook_user_name: userName, // Include user name in response
      facebook_page_id: pageId,
      facebook_page_name: pageName,
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

// Verify Facebook access token (checks stored file first, then falls back to API)
app.post("/api/verify-facebook-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      });
    }

    console.log(`🔍 Verifying Facebook token...`);

    // First, check if token exists in stored files
    try {
      const files = fs.readdirSync(TOKENS_DIR);
      const facebookTokenFiles = files.filter(
        (file) => file.startsWith("facebook_") && file.endsWith("_tokens.json")
      );

      for (const file of facebookTokenFiles) {
        const filePath = path.join(TOKENS_DIR, file);
        try {
          const data = fs.readFileSync(filePath, "utf8");
          const tokensData = JSON.parse(data);

          // Check if the provided token matches either the user token or long-lived token
          if (
            tokensData.longLivedToken?.token === token ||
            tokensData.userAccessToken?.token === token
          ) {
            // Check if token is expired
            const tokenData =
              tokensData.longLivedToken?.token === token
                ? tokensData.longLivedToken
                : tokensData.userAccessToken;

            if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
              console.log(`⚠️ Stored Facebook token for ${tokensData.userId} has expired`);
              // Continue to API verification
            } else {
              // Token found in file and is valid
              console.log(
                `✅ Facebook token verified from stored file for userId: ${tokensData.userId}`
              );

              // Verify with Facebook API to ensure token is still valid
              const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
              const verifyUrl = `https://graph.facebook.com/${graphVersion}/me?fields=id,name&access_token=${token}`;
              const verifyResponse = await fetch(verifyUrl, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (verifyResponse.ok) {
                const userInfo = await verifyResponse.json();
                return res.json({
                  success: true,
                  message: "Token verified successfully",
                  accountInfo: {
                    facebook_user_id: userInfo.id || tokensData.userId,
                    facebook_user_name: userInfo.name || tokensData.userName,
                    token_source: "stored_file",
                  },
                });
              } else {
                // Token in file is invalid, continue to full verification
                console.log(`⚠️ Stored token is invalid, verifying with API...`);
              }
            }
          }
        } catch (parseError) {
          console.warn(`⚠️ Error reading token file ${file}:`, parseError);
          continue;
        }
      }
    } catch (fileError) {
      console.log(`⚠️ Error checking stored files:`, fileError);
      // Continue to API verification
    }

    // Token not found in files or expired, verify with Facebook API
    console.log(`🔍 Token not found in stored files, verifying with Facebook API...`);
    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const verifyUrl = `https://graph.facebook.com/${graphVersion}/me?fields=id,name&access_token=${token}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      console.error("❌ Facebook token verification failed:", errorData);
      return res.status(verifyResponse.status).json({
        success: false,
        error: errorData.error?.message || "Invalid token. Please check and try again.",
        details: errorData,
      });
    }

    const userInfo = await verifyResponse.json();
    console.log(
      `✅ Facebook token verified successfully for user: ${userInfo.name || userInfo.id}`
    );

    res.json({
      success: true,
      message: "Token verified successfully",
      accountInfo: {
        facebook_user_id: userInfo.id,
        facebook_user_name: userInfo.name,
        token_source: "api_verification",
      },
    });
  } catch (error) {
    console.error("❌ Error verifying Facebook token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to verify token",
    });
  }
});

// ==================== LINKEDIN OAUTH ====================

// LinkedIn OAuth credentials
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "86xusxrrgf3kdp";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
// LinkedIn redirect URI should point to backend callback endpoint
const LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI ||
  `${process.env.REACT_APP_BACKEND_URL || "http://localhost:3001"}/linkedin/callback`;
const scopes = [
  "openid",
  "profile",
  "email",
  "w_member_social",
  "r_ads",
  "r_ads_reporting",
  "w_organization_social",
  "rw_ads",
  "r_organization_social",
  "r_organization_admin",
].join(" ");
const LI_TOKEN_FILE = path.join(TOKENS_DIR, "linkedin_token.json");

// Helper function to save LinkedIn token to file (legacy - kept for backward compatibility)
// DISABLED: Using database instead of files
/* function saveLinkedInTokenToFile(accessToken, expiresIn = null) {
  try {
    // Ensure tokens directory exists
    if (!fs.existsSync(TOKENS_DIR)) {
      fs.mkdirSync(TOKENS_DIR, { recursive: true });
      console.log("✅ Created tokens directory for LinkedIn");
    }

    const tokenData = {
      access_token: accessToken,
      savedAt: Date.now(),
      expiresIn: expiresIn, // in seconds
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
    };
    fs.writeFileSync(LI_TOKEN_FILE, JSON.stringify(tokenData, null, 2));
    console.log(`✅ LinkedIn token saved successfully to: ${LI_TOKEN_FILE}`);
    return true;
  } catch (error) {
    console.error("❌ Error saving LinkedIn token:", error);
    console.error("Token file path:", LI_TOKEN_FILE);
    throw error;
  }
} */

// Helper function to load LinkedIn token from database
async function loadLinkedInTokenFromDB(userId) {
  if (!userId) {
    throw new Error("User ID is required to load LinkedIn token");
  }
  try {
    // Try database first
    const token = await loadLinkedInToken(userId);
    if (token) {
      console.log(`✅ LinkedIn token loaded successfully from database`);
      return token;
    }

    // Fallback to file for backward compatibility - DISABLED: Using database only
    /* if (!fs.existsSync(LI_TOKEN_FILE)) {
      console.log(`⚠️ LinkedIn token not found in database or file: ${LI_TOKEN_FILE}`);
      return null;
    }
    const tokenData = JSON.parse(fs.readFileSync(LI_TOKEN_FILE, "utf8"));
    if (!tokenData.access_token) {
      console.log("⚠️ LinkedIn token file exists but access_token is missing");
      return null;
    }

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      console.log("⚠️ LinkedIn token has expired");
      return null;
    }

    console.log(`✅ LinkedIn token loaded successfully from file: ${LI_TOKEN_FILE}`);
    return tokenData.access_token; */
  } catch (error) {
    console.error("❌ Error loading LinkedIn token:", error);
    console.error("Token file path:", LI_TOKEN_FILE);
    return null;
  }
}

// Step 1: LinkedIn login button - redirects to LinkedIn OAuth
app.get("/linkedin/login", (req, res) => {
  try {
    // Get userId from query parameter
    const userId = req.query?.userId;

    // Generate state for CSRF protection and include userId
    const randomState =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // Encode userId in state parameter (LinkedIn will return it in callback)
    const state = userId ? `${randomState}:${userId}` : randomState;

    const loginUrl =
      "https://www.linkedin.com/oauth/v2/authorization?" +
      `response_type=code&client_id=${LINKEDIN_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}`;

    // Set proper headers before redirect
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Use 302 redirect (temporary) to ensure browser follows it
    // Make sure to use absolute URL - LinkedIn requires absolute URLs
    res.redirect(302, loginUrl);
  } catch (error) {
    console.error("❌ Error in LinkedIn login endpoint:", error);
    const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}/channels?error=login_failed&error_description=${encodeURIComponent(
        error.message
      )}`
    );
  }
});

// Step 2: LinkedIn callback - exchange code for access token
app.get("/linkedin/callback", async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  console.log("🔗 LinkedIn callback received:", { code: code ? "present" : "missing", error });

  // Handle OAuth errors
  if (error) {
    console.error("❌ LinkedIn OAuth error:", { error, errorDescription });
    const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendUrl}/channels?error=${encodeURIComponent(
        error
      )}&error_description=${encodeURIComponent(errorDescription || "")}`
    );
  }

  if (!code) {
    console.error("❌ LinkedIn callback missing authorization code");
    const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/channels?error=missing_code`);
  }

  try {
    const url = "https://www.linkedin.com/oauth/v2/accessToken";
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      // IMPORTANT: This MUST EXACTLY match the URI used in the initial /linkedin/login request.
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    console.log("🔄 Exchanging LinkedIn authorization code for access token...");
    console.log("Redirect URI:", LINKEDIN_REDIRECT_URI);
    console.log("Request params:", {
      grant_type: "authorization_code",
      code: code.substring(0, 10) + "...",
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID.substring(0, 10) + "...",
    });

    const tokenRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    console.log("Token exchange response status:", tokenRes.status);

    const data = await tokenRes.json();
    console.log("Token exchange response:", {
      hasError: !!data.error,
      hasToken: !!data.access_token,
      error: data.error,
      errorDescription: data.error_description,
    });

    // Check for the error and print the token/data
    if (data.error) {
      console.error("❌ LinkedIn Token Exchange Error:", data);
      const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/channels?error=${encodeURIComponent(
          data.error
        )}&error_description=${encodeURIComponent(data.error_description || "")}`
      );
    }

    // Success: Print the access token to the console and save it
    if (!data.access_token) {
      console.error("❌ LinkedIn response missing access_token:", data);
      const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/channels?error=no_token`);
    }

    console.log("✅ Successfully retrieved LinkedIn Access Token");
    console.log("Token preview:", data.access_token.substring(0, 20) + "...");
    console.log("Token expires in:", data.expires_in, "seconds");

    // Get user ID from request (required)
    // Try to extract from state parameter first (passed from login endpoint)
    let userId = req.user?._id?.toString() || req.query?.userId;

    // Extract userId from state if present (format: "randomState:userId")
    const state = req.query?.state;
    if (state && state.includes(":")) {
      const stateParts = state.split(":");
      if (stateParts.length > 1) {
        userId = stateParts[stateParts.length - 1]; // Get last part (userId)
      }
    }

    if (!userId) {
      const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/channels?error=user_id_required`);
    }

    // Save token to database (long-lived token if expires_in is provided)
    try {
      await saveLinkedInToken(userId, data.access_token, data.expires_in || null);
      console.log("✅ LinkedIn token saved to database");
    } catch (saveError) {
      console.error("❌ Failed to save LinkedIn token to database:", saveError);
      const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/channels?error=save_failed`);
    }

    // Redirect back to frontend (token is now stored in file, not passed in URL)
    const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/channels?linkedin_connected=true`);
  } catch (err) {
    console.error("❌ LinkedIn Auth Error:", err);
    const frontendUrl = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}/channels?error=server_error&error_description=${encodeURIComponent(
        err.message
      )}`
    );
  }
});

// Handle OPTIONS preflight for LinkedIn token endpoint (handles all HTTP methods)
app.options("/api/linkedin/token", (req, res) => {
  setCorsHeaders(res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
  res.sendStatus(200);
});

// Get LinkedIn token status (checks if token is valid by verifying with LinkedIn API)
app.get("/api/linkedin/token", optionalAuthenticate, async (req, res) => {
  // Set CORS headers explicitly at the start
  setCorsHeaders(res);

  try {
    // Get user ID from request (required)
    const userId = req.user?._id?.toString() || req.query?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access LinkedIn token.",
      });
    }

    // Load token from database
    const token = await loadLinkedInTokenFromDB(userId);

    if (!token) {
      console.log("⚠️ LinkedIn token not found in database or file");
      // Ensure CORS headers are set even on error response
      setCorsHeaders(res);
      return res.json({
        success: false,
        connected: false,
        error: "LinkedIn token not found or expired",
      });
    }

    console.log("🔍 Verifying LinkedIn token with API...");

    // Verify token by making a test API call to LinkedIn
    try {
      // Try userinfo endpoint first (OpenID Connect)
      const verifyUrl = "https://api.linkedin.com/v2/userinfo";
      const verifyResponse = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("LinkedIn API response status:", verifyResponse.status);

      if (verifyResponse.ok) {
        const userInfo = await verifyResponse.json();
        console.log("✅ LinkedIn token is valid");
        res.json({
          success: true,
          connected: true,
          message: "LinkedIn token is valid",
          userInfo: userInfo,
        });
      } else {
        // Try alternative endpoint if userinfo fails
        const altUrl = "https://api.linkedin.com/v2/me";
        const altResponse = await fetch(altUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (altResponse.ok) {
          const userInfo = await altResponse.json();
          console.log("✅ LinkedIn token is valid (via /me endpoint)");
          res.json({
            success: true,
            connected: true,
            message: "LinkedIn token is valid",
            userInfo: userInfo,
          });
        } else {
          const errorData = await verifyResponse.json().catch(() => ({}));
          console.error("❌ LinkedIn token verification failed:", {
            status: verifyResponse.status,
            error: errorData,
          });
          res.json({
            success: false,
            connected: false,
            error: "LinkedIn token is invalid or expired",
            details: errorData,
          });
        }
      }
    } catch (verifyError) {
      console.error("❌ Error verifying LinkedIn token:", verifyError);
      // Ensure CORS headers are set even on error response
      setCorsHeaders(res);
      res.json({
        success: false,
        connected: false,
        error: "Failed to verify LinkedIn token",
        details: verifyError.message,
      });
    }
  } catch (error) {
    console.error("❌ Error checking LinkedIn token:", error);
    // Ensure CORS headers are set even on error response
    setCorsHeaders(res);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message || "Failed to check LinkedIn token",
    });
  }
});

// Delete LinkedIn token (disconnect) - removes token from database
// Note: OPTIONS handler is already defined above for GET, it works for DELETE too
app.delete("/api/linkedin/token", optionalAuthenticate, async (req, res) => {
  // Set CORS headers explicitly
  setCorsHeaders(res);

  try {
    // Get user ID from request if available (from authentication middleware)
    const userId = req.user?._id?.toString() || null;

    // Delete from database
    await deleteLinkedInToken(userId);

    res.json({
      success: true,
      message: "LinkedIn disconnected successfully (token removed from database)",
    });
  } catch (error) {
    console.error("❌ Error deleting LinkedIn token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to disconnect LinkedIn",
    });
  }
});

// Get all integrations for the logged-in user
app.get("/api/integrations", optionalAuthenticate, async (req, res) => {
  try {
    const appUserId = req.user?._id?.toString();

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access integrations.",
      });
    }

    const integrations = await getUserIntegrations(appUserId);

    // Format response to show connection status for each platform
    const formattedIntegrations = {
      instagram: null,
      facebook: null,
      linkedin: null,
    };

    integrations.forEach((integration) => {
      const platform = integration.platform;
      if (platform === "instagram") {
        formattedIntegrations.instagram = {
          connected: true,
          platformUserId: integration.platformUserId,
          username: integration.instagramUsername,
          accountId: integration.instagramAccountId,
          pageId: integration.instagramPageId,
          pageName: integration.instagramPageName,
          tokenExpired: integration.isTokenExpired("instagramPageAccessToken"),
        };
      } else if (platform === "facebook") {
        formattedIntegrations.facebook = {
          connected: true,
          platformUserId: integration.platformUserId,
          userName: integration.facebookUserName,
          pageId: integration.facebookPageId,
          pageName: integration.facebookPageName,
          tokenExpired: integration.isTokenExpired("facebookPageAccessToken"),
        };
      } else if (platform === "linkedin") {
        formattedIntegrations.linkedin = {
          connected: true,
          platformUserId: integration.platformUserId,
          tokenExpired: integration.isTokenExpired("linkedinAccessToken"),
        };
      }
    });

    res.json({
      success: true,
      integrations: formattedIntegrations,
    });
  } catch (error) {
    console.error("Error getting user integrations:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get user integrations",
    });
  }
});

// Get user access token by userId
app.get("/api/instagram/tokens/user/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Instagram account ID)
    const appUserId = req.user?._id?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access tokens.",
      });
    }

    const tokenData = await loadUserAccessToken(appUserId, userId);

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
app.get("/api/instagram/tokens/page/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Instagram account ID)
    const appUserId = req.user?._id?.toString();
    console.log("req.user", req.user);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access tokens.",
      });
    }

    const tokenData = await loadPageAccessToken(appUserId, userId);

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
app.delete("/api/instagram/tokens/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Instagram account ID)
    // Get application user ID from authentication (required)
    const appUserId = req.user?._id?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to delete tokens.",
      });
    }

    await deleteUserAccessToken(userId, appUserId);
    // deletePageAccessToken is same as deleteUserAccessToken (deletes entire integration)
    // await deletePageAccessToken(userId);

    res.json({
      success: true,
      message: "Tokens deleted successfully from database",
    });
  } catch (error) {
    console.error("Error deleting tokens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete tokens",
    });
  }
});

// ==================== FACEBOOK TOKEN ENDPOINTS ====================

// Get Facebook long-lived token by userId
app.get("/api/facebook/tokens/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Facebook user ID)
    const appUserId = req.user?._id?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access tokens.",
      });
    }

    // Load from database
    const tokenData = await loadFacebookTokens(appUserId, userId);
    const tokenDataObj = tokenData ? { token: tokenData.userAccessToken } : null;

    if (!tokenDataObj) {
      return res.status(404).json({
        success: false,
        error: "Facebook token not found or expired",
        isExpired: true,
      });
    }

    res.json({
      success: true,
      token: tokenDataObj.token,
      expiresAt: tokenData.expiresAt,
      createdAt: tokenData.createdAt,
      expiresIn: tokenData.expiresIn,
      isExpired: Date.now() > tokenData.expiresAt,
    });
  } catch (error) {
    console.error("Error loading Facebook token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to load Facebook token",
    });
  }
});

// Get Facebook page access token by userId
app.get("/api/facebook/tokens/page/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Facebook user ID)
    const appUserId = req.user?._id?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to access tokens.",
      });
    }

    const tokenData = await loadFacebookPageAccessToken(appUserId, userId);

    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: "Facebook page access token not found or expired",
        isExpired: true,
      });
    }

    // Also get page info from tokens
    const tokensData = await loadFacebookTokens(appUserId, userId);

    res.json({
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      createdAt: tokenData.createdAt,
      isExpired: tokenData.expiresAt ? Date.now() > tokenData.expiresAt : false,
      pageId: tokensData?.pageId || null,
      pageName: tokensData?.pageName || null,
    });
  } catch (error) {
    console.error("Error loading Facebook page access token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to load Facebook page access token",
    });
  }
});

// Delete Facebook tokens by userId
app.delete("/api/facebook/tokens/:userId", optionalAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params; // This is platformUserId (Facebook user ID)
    // Get application user ID from authentication (required)
    const appUserId = req.user?._id?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Platform User ID is required",
      });
    }

    if (!appUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login to delete tokens.",
      });
    }

    await deleteFacebookTokensDB(appUserId, userId);

    res.json({
      success: true,
      message: "Facebook tokens deleted successfully from database",
    });
  } catch (error) {
    console.error("Error deleting Facebook tokens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete Facebook tokens",
    });
  }
});

// Helper function to set CORS headers
const setCorsHeaders = (res) => {
  // Use both setHeader and header to ensure compatibility
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app, Accept, Origin"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, ngrok-skip-browser-warning, lead-flow-gqlq.vercel.app, Accept, Origin"
  );
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.header("Access-Control-Allow-Credentials", "false");
};

// Handle OPTIONS preflight for Instagram conversations endpoint
app.options("/api/instagram/conversations/:userId", (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

// Get Instagram conversations for a user (using page ID)
app.get("/api/instagram/conversations/:userId", async (req, res) => {
  // Set CORS headers explicitly for all responses - MUST be before any response is sent
  // This ensures CORS headers are ALWAYS present, even on errors
  setCorsHeaders(res);

  // Log request details including headers that might affect the response
  const requestId = Date.now();
  console.log(
    `📥 [${requestId}] GET /api/instagram/conversations/${req.params.userId} - Request received`
  );
  console.log(`📋 [${requestId}] Headers:`, {
    "if-none-match": req.headers["if-none-match"],
    origin: req.headers["origin"],
    referer: req.headers["referer"],
  });

  try {
    const { userId } = req.params;
    const { limit = 25, after, before, fields } = req.query;

    if (!userId) {
      // CORS headers already set above
      console.log(`❌ [${requestId}] User ID is missing`);
      // Double-check CORS headers before sending error
      setCorsHeaders(res);
      res.status(400).json({
        success: false,
        error: "User ID is required",
      });
      return;
    }

    // Load tokens (userId here is platformUserId)
    const appUserId = req.user?._id?.toString() || null;
    const tokensData = await loadTokens(appUserId, userId);
    console.log(`🔑 [${requestId}] Tokens data loaded:`, tokensData ? "Found" : "Not found");
    const pageTokenData = tokensData?.pageAccessToken;

    if (!pageTokenData || !pageTokenData.token) {
      // CORS headers already set above
      console.log(`❌ [${requestId}] Page access token not found for userId: ${userId}`);
      // Double-check CORS headers before sending error
      setCorsHeaders(res);
      res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
      return;
    }

    const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";
    const pageAccessToken = pageTokenData.token;

    // Get page ID from stored tokens, or fetch it if not available
    let pageId = tokensData?.pageId;
    console.log(`📄 [${requestId}] Page ID from tokens:`, pageId || "Not found");

    // If page ID not stored, try to fetch it
    if (!pageId) {
      console.log(`🔍 Attempting to fetch page ID from Instagram API...`);
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
                  // Save the page ID for future use - DISABLED: Using database instead of files
                  /* if (tokensData) {
                    tokensData.pageId = pageId;
                    const filePath = path.join(TOKENS_DIR, `${userId}_tokens.json`);
                    fs.writeFileSync(filePath, JSON.stringify(tokensData, null, 2));
                  } */
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
      // CORS headers already set above
      console.log(`❌ [${requestId}] Page ID not found for userId: ${userId}. Tokens data:`, {
        hasUserToken: !!tokensData?.userAccessToken,
        hasPageToken: !!tokensData?.pageAccessToken,
        pageId: tokensData?.pageId,
      });
      // Double-check CORS headers before sending error - THIS IS LIKELY THE FAILING PATH
      setCorsHeaders(res);
      console.log(`🔍 [${requestId}] CORS headers set before 400 response`);
      res.status(400).json({
        success: false,
        error: "Page ID not found. Please reconnect your Instagram account.",
        details: "Unable to determine the Facebook Page ID associated with this Instagram account.",
      });
      return;
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
      `📱 [${requestId}] Fetching Instagram conversations for pageId: ${pageId}, userId: ${userId}`
    );
    console.log(
      `🔗 [${requestId}] Conversations URL:`,
      conversationsUrl.replace(/access_token=[^&]+/, "access_token=***")
    );

    const response = await fetch(conversationsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ [${requestId}] Failed to fetch Instagram conversations:`, errorData);
      // Double-check CORS headers before sending error
      setCorsHeaders(res);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 500).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch Instagram conversations",
        details: errorData,
      });
      return;
    }

    const data = await response.json();
    console.log(
      `✅ [${requestId}] Successfully fetched ${data.data?.length || 0} Instagram conversations`
    );

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
    console.error(`❌ [${requestId}] Error fetching Instagram conversations:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    // CORS headers already set above, but ensure they're set in case of exception
    if (!res.headersSent) {
      setCorsHeaders(res);
      console.log(`🔍 [${requestId}] CORS headers set in catch block before 500 response`);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch Instagram conversations",
      });
    } else {
      console.error(`⚠️ [${requestId}] Headers already sent, cannot set CORS headers`);
    }
  }
});

// Handle OPTIONS preflight for Instagram messages endpoint
app.options("/api/instagram/conversations/:userId/:conversationId/messages", (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

// Get messages for a specific Instagram conversation
app.get("/api/instagram/conversations/:userId/:conversationId/messages", async (req, res) => {
  // Set CORS headers explicitly for all responses - MUST be before any response is sent
  setCorsHeaders(res);

  try {
    const { userId, conversationId } = req.params;
    const { limit = 25, after, before, fields } = req.query;

    if (!userId || !conversationId) {
      // Ensure CORS headers are set before sending error response
      setCorsHeaders(res);
      res.status(400).json({
        success: false,
        error: "User ID and Conversation ID are required",
      });
      return;
    }

    // Load page access token (userId here is platformUserId)
    const appUserId = req.user?._id?.toString() || null;
    const pageTokenData = await loadPageAccessToken(appUserId, userId);
    if (!pageTokenData || !pageTokenData.token) {
      // Ensure CORS headers are set before sending error response
      setCorsHeaders(res);
      res.status(404).json({
        success: false,
        error: "Page access token not found or expired. Please reconnect your Instagram account.",
      });
      return;
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
      // Ensure CORS headers are set before sending error response
      setCorsHeaders(res);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 500).json({
        success: false,
        error: errorData.error?.message || "Failed to fetch conversation messages",
        details: errorData,
      });
      return;
    }

    const data = await response.json();
    console.log(
      `✅ Successfully fetched ${
        data.data?.length || 0
      } messages for conversation ${conversationId}`
    );

    // Return in Instagram API format (with 'data' field) for consistency
    const messagesData = data.data || [];
    console.log("📨 Processed messages data:", messagesData.length, "messages");

    // Ensure CORS headers are set before sending success response
    setCorsHeaders(res);
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
    // CORS headers already set above, but ensure they're set in case of exception
    if (!res.headersSent) {
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch conversation messages",
      });
    } else {
      console.error(`⚠️ Headers already sent, cannot set CORS headers`);
    }
  }
});

// Authentication routes
app.use("/api/auth", authRouter);

// Analytics routes
app.use(
  "/api/analytics",
  createAnalyticsRouter(
    messagesStore,
    instagramMessagesStore,
    setCorsHeaders,
    loadTokens,
    loadFacebookTokens
  )
);

// LinkedIn API routes
app.use("/api/linkedin", createLinkedInRouter(loadLinkedInTokenFromDB, setCorsHeaders));

// Facebook Messenger API routes
// Wrapper function for Facebook router - now requires appUserId
// The router will get appUserId from req.user via optionalAuthenticate middleware
const loadFacebookPageAccessTokenWrapper = async (appUserId, platformUserId) => {
  return await loadFacebookPageAccessToken(appUserId, platformUserId);
};

app.use("/api/facebook", createFacebookRouter(loadFacebookPageAccessTokenWrapper, setCorsHeaders));

// Send Instagram message
app.post("/api/instagram/send-message", optionalAuthenticate, async (req, res) => {
  try {
    const { userId, recipientId, message } = req.body;

    if (!userId || !recipientId || !message) {
      return res.status(400).json({
        success: false,
        error: "User ID, recipient ID, and message are required",
      });
    }

    // Load page access token (userId here is platformUserId)
    const appUserId = req.user?._id?.toString() || null;
    const pageTokenData = await loadPageAccessToken(appUserId, userId);
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
      recipientId: recipientId,
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

    // Load page access token (userId here is platformUserId)
    const appUserId = req.user?._id?.toString() || null;
    const pageTokenData = await loadPageAccessToken(appUserId, userId);
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

// Manual Facebook token refresh endpoint (for testing or manual refresh)
app.post("/api/facebook/refresh-tokens", async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId) {
      // Refresh tokens for a specific user
      console.log(`🔄 Manual Facebook token refresh requested for userId: ${userId}`);
      const success = await refreshFacebookTokens(userId);

      if (success) {
        return res.json({
          success: true,
          message: `Facebook tokens refreshed successfully for userId: ${userId}`,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: `Failed to refresh Facebook tokens for userId: ${userId}`,
        });
      }
    } else {
      // Refresh all Facebook tokens that need refresh
      const refreshInterval = process.env.TOKEN_REFRESH_INTERVAL_DAYS
        ? parseFloat(process.env.TOKEN_REFRESH_INTERVAL_DAYS)
        : 0.000694; // Default: 1 minute for testing
      console.log(
        `🔄 Manual Facebook token refresh requested for all users (last refreshed ${refreshInterval} days (${Math.round(
          refreshInterval * 24 * 60
        )} minutes) ago)`
      );
      await checkAndRefreshFacebookTokens(refreshInterval);

      return res.json({
        success: true,
        message: `Facebook token refresh check completed for all users`,
      });
    }
  } catch (error) {
    console.error("❌ Error in manual Facebook token refresh:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to refresh Facebook tokens",
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

// ==================== TOKEN REFRESH FUNCTIONS ====================
// Moved to ./services/refreshTokens.js
// Initialize refresh token functions with dependencies
const refreshTokenFunctions = createRefreshTokenFunctions({
  loadTokens,
  // saveTokens, // DISABLED: Using database instead of files
  // saveUserAccessToken, // DISABLED: Using database instead of files
  loadFacebookTokens,
  // saveFacebookTokens, // DISABLED: Using database instead of files
  getLastInstagramCronExecution,
  saveLastInstagramCronExecution,
  getLastFacebookCronExecution,
  saveLastFacebookCronExecution,
});

const {
  refreshUserTokens,
  refreshFacebookTokens,
  checkAndRefreshTokens,
  checkAndRefreshFacebookTokens,
} = refreshTokenFunctions;

// ==================== CRON JOB SETUP ====================
// Moved to ./services/cronJobs.js
// Setup token refresh cron job
setupTokenRefreshCron(checkAndRefreshTokens);

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

// Connect to MongoDB before starting the server
connectDB()
  .then(() => {
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
  })
  .catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
