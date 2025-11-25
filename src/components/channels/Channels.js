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
  Linkedin,
  Facebook,
} from "lucide-react";
import WhatsAppConnectModal from "./WhatsAppConnectModal";

const Channels = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Instagram OAuth credentials (using Facebook OAuth for Instagram Business API)
  const appId = process.env.REACT_APP_FACEBOOK_APP_ID || "1599198441064709";
  const redirectUri = process.env.REACT_APP_REDIRECT_URI || window.location.origin + "/channels";
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
    "ads_management",
    "ads_read",
    "business_management",
    "pages_manage_ads",
  ].join(",");

  const facebookBusinessScopes = [
    "email",
    "public_profile",
    "business_management",
    "pages_read_engagement",
    "pages_show_list",
    "ads_management",
    "ads_read",
    "read_insights",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_messaging",
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
    {
      id: "linkedin",
      name: "LinkedIn",
      subtitle: "LinkedIn OAuth",
      connected: false, // Start as disconnected, verify on mount
      leads: "",
      lastSync: "1/18/2025",
      logo: <Linkedin className="w-8 h-8 text-blue-500" />,
    },
    {
      id: "facebook",
      name: "Facebook",
      subtitle: "Facebook OAuth",
      connected: false, // Start as disconnected, verify on mount
      leads: "",
      lastSync: "1/18/2025",
      logo: <Facebook className="w-8 h-8 text-blue-600" />,
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

  // Handle LinkedIn OAuth callback
  useEffect(() => {
    const handleLinkedInCallback = async () => {
      // Check if we're coming back from LinkedIn OAuth
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      const linkedinToken = searchParams.get("linkedin_token");
      const linkedinConnected = searchParams.get("linkedin_connected");
      const linkedinAlreadyConnected = searchParams.get("linkedin_already_connected");

      // Check if this is a LinkedIn callback (has linkedin_token or linkedin_connected param)
      // LinkedIn redirects to backend first, then backend redirects to frontend with linkedin_token
      // Only process if we have LinkedIn-specific parameters
      const isLinkedInCallback = linkedinToken || linkedinConnected || linkedinAlreadyConnected;

      // If no LinkedIn-specific parameters and no error, skip
      if (!isLinkedInCallback && !error) {
        return;
      }

      // Handle LinkedIn callback (backend already saved token to file)
      if (
        (linkedinConnected || linkedinAlreadyConnected) &&
        window.location.pathname === "/channels"
      ) {
        // If already connected, just verify and update UI
        if (linkedinAlreadyConnected) {
          // Wait a bit then check connection
          setTimeout(() => {
            checkLinkedInConnection();
          }, 500);
          setSearchParams({});
          return;
        }

        // Wait a bit for backend to save token, then verify
        setTimeout(async () => {
          try {
            // Verify token with backend (token is stored in file on backend)
            const backendUrl =
              process.env.REACT_APP_BACKEND_URL ||
              "https://unexigent-felisha-calathiform.ngrok-free.dev";

            // Get authToken from localStorage
            const authToken = localStorage.getItem("authToken");
            const headers = {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            };

            // Add Authorization header if token exists
            if (authToken) {
              headers["Authorization"] = `Bearer ${authToken}`;
            }

            const tokenResponse = await fetch(`${backendUrl}/api/linkedin/token`, {
              method: "GET",
              headers: headers,
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.success && tokenData.connected) {
              localStorage.setItem("linkedin_connected", "true");

              // Get user name from response
              const userName =
                tokenData.userInfo?.name ||
                tokenData.userInfo?.given_name ||
                tokenData.userInfo?.localizedFirstName ||
                tokenData.userInfo?.firstName ||
                null;

              if (userName) {
                localStorage.setItem("linkedin_user_name", userName);
              }

              toast.success("LinkedIn connected successfully!", { autoClose: 3000 });

              // Update channel status with user name in subtitle
              setChannels((prev) =>
                prev.map((ch) =>
                  ch.id === "linkedin"
                    ? {
                        ...ch,
                        connected: true,
                        subtitle: userName ? `Connected as ${userName}` : "LinkedIn OAuth",
                      }
                    : ch
                )
              );

              // Mark that LinkedIn was just connected - this will trigger verification for LinkedIn only
              localStorage.setItem("verify_platform", "linkedin");
            } else {
              toast.warning("LinkedIn connection failed. Please try again.", {
                autoClose: 5000,
              });
            }

            // Clean up URL by removing query parameters
            setSearchParams({});
          } catch (error) {
            console.error("Error verifying LinkedIn connection:", error);
            toast.error("Failed to verify LinkedIn connection. Please try again.", {
              autoClose: 5000,
            });
            setSearchParams({});
          }
        }, 1000); // Wait 1 second for backend to save token
      } else if (error) {
        // Handle OAuth errors (only if it's a LinkedIn error, not Instagram)
        // LinkedIn errors don't have error_reason, Instagram/Facebook errors do
        if (!searchParams.get("error_reason")) {
          toast.error(
            errorDescription || error || "Failed to connect LinkedIn. Please try again.",
            {
              autoClose: 5000,
            }
          );
          setSearchParams({});
        }
      }
    };

    handleLinkedInCallback();
  }, [searchParams, setSearchParams]);

  // Handle Instagram OAuth callback
  useEffect(() => {
    const handleInstagramCallback = async () => {
      // IMPORTANT: Check for LinkedIn callback FIRST to prevent interference
      // LinkedIn redirects to backend first, then backend redirects to frontend with linkedin_token
      const linkedinToken = searchParams.get("linkedin_token");
      const linkedinConnected = searchParams.get("linkedin_connected");
      const linkedinAlreadyConnected = searchParams.get("linkedin_already_connected");

      // Skip if this is a LinkedIn callback (LinkedIn has specific parameters)
      if (linkedinToken || linkedinConnected || linkedinAlreadyConnected) {
        console.log("⏭️ Skipping Instagram handler - this is a LinkedIn callback");
        return; // Let LinkedIn handler process this
      }

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
      // Also verify this is an Instagram OAuth callback by checking localStorage
      const oauthPlatform = localStorage.getItem("oauth_platform");
      if (code && oauthPlatform !== "instagram") {
        // This is not an Instagram callback, skip it
        console.log("⏭️ Skipping Instagram handler - OAuth was for:", oauthPlatform);
        return;
      }

      if (code) {
        try {
          // Get redirect URI (should match the one used in the OAuth request)
          const currentRedirectUri =
            process.env.REACT_APP_REDIRECT_URI || window.location.origin + "/channels";

          // Exchange code for access token via backend
          const backendUrl =
            process.env.REACT_APP_BACKEND_URL ||
            "https://unexigent-felisha-calathiform.ngrok-free.dev";

          // Get userId and authToken from localStorage
          const userStr = localStorage.getItem("user");
          const user = userStr ? JSON.parse(userStr) : null;
          const userId = user?.id || null;
          const authToken = localStorage.getItem("authToken");

          console.log("🔄 Calling Instagram exchange-token API...");
          const headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          };

          // Add Authorization header if token exists
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const response = await fetch(`${backendUrl}/api/instagram/exchange-token`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
              code: code,
              redirectUri: currentRedirectUri,
              userId: userId,
            }),
          });

          console.log("Instagram API response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Instagram API error:", errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();

          if (response.ok && data.success && data.access_token) {
            // Tokens are now stored on the backend in JSON files
            // Only store userId (Instagram account ID) in localStorage for reference
            if (data.userId || data.instagram_account_id) {
              const userId = data.userId || data.instagram_account_id;
              localStorage.setItem("instagram_user_id", userId);

              // Store account info for display purposes only
              if (data.instagram_account_id) {
                localStorage.setItem("instagram_account_id", data.instagram_account_id);
              }
              if (data.instagram_username) {
                localStorage.setItem("instagram_username", data.instagram_username);
              }
              if (data.page_id) {
                localStorage.setItem("instagram_page_id", data.page_id);
              }

              // Remove old token storage from localStorage (cleanup)
              localStorage.removeItem("instagram_page_access_token");
              localStorage.removeItem("instagram_user_access_token");
              localStorage.removeItem("instagram_token_type");
              localStorage.removeItem("instagram_token_expiry");
            }

            toast.success("Instagram connected successfully!", { autoClose: 3000 });

            // Update channel status
            setChannels((prev) =>
              prev.map((ch) => (ch.id === "instagram" ? { ...ch, connected: true } : ch))
            );

            // Mark that Instagram was just connected - this will trigger verification for Instagram only
            localStorage.setItem("verify_platform", "instagram");
            // Clean up OAuth platform marker
            localStorage.removeItem("oauth_platform");

            // Clean up URL by removing query parameters
            setSearchParams({});
          } else {
            throw new Error(data.error || "Failed to exchange code for access token");
          }
        } catch (error) {
          console.error("❌ Error exchanging code for token:", error);
          // Check if it's a CORS error - this might happen if LinkedIn callback is processed as Instagram
          if (
            error.message &&
            (error.message.includes("CORS") || error.message.includes("Failed to fetch"))
          ) {
            console.error(
              "🚫 CORS error detected - checking if this is actually a LinkedIn callback"
            );
            // Check again for LinkedIn params (they might have been added after initial check)
            const hasLinkedInParams =
              searchParams.get("linkedin_token") ||
              searchParams.get("linkedin_connected") ||
              searchParams.get("linkedin_already_connected");
            if (hasLinkedInParams) {
              console.log("✅ This is a LinkedIn callback - skipping Instagram error");
              return; // Don't show error for LinkedIn callbacks
            }
            toast.error("CORS error: Please check your backend CORS configuration.", {
              autoClose: 5000,
            });
          } else {
            toast.error(error.message || "Failed to connect Instagram. Please try again.", {
              autoClose: 5000,
            });
          }
          // Clean up URL
          setSearchParams({});
        }
      }
    };

    handleInstagramCallback();
  }, [searchParams, setSearchParams]);

  // Handle Facebook OAuth callback
  useEffect(() => {
    const handleFacebookCallback = async () => {
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
          errorDescription || errorReason || "Failed to connect Facebook. Please try again.",
          { autoClose: 5000 }
        );
        // Clean up URL
        setSearchParams({});
        return;
      }

      // Check if we have an authorization code
      // Also verify this is a Facebook OAuth callback by checking localStorage
      const oauthPlatform = localStorage.getItem("oauth_platform");
      if (code && oauthPlatform !== "facebook") {
        // This is not a Facebook callback, skip it
        console.log("⏭️ Skipping Facebook handler - OAuth was for:", oauthPlatform);
        return;
      }

      if (code) {
        try {
          // Get redirect URI (should match the one used in the OAuth request)
          const currentRedirectUri =
            process.env.REACT_APP_REDIRECT_URI || window.location.origin + "/channels";

          // Exchange code for access token via backend
          const backendUrl =
            process.env.REACT_APP_BACKEND_URL ||
            "https://unexigent-felisha-calathiform.ngrok-free.dev";

          // Get userId and authToken from localStorage
          const userStr = localStorage.getItem("user");
          const user = userStr ? JSON.parse(userStr) : null;
          const userId = user?.id || null;
          const authToken = localStorage.getItem("authToken");

          console.log("🔄 Calling Facebook exchange-token API...");
          const headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          };

          // Add Authorization header if token exists
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const response = await fetch(`${backendUrl}/api/facebook/exchange-token`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
              code: code,
              redirectUri: currentRedirectUri,
              userId: userId,
            }),
          });

          console.log("Facebook API response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Facebook API error:", errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();

          if (response.ok && data.success && data.access_token) {
            // Tokens are now stored on the backend in JSON files
            // Only store userId (Facebook user ID) in localStorage for reference
            if (data.facebook_user_id) {
              const userId = data.facebook_user_id;
              localStorage.setItem("facebook_user_id", userId);

              // Store account info for display purposes only
              if (data.facebook_user_name) {
                localStorage.setItem("facebook_user_name", data.facebook_user_name);
              }
              if (data.facebook_page_id) {
                localStorage.setItem("facebook_page_id", data.facebook_page_id);
              }
              if (data.facebook_page_name) {
                localStorage.setItem("facebook_page_name", data.facebook_page_name);
              }

              // Remove old token storage from localStorage (cleanup)
              localStorage.removeItem("facebook_user_access_token");
              localStorage.removeItem("facebook_page_access_token");
              localStorage.removeItem("facebook_token_type");
              localStorage.removeItem("facebook_token_expiry");
            }

            toast.success("Facebook connected successfully!", { autoClose: 3000 });

            // Update channel status with user name in subtitle
            const userName = data.facebook_user_name || null;
            setChannels((prev) =>
              prev.map((ch) =>
                ch.id === "facebook"
                  ? {
                      ...ch,
                      connected: true,
                      subtitle: userName ? `Connected as ${userName}` : "Facebook OAuth",
                    }
                  : ch
              )
            );

            // Mark that Facebook was just connected - this will trigger verification for Facebook only
            localStorage.setItem("verify_platform", "facebook");
            // Clean up OAuth platform marker
            localStorage.removeItem("oauth_platform");

            // Clean up URL by removing query parameters
            setSearchParams({});
          } else {
            throw new Error(data.error || "Failed to exchange code for access token");
          }
        } catch (error) {
          console.error("❌ Error exchanging code for token:", error);
          // Check if it's a CORS error - this might happen if LinkedIn callback is processed as Instagram
          if (
            error.message &&
            (error.message.includes("CORS") || error.message.includes("Failed to fetch"))
          ) {
            console.error(
              "🚫 CORS error detected - checking if this is actually a LinkedIn callback"
            );
            // Check again for LinkedIn params (they might have been added after initial check)
            const hasLinkedInParams =
              searchParams.get("linkedin_token") ||
              searchParams.get("linkedin_connected") ||
              searchParams.get("linkedin_already_connected");
            if (hasLinkedInParams) {
              console.log("✅ This is a LinkedIn callback - skipping LinkedIn error");
              return; // Don't show error for LinkedIn callbacks
            }
            toast.error("CORS error: Please check your backend CORS configuration.", {
              autoClose: 5000,
            });
          } else {
            toast.error(error.message || "Failed to connect Facebook. Please try again.", {
              autoClose: 5000,
            });
          }
          // Clean up URL
          setSearchParams({});
        }
      }
    };

    handleFacebookCallback();
  }, [searchParams, setSearchParams]);

  // Verify connection status on component mount or after OAuth callback
  useEffect(() => {
    const verifyConnections = async () => {
      setCheckingConnection(true);
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

      // Check if a specific platform was just connected
      const verifyPlatform = localStorage.getItem("verify_platform");

      if (verifyPlatform) {
        // Only verify the specific platform that was just connected
        console.log(`🔍 Verifying ${verifyPlatform} connection only...`);

        if (verifyPlatform === "instagram") {
          try {
            const authToken = localStorage.getItem("authToken");
            if (!authToken) {
              setCheckingConnection(false);
              return;
            }

            const headers = {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
              Authorization: `Bearer ${authToken}`,
            };

            const response = await fetch(`${backendUrl}/api/integrations`, {
              method: "GET",
              headers: headers,
            });

            if (response.ok) {
              const data = await response.json();
              const instagramIntegration = data.integrations?.instagram;

              if (
                instagramIntegration &&
                instagramIntegration.connected &&
                !instagramIntegration.tokenExpired &&
                instagramIntegration.platformUserId
              ) {
                // Store in localStorage for backward compatibility
                localStorage.setItem("instagram_user_id", instagramIntegration.platformUserId);
                setChannels((prev) =>
                  prev.map((ch) =>
                    ch.id === "instagram"
                      ? {
                          ...ch,
                          connected: true,
                          subtitle: instagramIntegration.username
                            ? `Connected as ${instagramIntegration.username}`
                            : "Instagram OAuth",
                        }
                      : ch
                  )
                );
              }
            }
          } catch (error) {
            console.error("❌ Error verifying Instagram connection:", error);
          }
        } else if (verifyPlatform === "facebook") {
          try {
            const authToken = localStorage.getItem("authToken");
            if (!authToken) {
              setCheckingConnection(false);
              return;
            }

            const headers = {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
              Authorization: `Bearer ${authToken}`,
            };

            const response = await fetch(`${backendUrl}/api/integrations`, {
              method: "GET",
              headers: headers,
            });

            if (response.ok) {
              const data = await response.json();
              const facebookIntegration = data.integrations?.facebook;

              if (
                facebookIntegration &&
                facebookIntegration.connected &&
                !facebookIntegration.tokenExpired &&
                facebookIntegration.platformUserId
              ) {
                // Store in localStorage for backward compatibility
                localStorage.setItem("facebook_user_id", facebookIntegration.platformUserId);
                if (facebookIntegration.pageId) {
                  localStorage.setItem("facebook_page_id", facebookIntegration.pageId);
                }
                setChannels((prev) =>
                  prev.map((ch) =>
                    ch.id === "facebook"
                      ? {
                          ...ch,
                          connected: true,
                          subtitle: facebookIntegration.userName
                            ? `Connected as ${facebookIntegration.userName}`
                            : "Facebook OAuth",
                        }
                      : ch
                  )
                );
              }
            }
          } catch (error) {
            console.error("❌ Error verifying Facebook connection:", error);
          }
        } else if (verifyPlatform === "linkedin") {
          await checkLinkedInConnection();
        }

        // Clear the verify_platform flag after verification
        localStorage.removeItem("verify_platform");
        setCheckingConnection(false);
        return; // Exit early, don't verify all platforms
      }

      // No specific platform to verify - verify all platforms (normal mount scenario)
      console.log("🔍 Verifying all platform connections...");

      // Verify WhatsApp connection
      const whatsappToken = localStorage.getItem("whatsapp_token");
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

      // Get authToken from localStorage
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        console.log("No auth token found, skipping connection verification");
        setCheckingConnection(false);
        return;
      }

      // Get all integrations for the logged-in user
      try {
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
          const integrations = integrationsData.integrations || {};

          console.log("📊 Integrations data received:", integrations);

          // Update all channels at once to avoid race conditions
          setChannels((prev) => {
            const updated = prev.map((ch) => {
              if (ch.id === "instagram") {
                const instagram = integrations.instagram;
                if (instagram && instagram.connected && !instagram.tokenExpired) {
                  console.log("✅ Setting Instagram as connected");
                  return {
                    ...ch,
                    connected: true,
                    subtitle: instagram.username
                      ? `Connected as ${instagram.username}`
                      : "Instagram OAuth",
                  };
                } else {
                  console.log("❌ Setting Instagram as disconnected");
                  return { ...ch, connected: false };
                }
              }

              if (ch.id === "facebook") {
                const facebook = integrations.facebook;
                if (facebook && facebook.connected && !facebook.tokenExpired) {
                  console.log("✅ Setting Facebook as connected");
                  return {
                    ...ch,
                    connected: true,
                    subtitle: facebook.userName
                      ? `Connected as ${facebook.userName}`
                      : "Facebook OAuth",
                  };
                } else {
                  console.log("❌ Setting Facebook as disconnected");
                  return { ...ch, connected: false };
                }
              }

              if (ch.id === "linkedin") {
                const linkedin = integrations.linkedin;
                if (linkedin && linkedin.connected && !linkedin.tokenExpired) {
                  console.log("✅ Setting LinkedIn as connected");
                  return { ...ch, connected: true };
                } else {
                  console.log("❌ Setting LinkedIn as disconnected");
                  return { ...ch, connected: false };
                }
              }

              return ch;
            });

            console.log("🔄 Updated channels state:", updated);
            return updated;
          });

          // Store platformUserIds in localStorage for backward compatibility
          if (integrations.instagram?.platformUserId) {
            localStorage.setItem("instagram_user_id", integrations.instagram.platformUserId);
          }
          if (integrations.facebook?.platformUserId) {
            localStorage.setItem("facebook_user_id", integrations.facebook.platformUserId);
            if (integrations.facebook.pageId) {
              localStorage.setItem("facebook_page_id", integrations.facebook.pageId);
            }
          }

          // Mark checking as complete after successful update
          setCheckingConnection(false);
        } else {
          console.error("Failed to get integrations:", integrationsResponse.status);
          // Set all to disconnected if API call fails
          setChannels((prev) =>
            prev.map((ch) =>
              ["instagram", "facebook", "linkedin"].includes(ch.id)
                ? { ...ch, connected: false }
                : ch
            )
          );
          setCheckingConnection(false);
        }
      } catch (error) {
        console.error("❌ Error checking integrations:", error);
        // Set all to disconnected on error
        setChannels((prev) =>
          prev.map((ch) =>
            ["instagram", "facebook", "linkedin"].includes(ch.id) ? { ...ch, connected: false } : ch
          )
        );
        setCheckingConnection(false);
      }

      // Note: LinkedIn connection check is now handled by integrations API above
      // Only call checkLinkedInConnection if needed for additional verification
      // await checkLinkedInConnection();

      // All platform connections are now handled by the integrations API above
      // No need for legacy localStorage-based checks

      setCheckingConnection(false);
    };

    verifyConnections();
  }, [searchParams]); // Run only on mount

  const handleConnect = (channelId) => {
    if (channelId === "whatsapp") {
      setShowWhatsAppModal(true);
    } else if (channelId === "instagram") {
      handleInstagramConnect();
    } else if (channelId === "linkedin") {
      handleLinkedInConnect();
    } else if (channelId === "facebook") {
      handleFacebookConnect();
    }
  };

  const handleWhatsAppConnect = (token) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: true } : ch))
    );
    toast.success("WhatsApp Business connected successfully!");
  };

  const handleInstagramConnect = () => {
    // Store which platform is initiating OAuth
    localStorage.setItem("oauth_platform", "instagram");
    const state = Math.random().toString(36).substring(2);
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    // Use Facebook OAuth for Instagram Business API (this is the standard way)
    const authUrl = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodedRedirectUri}&scope=${instagramScopes}&response_type=code&state=${state}`;
    window.location.href = authUrl;
  };

  // Function to check LinkedIn connection status
  const checkLinkedInConnection = async () => {
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

    try {
      // Get authToken from localStorage
      const authToken = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };

      // Add Authorization header if token exists
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      // Check token from backend file (not localStorage)
      const linkedInResponse = await fetch(`${backendUrl}/api/linkedin/token`, {
        method: "GET",
        headers: headers,
      });

      // Check for 401 Unauthorized
      if (linkedInResponse.status === 401) {
        setCheckingConnection(false);
        console.log("❌ LinkedIn token unauthorized (401)");
        // Note: handleDisconnect will be called from handleSync if needed
        // For now, just mark as disconnected
        localStorage.removeItem("linkedin_connected");
        localStorage.removeItem("linkedin_user_name");
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === "linkedin" ? { ...ch, connected: false, subtitle: "LinkedIn OAuth" } : ch
          )
        );
        return false;
      }

      const linkedInData = await linkedInResponse.json();
      if (linkedInData.success && linkedInData.connected) {
        // Get user name from response or localStorage
        const userName =
          linkedInData.userInfo?.name ||
          linkedInData.userInfo?.given_name ||
          linkedInData.userInfo?.localizedFirstName ||
          linkedInData.userInfo?.firstName ||
          localStorage.getItem("linkedin_user_name") ||
          null;

        if (userName && !localStorage.getItem("linkedin_user_name")) {
          localStorage.setItem("linkedin_user_name", userName);
        }

        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === "linkedin"
              ? {
                  ...ch,
                  connected: true,
                  subtitle: userName ? `Connected as ${userName}` : "LinkedIn OAuth",
                }
              : ch
          )
        );
        localStorage.setItem("linkedin_connected", "true");
        console.log("✅ LinkedIn is connected", userName ? `as ${userName}` : "");
        return true;
      } else {
        // Token is invalid or not found
        localStorage.removeItem("linkedin_connected");
        localStorage.removeItem("linkedin_user_name");
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === "linkedin" ? { ...ch, connected: false, subtitle: "LinkedIn OAuth" } : ch
          )
        );
        console.log("❌ LinkedIn token is invalid or expired");
        return false;
      }
    } catch (error) {
      console.error("Error checking LinkedIn connection:", error);
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === "linkedin" ? { ...ch, connected: false, subtitle: "LinkedIn OAuth" } : ch
        )
      );
      return false;
    }
  };

  const handleLinkedInConnect = () => {
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

    // Get userId from localStorage
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || null;

    // Always force reconnect to ensure fresh OAuth flow
    // This ensures we always go through LinkedIn auth page

    // Redirect to backend LinkedIn login endpoint with userId
    const loginUrl = `${backendUrl}/linkedin/login${userId ? `?userId=${userId}` : ""}`;

    // Use window.location.replace to ensure redirect happens
    window.location.replace(loginUrl);
  };

  const handleFacebookConnect = () => {
    // Store which platform is initiating OAuth
    localStorage.setItem("oauth_platform", "facebook");
    const state = Math.random().toString(36).substring(2);
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    // Use Facebook OAuth for Facebook Business API (this is the standard way)
    const authUrl = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodedRedirectUri}&scope=${facebookBusinessScopes}&response_type=code&state=${state}`;
    window.location.href = authUrl;
  };

  const handleWhatsAppError = (errorMessage) => {
    toast.error(errorMessage, { autoClose: 5000 });
  };

  const handleDisconnect = async (channelId) => {
    if (channelId === "whatsapp") {
      localStorage.removeItem("whatsapp_token");
    } else if (channelId === "instagram") {
      const instagramUserId = localStorage.getItem("instagram_user_id");
      if (instagramUserId) {
        // Delete tokens from backend
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";
        try {
          const authToken = localStorage.getItem("authToken");
          const headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          };

          // Add Authorization header if token exists
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }
          await fetch(`${backendUrl}/api/instagram/tokens/${instagramUserId}`, {
            method: "DELETE",
            headers: headers,
          });
        } catch (error) {
          console.error("Error deleting Instagram tokens:", error);
        }
      }
      localStorage.removeItem("instagram_user_id");
      localStorage.removeItem("instagram_account_id");
      localStorage.removeItem("instagram_username");
      localStorage.removeItem("instagram_page_id");
    } else if (channelId === "facebook") {
      const facebookUserId = localStorage.getItem("facebook_user_id");
      if (facebookUserId) {
        // Delete tokens from backend

        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };

        // Add Authorization header if token exists
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";
        try {
          await fetch(`${backendUrl}/api/facebook/tokens/${facebookUserId}`, {
            method: "DELETE",
            headers: headers,
          });
        } catch (error) {
          console.error("Error deleting Facebook tokens:", error);
        }
      }
      localStorage.removeItem("facebook_user_id");
      localStorage.removeItem("facebook_user_name");
      localStorage.removeItem("facebook_page_id");
      localStorage.removeItem("facebook_page_name");
      localStorage.removeItem("facebook_token_type");
      localStorage.removeItem("facebook_token_expiry");
      localStorage.removeItem("facebook_user_access_token");
      localStorage.removeItem("facebook_page_access_token");
    } else if (channelId === "linkedin") {
      // Delete token from backend file
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
      try {
        // Get authToken from localStorage
        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };

        // Add Authorization header if token exists
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        await fetch(`${backendUrl}/api/linkedin/token`, {
          method: "DELETE",
          headers: headers,
        });
      } catch (error) {
        console.error("Error deleting LinkedIn token:", error);
      }
      localStorage.removeItem("linkedin_connected");
      localStorage.removeItem("linkedin_user_name");
    }
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, connected: false } : ch))
    );
    toast.success(`${channels.find((c) => c.id === channelId)?.name} disconnected successfully`);
  };

  const handleSync = async (channelId) => {
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
    if (channelId === "linkedin") {
      // Check LinkedIn connection status
      toast.loading("Checking LinkedIn connection...");
      try {
        // Get authToken from localStorage
        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };

        // Add Authorization header if token exists
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const linkedInResponse = await fetch(`${backendUrl}/api/linkedin/token`, {
          method: "GET",
          headers: headers,
        });

        // Check for 401 Unauthorized
        if (linkedInResponse.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting LinkedIn...");
          await handleDisconnect(channelId);
          return;
        }

        const isConnected = await checkLinkedInConnection();
        toast.dismiss();
        if (isConnected) {
          toast.success("LinkedIn is connected!");
          // Update lastSync date
          const currentDate = new Date();
          const formattedDate = `${
            currentDate.getMonth() + 1
          }/${currentDate.getDate()}/${currentDate.getFullYear()}`;
          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, lastSync: formattedDate } : ch))
          );
        } else {
          toast.error("LinkedIn is not connected. Please connect your LinkedIn account.");
        }
      } catch (error) {
        console.error("Error checking LinkedIn connection:", error);
        toast.dismiss();
        toast.error("Failed to check LinkedIn connection. Please try again.");
      }
      return;
    } else if (channelId === "whatsapp") {
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

        // Check for 401 Unauthorized
        if (response.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting WhatsApp...");
          await handleDisconnect(channelId);
          return;
        }

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
    } else if (channelId === "instagram") {
      const instagramUserId = localStorage.getItem("instagram_user_id");
      if (!instagramUserId) {
        toast.error("Instagram token not found. Please connect your Instagram account again.");
        return;
      }

      // Get user access token from backend using logged-in user's integrations
      toast.loading("Syncing Instagram...");
      try {
        // Get authToken from localStorage
        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };

        // Add Authorization header if token exists
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        // First, get all integrations to find Instagram platformUserId
        const integrationsResponse = await fetch(`${backendUrl}/api/integrations`, {
          method: "GET",
          headers: headers,
        });

        if (!integrationsResponse.ok) {
          toast.error("Failed to get Instagram connection. Please reconnect your account.");
          return;
        }

        const integrationsData = await integrationsResponse.json();
        const instagramIntegration = integrationsData.integrations?.instagram;

        if (
          !instagramIntegration ||
          !instagramIntegration.connected ||
          instagramIntegration.tokenExpired
        ) {
          toast.error("Instagram not connected or token expired. Please reconnect your account.");
          return;
        }

        // Use the platformUserId from the integration
        const instagramPlatformUserId = instagramIntegration.platformUserId;

        const tokenResponse = await fetch(
          `${backendUrl}/api/instagram/tokens/user/${instagramPlatformUserId}`,
          {
            method: "GET",
            headers: headers,
          }
        );

        // Check for 401 Unauthorized
        if (tokenResponse.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting Instagram...");
          await handleDisconnect(channelId);
          return;
        }

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.success || tokenData.isExpired) {
          toast.error(
            "Instagram token expired or not found. Please connect your Instagram account again."
          );
          return;
        }

        const response = await fetch(`${backendUrl}/api/verify-instagram-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ token: tokenData.token }),
        });

        // Check for 401 Unauthorized
        if (response.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting Instagram...");
          await handleDisconnect(channelId);
          return;
        }

        const data = await response.json();
        if (response.ok && data.success && data.accountInfo) {
          toast.dismiss();
          toast.success("Instagram sync completed successfully!");
        } else {
          toast.dismiss();
          toast.error("Failed to sync Instagram. Please try again.");
        }
      } catch (error) {
        console.error("Error syncing Instagram:", error);
        toast.dismiss();
        toast.error("Failed to sync Instagram. Please check your connection and try again.");
      }
    } else if (channelId === "facebook") {
      const facebookUserId = localStorage.getItem("facebook_user_id");
      if (!facebookUserId) {
        toast.error("Facebook token not found. Please connect your Facebook account again.");
        return;
      }

      // Get long-lived token from backend
      toast.loading("Syncing Facebook...");
      try {
        const tokenResponse = await fetch(`${backendUrl}/api/facebook/tokens/${facebookUserId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });

        // Check for 401 Unauthorized
        if (tokenResponse.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting Facebook...");
          await handleDisconnect(channelId);
          return;
        }

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.success || tokenData.isExpired) {
          toast.error(
            "Facebook token expired or not found. Please connect your Facebook account again."
          );
          return;
        }

        const response = await fetch(`${backendUrl}/api/verify-facebook-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ token: tokenData.token }),
        });

        // Check for 401 Unauthorized
        if (response.status === 401) {
          toast.dismiss();
          toast.error("Unauthorized access. Disconnecting Facebook...");
          await handleDisconnect(channelId);
          return;
        }

        const data = await response.json();
        if (response.ok && data.success && data.accountInfo) {
          // Update subtitle with user name if available
          if (data.accountInfo.facebook_user_name) {
            localStorage.setItem("facebook_user_name", data.accountInfo.facebook_user_name);
            setChannels((prev) =>
              prev.map((ch) =>
                ch.id === "facebook"
                  ? {
                      ...ch,
                      subtitle: `Connected as ${data.accountInfo.facebook_user_name}`,
                    }
                  : ch
              )
            );
          }

          // Update lastSync date
          const currentDate = new Date();
          const formattedDate = `${
            currentDate.getMonth() + 1
          }/${currentDate.getDate()}/${currentDate.getFullYear()}`;
          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, lastSync: formattedDate } : ch))
          );

          toast.dismiss();
          toast.success("Facebook sync completed successfully!");
        } else {
          toast.dismiss();
          toast.error("Failed to sync Facebook. Please try again.");
        }
      } catch (error) {
        console.error("Error syncing Facebook:", error);
        toast.dismiss();
        toast.error("Failed to sync Facebook. Please check your connection and try again.");
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
