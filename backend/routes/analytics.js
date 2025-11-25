import express from "express";
import { optionalAuthenticate } from "../middleware/auth.js";

// Analytics endpoint - Get aggregated analytics data
export const createAnalyticsRouter = (
  messagesStore,
  instagramMessagesStore,
  setCorsHeaders,
  loadTokens,
  loadFacebookTokens
) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    try {
      // Set CORS headers explicitly
      setCorsHeaders(res);

      const { timeRange = "all" } = req.query; // 7d, 30d, 90d, all

      const now = Date.now();
      const timeRangeMs =
        {
          "7d": 7 * 24 * 60 * 60 * 1000,
          "30d": 30 * 24 * 60 * 60 * 1000,
          "90d": 90 * 24 * 60 * 60 * 1000,
          all: Infinity,
        }[timeRange] || Infinity;

      let totalMessages = 0;
      let whatsappMessages = 0;
      let instagramMessages = 0;
      let incomingMessages = 0;
      let outgoingMessages = 0;
      const messagesByDay = {};
      const recentActivity = [];
      const contactsSet = new Set();

      // Process WhatsApp messages
      messagesStore.forEach((messages, phoneNumber) => {
        if (!Array.isArray(messages)) return;

        contactsSet.add(`whatsapp_${phoneNumber}`);

        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;

          const msgTime = msg.timestamp || 0;
          if (now - msgTime <= timeRangeMs) {
            totalMessages++;
            whatsappMessages++;
            if (msg.direction === "incoming") incomingMessages++;
            else outgoingMessages++;

            // Group by day
            const day = new Date(msgTime).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            messagesByDay[day] = (messagesByDay[day] || 0) + 1;

            // Recent activity
            recentActivity.push({
              ...msg,
              platform: "whatsapp",
              contactName: msg.profile?.name || phoneNumber,
              contactId: phoneNumber,
            });
          }
        }
      });

      // Process Instagram messages
      instagramMessagesStore.forEach((messages, userId) => {
        if (!Array.isArray(messages)) return;

        contactsSet.add(`instagram_${userId}`);

        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;

          const msgTime = msg.timestamp || 0;
          if (now - msgTime <= timeRangeMs) {
            totalMessages++;
            instagramMessages++;
            if (msg.direction === "incoming") incomingMessages++;
            else outgoingMessages++;

            // Group by day
            const day = new Date(msgTime).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            messagesByDay[day] = (messagesByDay[day] || 0) + 1;

            // Recent activity
            recentActivity.push({
              ...msg,
              platform: "instagram",
              contactName: msg.username || userId,
              contactId: userId,
            });
          }
        }
      });

      // Sort recent activity by timestamp (most recent first)
      recentActivity.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Convert messagesByDay to array format
      const messagesByDayArray = Object.entries(messagesByDay)
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => {
          // Sort by date
          const dateA = new Date(a.day);
          const dateB = new Date(b.day);
          return dateA - dateB;
        });

      // Calculate response rate
      const responseRate =
        totalMessages > 0 ? ((outgoingMessages / totalMessages) * 100).toFixed(1) : 0;

      res.json({
        success: true,
        data: {
          totalMessages,
          totalConversations: contactsSet.size,
          responseRate: parseFloat(responseRate),
          avgResponseTime: 0, // Would need conversation threading to calculate
          messagesByChannel: {
            whatsapp: whatsappMessages,
            instagram: instagramMessages,
          },
          messagesByDay: messagesByDayArray,
          incomingVsOutgoing: {
            incoming: incomingMessages,
            outgoing: outgoingMessages,
          },
          recentActivity: recentActivity.slice(0, 10), // Last 10 messages
        },
      });
    } catch (error) {
      console.error("Error in /api/analytics:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  // Get Facebook Ad Accounts
  router.get("/ad-accounts", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        try {
          const tokensData = await loadTokens(appUserId, userId);
          console.log(`🔍 Loaded tokens for appUserId: ${appUserId}, platformUserId: ${userId}`, {
            hasUserToken: !!tokensData?.userAccessToken?.token,
            hasPageToken: !!tokensData?.pageAccessToken?.token,
          });
          if (tokensData?.userAccessToken?.token) {
            accessToken = tokensData.userAccessToken.token;
          } else if (tokensData?.pageAccessToken?.token) {
            accessToken = tokensData.pageAccessToken.token;
          }
        } catch (error) {
          console.error(`❌ Error loading tokens:`, error);
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        console.error(
          `❌ No access token found for appUserId: ${appUserId}, platformUserId: ${userId}`
        );
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      console.log(`✅ Using access token (length: ${accessToken?.length || 0})`);

      // Fetch ad accounts from Facebook Graph API
      const adAccountsUrl = `https://graph.facebook.com/${graphVersion}/me/adaccounts?access_token=${accessToken}`;

      const response = await fetch(adAccountsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch ad accounts:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ad accounts",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        adAccounts: data.data || [],
        paging: data.paging || null,
      });
    } catch (error) {
      console.error("Error fetching ad accounts:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  // Get Campaigns from all Ad Accounts
  router.get("/campaigns", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, fields } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        try {
          const tokensData = await loadTokens(appUserId, userId);
          console.log(`🔍 Loaded tokens for appUserId: ${appUserId}, platformUserId: ${userId}`, {
            hasUserToken: !!tokensData?.userAccessToken?.token,
            hasPageToken: !!tokensData?.pageAccessToken?.token,
          });
          if (tokensData?.userAccessToken?.token) {
            accessToken = tokensData.userAccessToken.token;
          } else if (tokensData?.pageAccessToken?.token) {
            accessToken = tokensData.pageAccessToken.token;
          }
        } catch (error) {
          console.error(`❌ Error loading tokens:`, error);
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        console.error(
          `❌ No access token found for appUserId: ${appUserId}, platformUserId: ${userId}`
        );
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      console.log(`✅ Using access token (length: ${accessToken?.length || 0})`);

      // First, fetch all ad accounts
      const adAccountsUrl = `https://graph.facebook.com/${graphVersion}/me/adaccounts?access_token=${accessToken}`;
      const adAccountsResponse = await fetch(adAccountsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!adAccountsResponse.ok) {
        const errorData = await adAccountsResponse.json();
        console.error("❌ Failed to fetch ad accounts:", errorData);
        return res.status(adAccountsResponse.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ad accounts",
          details: errorData,
        });
      }

      const adAccountsData = await adAccountsResponse.json();
      const adAccounts = adAccountsData.data || [];

      // Build query parameters for campaigns
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - default fields if not provided
      const fieldsParam = fields || "id,name,status,start_time,objective";
      params.append("fields", fieldsParam);

      // Fetch campaigns from all ad accounts
      const allCampaigns = [];
      for (const account of adAccounts) {
        try {
          const campaignsUrl = `https://graph.facebook.com/${graphVersion}/${
            account.id
          }/campaigns?${params.toString()}`;
          const campaignsResponse = await fetch(campaignsUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            const campaigns = campaignsData.data || [];
            // Add account info to each campaign
            campaigns.forEach((campaign) => {
              let cleanedName = campaign.name || "";
              if (typeof cleanedName === "string") {
                try {
                  cleanedName = JSON.parse(cleanedName);
                } catch (e) {
                  cleanedName = cleanedName.trim();
                }
              }

              allCampaigns.push({
                ...campaign,
                name: cleanedName,
                accountId: account.id,
                accountName: account.name || account.id,
              });
            });
          } else {
            console.warn(`⚠️ Failed to fetch campaigns for account ${account.id}`);
          }
        } catch (accountError) {
          console.error(`❌ Error fetching campaigns for account ${account.id}:`, accountError);
        }
      }

      res.json({
        success: true,
        campaigns: allCampaigns,
        count: allCampaigns.length,
      });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  // Get AdSets for a Campaign
  router.get("/adsets", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { campaignId, userId, fields } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: "Campaign ID is required",
        });
      }

      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        try {
          const tokensData = await loadTokens(appUserId, userId);
          console.log(`🔍 Loaded tokens for appUserId: ${appUserId}, platformUserId: ${userId}`, {
            hasUserToken: !!tokensData?.userAccessToken?.token,
            hasPageToken: !!tokensData?.pageAccessToken?.token,
          });
          if (tokensData?.userAccessToken?.token) {
            accessToken = tokensData.userAccessToken.token;
          } else if (tokensData?.pageAccessToken?.token) {
            accessToken = tokensData.pageAccessToken.token;
          }
        } catch (error) {
          console.error(`❌ Error loading tokens:`, error);
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        console.error(
          `❌ No access token found for appUserId: ${appUserId}, platformUserId: ${userId}`
        );
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      console.log(`✅ Using access token (length: ${accessToken?.length || 0})`);

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - include targeting with publisher_platforms, facebook_positions, instagram_positions
      const fieldsParam =
        fields ||
        "id,name,status,daily_budget,targeting{publisher_platforms,facebook_positions,instagram_positions}";
      params.append("fields", fieldsParam);

      // Add breakdown by publisher_platform to separate Facebook and Instagram adsets
      params.append("breakdowns", "publisher_platform");

      // Fetch adsets from Facebook Graph API
      const adsetsUrl = `https://graph.facebook.com/${graphVersion}/${campaignId}/adsets?${params.toString()}`;

      const response = await fetch(adsetsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch adsets:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch adsets",
          details: errorData,
        });
      }

      const data = await response.json();

      // Process adsets to separate by platform
      const processedAdsets = [];
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((adset) => {
          // If breakdown is present, it means the adset is split by platform
          if (adset.publisher_platform) {
            processedAdsets.push({
              ...adset,
              platform: adset.publisher_platform, // 'facebook' or 'instagram'
            });
          } else {
            // If no breakdown, check targeting for publisher_platforms
            const platforms = adset.targeting?.publisher_platforms || [];
            if (platforms.length > 0) {
              platforms.forEach((platform) => {
                processedAdsets.push({
                  ...adset,
                  platform: platform,
                });
              });
            } else {
              // Default to both if not specified
              processedAdsets.push({
                ...adset,
                platform: "all",
              });
            }
          }
        });
      }

      res.json({
        success: true,
        adsets: processedAdsets,
        paging: data.paging || null,
        count: processedAdsets.length,
      });
    } catch (error) {
      console.error("Error fetching adsets:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  // Get Ads for an AdSet
  router.get("/ads", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { adsetId, userId, fields } = req.query;
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!adsetId) {
        return res.status(400).json({
          success: false,
          error: "AdSet ID is required",
        });
      }

      const appUserId = req.user?._id?.toString() || null; // Application user ID
      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        try {
          const tokensData = await loadTokens(appUserId, userId);
          console.log(`🔍 Loaded tokens for appUserId: ${appUserId}, platformUserId: ${userId}`, {
            hasUserToken: !!tokensData?.userAccessToken?.token,
            hasPageToken: !!tokensData?.pageAccessToken?.token,
          });
          if (tokensData?.userAccessToken?.token) {
            accessToken = tokensData.userAccessToken.token;
          } else if (tokensData?.pageAccessToken?.token) {
            accessToken = tokensData.pageAccessToken.token;
          }
        } catch (error) {
          console.error(`❌ Error loading tokens:`, error);
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        console.error(
          `❌ No access token found for appUserId: ${appUserId}, platformUserId: ${userId}`
        );
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      console.log(`✅ Using access token (length: ${accessToken?.length || 0})`);

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - default fields if not provided
      const fieldsParam =
        fields || "impressions,clicks,reach,spend,ctr,cpc,unique_clicks,date_start,date_stop";
      params.append("fields", fieldsParam);

      // Fetch ads from Facebook Graph API
      const adsUrl = `https://graph.facebook.com/${graphVersion}/${adsetId}/ads?${params.toString()}`;

      const response = await fetch(adsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch ads:", errorData);

        // If ads are not available, return static response based on API documentation
        // According to Facebook API docs, if no ads exist, return empty array
        if (response.status === 404 || (errorData.error && errorData.error.code === 100)) {
          return res.json({
            success: true,
            ads: [],
            message: "No ads available for this adset",
            count: 0,
          });
        }

        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ads",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        ads: data.data || [],
        paging: data.paging || null,
        count: data.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching ads:", error);
      // Return static response on error
      res.json({
        success: true,
        ads: [],
        message: "Unable to fetch ads data",
        count: 0,
      });
    }
  });

  // Get Instagram Insights
  router.get("/instagram-insights", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, period = "day", metric_type = "total_value" } = req.query; // userId is platformUserId (Instagram user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      // Valid periods for Instagram insights as per Facebook Graph API
      // Valid periods: day, week, days_28
      // Note: Some metrics may only support specific periods
      const validPeriods = ["day", "week", "days_28"];
      const validPeriod = validPeriods.includes(period) ? period : "day";

      console.log(`📅 Requested period: ${period}, Validated period: ${validPeriod}`);

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID (Instagram Business Account ID) is required",
        });
      }

      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        const tokensData = await loadTokens(appUserId, userId);
        if (tokensData?.pageAccessToken?.token) {
          accessToken = tokensData.pageAccessToken.token;
        } else if (tokensData?.userAccessToken?.token) {
          accessToken = tokensData.userAccessToken.token;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      // Build query parameters
      // Valid metrics: reach, follower_count, profile_views, website_clicks, etc.
      // Note: follower_count is incompatible with metric_type=total_value, so we fetch it separately
      const params = new URLSearchParams({
        access_token: accessToken,
        metric: "reach,profile_views",
        period: validPeriod,
        metric_type: metric_type,
      });

      // Fetch Instagram insights from Facebook Graph API
      // userId here is the Instagram Business Account ID
      const insightsUrl = `https://graph.facebook.com/${graphVersion}/${userId}/insights?${params.toString()}`;

      console.log(`📊 Fetching Instagram insights for userId: ${userId}`);
      console.log(
        `🔗 Insights URL:`,
        insightsUrl.replace(/access_token=[^&]+/, "access_token=***")
      );

      const response = await fetch(insightsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      let insights = [];

      if (response.ok) {
        const data = await response.json();
        insights = data.data || [];
        console.log(
          `✅ Successfully fetched ${insights.length} insights for period: ${validPeriod}`
        );
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: { message: response.statusText || "Unknown error" } };
        }
        console.error("❌ Failed to fetch Instagram insights:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          period: validPeriod,
        });
        // Continue to try fetching follower_count even if this fails
      }

      // Fetch follower_count separately (it doesn't support metric_type parameter)
      // Note: follower_count only supports period='day' according to Graph API
      const followerParams = new URLSearchParams({
        access_token: accessToken,
        metric: "follower_count",
        period: "day", // Always use 'day' for follower_count
      });

      const followerUrl = `https://graph.facebook.com/${graphVersion}/${userId}/insights?${followerParams.toString()}`;
      console.log(`📊 Fetching follower_count separately`);
      console.log(
        `🔗 Follower URL:`,
        followerUrl.replace(/access_token=[^&]+/, "access_token=***")
      );

      try {
        const followerResponse = await fetch(followerUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (followerResponse.ok) {
          const followerData = await followerResponse.json();
          console.log(`📊 Follower count response:`, JSON.stringify(followerData, null, 2));

          // Handle different response structures
          let followerInsight = null;

          if (
            followerData.data &&
            Array.isArray(followerData.data) &&
            followerData.data.length > 0
          ) {
            followerInsight = followerData.data[0];
            console.log(
              `✅ Successfully added ${followerData.data.length} follower_count insight(s) to insights`
            );
          } else if (followerData.data && !Array.isArray(followerData.data)) {
            // If data is not an array, use it directly
            followerInsight = followerData.data;
            console.log(`✅ Successfully added follower_count (non-array) to insights`);
          } else if (followerData && !followerData.data) {
            // If response is directly the insight object
            followerInsight = followerData;
            console.log(`✅ Successfully added follower_count (direct) to insights`);
          } else {
            console.warn(`⚠️ Follower count data is empty or in unexpected format:`, followerData);
          }

          // If we have follower insight, ensure values are set to 0 if null
          if (followerInsight) {
            // Handle null values in the insight
            if (
              followerInsight.values &&
              Array.isArray(followerInsight.values) &&
              followerInsight.values.length > 0
            ) {
              // Ensure value is 0 if null
              if (
                followerInsight.values[0].value === null ||
                followerInsight.values[0].value === undefined
              ) {
                followerInsight.values[0].value = "0";
              }
            } else if (followerInsight.total_value) {
              // Handle total_value structure
              if (
                followerInsight.total_value.value === null ||
                followerInsight.total_value.value === undefined
              ) {
                followerInsight.total_value.value = "0";
              }
            } else {
              // If no values structure, create one with 0
              followerInsight.values = [{ value: "0" }];
            }
            insights = [...insights, followerInsight];
          } else {
            // If no follower data at all, create a static follower_count insight with 0
            const staticFollowerInsight = {
              name: "follower_count",
              period: "day",
              title: "Followers",
              description: "The number of people who follow your Instagram account.",
              total_value: {
                value: "0",
              },
              id: `${userId}/insights/follower_count/day`,
            };
            insights = [...insights, staticFollowerInsight];
            console.log(`📊 Created static follower_count insight with value 0`);
          }
        } else {
          let errorData;
          try {
            errorData = await followerResponse.json();
          } catch (e) {
            errorData = { error: { message: followerResponse.statusText || "Unknown error" } };
          }
          console.error("❌ Failed to fetch follower_count:", {
            status: followerResponse.status,
            statusText: followerResponse.statusText,
            error: errorData,
          });
        }
      } catch (error) {
        console.error("❌ Error fetching follower_count:", error);
      }

      // If we got an error on the first request and no insights, return error
      if (!response.ok && insights.length === 0) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If body is already consumed or invalid, create error object
          errorData = {
            error: { message: response.statusText || "Failed to fetch Instagram insights" },
          };
        }
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch Instagram insights",
          details: errorData,
        });
      }

      res.json({
        success: true,
        insights: insights,
        paging: null,
      });
    } catch (error) {
      console.error("Error fetching Instagram insights:", error);
      setCorsHeaders(res);
      // Check if response was already sent
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  });

  // Get Lead Generation Forms
  router.get("/leadgen-forms", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, pageId } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!userId && !pageId) {
        return res.status(400).json({
          success: false,
          error: "User ID or Page ID is required",
        });
      }

      let accessToken = null;
      let targetPageId = pageId;

      // Try to get access token and page ID from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        const tokensData = await loadTokens(appUserId, userId);
        if (tokensData?.pageAccessToken?.token) {
          accessToken = tokensData.pageAccessToken.token;
        } else if (tokensData?.userAccessToken?.token) {
          accessToken = tokensData.userAccessToken.token;
        }

        // Get page ID from tokens if not provided
        if (!targetPageId && tokensData?.pageId) {
          targetPageId = tokensData.pageId;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      if (!targetPageId) {
        return res.status(400).json({
          success: false,
          error: "Page ID is required. Provide pageId parameter or ensure it's stored in tokens.",
        });
      }

      // Fetch leadgen forms from Facebook Graph API
      const formsUrl = `https://graph.facebook.com/${graphVersion}/${targetPageId}/leadgen_forms?access_token=${accessToken}`;

      console.log(`📋 Fetching leadgen forms for pageId: ${targetPageId}`);
      console.log(`🔗 Forms URL:`, formsUrl.replace(/access_token=[^&]+/, "access_token=***"));

      const response = await fetch(formsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: { message: response.statusText || "Unknown error" } };
        }
        console.error("❌ Failed to fetch leadgen forms:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch leadgen forms",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        forms: data.data || [],
        paging: data.paging || null,
        count: data.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching leadgen forms:", error);
      setCorsHeaders(res);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  });

  // Get Leads for a Lead Generation Form
  router.get("/leads", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { formId, userId, access_token } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!formId) {
        return res.status(400).json({
          success: false,
          error: "Form ID is required",
        });
      }

      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        const tokensData = await loadTokens(appUserId, userId);
        if (tokensData?.pageAccessToken?.token) {
          accessToken = tokensData.pageAccessToken.token;
        } else if (tokensData?.userAccessToken?.token) {
          accessToken = tokensData.userAccessToken.token;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      // Fetch leads from Facebook Graph API
      const leadsUrl = `https://graph.facebook.com/${graphVersion}/${formId}/leads?access_token=${accessToken}`;

      console.log(`📋 Fetching leads for formId: ${formId}`);
      console.log(`🔗 Leads URL:`, leadsUrl.replace(/access_token=[^&]+/, "access_token=***"));

      const response = await fetch(leadsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: { message: response.statusText || "Unknown error" } };
        }
        console.error("❌ Failed to fetch leads:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch leads",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        leads: data.data || [],
        paging: data.paging || null,
        count: data.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      setCorsHeaders(res);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  });

  // Get Campaign Insights
  router.get("/campaign-insights", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { campaignId, userId, fields } = req.query; // userId is platformUserId (Instagram/Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: "Campaign ID is required",
        });
      }
      let accessToken = null;

      // Try to get access token from stored tokens if userId is provided
      if (userId && loadTokens && appUserId) {
        try {
          const tokensData = await loadTokens(appUserId, userId);
          console.log(`🔍 Loaded tokens for appUserId: ${appUserId}, platformUserId: ${userId}`, {
            hasUserToken: !!tokensData?.userAccessToken?.token,
            hasPageToken: !!tokensData?.pageAccessToken?.token,
          });
          if (tokensData?.userAccessToken?.token) {
            accessToken = tokensData.userAccessToken.token;
          } else if (tokensData?.pageAccessToken?.token) {
            accessToken = tokensData.pageAccessToken.token;
          }
        } catch (error) {
          console.error(`❌ Error loading tokens:`, error);
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        console.error(
          `❌ No access token found for appUserId: ${appUserId}, platformUserId: ${userId}`
        );
        return res.status(400).json({
          success: false,
          error: "Access token is required. Provide userId or access_token parameter.",
        });
      }

      console.log(`✅ Using access token (length: ${accessToken?.length || 0})`);

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      const fieldsParam =
        fields || "impressions,clicks,reach,spend,ctr,cpc,unique_clicks,date_start,date_stop";
      params.append("fields", fieldsParam);

      // Fetch campaign insights from Facebook Graph API
      const insightsUrl = `https://graph.facebook.com/${graphVersion}/${campaignId}/insights?${params.toString()}`;

      const response = await fetch(insightsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch campaign insights:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch campaign insights",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        insights: data.data || [],
        paging: data.paging || null,
      });
    } catch (error) {
      console.error("Error fetching campaign insights:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Facebook Ad Accounts
   * GET /api/analytics/facebook/ad-accounts
   * Query params:
   *   - userId (required) - Facebook user ID
   */
  router.get("/facebook/ad-accounts", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId } = req.query; // This is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      let accessToken = null;

      // Try to get access token from stored Facebook tokens
      if (userId && loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.userAccessToken) {
          accessToken = tokensData.userAccessToken;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Please connect your Facebook account first.",
        });
      }

      // Fetch ad accounts from Facebook Graph API
      const adAccountsUrl = `https://graph.facebook.com/${graphVersion}/me/adaccounts?access_token=${accessToken}`;

      const response = await fetch(adAccountsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch Facebook ad accounts:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ad accounts",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        adAccounts: data.data || [],
        paging: data.paging || null,
      });
    } catch (error) {
      console.error("Error fetching Facebook ad accounts:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Facebook Campaigns from all Ad Accounts
   * GET /api/analytics/facebook/campaigns
   * Query params:
   *   - userId (required) - Facebook user ID
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get("/facebook/campaigns", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, fields } = req.query; // userId is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      console.log("userId", userId);
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      let accessToken = null;

      // Try to get access token from stored Facebook tokens
      if (userId && loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.userAccessToken) {
          accessToken = tokensData.userAccessToken;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Please connect your Facebook account first.",
        });
      }

      // First, fetch all ad accounts
      const adAccountsUrl = `https://graph.facebook.com/${graphVersion}/me/adaccounts?access_token=${accessToken}`;
      const adAccountsResponse = await fetch(adAccountsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!adAccountsResponse.ok) {
        const errorData = await adAccountsResponse.json();
        console.error("❌ Failed to fetch Facebook ad accounts:", errorData);
        return res.status(adAccountsResponse.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ad accounts",
          details: errorData,
        });
      }

      const adAccountsData = await adAccountsResponse.json();
      const adAccounts = adAccountsData.data || [];

      // Build query parameters for campaigns
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - default fields if not provided
      const fieldsParam = fields || "id,name,status,start_time,objective";
      params.append("fields", fieldsParam);

      // Fetch campaigns from all ad accounts
      const allCampaigns = [];
      for (const account of adAccounts) {
        try {
          const campaignsUrl = `https://graph.facebook.com/${graphVersion}/${
            account.id
          }/campaigns?${params.toString()}`;
          const campaignsResponse = await fetch(campaignsUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            const campaigns = campaignsData.data || [];
            // Add account info to each campaign
            campaigns.forEach((campaign) => {
              let cleanedName = campaign.name || "";
              if (typeof cleanedName === "string") {
                try {
                  cleanedName = JSON.parse(cleanedName);
                } catch (e) {
                  cleanedName = cleanedName.trim();
                }
              }

              allCampaigns.push({
                ...campaign,
                name: cleanedName,
                accountId: account.id,
                accountName: account.name || account.id,
              });
            });
          } else {
            console.warn(`⚠️ Failed to fetch campaigns for account ${account.id}`);
          }
        } catch (accountError) {
          console.error(`❌ Error fetching campaigns for account ${account.id}:`, accountError);
        }
      }

      res.json({
        success: true,
        campaigns: allCampaigns,
        count: allCampaigns.length,
      });
    } catch (error) {
      console.error("Error fetching Facebook campaigns:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Facebook Campaign Insights
   * GET /api/analytics/facebook/campaign-insights
   * Query params:
   *   - campaignId (required) - Campaign ID
   *   - userId (required) - Facebook user ID
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get("/facebook/campaign-insights", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { campaignId, userId, fields } = req.query; // userId is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: "Campaign ID is required",
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      let accessToken = null;

      // Try to get access token from stored Facebook tokens
      if (userId && loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.userAccessToken) {
          accessToken = tokensData.userAccessToken;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Please connect your Facebook account first.",
        });
      }

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      const fieldsParam =
        fields || "impressions,clicks,reach,spend,ctr,cpc,unique_clicks,date_start,date_stop";
      params.append("fields", fieldsParam);

      // Fetch campaign insights from Facebook Graph API
      const insightsUrl = `https://graph.facebook.com/${graphVersion}/${campaignId}/insights?${params.toString()}`;

      const response = await fetch(insightsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch Facebook campaign insights:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch campaign insights",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        insights: data.data || [],
        paging: data.paging || null,
      });
    } catch (error) {
      console.error("Error fetching Facebook campaign insights:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Facebook AdSets for a Campaign
   * GET /api/analytics/facebook/adsets
   * Query params:
   *   - campaignId (required) - Campaign ID
   *   - userId (required) - Facebook user ID
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get("/facebook/adsets", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { campaignId, userId, fields } = req.query; // userId is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: "Campaign ID is required",
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      let accessToken = null;

      // Try to get access token from stored Facebook tokens
      if (userId && loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.userAccessToken) {
          accessToken = tokensData.userAccessToken;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Please connect your Facebook account first.",
        });
      }

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - include targeting with publisher_platforms, facebook_positions, instagram_positions
      const fieldsParam =
        fields ||
        "id,name,status,daily_budget,targeting{publisher_platforms,facebook_positions,instagram_positions}";
      params.append("fields", fieldsParam);

      // Add breakdown by publisher_platform to separate Facebook and Instagram adsets
      params.append("breakdowns", "publisher_platform");

      // Fetch adsets from Facebook Graph API
      const adsetsUrl = `https://graph.facebook.com/${graphVersion}/${campaignId}/adsets?${params.toString()}`;

      const response = await fetch(adsetsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch Facebook adsets:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch adsets",
          details: errorData,
        });
      }

      const data = await response.json();

      // Process adsets to separate by platform
      const processedAdsets = [];
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((adset) => {
          // If breakdown is present, it means the adset is split by platform
          if (adset.publisher_platform) {
            processedAdsets.push({
              ...adset,
              platform: adset.publisher_platform, // 'facebook' or 'instagram'
            });
          } else {
            // If no breakdown, check targeting for publisher_platforms
            const platforms = adset.targeting?.publisher_platforms || [];
            if (platforms.length > 0) {
              platforms.forEach((platform) => {
                processedAdsets.push({
                  ...adset,
                  platform: platform,
                });
              });
            } else {
              // Default to both if not specified
              processedAdsets.push({
                ...adset,
                platform: "all",
              });
            }
          }
        });
      }

      res.json({
        success: true,
        adsets: processedAdsets,
        paging: data.paging || null,
        count: processedAdsets.length,
      });
    } catch (error) {
      console.error("Error fetching Facebook adsets:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  /**
   * Get Facebook Ads for an AdSet
   * GET /api/analytics/facebook/ads
   * Query params:
   *   - adsetId (required) - AdSet ID
   *   - userId (required) - Facebook user ID
   *   - fields (optional) - Comma-separated fields to retrieve
   */
  router.get("/facebook/ads", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { adsetId, userId, fields } = req.query; // userId is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!adsetId) {
        return res.status(400).json({
          success: false,
          error: "AdSet ID is required",
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      let accessToken = null;

      // Try to get access token from stored Facebook tokens
      if (userId && loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.userAccessToken) {
          accessToken = tokensData.userAccessToken;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!accessToken) {
        accessToken = req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required. Please connect your Facebook account first.",
        });
      }

      // Build query parameters
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      // Add fields parameter - default fields if not provided
      const fieldsParam =
        fields || "impressions,clicks,reach,spend,ctr,cpc,unique_clicks,date_start,date_stop";
      params.append("fields", fieldsParam);

      // Fetch ads from Facebook Graph API
      const adsUrl = `https://graph.facebook.com/${graphVersion}/${adsetId}/ads?${params.toString()}`;

      const response = await fetch(adsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to fetch Facebook ads:", errorData);

        // If ads are not available, return empty array
        if (response.status === 404 || (errorData.error && errorData.error.code === 100)) {
          return res.json({
            success: true,
            ads: [],
            message: "No ads available for this adset",
            count: 0,
          });
        }

        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || "Failed to fetch ads",
          details: errorData,
        });
      }

      const data = await response.json();
      res.json({
        success: true,
        ads: data.data || [],
        paging: data.paging || null,
        count: data.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching Facebook ads:", error);
      setCorsHeaders(res);
      res.json({
        success: true,
        ads: [],
        message: "Unable to fetch ads data",
        count: 0,
      });
    }
  });

  /**
   * Get Facebook Page Insights
   * GET /api/analytics/facebook/page-insights
   * Query params:
   *   - userId (required) - Facebook user ID
   *   - pageId (optional) - Facebook page ID (if not provided, uses pageId from token file)
   *   - metric (optional) - Comma-separated metrics (default: page_views_total,page_post_engagements,page_impressions_unique)
   *   - period (optional) - Period: day, week, days_28 (default: day)
   *   - since (optional) - Unix timestamp for start date
   *   - until (optional) - Unix timestamp for end date
   */
  router.get("/facebook/page-insights", optionalAuthenticate, async (req, res) => {
    try {
      setCorsHeaders(res);

      const { userId, pageId, metric, period, since, until } = req.query; // userId is platformUserId (Facebook user ID)
      const appUserId = req.user?._id?.toString() || null; // Application user ID
      const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v24.0";

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required. Provide userId as a query parameter.",
        });
      }

      if (!appUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please login.",
        });
      }

      // Load Facebook tokens
      let pageAccessToken = null;
      let targetPageId = pageId;

      if (loadFacebookTokens && appUserId) {
        const tokensData = await loadFacebookTokens(appUserId, userId);
        if (tokensData?.pageAccessToken) {
          pageAccessToken = tokensData.pageAccessToken;
        }
        // Use pageId from token data if not provided
        if (!targetPageId && tokensData?.pageId) {
          targetPageId = tokensData.pageId;
        }
      }

      // If no token from storage, check if token is provided directly
      if (!pageAccessToken) {
        pageAccessToken =
          req.query.access_token || req.headers.authorization?.replace("Bearer ", "");
      }

      if (!pageAccessToken) {
        return res.status(400).json({
          success: false,
          error: "Page access token is required. Please connect your Facebook account first.",
        });
      }

      if (!targetPageId) {
        return res.status(400).json({
          success: false,
          error:
            "Page ID is required. Provide pageId as a query parameter or ensure it's stored in your token file.",
        });
      }

      // Build URL
      const baseUrl = `https://graph.facebook.com/${graphVersion}/${targetPageId}/insights`;
      const params = new URLSearchParams({
        access_token: pageAccessToken,
      });

      // Add metrics (default to the ones from the curl example)
      const metrics = metric || "page_views_total,page_post_engagements,page_impressions_unique";
      params.append("metric", metrics);

      // Add period (default: day)
      const periodValue = period || "day";
      params.append("period", periodValue);

      // Add date range if provided
      if (since) {
        params.append("since", since);
      }
      if (until) {
        params.append("until", until);
      }

      const url = `${baseUrl}?${params.toString()}`;

      console.log(`🔗 Fetching Facebook Page Insights for page: ${targetPageId}`);
      console.log(`🔗 Full URL: ${url.replace(pageAccessToken, "TOKEN_HIDDEN")}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Facebook Page Insights API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || `Facebook API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log(`✅ Facebook Page Insights fetched successfully`);

      res.json({
        success: true,
        insights: data.data || [],
        paging: data.paging || null,
        pageId: targetPageId,
        period: periodValue,
      });
    } catch (error) {
      console.error("❌ Error fetching Facebook Page Insights:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch Facebook Page Insights",
      });
    }
  });

  return router;
};

export default createAnalyticsRouter;
