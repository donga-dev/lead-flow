import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Users,
  RefreshCw,
  Clock,
  Settings,
  Zap,
  CircleCheckBig,
  CircleX,
  Instagram,
} from "lucide-react";
import WhatsAppConnectModal from "./WhatsAppConnectModal";

const Channels = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Instagram OAuth credentials (using Facebook OAuth for Instagram Business API)
  const appId = process.env.REACT_APP_FACEBOOK_APP_ID || "1599198441064709";
  const redirectUri = process.env.REACT_APP_REDIRECT_URI || window.location.origin + "/channels";
  console.log("redirectUri", redirectUri);
  // const redirectUri = process.env.REACT_APP_REDIRECT_URI || "https://prnt.sc/YhdZA0DVLFwp";
  const graphVersion = process.env.REACT_APP_GRAPH_VERSION || "v21.0";

  // Instagram Business API scopes (via Facebook OAuth)
  const instagramScopes = [
    "instagram_basic",
    "instagram_manage_insights",
    "instagram_manage_messages",
    "pages_manage_metadata",
    "pages_messaging",
    "pages_read_engagement",
    "pages_show_list",
    "business_management",
  ].join(",");

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  const [channels, setChannels] = useState([
    {
      id: "whatsapp",
      name: "Whatsapp",
      subtitle: "WhatsApp Business API",
      connected: false, // Start as disconnected, verify on mount
      leads: "",
      lastSync: "1/18/2025",
      logo: (
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.77.966-.944 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
            fill="#25D366"
          />
        </svg>
      ),
    },
    {
      id: "instagram",
      name: "Instagram",
      subtitle: "Instagram Business",
      connected: false, // Start as disconnected, verify on mount
      leads: "",
      lastSync: "1/18/2025",
      logo: <Instagram className="w-8 h-8 text-pink-500" />,
    },
  ]);

  // Get the most recent lastSync date from connected channels
  const getLastSyncDate = () => {
    const connectedChannels = channels.filter((c) => c.connected && c.lastSync);
    if (connectedChannels.length === 0) {
      return "Outdated";
    }
    // Parse dates and find the most recent one
    const dates = connectedChannels
      .map((c) => {
        const dateStr = c.lastSync;
        if (!dateStr || dateStr === "Outdated") return null;
        // Parse date in format M/D/YYYY
        const [month, day, year] = dateStr.split("/").map(Number);
        return new Date(year, month - 1, day);
      })
      .filter((d) => d !== null);

    if (dates.length === 0) {
      return "Outdated";
    }

    // Find the most recent date
    const mostRecent = new Date(Math.max(...dates));
    const formattedDate = `${
      mostRecent.getMonth() + 1
    }/${mostRecent.getDate()}/${mostRecent.getFullYear()}`;
    return formattedDate;
  };

  const summaryStats = {
    connected: channels.filter((c) => c.connected).length,
    disconnected: channels.filter((c) => !c.connected).length,
    totalLeads: channels.reduce((sum, c) => sum + c.leads, 0),
    lastSync: getLastSyncDate(),
  };

  // Handle Instagram OAuth callback
  useEffect(() => {
    const handleInstagramCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorReason = searchParams.get("error_reason");
      const errorDescription = searchParams.get("error_description");

      // If no OAuth parameters, skip callback handling
      if (!code && !error) {
        return;
      }

      // Handle OAuth errors
      if (error) {
        console.error("OAuth error:", { error, errorReason, errorDescription });
        toast.error(
          errorDescription || errorReason || "Failed to connect Instagram. Please try again.",
          { autoClose: 5000 }
        );
        // Clean up URL
        setSearchParams({});
        return;
      }

      // Check if we have an authorization code
      if (code) {
        try {
          // Get redirect URI (should match the one used in the OAuth request)
          const currentRedirectUri =
            process.env.REACT_APP_REDIRECT_URI || window.location.origin + "/channels";

          // Exchange code for access token via backend
          const backendUrl =
            process.env.REACT_APP_BACKEND_URL ||
            "https://unexigent-felisha-calathiform.ngrok-free.dev";

          const response = await fetch(`${backendUrl}/api/instagram/exchange-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({
              code: code,
              redirectUri: currentRedirectUri,
            }),
          });

          const data = await response.json();

          if (response.ok && data.success && data.access_token) {
            // Save Instagram access token (page token) to localStorage
            localStorage.setItem("instagram_page_access_token", data.access_token);

            // Save user access token if available (for /me/accounts calls)
            if (data.user_access_token) {
              localStorage.setItem("instagram_user_access_token", data.user_access_token);
            }

            // Also save token type and expiry if available
            if (data.token_type) {
              localStorage.setItem("instagram_token_type", data.token_type);
            }
            if (data.expires_in) {
              // Calculate expiry timestamp
              const expiryTime = Date.now() + data.expires_in * 1000;
              localStorage.setItem("instagram_token_expiry", expiryTime.toString());
            }

            // Save additional Instagram account info
            if (data.instagram_account_id) {
              localStorage.setItem("instagram_account_id", data.instagram_account_id);
            }
            if (data.instagram_username) {
              localStorage.setItem("instagram_username", data.instagram_username);
            }
            // Note: page_id may not be available with Instagram Basic Display API
            if (data.page_id) {
              localStorage.setItem("instagram_page_id", data.page_id);
            }

            toast.success("Instagram connected successfully!", { autoClose: 3000 });

            // Update channel status
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: true } : ch))
            );

            // Clean up URL by removing query parameters
            setSearchParams({});
          } else {
            throw new Error(data.error || "Failed to exchange code for access token");
          }
        } catch (error) {
          console.error("Error exchanging code for token:", error);
          toast.error(error.message || "Failed to connect Instagram. Please try again.", {
            autoClose: 5000,
          });
          // Clean up URL
          setSearchParams({});
        }
      }
    };

    handleInstagramCallback();
  }, [searchParams, setSearchParams]);

  // Verify WhatsApp and Instagram connection status on component mount
  useEffect(() => {
    const verifyConnections = async () => {
      setCheckingConnection(true);
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
      // Verify WhatsApp connection
      const whatsappToken = localStorage.getItem("whatsapp_token");
      const instagramUserAccessToken = localStorage.getItem("instagram_user_access_token");
      if (!instagramUserAccessToken) {
        setChannels((prev) =>
          prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: false } : ch))
        );
      } else {
        // Get user accounts
        const response = await fetch(`${backendUrl}/api/verify-instagram-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ token: instagramUserAccessToken }),
        });
        const data = await response.json();
        if (response.ok && data.success && data.accountInfo) {
          console.log("✅ Instagram user accounts found");
        } else {
          console.log("❌ No Instagram user accounts found");
        }
      }
      if (!whatsappToken) {
        setChannels((prev) =>
          prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
        );
      } else {
        // Verify token validity
        try {
          const response = await fetch(`${backendUrl}/api/verify-whatsapp-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({ token: whatsappToken }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: true } : ch))
            );
          } else {
            localStorage.removeItem("whatsapp_token");
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
            );
          }
        } catch (error) {
          console.error("Error verifying WhatsApp token on mount:", error);
          setChannels((prev) =>
            prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
          );
        }
      }

      // Verify Instagram connection
      const instagramToken = localStorage.getItem("instagram_page_access_token");
      if (instagramToken) {
        // Check if token is expired
        const expiryTime = localStorage.getItem("instagram_token_expiry");
        if (expiryTime) {
          const isExpired = Date.now() > parseInt(expiryTime, 10);
          if (isExpired) {
            // Token expired, remove it
            localStorage.removeItem("instagram_page_access_token");
            localStorage.removeItem("instagram_token_type");
            localStorage.removeItem("instagram_token_expiry");
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: false } : ch))
            );
          } else {
            // Token is valid
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: true } : ch))
            );
          }
        } else {
          // No expiry info, assume token is valid
          setChannels((prev) =>
            prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: true } : ch))
          );
        }
      } else {
        setChannels((prev) =>
          prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: false } : ch))
        );
      }

      setCheckingConnection(false);
    };

    verifyConnections();
  }, []); // Run only on mount

  const handleConnect = (channelId) => {
    if (channelId === "whatsapp") {
      setShowWhatsAppModal(true);
    } else if (channelId === "instagram") {
      handleInstagramConnect();
    }
  };

  const handleWhatsAppConnect = (token) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: true } : ch))
    );
    toast.success("WhatsApp Business connected successfully!");
  };

  const handleInstagramConnect = () => {
    const state = Math.random().toString(36).substring(2);
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    // Use Facebook OAuth for Instagram Business API (this is the standard way)
    const authUrl = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodedRedirectUri}&scope=${instagramScopes}&response_type=code&state=${state}`;
    window.location.href = authUrl;
  };

  const handleWhatsAppError = (errorMessage) => {
    toast.error(errorMessage, { autoClose: 5000 });
  };

  const handleDisconnect = (channelId) => {
    if (channelId === "whatsapp") {
      localStorage.removeItem("whatsapp_token");
    } else if (channelId === "instagram") {
      localStorage.removeItem("instagram_page_access_token");
      localStorage.removeItem("instagram_user_access_token");
      localStorage.removeItem("instagram_account_id");
      localStorage.removeItem("instagram_username");
      localStorage.removeItem("instagram_page_id");
      localStorage.removeItem("instagram_token_type");
      localStorage.removeItem("instagram_token_expiry");
    }
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, connected: false } : ch))
    );
    toast.success(`${channels.find((c) => c.id === channelId)?.name} disconnected successfully`);
  };

  const handleSync = async (channelId) => {
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
    if (channelId === "whatsapp") {
      // Get stored token from localStorage
      const storedToken = localStorage.getItem("whatsapp_token");

      if (!storedToken) {
        // No token found, open verification modal
        setShowWhatsAppModal(true);
        return;
      }

      toast.loading("Syncing WhatsApp...");
      // Verify token validity
      try {
        const response = await fetch(`${backendUrl}/api/verify-whatsapp-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ token: storedToken }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Token is valid, proceed with sync

          // Update lastSync date
          const currentDate = new Date();
          const formattedDate = `${
            currentDate.getMonth() + 1
          }/${currentDate.getDate()}/${currentDate.getFullYear()}`;

          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, lastSync: formattedDate } : ch))
          );

          toast.dismiss();
          toast.success("Sync completed successfully!");
        } else {
          // Token is invalid, open verification modal
          localStorage.removeItem("whatsapp_token");
          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, connected: false } : ch))
          );
          setShowWhatsAppModal(true);
          toast.dismiss();
          toast.error("Token expired or invalid. Please verify your token again.");
        }
      } catch (error) {
        console.error("Error verifying token:", error);
        // On error, open verification modal
        setShowWhatsAppModal(true);
        toast.error("Failed to verify token. Please check your connection and try again.");
      }
    } else {
      const instagramUserAccessToken = localStorage.getItem("instagram_user_access_token");
      if (!instagramUserAccessToken) {
        toast.error("Instagram token not found. Please connect your Instagram account again.");
        return;
      }
      toast.loading("Syncing Instagram...");
      const response = await fetch(`${backendUrl}/api/verify-instagram-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ token: instagramUserAccessToken }),
      });
      const data = await response.json();
      if (response.ok && data.success && data.accountInfo) {
        toast.dismiss();
        toast.success("Instagram sync completed successfully!");
      } else {
        toast.dismiss();
        toast.error("Failed to sync Instagram. Please check your connection and try again.");
      }
    }
  };

  if (checkingConnection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111827] h-full">
        <div className="text-center text-slate-400 p-10">
          <RefreshCw className="w-16 h-16 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-4 mb-0">Checking connection...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-[#111827] h-full">
        <div className="mx-auto px-6 py-8 w-full h-full overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-100 m-0 mb-2 tracking-tight">Channels</h2>
            <p className="text-base text-slate-400 m-0">
              Connect your lead sources and manage data synchronization
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-700 rounded-xl p-5 flex items-center justify-between gap-3 border border-gray-600">
              <div>
                <div className="text-sm text-slate-400 font-medium">Connected</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {summaryStats.connected}
                </div>
              </div>
              <CircleCheckBig className="w-8 h-8 text-green-500" />
            </div>
            <div className="bg-slate-700 rounded-xl p-5 flex items-center justify-between gap-3 border border-gray-600">
              <div>
                <div className="text-sm text-slate-400 font-medium">Disconnected</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {summaryStats.disconnected}
                </div>
              </div>
              <CircleX className="w-8 h-8 text-red-500" />
            </div>
            <div className="bg-slate-700 rounded-xl p-5 flex items-center justify-between gap-3 border border-gray-600">
              <div>
                <div className="text-sm text-slate-400 font-medium">Total Leads</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {summaryStats.totalLeads}
                </div>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <div className="bg-slate-700 rounded-xl p-5 flex items-center justify-between gap-3 border border-gray-600">
              <div>
                <div className="text-sm text-slate-400 font-medium">Last Sync</div>
                <div className="text-2xl font-bold text-purple-500 mt-1">
                  {summaryStats.lastSync}
                </div>
              </div>
              <RefreshCw className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-slate-700 rounded-xl p-6 relative border border-gray-600"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-shrink-0">{channel.logo}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-100 m-0 mb-1">
                      {channel.name}
                    </h3>
                    <p className="text-sm text-slate-400 m-0">{channel.subtitle}</p>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 flex items-center ${
                      channel.id === "whatsapp" && checkingConnection
                        ? "bg-slate-500/20 text-slate-400"
                        : channel.connected
                        ? "bg-green-500 bg-opacity-20 text-green-400"
                        : "bg-red-500 bg-opacity-20 text-red-400"
                    }`}
                  >
                    {channel.id === "whatsapp" && checkingConnection ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        {channel.connected ? (
                          <CircleCheckBig className="w-4 h-4 mr-2" />
                        ) : (
                          <CircleX className="w-4 h-4 mr-2" />
                        )}
                        {channel.connected ? "Connected" : "Disconnected"}
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5 flex-wrap">
                  <div className="bg-slate-600 rounded-lg p-2">
                    <div className="flex items-center gap-2 justify-between text-sm text-[#9ca3af]">
                      <span>Leads</span>
                      <Users className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <p className="text-white text-2xl font-bold mt-1">{channel.leads || "-"}</p>
                  </div>
                  <div className="bg-slate-600 rounded-lg p-2">
                    <div className="flex items-center gap-2 justify-between text-sm text-[#9ca3af]">
                      <span>Last Sync</span>
                      <Clock className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <p className="text-white text-sm font-bold mt-1">{channel.lastSync || "-"}</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  {channel.connected ? (
                    <>
                      <button
                        className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-red-500 text-white hover:bg-red-600 hover:-translate-y-px"
                        onClick={() => handleDisconnect(channel.id)}
                      >
                        Disconnect
                      </button>
                      <button
                        className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 hover:-translate-y-px"
                        onClick={() => handleSync(channel.id)}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Sync Now
                      </button>
                    </>
                  ) : (
                    <button
                      className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-green-500 text-white hover:bg-green-600 hover:-translate-y-px"
                      onClick={() => handleConnect(channel.id)}
                    >
                      Connect
                    </button>
                  )}
                  <button className="w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all ml-auto hover:bg-slate-600 hover:text-slate-100">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                {channel.id === "whatsapp" && channel.connected && (
                  <div className="mt-4 p-3 pl-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-md text-blue-300 text-sm leading-relaxed flex items-center w-full">
                    <Zap className="w-5 h-5 mr-2 flex-shrink-0" />
                    WhatsApp Assignment Ready. You can now assign leads to sales reps via WhatsApp
                    directly from the leads panel.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <WhatsAppConnectModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onConnect={handleWhatsAppConnect}
        onError={handleWhatsAppError}
      />
    </>
  );
};

export default Channels;
