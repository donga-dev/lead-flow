import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_DIR = path.join(path.dirname(__dirname), "tokens");

// ==================== INSTAGRAM REFRESH TOKEN STORAGE ====================

/**
 * Save Instagram refresh token to a separate JSON file
 * @param {string} userId - User ID (Instagram account ID)
 * @param {string} refreshToken - Refresh token
 */
export function saveInstagramRefreshToken(userId, refreshToken) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_refresh_token.json`);
    const refreshTokenData = {
      refreshToken: refreshToken,
      userId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    fs.writeFileSync(filePath, JSON.stringify(refreshTokenData, null, 2));
    console.log(`✅ Saved Instagram refresh token for userId: ${userId}`);
  } catch (error) {
    console.error(`❌ Error saving Instagram refresh token for ${userId}:`, error);
    throw error;
  }
}

/**
 * Load Instagram refresh token from JSON file
 * @param {string} userId - User ID (Instagram account ID)
 * @returns {string|null} Refresh token or null if not found
 */
export function loadInstagramRefreshToken(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_refresh_token.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    const refreshTokenData = JSON.parse(data);

    return refreshTokenData.refreshToken || null;
  } catch (error) {
    console.error(`❌ Error loading Instagram refresh token for ${userId}:`, error);
    return null;
  }
}

/**
 * Delete Instagram refresh token file
 * @param {string} userId - User ID (Instagram account ID)
 */
export function deleteInstagramRefreshToken(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `${userId}_refresh_token.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted Instagram refresh token for userId: ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting Instagram refresh token for ${userId}:`, error);
  }
}

// ==================== FACEBOOK REFRESH TOKEN STORAGE ====================

/**
 * Save Facebook refresh token to a separate JSON file
 * @param {string} userId - Facebook user ID
 * @param {string} refreshToken - Refresh token
 */
export function saveFacebookRefreshToken(userId, refreshToken) {
  try {
    const filePath = path.join(TOKENS_DIR, `facebook_${userId}_refresh_token.json`);
    const refreshTokenData = {
      refreshToken: refreshToken,
      userId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    fs.writeFileSync(filePath, JSON.stringify(refreshTokenData, null, 2));
    console.log(`✅ Saved Facebook refresh token for userId: ${userId}`);
  } catch (error) {
    console.error(`❌ Error saving Facebook refresh token for ${userId}:`, error);
    throw error;
  }
}

/**
 * Load Facebook refresh token from JSON file
 * @param {string} userId - Facebook user ID
 * @returns {string|null} Refresh token or null if not found
 */
export function loadFacebookRefreshToken(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `facebook_${userId}_refresh_token.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, "utf8");
    const refreshTokenData = JSON.parse(data);

    return refreshTokenData.refreshToken || null;
  } catch (error) {
    console.error(`❌ Error loading Facebook refresh token for ${userId}:`, error);
    return null;
  }
}

/**
 * Delete Facebook refresh token file
 * @param {string} userId - Facebook user ID
 */
export function deleteFacebookRefreshToken(userId) {
  try {
    const filePath = path.join(TOKENS_DIR, `facebook_${userId}_refresh_token.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted Facebook refresh token for userId: ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting Facebook refresh token for ${userId}:`, error);
  }
}

// ==================== TOKEN REFRESH FUNCTIONS ====================

/**
 * Create refresh token functions with dependencies
 * @param {Object} dependencies - Token storage and cron execution functions
 * @returns {Object} Refresh token functions
 */
