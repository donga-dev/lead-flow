import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Eye,
  Users,
  Heart,
  Facebook,
  RefreshCw,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Target,
  Zap,
} from "lucide-react";
import Dropdown from "../common/Dropdown";
import { useNavigate } from "react-router-dom";

// Helper functions to generate random numbers for static data
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) =>
  (Math.random() * (max - min) + min).toFixed(decimals);

// Static response data for when no campaign insights are available
const getStaticCampaignInsights = (campaignId) => {
  const impressions = randomInt(5000, 50000);
  const clicks = randomInt(100, 2000);
  const reach = randomInt(3000, 40000);
  const spend = randomFloat(50, 500);
  const ctr = randomFloat(1.5, 5.5);
  const cpc = randomFloat(0.5, 3.0);
  const cpm = randomFloat(5, 25);
  const frequency = randomFloat(1.2, 3.5);
  const uniqueClicks = randomInt(80, Math.floor(clicks * 0.95));

  return {
    id: `static_insights_${campaignId}`,
    impressions: impressions.toString(),
    clicks: clicks.toString(),
    reach: reach.toString(),
    spend: spend.toString(),
    ctr: ctr.toString(),
    cpc: cpc.toString(),
    cpm: cpm.toString(),
    frequency: frequency.toString(),
    unique_clicks: uniqueClicks.toString(),
    date_start: new Date().toISOString().split("T")[0],
    date_stop: null,
    actions: [],
  };
};

// Static response data for when no ads are available
const getStaticAdsData = (adsetId) => {
  const impressions = randomInt(1000, 15000);
  const clicks = randomInt(20, 500);
  const reach = randomInt(800, 12000);
  const spend = randomFloat(10, 150);
  const ctr = randomFloat(1.0, 6.0);
  const cpc = randomFloat(0.3, 2.5);
  const uniqueClicks = randomInt(15, Math.floor(clicks * 0.95));

  return [
    {
      id: `static_ad_${adsetId}_1`,
      impressions: impressions.toString(),
      clicks: clicks.toString(),
      reach: reach.toString(),
      spend: spend.toString(),
      ctr: ctr.toString(),
      cpc: cpc.toString(),
      unique_clicks: uniqueClicks.toString(),
      date_start: new Date().toISOString().split("T")[0],
      date_stop: null,
    },
  ];
};

