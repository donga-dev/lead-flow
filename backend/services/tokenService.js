import Integration from "../models/Integration.js";

/**
 * Save Instagram tokens to database
 * @param {string} userId - Application user ID (from User model, required)
 * @param {string} platformUserId - Instagram account ID
 * @param {Object} tokenData - Token data object
 * @param {string} tokenData.userAccessToken - User access token
 * @param {string} tokenData.pageAccessToken - Page access token
 * @param {number} tokenData.expiresIn - Expiration time in seconds
 * @param {string} tokenData.pageId - Page ID (optional)
 * @param {string} tokenData.pageName - Page name (optional)
 * @param {string} tokenData.accountId - Instagram account ID (optional)
 * @param {string} tokenData.username - Instagram username (optional)
 * @param {string} tokenData.refreshToken - Refresh token (optional)
 */
export async function saveInstagramTokens(userId, platformUserId, tokenData) {
  if (!userId) {
    throw new Error("User ID is required to save Instagram tokens");
  }
  try {
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null;

    const now = new Date();

    const tokenUpdate = {
      platform: "instagram",
      platformUserId: platformUserId,
      instagramUserAccessToken: {
        token: tokenData.userAccessToken,
        expiresAt: expiresAt,
        expiresIn: tokenData.expiresIn,
        updatedAt: now,
      },
      instagramPageAccessToken: {
        token: tokenData.pageAccessToken,
        expiresAt: expiresAt,
        expiresIn: tokenData.expiresIn,
        updatedAt: now,
      },
    };

    // Always set user (userId is required)
    tokenUpdate.user = userId;
    console.log(
      `📝 Storing userId in integration: ${userId} for platformUserId: ${platformUserId}`
    );

    // Set createdAt if this is a new token
    // Search without user field to find existing integrations (even if they don't have user set)
    const query = {
      platform: "instagram",
      platformUserId: platformUserId,
    };
    const existingToken = await Integration.findOne(query);

    if (!existingToken) {
      tokenUpdate.instagramUserAccessToken.createdAt = now;
      tokenUpdate.instagramPageAccessToken.createdAt = now;
    } else {
      tokenUpdate.instagramUserAccessToken.createdAt =
        existingToken.instagramUserAccessToken?.createdAt || now;
      tokenUpdate.instagramPageAccessToken.createdAt =
        existingToken.instagramPageAccessToken?.createdAt || now;
      // If existing token has a user but we're providing a different one, update it
      // If existing token doesn't have a user and we're providing one, set it
      if (userId && (!existingToken.user || existingToken.user.toString() !== userId)) {
        tokenUpdate.user = userId;
        console.log(
          `🔄 Updating userId in existing integration: ${userId} for platformUserId: ${platformUserId}`
        );
      }
    }

    // Add optional fields
    if (tokenData.pageId) tokenUpdate.instagramPageId = tokenData.pageId;
    if (tokenData.pageName) tokenUpdate.instagramPageName = tokenData.pageName;
    if (tokenData.accountId) tokenUpdate.instagramAccountId = tokenData.accountId;
    if (tokenData.username) tokenUpdate.instagramUsername = tokenData.username;
    if (tokenData.refreshToken) tokenUpdate.instagramRefreshToken = tokenData.refreshToken;

    // Use query without user field to match existing integrations
    const updateQuery = {
      platform: "instagram",
      platformUserId: platformUserId,
    };

    const token = await Integration.findOneAndUpdate(updateQuery, tokenUpdate, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    console.log(
      `✅ Instagram tokens saved to database for user: ${userId}, platformUserId: ${platformUserId}`
    );
    return token;
  } catch (error) {
    console.error("❌ Error saving Instagram tokens to database:", error);
    throw error;
  }
}

/**
 * Load Instagram tokens from database
 * @param {string} userId - Application user ID (required - filters tokens by user)
 * @param {string} platformUserId - Instagram account ID
 * @returns {Object|null} Token object or null if not found
 */
export async function loadInstagramTokens(userId, platformUserId) {
  if (!userId) {
    throw new Error("User ID is required to load Instagram tokens");
  }
  try {
    const query = {
      platform: "instagram",
      platformUserId: platformUserId,
      user: userId, // Always filter by user
    };

    const integration = await Integration.findOne(query);

    if (!integration) {
      console.log(
        `⚠️ Instagram tokens not found in database for platformUserId: ${platformUserId}`
      );
      return null;
    }

    // Check if tokens are expired
    if (integration.isTokenExpired("instagramUserAccessToken")) {
      console.log(`⚠️ Instagram user access token expired for platformUserId: ${platformUserId}`);
      return null;
    }

    if (integration.isTokenExpired("instagramPageAccessToken")) {
      console.log(`⚠️ Instagram page access token expired for platformUserId: ${platformUserId}`);
      return null;
    }

    return {
      userAccessToken: integration.instagramUserAccessToken?.token,
      pageAccessToken: integration.instagramPageAccessToken?.token,
      pageId: integration.instagramPageId,
      pageName: integration.instagramPageName,
      accountId: integration.instagramAccountId,
      username: integration.instagramUsername,
      refreshToken: integration.instagramRefreshToken,
      userId: integration.user?.toString(),
      platformUserId: integration.platformUserId,
    };
  } catch (error) {
    console.error("❌ Error loading Instagram tokens from database:", error);
    return null;
  }
}

/**
 * Save Instagram refresh token
 * @param {string} userId - Application user ID (required)
 * @param {string} platformUserId - Instagram account ID
 * @param {string} refreshToken - Refresh token
 */
export async function saveInstagramRefreshToken(userId, platformUserId, refreshToken) {
  if (!userId) {
    throw new Error("User ID is required to save Instagram refresh token");
  }
  try {
    const query = {
      platform: "instagram",
      platformUserId: platformUserId,
      user: userId,
    };

    const update = {
      instagramRefreshToken: refreshToken,
      user: userId,
    };

    await Integration.findOneAndUpdate(query, update, { upsert: true, new: true });
    console.log(
      `✅ Instagram refresh token saved to database for user: ${userId}, platformUserId: ${platformUserId}`
    );
  } catch (error) {
    console.error("❌ Error saving Instagram refresh token to database:", error);
    throw error;
  }
}

/**
 * Delete Instagram tokens from database
 * @param {string} userId - Application user ID (required)
 * @param {string} platformUserId - Instagram account ID
 */
export async function deleteInstagramTokens(userId, platformUserId) {
  if (!userId) {
    throw new Error("User ID is required to delete Instagram tokens");
  }
  try {
    const query = {
      platform: "instagram",
      platformUserId: platformUserId,
      user: userId,
    };
    await Integration.deleteOne(query);
    console.log(
      `✅ Instagram tokens deleted from database for user: ${userId}, platformUserId: ${platformUserId}`
    );
  } catch (error) {
    console.error("❌ Error deleting Instagram tokens from database:", error);
    throw error;
  }
}

/**
 * Save Facebook tokens to database
 * @param {string} userId - Application user ID (required)
 * @param {string} platformUserId - Facebook user ID
 * @param {Object} tokenData - Token data object
 */
export async function saveFacebookTokens(userId, platformUserId, tokenData) {
  if (!userId) {
    throw new Error("User ID is required to save Facebook tokens");
  }
  try {
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null;

    const now = new Date();

    const tokenUpdate = {
      platform: "facebook",
      platformUserId: platformUserId,
      facebookUserAccessToken: {
        token: tokenData.userAccessToken,
        expiresAt: expiresAt,
        expiresIn: tokenData.expiresIn,
        updatedAt: now,
      },
      facebookPageAccessToken: {
        token: tokenData.pageAccessToken,
        expiresAt: expiresAt,
        expiresIn: tokenData.expiresIn,
        updatedAt: now,
      },
    };

    // Always set user (userId is required)
    tokenUpdate.user = userId;
    console.log(
      `📝 Storing userId in integration: ${userId} for platformUserId: ${platformUserId}`
    );

    // Set createdAt if this is a new token
    // Search without user field to find existing integrations (even if they don't have user set)
    const query = {
      platform: "facebook",
      platformUserId: platformUserId,
    };
    const existingToken = await Integration.findOne(query);

    if (!existingToken) {
      tokenUpdate.facebookUserAccessToken.createdAt = now;
      tokenUpdate.facebookPageAccessToken.createdAt = now;
    } else {
      tokenUpdate.facebookUserAccessToken.createdAt =
        existingToken.facebookUserAccessToken?.createdAt || now;
      tokenUpdate.facebookPageAccessToken.createdAt =
        existingToken.facebookPageAccessToken?.createdAt || now;
      // If existing token has a user but we're providing a different one, update it
      // If existing token doesn't have a user and we're providing one, set it
      if (userId && (!existingToken.user || existingToken.user.toString() !== userId)) {
        tokenUpdate.user = userId;
        console.log(
          `🔄 Updating userId in existing Facebook integration: ${userId} for platformUserId: ${platformUserId}`
        );
      }
    }

    // Add optional fields
    if (tokenData.refreshToken) tokenUpdate.facebookRefreshToken = tokenData.refreshToken;
    if (tokenData.pageId) tokenUpdate.facebookPageId = tokenData.pageId;
    if (tokenData.pageName) tokenUpdate.facebookPageName = tokenData.pageName;
    if (tokenData.userName) tokenUpdate.facebookUserName = tokenData.userName;

    // Use query without user field to match existing integrations
    const updateQuery = {
      platform: "facebook",
      platformUserId: platformUserId,
    };

    const token = await Integration.findOneAndUpdate(updateQuery, tokenUpdate, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    console.log(
      `✅ Facebook tokens saved to database for user: ${userId}, platformUserId: ${platformUserId}`
    );
    return token;
  } catch (error) {
    console.error("❌ Error saving Facebook tokens to database:", error);
    throw error;
  }
}

/**
 * Load Facebook tokens from database
 * @param {string} userId - Application user ID (required - filters tokens by user)
 * @param {string} platformUserId - Facebook user ID
 * @returns {Object|null} Token object or null if not found
 */
export async function loadFacebookTokens(userId, platformUserId) {
  if (!userId) {
    throw new Error("User ID is required to load Facebook tokens");
  }
  try {
    const query = {
      platform: "facebook",
      platformUserId: platformUserId,
      user: userId, // Always filter by user
    };

    const integration = await Integration.findOne(query);

    if (!integration) {
      console.log(`⚠️ Facebook tokens not found in database for platformUserId: ${platformUserId}`);
      return null;
    }

    // Check if tokens are expired
    if (integration.isTokenExpired("facebookPageAccessToken")) {
      console.log(`⚠️ Facebook page access token expired for platformUserId: ${platformUserId}`);
      return null;
    }

    return {
      userAccessToken: integration.facebookUserAccessToken?.token,
      pageAccessToken: integration.facebookPageAccessToken?.token,
      refreshToken: integration.facebookRefreshToken,
      pageId: integration.facebookPageId,
      pageName: integration.facebookPageName,
      userName: integration.facebookUserName,
      userId: integration.user?.toString(),
      platformUserId: integration.platformUserId,
    };
  } catch (error) {
    console.error("❌ Error loading Facebook tokens from database:", error);
    return null;
  }
}

/**
 * Save Facebook refresh token
 * @param {string} userId - Application user ID (required)
 * @param {string} platformUserId - Facebook user ID
 * @param {string} refreshToken - Refresh token
 */
export async function saveFacebookRefreshToken(userId, platformUserId, refreshToken) {
  if (!userId) {
    throw new Error("User ID is required to save Facebook refresh token");
  }
  try {
    const query = {
      platform: "facebook",
      platformUserId: platformUserId,
      user: userId,
    };

    const update = {
      facebookRefreshToken: refreshToken,
      user: userId,
    };

    await Integration.findOneAndUpdate(query, update, { upsert: true, new: true });
    console.log(
      `✅ Facebook refresh token saved to database for user: ${userId}, platformUserId: ${platformUserId}`
    );
  } catch (error) {
    console.error("❌ Error saving Facebook refresh token to database:", error);
    throw error;
  }
}

/**
 * Delete Facebook tokens from database
 * @param {string} userId - Application user ID (required)
 * @param {string} platformUserId - Facebook user ID
 */
export async function deleteFacebookTokens(userId, platformUserId) {
  if (!userId) {
    throw new Error("User ID is required to delete Facebook tokens");
  }
  try {
    const query = {
      platform: "facebook",
      platformUserId: platformUserId,
      user: userId,
    };
    await Integration.deleteOne(query);
    console.log(
      `✅ Facebook tokens deleted from database for user: ${userId}, platformUserId: ${platformUserId}`
    );
  } catch (error) {
    console.error("❌ Error deleting Facebook tokens from database:", error);
    throw error;
  }
}

/**
 * Save LinkedIn token to database
 * @param {string} userId - Application user ID (required)
 * @param {string} accessToken - LinkedIn access token
 * @param {number} expiresIn - Expiration time in seconds (optional)
 */
export async function saveLinkedInToken(userId, accessToken, expiresIn = null) {
  if (!userId) {
    throw new Error("User ID is required to save LinkedIn token");
  }
  try {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const now = new Date();

    // For LinkedIn, use userId as platformUserId
    const platformUserId = userId;

    const tokenUpdate = {
      platform: "linkedin",
      platformUserId: platformUserId,
      linkedinAccessToken: {
        token: accessToken,
        expiresAt: expiresAt,
        expiresIn: expiresIn,
        updatedAt: now,
      },
    };

    // Always set user (userId is required)
    tokenUpdate.user = userId;
    console.log(
      `📝 Storing userId in integration: ${userId} for platformUserId: ${platformUserId}`
    );

    // Set createdAt if this is a new token
    // Search without user field to find existing integrations (even if they don't have user set)
    const query = {
      platform: "linkedin",
      platformUserId: platformUserId,
    };
    const existingToken = await Integration.findOne(query);

    if (!existingToken) {
      tokenUpdate.linkedinAccessToken.createdAt = now;
    } else {
      tokenUpdate.linkedinAccessToken.createdAt =
        existingToken.linkedinAccessToken?.createdAt || now;
      // If existing token has a user but we're providing a different one, update it
      // If existing token doesn't have a user and we're providing one, set it
      if (userId && (!existingToken.user || existingToken.user.toString() !== userId)) {
        tokenUpdate.user = userId;
        console.log(
          `🔄 Updating userId in existing LinkedIn integration: ${userId} for platformUserId: ${platformUserId}`
        );
      }
    }

    // Use query without user field to match existing integrations
    const updateQuery = {
      platform: "linkedin",
      platformUserId: platformUserId,
    };

    const token = await Integration.findOneAndUpdate(updateQuery, tokenUpdate, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    console.log(`✅ LinkedIn token saved to database for user: ${userId}`);
    return token;
  } catch (error) {
    console.error("❌ Error saving LinkedIn token to database:", error);
    throw error;
  }
}

/**
 * Load LinkedIn token from database
 * @param {string} userId - Application user ID (required for LinkedIn)
 * @returns {string|null} Access token or null if not found
 */
export async function loadLinkedInToken(userId) {
  if (!userId) {
    throw new Error("User ID is required to load LinkedIn token");
  }
  try {
    const platformUserId = userId;
    const query = {
      platform: "linkedin",
      platformUserId: platformUserId,
      user: userId,
    };
    const integration = await Integration.findOne(query);

    if (!integration) {
      console.log(`⚠️ LinkedIn token not found in database for user: ${userId}`);
      return null;
    }

    // Check if token is expired
    if (integration.isTokenExpired("linkedinAccessToken")) {
      console.log(`⚠️ LinkedIn token expired for user: ${userId}`);
      return null;
    }

    return integration.linkedinAccessToken?.token || null;
  } catch (error) {
    console.error("❌ Error loading LinkedIn token from database:", error);
    return null;
  }
}

/**
 * Delete LinkedIn token from database
 * @param {string} userId - Application user ID (required)
 */
export async function deleteLinkedInToken(userId) {
  if (!userId) {
    throw new Error("User ID is required to delete LinkedIn token");
  }
  try {
    const platformUserId = userId;
    const query = {
      platform: "linkedin",
      platformUserId: platformUserId,
      user: userId,
    };
    await Integration.deleteOne(query);
    console.log(`✅ LinkedIn token deleted from database for user: ${userId}`);
  } catch (error) {
    console.error("❌ Error deleting LinkedIn token from database:", error);
    throw error;
  }
}

/**
 * Get all tokens for a user
 * @param {string} userId - Application user ID
 * @returns {Array} Array of token documents
 */
export async function getUserIntegrations(userId) {
  try {
    const integrations = await Integration.find({ user: userId });
    return integrations;
  } catch (error) {
    console.error("❌ Error getting user integrations from database:", error);
    return [];
  }
}

/**
 * Get all platform user IDs for a specific platform
 * @param {string} platform - Platform name (instagram, facebook, linkedin)
 * @returns {Array} Array of platform user IDs
 */
export async function getAllPlatformUserIds(platform) {
  try {
    const integrations = await Integration.find({ platform: platform }).select("platformUserId");
    return integrations.map((integration) => integration.platformUserId);
  } catch (error) {
    console.error(`❌ Error getting ${platform} platform user IDs from database:`, error);
    return [];
  }
}
