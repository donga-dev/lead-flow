import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  Linkedin,
  Loader2,
  Calendar,
  RefreshCw,
  FileText,
} from "lucide-react";
import Dropdown from "../common/Dropdown";
import { useNavigate } from "react-router-dom";

// Helper functions to generate random numbers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) =>
  (Math.random() * (max - min) + min).toFixed(decimals);

// Static analytics data for when no analytics are available
const getStaticLinkedInAnalytics = () => {
  const impressions = randomInt(10000, 100000);
  const clicks = randomInt(200, 5000);
  const conversions = randomInt(10, 500);
  const cost = randomFloat(100, 2000);
  const ctr = randomFloat(1.5, 6.0);
  const cpc = randomFloat(0.5, 5.0);
  const cpm = randomFloat(5, 30);

  return {
    impressions: impressions.toString(),
    clicks: clicks.toString(),
    conversions: conversions.toString(),
    costInLocalCurrency: cost.toString(),
    ctr: ctr.toString(),
    cpc: cpc.toString(),
    cpm: cpm.toString(),
  };
};

const MetricCard = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
    orange: "bg-orange-500/20 text-orange-400",
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-sm ${
            trend > 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {trend > 0 ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <ArrowDownRight className="w-4 h-4" />
          )}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
};

const LinkedInAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignData, setCampaignData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeGranularity, setTimeGranularity] = useState("ALL");
  const [shareStatistics, setShareStatistics] = useState(null);
  const [loadingShareStats, setLoadingShareStats] = useState(false);
  const [organizationalEntity, setOrganizationalEntity] = useState("");
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

  // Format number with commas
  const formatNumber = (num) => {
    if (!num) return "0";
    return parseInt(num).toLocaleString();
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  // Check connection status from integrations API
  useEffect(() => {
    
    const checkConnection = async () => {
      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
          setLoading(false);
          setError("LinkedIn account not connected. Please connect your LinkedIn account first.");
          return;
        }

        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${authToken}`,
        };

        const integrationsResponse = await fetch(`${backendUrl}/api/integrations`, {
          method: "GET",
          headers: headers,
        });

        if (integrationsResponse.ok) {
          const integrationsData = await integrationsResponse.json();
          const linkedinIntegration = integrationsData.integrations?.linkedin;

          if (
            !linkedinIntegration ||
            !linkedinIntegration.connected ||
            linkedinIntegration.tokenExpired
          ) {
            setError("LinkedIn account not connected. Please connect your LinkedIn account first.");
            setLoading(false);
            return;
          }

          // If connected, fetch ad accounts
          fetchAdAccounts();
        } else {
          setError("LinkedIn account not connected. Please connect your LinkedIn account first.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking LinkedIn connection:", error);
        setError("LinkedIn account not connected. Please connect your LinkedIn account first.");
        setLoading(false);
      }
    };

    checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl]);

  // Fetch LinkedIn Ad Accounts
  const fetchAdAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authToken = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${backendUrl}/api/linkedin/ad-accounts`, {
        headers: headers,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.adAccounts) {
          setAdAccounts(result.adAccounts);
          // Auto-select first account if available
          if (result.adAccounts.length > 0 && !selectedAccount) {
            setSelectedAccount(result.adAccounts[0].id);
          }
        } else {
          setError("No ad accounts found. Please connect your LinkedIn account.");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setError("LinkedIn account not connected. Please connect your LinkedIn account first.");
        } else {
          setError(errorData.error || "Failed to fetch ad accounts");
        }
      }
    } catch (error) {
      console.error("Error fetching ad accounts:", error);
      setError("Failed to fetch ad accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, selectedAccount]);

  // Fetch Campaigns for selected account
  const fetchCampaigns = useCallback(async () => {
    if (!selectedAccount) {
      setCampaigns([]);
      setSelectedCampaign(null);
      setCampaignData(null);
      return;
    }

    setLoadingCampaigns(true);
    setError(null);
    try {
      const response = await fetch(
        `${backendUrl}/api/linkedin/ad-accounts/${selectedAccount}/campaigns?type=SPONSORED_UPDATES&status=ACTIVE,DRAFT`,
        {
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.campaigns) {
          setCampaigns(result.campaigns);
          // Auto-select first campaign if available
          if (result.campaigns.length > 0 && !selectedCampaign) {
            setSelectedCampaign(result.campaigns[0].id);
          }
        } else {
          setCampaigns([]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch campaigns:", errorData);
        setCampaigns([]);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [selectedAccount, backendUrl, selectedCampaign]);

  // Fetch campaign data when selected
  useEffect(() => {
    if (selectedCampaign && campaigns.length > 0) {
      const campaign = campaigns.find((c) => c.id === selectedCampaign);
      if (campaign) {
        setCampaignData(campaign);
      }
    } else {
      setCampaignData(null);
    }
  }, [selectedCampaign, campaigns]);

  // Fetch Ad Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!selectedAccount) {
      setAnalyticsData(null);
      return;
    }

    setLoadingAnalytics(true);
    setError(null);
    try {
      // Extract account ID from URN if needed
      // Convert to string to ensure startsWith works
      const accountIdStr = String(selectedAccount);
      let accountId = accountIdStr;
      if (accountIdStr && accountIdStr.startsWith("urn:li:sponsoredAccount:")) {
        accountId = accountIdStr.replace("urn:li:sponsoredAccount:", "");
      }

      const params = new URLSearchParams({
        accountId: accountId,
        timeGranularity: "DAILY",
        pivot: "ACCOUNT",
      });

      const response = await fetch(`${backendUrl}/api/linkedin/ad-analytics?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.analytics) {
          setAnalyticsData(result.analytics);
        } else {
          setAnalyticsData([]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch analytics:", errorData);
        setAnalyticsData([]);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setAnalyticsData([]);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedAccount, timeGranularity, backendUrl]);

  // Fetch analytics when account or time granularity changes
  useEffect(() => {
    if (selectedAccount) {
      fetchAnalytics();
    }
  }, [selectedAccount, timeGranularity, fetchAnalytics]);

  // Fetch Organizational Entity Share Statistics
  const fetchShareStatistics = useCallback(
    async (orgReference = null) => {
      // Use provided orgReference or fall back to manual input
      const orgToUse = orgReference || organizationalEntity;

      if (!orgToUse || orgToUse.trim() === "") {
        setShareStatistics(null);
        return;
      }

      setLoadingShareStats(true);
      setError(null);
      try {
        // Extract organization ID if URN format is provided
        let orgId = orgToUse.trim();
        if (orgId.startsWith("urn:li:organization:")) {
          orgId = orgId.replace("urn:li:organization:", "");
        }

        const params = new URLSearchParams({
          organizationalEntity: orgId,
        });

        const response = await fetch(
          `${backendUrl}/api/linkedin/organizational-entity-share-statistics?${params.toString()}`,
          {
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.statistics) {
            setShareStatistics(result.statistics);
          } else {
            setShareStatistics([]);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to fetch share statistics:", errorData);
          setShareStatistics([]);
          setError(errorData.error || "Failed to fetch share statistics");
        }
      } catch (error) {
        console.error("Error fetching share statistics:", error);
        setShareStatistics([]);
        setError(error.message || "Failed to fetch share statistics");
      } finally {
        setLoadingShareStats(false);
      }
    },
    [organizationalEntity, backendUrl]
  );

  // Connection check and fetchAdAccounts is now handled in the connection check useEffect above

  // Fetch campaigns when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchCampaigns();

      // Automatically fetch share statistics if account has organization reference
      const account = adAccounts.find(
        (acc) => acc.id === selectedAccount || String(acc.id) === String(selectedAccount)
      );
      if (account && account.reference) {
        // Extract organization reference from account
        const orgReference = account.reference;
        if (orgReference && orgReference.startsWith("urn:li:organization:")) {
          setOrganizationalEntity(orgReference);
          fetchShareStatistics(orgReference);
        }
      }
    }
  }, [selectedAccount, fetchCampaigns, adAccounts, fetchShareStatistics]);

  // Handle account selection
  const handleAccountChange = (accountId) => {
    // Prevent any default behavior
    if (accountId === selectedAccount) {
      return; // Don't update if same account selected
    }
    setSelectedAccount(accountId);
    setSelectedCampaign(null);
    setCampaigns([]);
    setCampaignData(null);
    setAnalyticsData(null); // Clear analytics when account changes
  };

  // Handle campaign selection
  const handleCampaignChange = (campaignId) => {
    setSelectedCampaign(campaignId);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111827] h-full">
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 animate-pulse mx-auto mb-4 opacity-50" />
          <p className="text-sm">Loading LinkedIn analytics...</p>
        </div>
      </div>
    );
  }

  if (error && adAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Linkedin className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400 text-lg">Please connect your LinkedIn account first</p>
          <p className="text-slate-500 text-sm mt-2">
            Go to Channels to connect your LinkedIn account
          </p>
          <button
            onClick={() => navigate("/channels")}
            className="text-sm text-blue-500 hover:text-blue-600 mt-2 cursor-pointer px-3 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
          >
            Go to Channels
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111827] h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">LinkedIn Analytics</h1>
            <p className="text-slate-400 text-sm">LinkedIn ad performance and insights</p>
          </div>
        </div>

        {/* Ad Account Selection */}
        {adAccounts.length > 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Select Ad Account
              </h2>
            </div>
            <Dropdown
              options={adAccounts.map((account) => ({
                value: account.id,
                label: account.name || account.id || "Unnamed Account",
              }))}
              value={selectedAccount}
              onChange={(value) => {
                // Ensure we prevent any default behavior
                handleAccountChange(value);
              }}
              placeholder="Select an ad account"
            />
          </div>
        )}

        {/* Campaign Selection */}
        {selectedAccount && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Select Campaign
              </h2>
              {loadingCampaigns && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
            </div>
            {loadingCampaigns ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading campaigns...</p>
              </div>
            ) : campaigns.length > 0 ? (
              <Dropdown
                options={campaigns.map((campaign) => ({
                  value: campaign.id,
                  label: campaign.name || campaign.id || "Unnamed Campaign",
                }))}
                value={selectedCampaign}
                onChange={handleCampaignChange}
                placeholder="Select a campaign"
              />
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-400">No active campaigns found</p>
              </div>
            )}
          </div>
        )}

        {/* Campaign Details */}
        {campaignData && selectedCampaign && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Campaign Performance
              </h2>
            </div>

            {/* Campaign Info */}
            <div className="mb-6 pb-6 border-b border-slate-700">
              <h3 className="text-md font-semibold text-slate-100 mb-2">
                {campaignData.name || "Unnamed Campaign"}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                {campaignData.status && (
                  <span className="flex items-center gap-1">
                    Status:{" "}
                    <span
                      className={`font-semibold ${
                        campaignData.status === "ACTIVE"
                          ? "text-green-400"
                          : campaignData.status === "PAUSED"
                          ? "text-yellow-400"
                          : "text-slate-400"
                      }`}
                    >
                      {campaignData.status}
                    </span>
                  </span>
                )}
                {campaignData.type && (
                  <span className="flex items-center gap-1">
                    Type: <span className="font-semibold text-slate-300">{campaignData.type}</span>
                  </span>
                )}
                {campaignData.id && (
                  <span className="flex items-center gap-1">
                    ID: <span className="font-mono text-xs text-slate-500">{campaignData.id}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {campaignData.costInLocalCurrency && (
                <MetricCard
                  title="Total Spend"
                  value={formatCurrency(campaignData.costInLocalCurrency)}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="green"
                />
              )}
              {campaignData.impressions && (
                <MetricCard
                  title="Impressions"
                  value={formatNumber(campaignData.impressions)}
                  icon={<Eye className="w-5 h-5" />}
                  color="blue"
                />
              )}
              {campaignData.clicks && (
                <MetricCard
                  title="Clicks"
                  value={formatNumber(campaignData.clicks)}
                  icon={<MousePointerClick className="w-5 h-5" />}
                  color="purple"
                />
              )}
              {campaignData.ctr && (
                <MetricCard
                  title="CTR"
                  value={`${parseFloat(campaignData.ctr).toFixed(2)}%`}
                  icon={<Target className="w-5 h-5" />}
                  color="orange"
                />
              )}
            </div>

            {/* Additional Metrics */}
            {(campaignData.cpc ||
              campaignData.cpm ||
              campaignData.reach ||
              campaignData.conversions) && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-md font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Additional Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {campaignData.cpc && (
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">CPC</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {formatCurrency(campaignData.cpc)}
                      </span>
                    </div>
                  )}
                  {campaignData.cpm && (
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">CPM</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {formatCurrency(campaignData.cpm)}
                      </span>
                    </div>
                  )}
                  {campaignData.reach && (
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">Reach</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {formatNumber(campaignData.reach)}
                      </span>
                    </div>
                  )}
                  {campaignData.conversions && (
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">Conversions</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {formatNumber(campaignData.conversions)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campaign Details JSON (for debugging) */}
            {/* {process.env.NODE_ENV === "development" && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-300 mb-2">
                    View Raw Data
                  </summary>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-slate-300">
                    {JSON.stringify(campaignData, null, 2)}
                  </pre>
                </details>
              </div>
            )} */}
          </div>
        )}

        {/* No Campaign Selected */}
        {selectedAccount && !loadingCampaigns && campaigns.length === 0 && !selectedCampaign && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-400">No campaigns available for this account</p>
            </div>
          </div>
        )}

        {/* Organization Share Statistics Overview */}
        {selectedAccount && organizationalEntity && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Organization Share Statistics Overview
              </h2>
              <button
                onClick={() => fetchShareStatistics(organizationalEntity)}
                disabled={loadingShareStats}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh Share Statistics"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-300 ${loadingShareStats ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {loadingShareStats ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading share statistics...</p>
              </div>
            ) : shareStatistics && shareStatistics.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  // Calculate aggregate statistics
                  // Data structure: statistics[].totalShareStatistics.{shareCount, clickCount, etc.}
                  const aggregate = shareStatistics.reduce(
                    (acc, stat) => {
                      const stats = stat.totalShareStatistics || {};
                      acc.shareCount += parseInt(stats.shareCount || 0);
                      acc.clickCount += parseInt(stats.clickCount || 0);
                      acc.likeCount += parseInt(stats.likeCount || 0);
                      acc.commentCount += parseInt(stats.commentCount || 0);
                      acc.commentMentionsCount += parseInt(stats.commentMentionsCount || 0);
                      acc.shareMentionsCount += parseInt(stats.shareMentionsCount || 0);
                      acc.engagement += parseInt(stats.engagement || 0);
                      acc.impressionCount += parseInt(stats.impressionCount || 0);
                      return acc;
                    },
                    {
                      shareCount: 0,
                      clickCount: 0,
                      likeCount: 0,
                      commentCount: 0,
                      commentMentionsCount: 0,
                      shareMentionsCount: 0,
                      engagement: 0,
                      impressionCount: 0,
                    }
                  );

                  // Calculate CTR if we have clicks and impressions
                  const ctr =
                    aggregate.impressionCount > 0
                      ? ((aggregate.clickCount / aggregate.impressionCount) * 100).toFixed(2)
                      : 0;

                  return (
                    <>
                      {/* Main Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {aggregate.shareCount > 0 && (
                          <MetricCard
                            title="Total Shares"
                            value={formatNumber(aggregate.shareCount)}
                            icon={<Target className="w-5 h-5" />}
                            color="blue"
                          />
                        )}
                        {aggregate.clickCount > 0 && (
                          <MetricCard
                            title="Total Clicks"
                            value={formatNumber(aggregate.clickCount)}
                            icon={<MousePointerClick className="w-5 h-5" />}
                            color="purple"
                          />
                        )}
                        {aggregate.likeCount > 0 && (
                          <MetricCard
                            title="Total Likes"
                            value={formatNumber(aggregate.likeCount)}
                            icon={<TrendingUp className="w-5 h-5" />}
                            color="green"
                          />
                        )}
                        {aggregate.commentCount > 0 && (
                          <MetricCard
                            title="Total Comments"
                            value={formatNumber(aggregate.commentCount)}
                            icon={<Eye className="w-5 h-5" />}
                            color="orange"
                          />
                        )}
                        {aggregate.commentMentionsCount > 0 && (
                          <MetricCard
                            title="Comment Mentions"
                            value={formatNumber(aggregate.commentMentionsCount)}
                            icon={<Eye className="w-5 h-5" />}
                            color="orange"
                          />
                        )}
                        {aggregate.shareMentionsCount > 0 && (
                          <MetricCard
                            title="Share Mentions"
                            value={formatNumber(aggregate.shareMentionsCount)}
                            icon={<Target className="w-5 h-5" />}
                            color="blue"
                          />
                        )}
                        {aggregate.engagement > 0 && (
                          <MetricCard
                            title="Total Engagement"
                            value={formatNumber(aggregate.engagement)}
                            icon={<BarChart3 className="w-5 h-5" />}
                            color="green"
                          />
                        )}
                        {aggregate.impressionCount > 0 && (
                          <MetricCard
                            title="Total Impressions"
                            value={formatNumber(aggregate.impressionCount)}
                            icon={<Eye className="w-5 h-5" />}
                            color="blue"
                          />
                        )}
                        {ctr > 0 && (
                          <MetricCard
                            title="CTR"
                            value={`${ctr}%`}
                            icon={<Target className="w-5 h-5" />}
                            color="purple"
                          />
                        )}
                      </div>

                      {/* Additional Performance Metrics */}
                      {(aggregate.clickCount > 0 ||
                        aggregate.engagement > 0 ||
                        aggregate.impressionCount > 0) && (
                        <div className="mt-6 pt-6 border-t border-slate-700">
                          <h3 className="text-md font-semibold text-slate-100 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Performance Metrics
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {aggregate.clickCount > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">Clicks</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatNumber(aggregate.clickCount)}
                                </span>
                              </div>
                            )}
                            {aggregate.engagement > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">Engagement</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatNumber(aggregate.engagement)}
                                </span>
                              </div>
                            )}
                            {aggregate.impressionCount > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">Impressions</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatNumber(aggregate.impressionCount)}
                                </span>
                              </div>
                            )}
                            {ctr > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">CTR</span>
                                <span className="text-lg font-semibold text-slate-100">{ctr}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : shareStatistics && shareStatistics.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-400">No share statistics available</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Lead Generation Forms */}
        {selectedAccount && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Lead Generation Forms
              </h2>
            </div>
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ Showing static data for demonstration. Lead forms will be fetched from LinkedIn
                API in the future.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                // Static lead forms data
                const staticLeadForms = [
                  {
                    id: "urn:li:leadForm:123456789",
                    name: "Webinar Sign-Up Form",
                    status: "ACTIVE",
                    campaign: "urn:li:sponsoredCampaign:987654321",
                    account: "urn:li:sponsoredAccount:987654321",
                    createdAt: 1695000000000,
                    updatedAt: 1697600000000,
                  },
                  {
                    id: "urn:li:leadForm:987654321",
                    name: "Ebook Download Form",
                    status: "ACTIVE",
                    campaign: "urn:li:sponsoredCampaign:987654322",
                    account: "urn:li:sponsoredAccount:987654321",
                    createdAt: 1695200000000,
                    updatedAt: 1697700000000,
                  },
                  {
                    id: "urn:li:leadForm:112233445",
                    name: "Free Trial Form",
                    status: "INACTIVE",
                    campaign: "urn:li:sponsoredCampaign:987654323",
                    account: "urn:li:sponsoredAccount:987654321",
                    createdAt: 1695300000000,
                    updatedAt: 1697800000000,
                  },
                ];

                return staticLeadForms.map((form) => (
                  <div
                    key={form.id}
                    className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-100 mb-1">
                          {form.name || form.id}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          {form.status && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                form.status === "ACTIVE"
                                  ? "bg-green-500/20 text-green-400"
                                  : form.status === "INACTIVE"
                                  ? "bg-slate-600 text-slate-300"
                                  : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {form.status}
                            </span>
                          )}
                          {form.createdAt && (
                            <span className="text-xs text-slate-400">
                              Created: {new Date(form.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {form.id && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500 font-mono">ID: {form.id}</span>
                          </div>
                        )}
                      </div>
                      <button
                        disabled
                        className="text-xs px-3 py-1.5 bg-slate-600 text-slate-400 rounded opacity-50 cursor-not-allowed"
                      >
                        View Leads
                      </button>
                    </div>
                    {form.campaign && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <div className="text-xs text-slate-400">
                          <span className="text-slate-300">Campaign:</span>{" "}
                          <span className="font-mono">{form.campaign}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Analytics Overview */}
        {selectedAccount && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Account Analytics Overview
              </h2>
              <div className="flex items-center gap-2">
                <Dropdown
                  options={[
                    { value: "ALL", label: "All Time" },
                    { value: "DAILY", label: "Daily" },
                    { value: "MONTHLY", label: "Monthly" },
                  ]}
                  value={timeGranularity}
                  onChange={setTimeGranularity}
                  placeholder="Time Granularity"
                />
                <button
                  onClick={fetchAnalytics}
                  disabled={loadingAnalytics}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh Analytics"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-slate-300 ${loadingAnalytics ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            {loadingAnalytics ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading analytics...</p>
              </div>
            ) : analyticsData && analyticsData.length > 0 ? (
              <div className="space-y-4">
                {/* Aggregate Metrics */}
                {(() => {
                  // Calculate aggregate metrics from all analytics data
                  const aggregate = analyticsData.reduce(
                    (acc, item) => {
                      acc.impressions += parseInt(item.impressions || 0);
                      acc.clicks += parseInt(item.clicks || 0);
                      acc.conversions += parseInt(item.conversions || 0);
                      acc.cost += parseFloat(item.costInLocalCurrency || 0);
                      return acc;
                    },
                    { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
                  );

                  const ctr =
                    aggregate.impressions > 0
                      ? ((aggregate.clicks / aggregate.impressions) * 100).toFixed(2)
                      : 0;
                  const cpc = aggregate.clicks > 0 ? aggregate.cost / aggregate.clicks : 0;
                  const cpm =
                    aggregate.impressions > 0 ? (aggregate.cost / aggregate.impressions) * 1000 : 0;

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                          title="Total Spend"
                          value={formatCurrency(aggregate.cost)}
                          icon={<DollarSign className="w-5 h-5" />}
                          color="green"
                        />
                        <MetricCard
                          title="Impressions"
                          value={formatNumber(aggregate.impressions)}
                          icon={<Eye className="w-5 h-5" />}
                          color="blue"
                        />
                        <MetricCard
                          title="Clicks"
                          value={formatNumber(aggregate.clicks)}
                          icon={<MousePointerClick className="w-5 h-5" />}
                          color="purple"
                        />
                        <MetricCard
                          title="CTR"
                          value={`${ctr}%`}
                          icon={<Target className="w-5 h-5" />}
                          color="orange"
                        />
                      </div>

                      {/* Additional Performance Metrics */}
                      {(aggregate.conversions > 0 || cpc > 0 || cpm > 0) && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                          <h3 className="text-md font-semibold text-slate-100 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Performance Metrics
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {cpc > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">CPC</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatCurrency(cpc)}
                                </span>
                              </div>
                            )}
                            {cpm > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">CPM</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatCurrency(cpm)}
                                </span>
                              </div>
                            )}
                            {aggregate.conversions > 0 && (
                              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                <span className="text-sm text-slate-300">Conversions</span>
                                <span className="text-lg font-semibold text-slate-100">
                                  {formatNumber(aggregate.conversions)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Time-based Analytics (if timeGranularity is not ALL) */}
                {timeGranularity !== "ALL" && analyticsData.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <h3 className="text-md font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Time-based Breakdown
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {analyticsData.map((item, index) => (
                        <div
                          key={index}
                          className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-semibold text-slate-300">
                                {item.dateRange?.start
                                  ? new Date(
                                      `${item.dateRange.start.year}-${item.dateRange.start.month}-${item.dateRange.start.day}`
                                    ).toLocaleDateString()
                                  : "Period"}
                              </span>
                            </div>
                            {item.costInLocalCurrency && (
                              <span className="text-sm font-semibold text-green-400">
                                {formatCurrency(item.costInLocalCurrency)}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {item.impressions && (
                              <div>
                                <span className="text-slate-400">Impressions: </span>
                                <span className="text-slate-200">
                                  {formatNumber(item.impressions)}
                                </span>
                              </div>
                            )}
                            {item.clicks && (
                              <div>
                                <span className="text-slate-400">Clicks: </span>
                                <span className="text-slate-200">{formatNumber(item.clicks)}</span>
                              </div>
                            )}
                            {item.ctr && (
                              <div>
                                <span className="text-slate-400">CTR: </span>
                                <span className="text-slate-200">
                                  {parseFloat(item.ctr).toFixed(2)}%
                                </span>
                              </div>
                            )}
                            {item.conversions && (
                              <div>
                                <span className="text-slate-400">Conversions: </span>
                                <span className="text-slate-200">
                                  {formatNumber(item.conversions)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Show static data when no analytics are available
              (() => {
                const staticData = getStaticLinkedInAnalytics();
                const aggregate = {
                  impressions: parseInt(staticData.impressions),
                  clicks: parseInt(staticData.clicks),
                  conversions: parseInt(staticData.conversions),
                  cost: parseFloat(staticData.costInLocalCurrency),
                };
                const ctr = parseFloat(staticData.ctr);
                const cpc = parseFloat(staticData.cpc);
                const cpm = parseFloat(staticData.cpm);

                return (
                  <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-400">
                        ⚠️ No analytics data available. Showing sample data for demonstration.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard
                        title="Total Spend"
                        value={formatCurrency(aggregate.cost)}
                        icon={<DollarSign className="w-5 h-5" />}
                        color="green"
                      />
                      <MetricCard
                        title="Impressions"
                        value={formatNumber(aggregate.impressions)}
                        icon={<Eye className="w-5 h-5" />}
                        color="blue"
                      />
                      <MetricCard
                        title="Clicks"
                        value={formatNumber(aggregate.clicks)}
                        icon={<MousePointerClick className="w-5 h-5" />}
                        color="purple"
                      />
                      <MetricCard
                        title="CTR"
                        value={`${ctr}%`}
                        icon={<Target className="w-5 h-5" />}
                        color="orange"
                      />
                    </div>

                    {/* Additional Performance Metrics */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <h3 className="text-md font-semibold text-slate-100 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Performance Metrics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <span className="text-sm text-slate-300">CPC</span>
                          <span className="text-lg font-semibold text-slate-100">
                            {formatCurrency(cpc)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <span className="text-sm text-slate-300">CPM</span>
                          <span className="text-lg font-semibold text-slate-100">
                            {formatCurrency(cpm)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <span className="text-sm text-slate-300">Conversions</span>
                          <span className="text-lg font-semibold text-slate-100">
                            {formatNumber(aggregate.conversions)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkedInAnalytics;