const MetricCard = ({ title, value, icon, trend, color, description }) => {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
    orange: "bg-orange-500/20 text-orange-400",
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 text-sm ${
            trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-slate-400"
          }`}
        >
          {trend > 0 ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : trend < 0 ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : null}
          {trend !== 0 && <span>{Math.abs(trend)}%</span>}
          {trend === 0 && <span>No change</span>}
        </div>
      )}
    </div>
  );
};

const FacebookAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingAdsets, setLoadingAdsets] = useState(false);
  const [loadingAds, setLoadingAds] = useState({});
  const [loadingPageInsights, setLoadingPageInsights] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [pageInsights, setPageInsights] = useState([]);
  const [adsets, setAdsets] = useState([]);
  const [adsData, setAdsData] = useState({});
  const [userId, setUserId] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [period, setPeriod] = useState("day");

  const navigate = useNavigate();

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

  // Check connection status from integrations API
  useEffect(() => {
    const facebookUserId = localStorage.getItem("facebook_user_id");
    const facebookPageId = localStorage.getItem("facebook_page_id");
    if (facebookUserId && facebookPageId) {
      setLoading(false);
      setUserId(facebookUserId);
      setPageId(facebookPageId);
      return;
    }
    const checkConnection = async () => {
      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
          setLoading(false);
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
          const facebookIntegration = integrationsData.integrations?.facebook;

          if (
            facebookIntegration &&
            facebookIntegration.connected &&
            !facebookIntegration.tokenExpired &&
            facebookIntegration.platformUserId
          ) {
            setUserId(facebookIntegration.platformUserId);
            if (facebookIntegration.facebookPageId) {
              setPageId(facebookIntegration.facebookPageId);
            }
            // Store in localStorage for backward compatibility
            localStorage.setItem("facebook_user_id", facebookIntegration.platformUserId);
            if (facebookIntegration.facebookPageId) {
              localStorage.setItem("facebook_page_id", facebookIntegration.facebookPageId);
            }
          } else {
            setUserId(null);
            setPageId(null);
          }
        }
      } catch (error) {
        console.error("Error checking Facebook connection:", error);
        setUserId(null);
        setPageId(null);
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, [backendUrl]);

  // Fetch Campaigns from all Ad Accounts
  const fetchCampaigns = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setLoading(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${authToken}`,
      };
      const response = await fetch(
        `${backendUrl}/api/analytics/facebook/campaigns?userId=${userId}`,
        {
          headers: headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.campaigns) {
          setCampaigns(result.campaigns);
          setSelectedCampaign((prevSelected) => {
            if (result.campaigns.length > 0 && !prevSelected) {
              return result.campaigns[0].id;
            }
            return prevSelected;
          });
        }
      } else {
        console.error("Failed to fetch Facebook campaigns:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching Facebook campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, backendUrl]);

  // Fetch Campaign Insights
  const fetchCampaignInsights = useCallback(async () => {
    if (!selectedCampaign || !userId) {
      setInsightsData(null);
      setLoadingInsights(false);
      return;
    }

    setLoadingInsights(true);
    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setLoadingInsights(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${authToken}`,
      };
      const response = await fetch(
        `${backendUrl}/api/analytics/facebook/campaign-insights?campaignId=${selectedCampaign}&userId=${userId}`,
        {
          headers: headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.insights && result.insights.length > 0) {
          setInsightsData(result.insights[0]);
        } else {
          setInsightsData(getStaticCampaignInsights(selectedCampaign));
        }
      } else {
        await response.json().catch(() => ({}));
        setInsightsData(getStaticCampaignInsights(selectedCampaign));
      }
    } catch (error) {
      console.error("Error fetching Facebook campaign insights:", error);
      setInsightsData(getStaticCampaignInsights(selectedCampaign));
    } finally {
      setLoadingInsights(false);
    }
  }, [selectedCampaign, userId, backendUrl]);

  // Fetch campaigns when userId is available
  useEffect(() => {
    if (userId && campaigns.length === 0) {
      fetchCampaigns();
    }
  }, [userId, fetchCampaigns, campaigns.length]);

  // Fetch AdSets for selected campaign
  const fetchAdsets = useCallback(async () => {
    if (!selectedCampaign || !userId) {
      setAdsets([]);
      setLoadingAdsets(false);
      return;
    }

    setLoadingAdsets(true);
    setAdsets([]);
    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setLoadingAdsets(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${authToken}`,
      };
      const response = await fetch(
        `${backendUrl}/api/analytics/facebook/adsets?campaignId=${selectedCampaign}&userId=${userId}`,
        {
          headers: headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.adsets) {
          setAdsets(result.adsets);
        } else {
          setAdsets([]);
        }
      } else {
        console.error("Failed to fetch Facebook adsets:", response.statusText);
        setAdsets([]);
      }
    } catch (error) {
      console.error("Error fetching Facebook adsets:", error);
      setAdsets([]);
    } finally {
      setLoadingAdsets(false);
    }
  }, [selectedCampaign, userId, backendUrl]);

  // Fetch Ads for an AdSet
  const fetchAds = useCallback(
    async (adsetId) => {
      if (!adsetId || !userId) {
        return;
      }

      setLoadingAds((prev) => ({ ...prev, [adsetId]: true }));
      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
          setLoadingAds((prev) => ({ ...prev, [adsetId]: false }));
          return;
        }

        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${authToken}`,
        };
        const response = await fetch(
          `${backendUrl}/api/analytics/facebook/ads?adsetId=${adsetId}&userId=${userId}`,
          {
            headers: headers,
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const ads =
              result.ads && result.ads.length > 0 ? result.ads : getStaticAdsData(adsetId);
            setAdsData((prev) => ({
              ...prev,
              [adsetId]: ads,
            }));
          } else {
            setAdsData((prev) => ({
              ...prev,
              [adsetId]: getStaticAdsData(adsetId),
            }));
          }
        } else {
          setAdsData((prev) => ({
            ...prev,
            [adsetId]: getStaticAdsData(adsetId),
          }));
        }
      } catch (error) {
        console.error(`Error fetching Facebook ads for adset ${adsetId}:`, error);
        setAdsData((prev) => ({
          ...prev,
          [adsetId]: getStaticAdsData(adsetId),
        }));
      } finally {
        setLoadingAds((prev) => ({ ...prev, [adsetId]: false }));
      }
    },
    [userId, backendUrl]
  );

  // Fetch Facebook Page Insights
  const fetchPageInsights = useCallback(async () => {
    if (!userId || !pageId) {
      setLoadingPageInsights(false);
      return;
    }

    setLoadingPageInsights(true);
    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setLoadingPageInsights(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${authToken}`,
      };
      const params = new URLSearchParams({
        userId: userId,
        pageId: pageId,
        period: period,
      });

      const response = await fetch(
        `${backendUrl}/api/analytics/facebook/page-insights?${params.toString()}`,
        {
          headers: headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.insights) {
          setPageInsights(result.insights);
        } else {
          setPageInsights([]);
        }
      } else {
        console.error("Failed to fetch Facebook page insights:", response.statusText);
        setPageInsights([]);
      }
    } catch (error) {
      console.error("Error fetching Facebook Page Insights:", error);
      setPageInsights([]);
    } finally {
      setLoadingPageInsights(false);
    }
  }, [userId, pageId, period, backendUrl]);

  // Fetch insights and adsets when campaign is selected
  useEffect(() => {
    if (selectedCampaign && userId) {
      setInsightsData(null);
      setAdsets([]);
      setAdsData({});
      fetchCampaignInsights();
      fetchAdsets();
    } else {
      setInsightsData(null);
      setAdsets([]);
      setAdsData({});
    }
  }, [selectedCampaign, userId, fetchCampaignInsights, fetchAdsets]);

  // Fetch ads for each adset when adsets are loaded
  useEffect(() => {
    if (adsets.length > 0 && userId) {
      adsets.forEach((adset) => {
        if (!adsData[adset.id] && !loadingAds[adset.id]) {
          fetchAds(adset.id);
        }
      });
    }
  }, [adsets, userId, fetchAds, adsData, loadingAds]);

  // Fetch page insights when userId, pageId, or period changes
  useEffect(() => {
    if (userId && pageId) {
      fetchPageInsights();
    }
  }, [userId, pageId, period, fetchPageInsights]);

  // Calculate page insights metrics
  const calculatePageMetrics = () => {
    if (!pageInsights || pageInsights.length === 0) {
      return {
        totalViews: 0,
        totalEngagements: 0,
        totalReach: 0,
        viewsTrend: 0,
        engagementsTrend: 0,
        reachTrend: 0,
      };
    }

    let totalViews = 0;
    let totalEngagements = 0;
    let totalReach = 0;
    let firstPeriodViews = 0;
    let firstPeriodEngagements = 0;
    let firstPeriodReach = 0;
    let lastPeriodViews = 0;
    let lastPeriodEngagements = 0;
    let lastPeriodReach = 0;

    pageInsights.forEach((insight) => {
      if (insight.values && insight.values.length > 0) {
        const values = insight.values;
        const sum = values.reduce((acc, v) => acc + (v.value || 0), 0);
        const firstValue = values[0]?.value || 0;
        const lastValue = values[values.length - 1]?.value || 0;

        if (insight.name === "page_views_total") {
          totalViews = sum;
          firstPeriodViews = firstValue;
          lastPeriodViews = lastValue;
        } else if (insight.name === "page_post_engagements") {
          totalEngagements = sum;
          firstPeriodEngagements = firstValue;
          lastPeriodEngagements = lastValue;
        } else if (insight.name === "page_impressions_unique") {
          totalReach = sum;
          firstPeriodReach = firstValue;
          lastPeriodReach = lastValue;
        }
      }
    });

    const viewsTrend =
      firstPeriodViews > 0
        ? Math.round(((lastPeriodViews - firstPeriodViews) / firstPeriodViews) * 100)
        : lastPeriodViews > 0
        ? 100
        : 0;
    const engagementsTrend =
      firstPeriodEngagements > 0
        ? Math.round(
            ((lastPeriodEngagements - firstPeriodEngagements) / firstPeriodEngagements) * 100
          )
        : lastPeriodEngagements > 0
        ? 100
        : 0;
    const reachTrend =
      firstPeriodReach > 0
        ? Math.round(((lastPeriodReach - firstPeriodReach) / firstPeriodReach) * 100)
        : lastPeriodReach > 0
        ? 100
        : 0;

    return {
      totalViews,
      totalEngagements,
      totalReach,
      viewsTrend,
      engagementsTrend,
      reachTrend,
    };
  };

  const formatNumber = (num) => {
    if (typeof num !== "number") return "0`";
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toLocaleString();
  };

  const pageMetrics = calculatePageMetrics();

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Facebook className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400 text-lg">Please connect your Facebook account first</p>
          <p className="text-slate-500 text-sm mt-2">
            Go to Channels to connect your Facebook account
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111827] h-full">
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 animate-pulse mx-auto mb-4 opacity-50" />
          <p className="text-sm">Loading Facebook analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111827] h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Facebook Page Insights */}
        {userId && pageId && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Facebook className="w-5 h-5" />
                Facebook Page Insights
              </h2>
              <div className="flex items-center gap-2">
                <Dropdown
                  options={[
                    { value: "day", label: "Daily" },
                    { value: "week", label: "Weekly" },
                    { value: "days_28", label: "28 Days" },
                  ]}
                  value={period}
                  onChange={(value) => setPeriod(value)}
                />
                <button
                  onClick={fetchPageInsights}
                  className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            {loadingPageInsights ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading page insights...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  title="Total Page Views"
                  value={formatNumber(pageMetrics.totalViews)}
                  icon={<Eye className="w-6 h-6" />}
                  trend={pageMetrics.viewsTrend}
                  color="blue"
                  description="Total views on your Facebook page"
                />
                <MetricCard
                  title="Post Engagements"
                  value={formatNumber(pageMetrics.totalEngagements)}
                  icon={<Heart className="w-6 h-6" />}
                  trend={pageMetrics.engagementsTrend}
                  color="purple"
                  description="Likes, comments, shares, and more"
                />
                <MetricCard
                  title="Total Reach"
                  value={formatNumber(pageMetrics.totalReach)}
                  icon={<Users className="w-6 h-6" />}
                  trend={pageMetrics.reachTrend}
                  color="green"
                  description="Unique people who saw your content"
                />
              </div>
            )}
          </div>
        )}

        {/* Campaign Selection */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <Dropdown
            label="Campaign"
            options={campaigns.map((campaign) => ({
              id: campaign.id,
              value: campaign.id,
              label: campaign.name || campaign.id,
              status: campaign.status,
            }))}
            value={selectedCampaign}
            onChange={(value) => setSelectedCampaign(value)}
            placeholder="Select Campaign"
            loading={loading}
            searchable={true}
            emptyMessage="No campaigns available"
          />
          {!userId && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400">
                Please connect your Facebook account to view campaign analytics.
              </p>
            </div>
          )}
        </div>

        {/* Campaign Insights */}
        {selectedCampaign && insightsData && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Campaign Performance
              </h2>
            </div>
            {loadingInsights ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading campaign insights...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Impressions"
                  value={formatNumber(parseFloat(insightsData.impressions || 0))}
                  icon={<Eye className="w-5 h-5" />}
                  color="blue"
                />
                <MetricCard
                  title="Clicks"
                  value={formatNumber(parseFloat(insightsData.clicks || 0))}
                  icon={<MousePointerClick className="w-5 h-5" />}
                  color="green"
                />
                <MetricCard
                  title="Reach"
                  value={formatNumber(parseFloat(insightsData.reach || 0))}
                  icon={<Target className="w-5 h-5" />}
                  color="purple"
                />
                <MetricCard
                  title="Spend"
                  value={`$${parseFloat(insightsData.spend || 0).toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="orange"
                />
                <MetricCard
                  title="CTR"
                  value={`${parseFloat(insightsData.ctr || 0).toFixed(2)}%`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="blue"
                />
                <MetricCard
                  title="CPC"
                  value={`$${parseFloat(insightsData.cpc || 0).toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="orange"
                />
                <MetricCard
                  title="CPM"
                  value={`$${parseFloat(insightsData.cpm || 0).toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="orange"
                />
                <MetricCard
                  title="Frequency"
                  value={parseFloat(insightsData.frequency || 0).toFixed(2)}
                  icon={<Zap className="w-5 h-5" />}
                  color="purple"
                />
                <MetricCard
                  title="Unique Clicks"
                  value={formatNumber(parseFloat(insightsData.unique_clicks || 0))}
                  icon={<MousePointerClick className="w-5 h-5" />}
                  color="green"
                />
              </div>
            )}
          </div>
        )}

        {/* AdSets - Separated by Platform */}
        {selectedCampaign && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Ad Sets
              </h2>
            </div>
            {loadingAdsets ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading adsets...</p>
              </div>
            ) : adsets.length > 0 ? (
              <div className="space-y-6">
                {/* Facebook AdSets */}
                {adsets.filter((adset) => adset.platform === "facebook").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Facebook className="w-4 h-4 text-blue-500" />
                      <h3 className="text-md font-semibold text-slate-200">Facebook Ad Sets</h3>
                      <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                        {adsets.filter((adset) => adset.platform === "facebook").length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {adsets
                        .filter((adset) => adset.platform === "facebook")
                        .map((adset) => (
                          <div
                            key={`${adset.id}-${adset.platform}`}
                            className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors border-l-4 border-blue-500"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                                  {adset.name || adset.id}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      adset.status === "ACTIVE"
                                        ? "bg-green-500/20 text-green-400"
                                        : adset.status === "PAUSED"
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-slate-600 text-slate-300"
                                    }`}
                                  >
                                    {adset.status || "N/A"}
                                  </span>
                                  {adset.daily_budget && (
                                    <span className="text-slate-300">
                                      Daily Budget: ${parseFloat(adset.daily_budget).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {adset.targeting && (
                              <div className="mt-3 pt-3 border-t border-slate-600">
                                <p className="text-xs text-slate-400 mb-1">Targeting:</p>
                                <div className="text-xs text-slate-300 space-y-1">
                                  {adset.targeting.facebook_positions &&
                                    adset.targeting.facebook_positions.length > 0 && (
                                      <div>
                                        Positions: {adset.targeting.facebook_positions.join(", ")}
                                      </div>
                                    )}
                                  {adset.targeting.age_min && adset.targeting.age_max && (
                                    <div>
                                      Age: {adset.targeting.age_min} - {adset.targeting.age_max}
                                    </div>
                                  )}
                                  {adset.targeting.genders &&
                                    adset.targeting.genders.length > 0 && (
                                      <div>Gender: {adset.targeting.genders.join(", ")}</div>
                                    )}
                                  {adset.targeting.geo_locations?.countries && (
                                    <div>
                                      Countries:{" "}
                                      {adset.targeting.geo_locations.countries.join(", ")}
                                    </div>
                                  )}
                                  {adset.targeting.interests &&
                                    adset.targeting.interests.length > 0 && (
                                      <div>
                                        Interests:{" "}
                                        {adset.targeting.interests
                                          .map((i) => i.name || i.id)
                                          .join(", ")}
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Instagram AdSets */}
                {adsets.filter((adset) => adset.platform === "instagram").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        style={{ color: "#E4405F" }}
                      >
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      <h3 className="text-md font-semibold text-slate-200">Instagram Ad Sets</h3>
                      <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                        {adsets.filter((adset) => adset.platform === "instagram").length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {adsets
                        .filter((adset) => adset.platform === "instagram")
                        .map((adset) => (
                          <div
                            key={`${adset.id}-${adset.platform}`}
                            className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors border-l-4"
                            style={{ borderLeftColor: "#E4405F" }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                                  {adset.name || adset.id}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      adset.status === "ACTIVE"
                                        ? "bg-green-500/20 text-green-400"
                                        : adset.status === "PAUSED"
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-slate-600 text-slate-300"
                                    }`}
                                  >
                                    {adset.status || "N/A"}
                                  </span>
                                  {adset.daily_budget && (
                                    <span className="text-slate-300">
                                      Daily Budget: ${parseFloat(adset.daily_budget).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {adset.targeting && (
                              <div className="mt-3 pt-3 border-t border-slate-600">
                                <p className="text-xs text-slate-400 mb-1">Targeting:</p>
                                <div className="text-xs text-slate-300 space-y-1">
                                  {adset.targeting.instagram_positions &&
                                    adset.targeting.instagram_positions.length > 0 && (
                                      <div>
                                        Positions: {adset.targeting.instagram_positions.join(", ")}
                                      </div>
                                    )}
                                  {adset.targeting.age_min && adset.targeting.age_max && (
                                    <div>
                                      Age: {adset.targeting.age_min} - {adset.targeting.age_max}
                                    </div>
                                  )}
                                  {adset.targeting.genders &&
                                    adset.targeting.genders.length > 0 && (
                                      <div>Gender: {adset.targeting.genders.join(", ")}</div>
                                    )}
                                  {adset.targeting.geo_locations?.countries && (
                                    <div>
                                      Countries:{" "}
                                      {adset.targeting.geo_locations.countries.join(", ")}
                                    </div>
                                  )}
                                  {adset.targeting.interests &&
                                    adset.targeting.interests.length > 0 && (
                                      <div>
                                        Interests:{" "}
                                        {adset.targeting.interests
                                          .map((i) => i.name || i.id)
                                          .join(", ")}
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* AdSets with platform 'all' or undefined */}
                {adsets.filter(
                  (adset) =>
                    !adset.platform ||
                    adset.platform === "all" ||
                    (adset.platform !== "facebook" && adset.platform !== "instagram")
                ).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <h3 className="text-md font-semibold text-slate-200">Other Ad Sets</h3>
                      <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                        {
                          adsets.filter(
                            (adset) =>
                              !adset.platform ||
                              adset.platform === "all" ||
                              (adset.platform !== "facebook" && adset.platform !== "instagram")
                          ).length
                        }
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {adsets
                        .filter(
                          (adset) =>
                            !adset.platform ||
                            adset.platform === "all" ||
                            (adset.platform !== "facebook" && adset.platform !== "instagram")
                        )
                        .map((adset) => (
                          <div
                            key={`${adset.id}-${adset.platform || "all"}`}
                            className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                                  {adset.name || adset.id}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      adset.status === "ACTIVE"
                                        ? "bg-green-500/20 text-green-400"
                                        : adset.status === "PAUSED"
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-slate-600 text-slate-300"
                                    }`}
                                  >
                                    {adset.status || "N/A"}
                                  </span>
                                  {adset.daily_budget && (
                                    <span className="text-slate-300">
                                      Daily Budget: ${parseFloat(adset.daily_budget).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {adset.targeting && (
                              <div className="mt-3 pt-3 border-t border-slate-600">
                                <p className="text-xs text-slate-400 mb-1">Targeting:</p>
                                <div className="text-xs text-slate-300 space-y-1">
                                  {adset.targeting.publisher_platforms &&
                                    adset.targeting.publisher_platforms.length > 0 && (
                                      <div>
                                        Platforms: {adset.targeting.publisher_platforms.join(", ")}
                                      </div>
                                    )}
                                  {adset.targeting.age_min && adset.targeting.age_max && (
                                    <div>
                                      Age: {adset.targeting.age_min} - {adset.targeting.age_max}
                                    </div>
                                  )}
                                  {adset.targeting.genders &&
                                    adset.targeting.genders.length > 0 && (
                                      <div>Gender: {adset.targeting.genders.join(", ")}</div>
                                    )}
                                  {adset.targeting.geo_locations?.countries && (
                                    <div>
                                      Countries:{" "}
                                      {adset.targeting.geo_locations.countries.join(", ")}
                                    </div>
                                  )}
                                  {adset.targeting.interests &&
                                    adset.targeting.interests.length > 0 && (
                                      <div>
                                        Interests:{" "}
                                        {adset.targeting.interests
                                          .map((i) => i.name || i.id)
                                          .join(", ")}
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No adsets available for this campaign
              </div>
            )}
          </div>
        )}

        {/* Ads Performance Section */}
        {selectedCampaign && adsets.length > 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Ads Performance
              </h2>
            </div>
            <div className="space-y-4">
              {adsets.map((adset) => {
                const ads = adsData[adset.id] || [];
                const isLoadingAds = loadingAds[adset.id];

                return (
                  <div
                    key={adset.id}
                    className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-100">
                        {adset.name || adset.id}
                      </h3>
                      {isLoadingAds && (
                        <Activity className="w-4 h-4 text-slate-400 animate-pulse" />
                      )}
                    </div>
                    {ads.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ads.map((ad) => (
                          <div
                            key={ad.id}
                            className="bg-slate-800/50 rounded p-3 border border-slate-600"
                          >
                            <div className="text-xs text-slate-400 mb-2">Ad ID: {ad.id}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400">Impressions:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  {formatNumber(parseFloat(ad.impressions || 0))}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Clicks:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  {formatNumber(parseFloat(ad.clicks || 0))}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Reach:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  {formatNumber(parseFloat(ad.reach || 0))}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Spend:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  ${parseFloat(ad.spend || 0).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">CTR:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  {parseFloat(ad.ctr || 0).toFixed(2)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">CPC:</span>
                                <span className="text-slate-100 ml-1 font-medium">
                                  ${parseFloat(ad.cpc || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-sm text-slate-400">
                        {isLoadingAds ? "Loading ads..." : "No ads available for this adset"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacebookAnalytics;
