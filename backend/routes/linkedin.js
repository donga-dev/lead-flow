import express from "express";
import { optionalAuthenticate } from "../middleware/auth.js";

/**
 * Create LinkedIn API router
 * @param {Function} loadLinkedInToken - Function to load LinkedIn token from database
 * @param {Function} setCorsHeaders - Function to set CORS headers
 * @returns {express.Router} LinkedIn API router
 */
export const createLinkedInRouter = (loadLinkedInToken, setCorsHeaders) => {
  const router = express.Router();

  // Helper function to get LinkedIn token and set CORS headers
  const getLinkedInToken = async (req, res) => {
    setCorsHeaders(res);
    const appUserId = req.user?._id?.toString() || null;
    if (!appUserId) {
      return { error: "Authentication required. Please login." };
    }
    const token = await loadLinkedInToken(appUserId);
    if (!token) {
      return { error: "LinkedIn token not found. Please connect your LinkedIn account first." };
    }
    return token;
  };

  /**
   * Get LinkedIn Ad Accounts
   * GET /api/linkedin/ad-accounts
   * Query params: type (optional, default: BUSINESS)
   */
  router.get("/ad-accounts", optionalAuthenticate, async (req, res) => {
    try {
      const token = await getLinkedInToken(req, res);
      if (!token || token.error) {
        return res.status(401).json({
          success: false,
          error:
            token?.error || "LinkedIn token not found. Please connect your LinkedIn account first.",
        });
      }

      const accountType = req.query.type || "BUSINESS";

      // LinkedIn Rest.li search format: (type:(values:List(BUSINESS)))
      // Build the search query string
      const searchQuery = `(type:(values:List(${accountType})))`;

      // Manually construct URL to match the exact format from curl command
      // The search parameter needs to be URL encoded properly
      // Format: https://api.linkedin.com/rest/adAccounts?q=search&search=(type:(values:List(BUSINESS)))
      const baseUrl = "https://api.linkedin.com/rest/adAccounts";
      const url = `${baseUrl}?q=search&search=${searchQuery}`;

      console.log("🔗 Fetching LinkedIn Ad Accounts...");

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202307",
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ LinkedIn Ad Accounts API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.message || `LinkedIn API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log("✅ LinkedIn Ad Accounts fetched successfully");

      res.json({
        success: true,
        adAccounts: data.elements || [],
        total: data.paging?.total || 0,
      });
    } catch (error) {
      console.error("❌ Error fetching LinkedIn Ad Accounts:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch LinkedIn Ad Accounts",
      });
    }
  });

  /**
   * Get LinkedIn Ad Account by ID
   * GET /api/linkedin/ad-accounts/:accountId
   */
  router.get("/ad-accounts/:accountId", optionalAuthenticate, async (req, res) => {
    try {
      const token = await getLinkedInToken(req, res);
      if (!token || token.error) {
        return res.status(401).json({
          success: false,
          error:
            token?.error || "LinkedIn token not found. Please connect your LinkedIn account first.",
        });
      }

      const { accountId } = req.params;

      const url = `https://api.linkedin.com/rest/adAccounts/${accountId}`;

      console.log(`🔗 Fetching LinkedIn Ad Account: ${accountId}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202307",
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ LinkedIn Ad Account API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.message || `LinkedIn API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log("✅ LinkedIn Ad Account fetched successfully");

      res.json({
        success: true,
        adAccount: data,
      });
    } catch (error) {
      console.error("❌ Error fetching LinkedIn Ad Account:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch LinkedIn Ad Account",
      });
    }
  });

  /**
   * Get LinkedIn Ad Account Campaigns
   * GET /api/linkedin/ad-accounts/:accountId/campaigns
   * Query params:
   *   - type (optional, default: SPONSORED_UPDATES) - Campaign type (SPONSORED_UPDATES, SPONSORED_CONTENT, etc.)
   *   - status (optional, default: ACTIVE) - Campaign status (ACTIVE, PAUSED, ARCHIVED, etc.)
   *   - types (optional) - Comma-separated list of types (e.g., "SPONSORED_UPDATES,SPONSORED_CONTENT")
   *   - statuses (optional) - Comma-separated list of statuses (e.g., "ACTIVE,PAUSED")
   */
  router.get("/ad-accounts/:accountId/campaigns", optionalAuthenticate, async (req, res) => {
    try {
      const token = await getLinkedInToken(req, res);
      if (!token || token.error) {
        return res.status(401).json({
          success: false,
          error:
            token?.error || "LinkedIn token not found. Please connect your LinkedIn account first.",
        });
      }

      const { accountId } = req.params;
      const { type, status, types, statuses } = req.query;

      // Build search query
      let searchQuery = "";

      // Handle multiple types if provided
      if (types) {
        const typeList = types
          .split(",")
          .map((t) => t.trim())
          .join(",");
        searchQuery = `(type:(values:List(${typeList}))`;
      } else if (type) {
        searchQuery = `(type:(values:List(${type}))`;
      } else {
        // Default to SPONSORED_UPDATES
        searchQuery = `(type:(values:List(SPONSORED_UPDATES))`;
      }

      // Handle multiple statuses if provided
      if (statuses) {
        const statusList = statuses
          .split(",")
          .map((s) => s.trim())
          .join(",");
        searchQuery += `,status:(values:List(${statusList}))`;
      } else if (status) {
        searchQuery += `,status:(values:List(${status}))`;
      } else {
        // Default to ACTIVE
        searchQuery += `,status:(values:List(ACTIVE,DRAFT))`;
      }

      searchQuery += ")";

      const url = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&search=${searchQuery}`;

      console.log(`🔗 Fetching LinkedIn Ad Campaigns for account: ${accountId}`);
      console.log(`📋 Search query: ${searchQuery}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Linkedin-Version": "202307",
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ LinkedIn Ad Campaigns API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.message || `LinkedIn API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log(
        `✅ LinkedIn Ad Campaigns fetched successfully: ${data.elements?.length || 0} campaigns`
      );

      res.json({
        success: true,
        campaigns: data.elements || [],
        total: data.paging?.total || data.elements?.length || 0,
        accountId: accountId,
      });
    } catch (error) {
      console.error("❌ Error fetching LinkedIn Ad Campaigns:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch LinkedIn Ad Campaigns",
      });
    }
  });

  /**
   * Get LinkedIn Ad Analytics
   * GET /api/linkedin/ad-analytics
   * Query params:
   *   - accountId (required) - The LinkedIn ad account ID (can be numeric or URN format)
   *   - dateRange (optional) - Date range in format: (start:(year:YYYY,month:MM,day:DD),end:(year:YYYY,month:MM,day:DD))
   *   - pivot (optional) - Pivot dimension: CAMPAIGN, CREATIVE, etc. (default: CAMPAIGN)
   *   - timeGranularity (optional) - Time granularity: ALL, DAILY, MONTHLY (default: ALL)
   *   - fields (optional) - Comma-separated list of fields to retrieve (e.g., "impressions,clicks,conversions")
   */
  router.get("/ad-analytics", optionalAuthenticate, async (req, res) => {
    try {
      const token = await getLinkedInToken(req, res);
      if (!token || token.error) {
        return res.status(401).json({
          success: false,
          error:
            token?.error || "LinkedIn token not found. Please connect your LinkedIn account first.",
        });
      }

      const { accountId, dateRange, pivot, timeGranularity, fields } = req.query;

      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: "accountId is required. Provide accountId as a query parameter.",
        });
      }

      // Build URL with base query
      const baseUrl = "https://api.linkedin.com/rest/adAnalytics";
      let url = `${baseUrl}?q=analytics`;

      // Add account URN - LinkedIn expects URN format in List()
      // If accountId is not already a URN, convert it
      let accountURN = accountId;
      if (!accountId.startsWith("urn:li:sponsoredAccount:")) {
        accountURN = `urn:li:sponsoredAccount:${accountId}`;
      }
      // Format accounts as List(urn:li:sponsoredAccount:123)
      url += `&accounts=List(${encodeURIComponent(accountURN)})`;

      // Add pivot if provided (default to CAMPAIGN)
      const pivotValue = pivot || "CAMPAIGN";
      url += `&pivot=${pivotValue}`;

      // Build date range in Rest.li format: (start:(year:YYYY,month:MM,day:DD),end:(year:YYYY,month:MM,day:DD))
      const buildDateRange = (start, end) => {
        const startYear = start.getUTCFullYear();
        const startMonth = start.getUTCMonth() + 1;
        const startDay = start.getUTCDate();
        const endYear = end.getUTCFullYear();
        const endMonth = end.getUTCMonth() + 1;
        const endDay = end.getUTCDate();

        return `(start:(year:${startYear},month:${startMonth},day:${startDay}),end:(year:${endYear},month:${endMonth},day:${endDay}))`;
      };

      let dateRangeStr;
      // Add date range if provided
      if (dateRange) {
        const dr = JSON.parse(dateRange);
        dateRangeStr = buildDateRange(new Date(dr.start), new Date(dr.end));
      } else {
        // Default to last 30 days if not provided
        const end = new Date();
        const start = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 30)
        );
        dateRangeStr = buildDateRange(start, end);
      }
      url += `&dateRange=${encodeURIComponent(dateRangeStr)}`;

      // Add time granularity if provided (default: DAILY)
      const granularity = timeGranularity || "DAILY";
      url += `&timeGranularity=${granularity}`;

      // Add fields if provided (default to common metrics)
      // Format fields as List(field1,field2,field3)
      let fieldsStr;
      if (fields) {
        // If fields is already a comma-separated string, convert to List format
        if (fields.includes(",")) {
          fieldsStr = `List(${fields})`;
        } else if (fields.startsWith("List(")) {
          fieldsStr = fields; // Already in List format
        } else {
          fieldsStr = `List(${fields})`;
        }
      } else {
        // Default fields: impressions, clicks, conversions, cost, etc.
        fieldsStr =
          "List(impressions,clicks,costInLocalCurrency,externalWebsiteConversions,conversionValueInLocalCurrency)";
      }
      url += `&fields=${encodeURIComponent(fieldsStr)}`;

      console.log(`🔗 Fetching LinkedIn Ad Analytics for account: ${accountURN}`);
      console.log(`🔗 Full URL: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Linkedin-Version": "202307",
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ LinkedIn Ad Analytics API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.message || `LinkedIn API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log(`✅ LinkedIn Ad Analytics fetched successfully`);

      res.json({
        success: true,
        analytics: data.elements || [],
        total: data.paging?.total || data.elements?.length || 0,
        accountId: accountURN,
        pivot: pivotValue,
        timeGranularity: granularity,
      });
    } catch (error) {
      console.error("❌ Error fetching LinkedIn Ad Analytics:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch LinkedIn Ad Analytics",
      });
    }
  });

  /**
   * Get LinkedIn Organizational Entity Share Statistics
   * GET /api/linkedin/organizational-entity-share-statistics
   * Query params:
   *   - organizationalEntity (required) - The organization URN (e.g., urn:li:organization:76142531) or just the ID
   */
  router.get("/organizational-entity-share-statistics", optionalAuthenticate, async (req, res) => {
    try {
      const token = await getLinkedInToken(req, res);
      if (!token || token.error) {
        return res.status(401).json({
          success: false,
          error:
            token?.error || "LinkedIn token not found. Please connect your LinkedIn account first.",
        });
      }

      const { organizationalEntity } = req.query;

      if (!organizationalEntity) {
        return res.status(400).json({
          success: false,
          error:
            "organizationalEntity is required. Provide organizationalEntity as a query parameter.",
        });
      }

      // Build organization URN - LinkedIn expects URN format
      let orgURN = organizationalEntity;
      if (!organizationalEntity.startsWith("urn:li:organization:")) {
        orgURN = `urn:li:organization:${organizationalEntity}`;
      }

      // URL encode the URN for the query parameter
      const encodedOrgURN = encodeURIComponent(orgURN);

      const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedOrgURN}`;

      console.log(`🔗 Fetching LinkedIn Organizational Entity Share Statistics for: ${orgURN}`);
      console.log(`🔗 Full URL: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Linkedin-Version": "202307",
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ LinkedIn Organizational Entity Share Statistics API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return res.status(response.status).json({
          success: false,
          error: errorData.message || `LinkedIn API error: ${response.statusText}`,
          details: errorData,
        });
      }

      const data = await response.json();
      console.log(`✅ LinkedIn Organizational Entity Share Statistics fetched successfully`);

      res.json({
        success: true,
        statistics: data.elements || [],
        total: data.paging?.total || data.elements?.length || 0,
        organizationalEntity: orgURN,
      });
    } catch (error) {
      console.error("❌ Error fetching LinkedIn Organizational Entity Share Statistics:", error);
      setCorsHeaders(res);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch LinkedIn Organizational Entity Share Statistics",
      });
    }
  });

  return router;
};
