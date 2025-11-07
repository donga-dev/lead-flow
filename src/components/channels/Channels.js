import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Check,
  Users,
  RefreshCw,
  Clock,
  Settings,
  Zap,
  CircleCheckBig,
  CircleX,
} from "lucide-react";
import WhatsAppConnectModal from "./WhatsAppConnectModal";

const Channels = () => {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  const [channels, setChannels] = useState([
    {
      id: "whatsapp",
      name: "Whatsapp",
      subtitle: "WhatsApp Business API",
      connected: false, // Start as disconnected, verify on mount
      leads: 45,
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

  const whatsappChannel = channels.find((c) => c.id === "whatsapp");

  // Verify WhatsApp connection status on component mount
  useEffect(() => {
    const verifyWhatsAppConnection = async () => {
      setCheckingConnection(true);
      const storedToken = localStorage.getItem("whatsapp_token");

      if (!storedToken) {
        // No token found, ensure channel is disconnected
        setChannels((prev) =>
          prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
        );
        setCheckingConnection(false);
        return;
      }

      // Verify token validity
      try {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";
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
          // Token is valid, mark as connected
          setChannels((prev) =>
            prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: true } : ch))
          );
        } else {
          // Token is invalid, remove it and mark as disconnected
          localStorage.removeItem("whatsapp_token");
          setChannels((prev) =>
            prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
          );
        }
      } catch (error) {
        console.error("Error verifying WhatsApp token on mount:", error);
        // On error, mark as disconnected but keep token (might be network issue)
        setChannels((prev) =>
          prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: false } : ch))
        );
      } finally {
        setCheckingConnection(false);
      }
    };

    verifyWhatsAppConnection();
  }, []); // Run only on mount

  const handleConnect = (channelId) => {
    if (channelId === "whatsapp") {
      setShowWhatsAppModal(true);
    } else {
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, connected: true } : ch))
      );
      toast.success(`${channels.find((c) => c.id === channelId)?.name} connected successfully`);
    }
  };

  const handleWhatsAppConnect = (token) => {
    console.log("WhatsApp token verified and stored:", token);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === "whatsapp" ? { ...ch, connected: true } : ch))
    );
    toast.success("WhatsApp Business connected successfully!");
  };

  const handleWhatsAppError = (errorMessage) => {
    toast.error(errorMessage, { autoClose: 5000 });
  };

  const handleDisconnect = (channelId) => {
    localStorage.removeItem("whatsapp_token");
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, connected: false } : ch))
    );
  };

  const handleSync = async (channelId) => {
    if (channelId === "whatsapp") {
      // Get stored token from localStorage
      const storedToken = localStorage.getItem("whatsapp_token");

      if (!storedToken) {
        // No token found, open verification modal
        setShowWhatsAppModal(true);
        return;
      }

      // Verify token validity
      try {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";
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
          console.log(`Syncing ${channelId}`);

          // Update lastSync date
          const currentDate = new Date();
          const formattedDate = `${
            currentDate.getMonth() + 1
          }/${currentDate.getDate()}/${currentDate.getFullYear()}`;

          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, lastSync: formattedDate } : ch))
          );

          toast.success("Sync completed successfully!");
        } else {
          // Token is invalid, open verification modal
          localStorage.removeItem("whatsapp_token");
          setChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, connected: false } : ch))
          );
          setShowWhatsAppModal(true);
          toast.error("Token expired or invalid. Please verify your token again.");
        }
      } catch (error) {
        console.error("Error verifying token:", error);
        // On error, open verification modal
        setShowWhatsAppModal(true);
        toast.error("Failed to verify token. Please check your connection and try again.");
      }
    } else {
      console.log(`Syncing ${channelId}`);
    }
  };

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

          <div className="flex flex-col gap-5">
            {whatsappChannel && (
              <div className="bg-slate-700 rounded-xl p-6 relative border border-gray-600">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-shrink-0">{whatsappChannel.logo}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-100 m-0 mb-1">
                      {whatsappChannel.name}
                    </h3>
                    <p className="text-sm text-slate-400 m-0">{whatsappChannel.subtitle}</p>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 flex items-center ${
                      checkingConnection
                        ? "bg-slate-500/20 text-slate-400"
                        : whatsappChannel.connected
                        ? "bg-green-500/20 text-green-500"
                        : "bg-red-500/20 text-red-500"
                    }`}
                  >
                    {checkingConnection ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        {whatsappChannel.connected ? "Connected" : "Disconnected"}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-6 mb-5 flex-wrap">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>Leads {whatsappChannel.leads}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>Last Sync {whatsappChannel.lastSync}</span>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  {whatsappChannel.connected ? (
                    <>
                      <button
                        className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-red-500 text-white hover:bg-red-600 hover:-translate-y-px"
                        onClick={() => handleDisconnect(whatsappChannel.id)}
                      >
                        Disconnect
                      </button>
                      <button
                        className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 hover:-translate-y-px"
                        onClick={() => handleSync(whatsappChannel.id)}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Sync Now
                      </button>
                    </>
                  ) : (
                    <button
                      className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-green-500 text-white hover:bg-green-600 hover:-translate-y-px"
                      onClick={() => handleConnect(whatsappChannel.id)}
                    >
                      Connect
                    </button>
                  )}
                  <button className="w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all ml-auto hover:bg-slate-600 hover:text-slate-100">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                {whatsappChannel.connected && (
                  <div className="mt-4 p-3 pl-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-md text-blue-300 text-sm leading-relaxed flex items-center w-full">
                    <Zap className="w-5 h-5 mr-2 flex-shrink-0" />
                    WhatsApp Assignment Ready. You can now assign leads to sales reps via WhatsApp
                    directly from the leads panel.
                  </div>
                )}
              </div>
            )}
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