export function createRefreshTokenFunctions(dependencies) {
  const {
    loadTokens,
    saveTokens,
    saveUserAccessToken,
    loadFacebookTokens,
    saveFacebookTokens,
    getLastInstagramCronExecution,
    saveLastInstagramCronExecution,
    getLastFacebookCronExecution,
    saveLastFacebookCronExecution,
  } = dependencies;

  /**
   * Refresh user access token using refresh token or fb_exchange_token
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

      // Try to use refresh token first if available
      const refreshToken = loadInstagramRefreshToken(userId);
      let longLivedTokenUrl;
      let longLivedParams;

      if (refreshToken) {
        console.log(`🔄 Using refresh token for userId: ${userId}`);
        // Use refresh token to get new access token
        longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
        longLivedParams = new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: refreshToken,
        });
      } else {
        console.log(
          `🔄 Using fb_exchange_token for userId: ${userId} (no refresh token available)`
        );
        // Fallback to fb_exchange_token method
        longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
        longLivedParams = new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        });
      }

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
      const newRefreshToken = longLivedData.refresh_token || refreshToken; // Use new refresh token if provided, otherwise keep existing
      const expiresIn = longLivedData.expires_in || 5184000; // Default to 60 days if not provided

      // Save new refresh token if we got one
      if (newRefreshToken && newRefreshToken !== refreshToken) {
        saveInstagramRefreshToken(userId, newRefreshToken);
        console.log(`✅ Updated refresh token for userId: ${userId}`);
      }

      console.log(`✅ Successfully refreshed user access token for userId: ${userId}`);

      return {
        token: newToken,
        expiresIn: expiresIn,
        refreshToken: newRefreshToken,
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
   * Refresh Facebook user access token using refresh token or fb_exchange_token
   * @param {string} userId - Facebook user ID
   * @param {string} currentToken - Current long-lived access token
   * @returns {Promise<Object|null>} New token data or null if failed
   */
  async function refreshFacebookUserAccessToken(userId, currentToken) {
    try {
      const appId = process.env.REACT_APP_FACEBOOK_APP_ID || "1599198441064709";
      const appSecret = process.env.FACEBOOK_APP_SECRET || "12a042d6c5d3013e0921c382f84072f7";
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

      if (!appSecret) {
        console.error(
          `❌ Cannot refresh Facebook token for ${userId}: FACEBOOK_APP_SECRET not configured`
        );
        return null;
      }

      console.log(`🔄 Refreshing Facebook user access token for userId: ${userId}`);

      // Try to use refresh token first if available
      const refreshToken = loadFacebookRefreshToken(userId);
      let longLivedTokenUrl;
      let longLivedParams;

      if (refreshToken) {
        console.log(`🔄 Using refresh token for Facebook userId: ${userId}`);
        // Use refresh token to get new access token
        longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
        longLivedParams = new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: refreshToken,
        });
      } else {
        console.log(
          `🔄 Using fb_exchange_token for Facebook userId: ${userId} (no refresh token available)`
        );
        // Fallback to fb_exchange_token method
        longLivedTokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token`;
        longLivedParams = new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        });
      }

      const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!longLivedResponse.ok) {
        const errorData = await longLivedResponse.json();
        console.error(`❌ Failed to refresh Facebook user access token for ${userId}:`, errorData);
        return null;
      }

      const longLivedData = await longLivedResponse.json();
      const newToken = longLivedData.access_token;
      const newRefreshToken = longLivedData.refresh_token || refreshToken; // Use new refresh token if provided, otherwise keep existing
      const expiresIn = longLivedData.expires_in || 5184000; // Default to 60 days if not provided

      // Save new refresh token if we got one
      if (newRefreshToken && newRefreshToken !== refreshToken) {
        saveFacebookRefreshToken(userId, newRefreshToken);
        console.log(`✅ Updated Facebook refresh token for userId: ${userId}`);
      }

      console.log(`✅ Successfully refreshed Facebook user access token for userId: ${userId}`);

      return {
        token: newToken,
        expiresIn: expiresIn,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      console.error(`❌ Error refreshing Facebook user access token for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Refresh Facebook page access token by fetching it again from Facebook Pages API
   * @param {string} userId - Facebook user ID
   * @param {string} userAccessToken - Current long-lived access token
   * @returns {Promise<Object|null>} New page token data or null if failed
   */
  async function refreshFacebookPageAccessToken(userId, userAccessToken) {
    try {
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

      console.log(`🔄 Refreshing Facebook page access token for userId: ${userId}`);

      // Get user's Facebook Pages
      const pagesUrl = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token`;
      const pagesResponse = await fetch(`${pagesUrl}&access_token=${userAccessToken}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!pagesResponse.ok) {
        const errorData = await pagesResponse.json();
        console.error(`❌ Failed to fetch Facebook pages for ${userId}:`, errorData);
        return null;
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        console.error(`❌ No Facebook Pages found for userId: ${userId}`);
        return null;
      }

      // Get the first page (or you can add logic to select a specific page)
      const selectedPage = pages[0];
      const pageAccessToken = selectedPage.access_token;
      const pageId = selectedPage.id;
      const pageName = selectedPage.name;

      console.log(`✅ Successfully refreshed Facebook page access token for userId: ${userId}`);

      return {
        token: pageAccessToken,
        pageId: pageId,
        pageName: pageName,
      };
    } catch (error) {
      console.error(`❌ Error refreshing Facebook page access token for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Refresh Facebook tokens for a specific user
   * @param {string} userId - Facebook user ID
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async function refreshFacebookTokens(userId) {
    try {
      // Load current tokens
      const tokensData = loadFacebookTokens(userId);
      const longLivedTokenData = tokensData?.longLivedToken;

      if (!longLivedTokenData) {
        console.log(
          `⚠️ No long-lived token found for Facebook userId: ${userId}, skipping refresh`
        );
        return false;
      }

      // Refresh long-lived access token first
      const newTokenData = await refreshFacebookUserAccessToken(userId, longLivedTokenData.token);
      if (!newTokenData) {
        console.error(`❌ Failed to refresh Facebook long-lived token for userId: ${userId}`);
        return false;
      }

      // Refresh page access token using the new long-lived token
      const newPageTokenData = await refreshFacebookPageAccessToken(userId, newTokenData.token);
      if (!newPageTokenData) {
        console.error(`❌ Failed to refresh Facebook page access token for userId: ${userId}`);
        // Still save the long-lived token even if page token refresh fails
      }

      // Save refreshed tokens
      const existingTokensData = loadFacebookTokens(userId);
      saveFacebookTokens(
        userId,
        existingTokensData?.userAccessToken?.token || newTokenData.token, // Keep existing short-lived token or use new one
        newTokenData.token, // New long-lived token
        newTokenData.expiresIn,
        existingTokensData?.userName || null,
        newPageTokenData?.pageId || existingTokensData?.pageId || null,
        newPageTokenData?.token || existingTokensData?.pageAccessToken?.token || null,
        newPageTokenData?.pageName || existingTokensData?.pageName || null
      );

      console.log(`✅ Successfully refreshed all Facebook tokens for userId: ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error refreshing Facebook tokens for userId ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get all Facebook user IDs from token files
   * @returns {Array<string>} Array of Facebook user IDs
   */
  function getAllFacebookUserIds() {
    try {
      const files = fs.readdirSync(TOKENS_DIR);
      const userIds = new Set();

      files.forEach((file) => {
        // Extract userId from filename pattern: facebook_{userId}_tokens.json
        const match = file.match(/^facebook_(\d+)_tokens\.json$/);
        if (match) {
          userIds.add(match[1]);
        }
      });

      return Array.from(userIds);
    } catch (error) {
      console.error("❌ Error getting Facebook user IDs:", error);
      return [];
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
   * Check and refresh Facebook tokens that haven't been refreshed in the specified interval
   * @param {number} daysSinceLastRefresh - Number of days since last refresh to trigger refresh (default: 50)
   */
  async function checkAndRefreshFacebookTokens(daysSinceLastRefresh = 50) {
    try {
      const intervalMinutes = Math.round(daysSinceLastRefresh * 24 * 60);
      const intervalText =
        daysSinceLastRefresh < 1
          ? `${intervalMinutes} minute(s)`
          : `${daysSinceLastRefresh} day(s)`;

      console.log(
        `\n🕐 Starting Facebook token refresh check (refreshing tokens last refreshed ${intervalText} ago)...`
      );

      const userIds = getAllFacebookUserIds();
      console.log(`📋 Found ${userIds.length} Facebook user(s) with tokens`);

      if (userIds.length === 0) {
        console.log("✅ No Facebook tokens to check");
        return;
      }

      const lastRefreshThreshold = Date.now() - daysSinceLastRefresh * 24 * 60 * 60 * 1000; // milliseconds
      let refreshedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const userId of userIds) {
        try {
          const tokensData = loadFacebookTokens(userId);
          const longLivedTokenData = tokensData?.longLivedToken;

          if (!longLivedTokenData) {
            console.log(`⚠️ No long-lived token found for Facebook userId: ${userId}, skipping`);
            skippedCount++;
            continue;
          }

          // Check last cron execution time for this user
          const lastCronExecution = getLastFacebookCronExecution(userId);
          const lastUpdated =
            longLivedTokenData.updatedAt || longLivedTokenData.createdAt || Date.now();

          // Use cron execution time if available, otherwise fall back to token update time
          const lastRefreshTime = lastCronExecution || lastUpdated;
          const needsRefresh = lastRefreshTime <= lastRefreshThreshold;

          if (needsRefresh) {
            const timeSinceRefresh = Date.now() - lastRefreshTime;
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

            const executionType = lastCronExecution ? "cron execution" : "token update";
            console.log(
              `🔄 Facebook token for userId ${userId} needs refresh (last ${executionType} ${timeText} ago, >= ${thresholdText})`
            );

            const success = await refreshFacebookTokens(userId);
            if (success) {
              refreshedCount++;
              // Save last cron execution time for this user
              saveLastFacebookCronExecution(userId);
            } else {
              failedCount++;
            }
          } else {
            const timeSinceRefresh = Date.now() - lastRefreshTime;
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

            const executionType = lastCronExecution ? "cron execution" : "token update";
            console.log(
              `✅ Facebook token for userId ${userId} is still valid (last ${executionType} ${timeText} ago, < ${thresholdText})`
            );
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing Facebook tokens for userId ${userId}:`, error);
          failedCount++;
        }
      }

      console.log(
        `\n📊 Facebook token refresh summary: ${refreshedCount} refreshed, ${skippedCount} skipped, ${failedCount} failed`
      );
    } catch (error) {
      console.error("❌ Error in Facebook token refresh check:", error);
    }
  }

  /**
   * Check and refresh tokens that haven't been refreshed in the specified interval
   * Handles both Instagram and Facebook tokens
   * @param {number} daysSinceLastRefresh - Number of days since last refresh to trigger refresh (default: 50)
   */
  async function checkAndRefreshTokens(daysSinceLastRefresh = 50) {
    try {
      const intervalMinutes = Math.round(daysSinceLastRefresh * 24 * 60);
      const intervalText =
        daysSinceLastRefresh < 1
          ? `${intervalMinutes} minute(s)`
          : `${daysSinceLastRefresh} day(s)`;

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

          // Check last cron execution time for this user
          const lastCronExecution = getLastInstagramCronExecution(userId);
          const lastUpdated = userTokenData.updatedAt || userTokenData.createdAt || Date.now();

          // Use cron execution time if available, otherwise fall back to token update time
          const lastRefreshTime = lastCronExecution || lastUpdated;
          const needsRefresh = lastRefreshTime <= lastRefreshThreshold;

          if (needsRefresh) {
            const timeSinceRefresh = Date.now() - lastRefreshTime;
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

            const executionType = lastCronExecution ? "cron execution" : "token update";
            console.log(
              `🔄 Instagram token for userId ${userId} needs refresh (last ${executionType} ${timeText} ago, >= ${thresholdText})`
            );

            const success = await refreshUserTokens(userId);
            if (success) {
              refreshedCount++;
              // Save last cron execution time for this user
              saveLastInstagramCronExecution(userId);
            } else {
              failedCount++;
            }
          } else {
            const timeSinceRefresh = Date.now() - lastRefreshTime;
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

            const executionType = lastCronExecution ? "cron execution" : "token update";
            console.log(
              `✅ Instagram token for userId ${userId} is still valid (last ${executionType} ${timeText} ago, < ${thresholdText})`
            );
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing tokens for userId ${userId}:`, error);
          failedCount++;
        }
      }

      console.log(
        `\n📊 Instagram token refresh summary: ${refreshedCount} refreshed, ${skippedCount} skipped, ${failedCount} failed`
      );

      // Also refresh Facebook tokens
      await checkAndRefreshFacebookTokens(daysSinceLastRefresh);
    } catch (error) {
      console.error("❌ Error in token refresh check:", error);
    }
  }

  return {
    refreshUserAccessToken,
    refreshPageAccessToken,
    refreshUserTokens,
    refreshFacebookUserAccessToken,
    refreshFacebookPageAccessToken,
    refreshFacebookTokens,
    getAllUserIds,
    getAllFacebookUserIds,
    checkAndRefreshTokens,
    checkAndRefreshFacebookTokens,
  };
}
