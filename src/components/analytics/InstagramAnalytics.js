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
  Zap,
  FileText,
  Users,
  Megaphone,
  LineChart,
  Sparkles,
  Instagram,
  Facebook,
} from "lucide-react";
import Dropdown from "../common/Dropdown";
import { useNavigate } from "react-router-dom";

// Helper functions to generate random numbers
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

const InstagramAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingAdsets, setLoadingAdsets] = useState(false);
  const [loadingAds, setLoadingAds] = useState({});
  const [loadingInstagramInsights, setLoadingInstagramInsights] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [instagramInsights, setInstagramInsights] = useState(null);
  const [adsets, setAdsets] = useState([]);
  const [adsData, setAdsData] = useState({});
  const [leadForms, setLeadForms] = useState([]);
  const [loadingLeadForms, setLoadingLeadForms] = useState(false);
  const [formLeads, setFormLeads] = useState({});
  const [loadingLeads, setLoadingLeads] = useState({});
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

  // Check connection status from integrations API
  useEffect(() => {
    const instagramUserId = localStorage.getItem("instagram_user_id");
    if (instagramUserId) {
      setUserId(instagramUserId);
      setLoading(false);
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
          const instagramIntegration = integrationsData.integrations?.instagram;

          if (
            instagramIntegration &&
            instagramIntegration.connected &&
            !instagramIntegration.tokenExpired &&
            instagramIntegration.platformUserId
          ) {
            setUserId(instagramIntegration.platformUserId);
            // Store in localStorage for backward compatibility
            localStorage.setItem("instagram_user_id", instagramIntegration.platformUserId);
          } else {
            setUserId(null);
          }
        }
      } catch (error) {
        console.error("Error checking Instagram connection:", error);
        setUserId(null);
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

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
      const response = await fetch(`${backendUrl}/api/analytics/campaigns?userId=${userId}`, {
        headers: headers,
      });

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
        console.error("Failed to fetch campaigns:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
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
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(
        `${backendUrl}/api/analytics/campaign-insights?campaignId=${selectedCampaign}&userId=${userId}`,
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
        const errorData = await response.json().catch(() => ({}));
        setInsightsData(getStaticCampaignInsights(selectedCampaign));
      }
    } catch (error) {
      console.error("Error fetching campaign insights:", error);
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
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(
        `${backendUrl}/api/analytics/adsets?campaignId=${selectedCampaign}&userId=${userId}`,
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
        console.error("Failed to fetch adsets:", response.statusText);
        setAdsets([]);
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
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
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(
          `${backendUrl}/api/analytics/ads?adsetId=${adsetId}&userId=${userId}`,
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
        console.error(`Error fetching ads for adset ${adsetId}:`, error);
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

  // Fetch Instagram Insights
  const fetchInstagramInsights = useCallback(async () => {
    if (!userId) return;

    setLoadingInstagramInsights(true);
    try {
      const authToken = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(
        `${backendUrl}/api/analytics/instagram-insights?userId=${userId}&period=day&metric_type=total_value`,
        {
          headers: headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setInstagramInsights(result.insights || []);
        }
      } else {
        console.error("Failed to fetch Instagram insights:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching Instagram insights:", error);
    } finally {
      setLoadingInstagramInsights(false);
    }
  }, [userId, backendUrl]);

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

  // Fetch Lead Generation Forms
  const fetchLeadForms = useCallback(async () => {
    if (!userId) return;

    setLoadingLeadForms(true);
    try {
      const authToken = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(`${backendUrl}/api/analytics/leadgen-forms?userId=${userId}`, {
        headers: headers,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLeadForms(result.forms || []);
        }
      } else {
        console.error("Failed to fetch lead forms:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching lead forms:", error);
    } finally {
      setLoadingLeadForms(false);
    }
  }, [userId, backendUrl]);

  // Fetch Instagram insights when userId is available
  useEffect(() => {
    if (userId) {
      fetchInstagramInsights();
      fetchLeadForms();
    }
  }, [userId, fetchInstagramInsights, fetchLeadForms]);

  // Fetch Leads for a Form
  const fetchLeads = useCallback(
    async (formId) => {
      if (!formId || !userId) {
        return;
      }

      setLoadingLeads((prev) => ({ ...prev, [formId]: true }));
      try {
        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(
          `${backendUrl}/api/analytics/leads?formId=${formId}&userId=${userId}`,
          {
            headers: headers,
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setFormLeads((prev) => ({
              ...prev,
              [formId]: result.leads || [],
            }));
          }
        } else {
          console.error(`Failed to fetch leads for form ${formId}:`, response.statusText);
        }
      } catch (error) {
        console.error(`Error fetching leads for form ${formId}:`, error);
      } finally {
        setLoadingLeads((prev) => ({ ...prev, [formId]: false }));
      }
    },
    [userId, backendUrl]
  );

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

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Instagram className="w-16 h-16 text-pink-400 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Please connect your Instagram account first</p>
          <p className="text-slate-500 text-sm mt-2">
            Go to Channels to connect your Instagram account
          </p>
          <button
            onClick={() => navigate("/channels")}
            className="text-sm text-pink-500 hover:text-pink-600 mt-2 cursor-pointer px-3 py-1 rounded-md bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
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
          <p className="text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111827] h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Instagram Insights */}
        {userId && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Instagram Account Insights
              </h2>
            </div>
            {loadingInstagramInsights ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading Instagram insights...</p>
              </div>
            ) : instagramInsights && instagramInsights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {instagramInsights.map((insight, index) => {
                  let value = "0";
                  if (
                    insight.values &&
                    Array.isArray(insight.values) &&
                    insight.values.length > 0
                  ) {
                    value = insight.values[0]?.value ?? "0";
                  } else if (insight.total_value) {
                    value = insight.total_value?.value ?? "0";
                  }

                  if (value === null || value === undefined || value === "") {
                    value = "0";
                  }

                  let icon = Eye;
                  let label = insight.name || "Metric";
                  let formattedValue = value;

                  switch (insight.name) {
                    case "reach":
                      icon = Target;
                      label = "Reach";
                      formattedValue = formatNumber(parseFloat(value));
                      break;
                    case "profile_views":
                      icon = TrendingUp;
                      label = "Profile Views";
                      formattedValue = formatNumber(parseFloat(value));
                      break;
                    case "follower_count":
                      icon = Zap;
                      label = "Followers";
                      formattedValue = formatNumber(parseFloat(value));
                      break;
                    default:
                      formattedValue = formatNumber(parseFloat(value));
                  }

                  return (
                    <div
                      key={insight.name || index}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const IconComponent = icon;
                            return <IconComponent className="w-5 h-5 text-slate-400" />;
                          })()}
                          <span className="text-sm text-slate-400">{label}</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-slate-100">{formattedValue}</div>
                      {insight.period && (
                        <div className="text-xs text-slate-500 mt-1">Period: {insight.period}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">
                No Instagram insights available
              </div>
            )}
          </div>
        )}

        {/* Lead Generation Forms */}
        {userId && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Lead Generation Forms
              </h2>
            </div>
            {loadingLeadForms ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                <p className="text-sm text-slate-400">Loading lead forms...</p>
              </div>
            ) : leadForms.length > 0 ? (
              <div className="space-y-4">
                {leadForms.map((form) => {
                  const formLeadsData = formLeads[form.id] || [];
                  const isLoadingLeads = loadingLeads[form.id];
                  return (
                    <div
                      key={form.id}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-slate-100 mb-1">
                            {form.name || form.id}
                          </h3>
                          {form.status && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                form.status === "ACTIVE"
                                  ? "bg-green-500/20 text-green-400"
                                  : form.status === "ARCHIVED"
                                  ? "bg-slate-600 text-slate-300"
                                  : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {form.status}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => fetchLeads(form.id)}
                          disabled={isLoadingLeads}
                          className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                        >
                          {isLoadingLeads ? "Loading..." : "View Leads"}
                        </button>
                      </div>
                      {formLeadsData.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-medium text-slate-300">
                              Leads ({formLeadsData.length})
                            </span>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {formLeadsData.map((lead, index) => (
                              <div
                                key={lead.id || index}
                                className="bg-slate-800/50 rounded p-2 text-xs"
                              >
                                <div className="text-slate-300 mb-1">
                                  {lead.created_time && (
                                    <span className="text-slate-400">
                                      {new Date(lead.created_time).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                {lead.field_data && Array.isArray(lead.field_data) && (
                                  <div className="space-y-1">
                                    {lead.field_data.map((field, fieldIndex) => (
                                      <div
                                        key={fieldIndex}
                                        className="text-slate-300"
                                      >
                                        <span className="text-slate-400">{field.name}:</span>{" "}
                                        {field.values?.join(", ") || "N/A"}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 border-dashed">
                  <div className="mb-2">
                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                      Static Data - No forms available
                    </span>
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-100 mb-1">
                        Sample Lead Form
                      </h3>
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                        ACTIVE
                      </span>
                    </div>
                    <button
                      disabled
                      className="text-xs px-3 py-1.5 bg-slate-600 text-slate-400 rounded opacity-50 cursor-not-allowed"
                    >
                      View Leads
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-300">Leads (0)</span>
                    </div>
                    <div className="text-xs text-slate-400 italic">
                      No leads available for this form
                    </div>
                  </div>
                </div>
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
                Please connect your Instagram account to view campaign analytics.
              </p>
            </div>
          )}
        </div>

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
                {/* Instagram AdSets */}
                {adsets.filter((adset) => adset.platform === "instagram").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Instagram className="w-4 h-4 text-pink-500" />
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
        {selectedCampaign && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Ads Performance
              </h2>
            </div>
            {adsets.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No adsets available to show ads performance
              </div>
            ) : (
              <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adsets.map((adset) => {
                  const adsetAds = adsData[adset.id] || [];
                  const isAdsetLoading = loadingAds[adset.id];

                  return (
                    <div
                      key={adset.id}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {adset.name || adset.id}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            adset.status === "ACTIVE"
                              ? "bg-green-500/20 text-green-400"
                              : adset.status === "PAUSED"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-600 text-slate-300"
                          }`}
                        >
                          {adset.status || "N/A"}
                        </span>
                      </div>

                      {isAdsetLoading ? (
                        <div className="text-center py-4">
                          <Activity className="w-6 h-6 mx-auto mb-2 text-slate-500 animate-pulse" />
                          <p className="text-xs text-slate-400">Loading ads data...</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {adsetAds.length > 0
                            ? adsetAds.map((ad, adIndex) => {
                                const isStaticAd = ad.id && ad.id.startsWith("static_ad_");
                                return (
                                  <div
                                    key={ad.id || adIndex}
                                    className={`rounded-lg p-3 border ${
                                      isStaticAd
                                        ? "border-slate-500/50 border-dashed bg-slate-800"
                                        : "border-slate-500/50 bg-slate-600/50 "
                                    }`}
                                  >
                                    {isStaticAd && (
                                      <div className="mb-2">
                                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                                          Static Data - No ads available
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-slate-200">
                                        Ad {adIndex + 1}
                                      </span>
                                      {ad.date_start && (
                                        <span className="text-xs text-slate-400">
                                          {new Date(ad.date_start).toLocaleDateString()}
                                          {ad.date_stop &&
                                            ` - ${new Date(ad.date_stop).toLocaleDateString()}`}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      {ad.impressions !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">Impressions</div>
                                          <div className="text-slate-100 font-semibold">
                                            {formatNumber(parseFloat(ad.impressions || 0))}
                                          </div>
                                        </div>
                                      )}
                                      {ad.clicks !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">Clicks</div>
                                          <div className="text-slate-100 font-semibold">
                                            {formatNumber(parseFloat(ad.clicks || 0))}
                                          </div>
                                        </div>
                                      )}
                                      {ad.reach !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">Reach</div>
                                          <div className="text-slate-100 font-semibold">
                                            {formatNumber(parseFloat(ad.reach || 0))}
                                          </div>
                                        </div>
                                      )}
                                      {ad.spend !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">Spend</div>
                                          <div className="text-slate-100 font-semibold">
                                            ${parseFloat(ad.spend || 0).toFixed(2)}
                                          </div>
                                        </div>
                                      )}
                                      {ad.ctr !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">CTR</div>
                                          <div className="text-slate-100 font-semibold">
                                            {parseFloat(ad.ctr || 0).toFixed(2)}%
                                          </div>
                                        </div>
                                      )}
                                      {ad.cpc !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">CPC</div>
                                          <div className="text-slate-100 font-semibold">
                                            ${parseFloat(ad.cpc || 0).toFixed(2)}
                                          </div>
                                        </div>
                                      )}
                                      {ad.unique_clicks !== undefined && (
                                        <div className="bg-slate-700/50 rounded p-2">
                                          <div className="text-slate-400 mb-1">Unique Clicks</div>
                                          <div className="text-slate-100 font-semibold">
                                            {formatNumber(parseFloat(ad.unique_clicks || 0))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            : (() => {
                                const staticImpressions = randomInt(1000, 15000);
                                const staticClicks = randomInt(20, 500);
                                const staticReach = randomInt(800, 12000);
                                const staticSpend = randomFloat(10, 150);
                                const staticCtr = randomFloat(1.0, 6.0);
                                const staticCpc = randomFloat(0.3, 2.5);
                                const staticUniqueClicks = randomInt(
                                  15,
                                  Math.floor(staticClicks * 0.95)
                                );

                                return (
                                  <div className="bg-slate-600/50 rounded-lg p-3 border border-slate-500/50 border-dashed">
                                    <div className="mb-2">
                                      <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                                        Static Data - No ads available
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-slate-200">
                                        Ad 1
                                      </span>
                                      <span className="text-xs text-slate-400">
                                        {new Date().toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">Impressions</div>
                                        <div className="text-slate-100 font-semibold">
                                          {formatNumber(staticImpressions)}
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">Clicks</div>
                                        <div className="text-slate-100 font-semibold">
                                          {formatNumber(staticClicks)}
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">Reach</div>
                                        <div className="text-slate-100 font-semibold">
                                          {formatNumber(staticReach)}
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">Spend</div>
                                        <div className="text-slate-100 font-semibold">
                                          ${staticSpend}
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">CTR</div>
                                        <div className="text-slate-100 font-semibold">
                                          {staticCtr}%
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">CPC</div>
                                        <div className="text-slate-100 font-semibold">
                                          ${staticCpc}
                                        </div>
                                      </div>
                                      <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400 mb-1">Unique Clicks</div>
                                        <div className="text-slate-100 font-semibold">
                                          {formatNumber(staticUniqueClicks)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Campaign Insights */}
        {selectedCampaign && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Campaign Insights
              </h2>
            </div>
            {loadingInsights ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto mb-4 text-slate-500 animate-pulse" />
                <p className="text-slate-400">Loading insights...</p>
              </div>
            ) : insightsData ? (
              <div
                className={`${
                  insightsData.id && insightsData.id.startsWith("static_insights_")
                    ? "border-dashed border-slate-600"
                    : ""
                }`}
              >
                {insightsData.id && insightsData.id.startsWith("static_insights_") && (
                  <div className="mb-4">
                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                      Static Data - No campaign insights available
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Impressions"
                    value={formatNumber(parseFloat(insightsData.impressions || 0))}
                    icon={<Eye className="w-5 h-5" />}
                    trend={null}
                    color="blue"
                  />
                  <MetricCard
                    title="Clicks"
                    value={formatNumber(parseFloat(insightsData.clicks || 0))}
                    icon={<MousePointerClick className="w-5 h-5" />}
                    trend={null}
                    color="green"
                  />
                  <MetricCard
                    title="CTR"
                    value={insightsData.ctr ? `${parseFloat(insightsData.ctr).toFixed(2)}%` : "0%"}
                    icon={<Target className="w-5 h-5" />}
                    trend={null}
                    color="purple"
                  />
                  <MetricCard
                    title="Spend"
                    value={
                      insightsData.spend ? `$${parseFloat(insightsData.spend).toFixed(2)}` : "$0.00"
                    }
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={null}
                    color="orange"
                  />
                </div>

                {/* Performance Metrics */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold text-slate-100 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Performance Metrics
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">Reach</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {formatNumber(parseFloat(insightsData.reach || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">Frequency</span>
                      <span className="text-lg font-semibold text-slate-100">
                        {parseFloat(insightsData.frequency || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">CPC</span>
                      <span className="text-lg font-semibold text-slate-100">
                        ${parseFloat(insightsData.cpc || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-sm text-slate-300">CPM</span>
                      <span className="text-lg font-semibold text-slate-100">
                        ${parseFloat(insightsData.cpm || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {insightsData.actions && insightsData.actions.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-slate-100 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Actions
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {insightsData.actions.map((action, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                        >
                          <span className="text-sm text-slate-300 capitalize">
                            {action.action_type?.replace(/_/g, " ") || "Unknown"}
                          </span>
                          <span className="text-lg font-semibold text-slate-100">
                            {action.value || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <p className="text-slate-400">No insights data available for this campaign</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstagramAnalytics;
