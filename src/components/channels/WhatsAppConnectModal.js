import React, { useState } from "react";
import { X } from "lucide-react";

const WhatsAppConnectModal = ({ isOpen, onClose, onConnect, onError }) => {
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!token.trim()) {
      setError("Please enter a token");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

      const response = await fetch(`${backendUrl}/api/verify-whatsapp-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("whatsapp_token", token);
        onConnect(token);
        setToken("");
        onClose();
      } else {
        const errorMessage = data.error || "Invalid token. Please check and try again.";
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (err) {
      console.error("Error verifying token:", err);
      const errorMessage = "Failed to verify token. Please check your connection and try again.";
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setToken("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-5"
      onClick={handleClose}
    >
      <div
        className="bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100 m-0">Connect WhatsApp Business</h2>
          <button
            className="w-8 h-8 border-none bg-transparent rounded-md flex items-center justify-center cursor-pointer text-slate-400 transition-all hover:bg-slate-700 hover:text-slate-100"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <p className="text-sm text-slate-400 m-0 mb-2 leading-relaxed">
              Enter your WhatsApp Business API access token to connect your account.
            </p>
            <p className="text-xs text-slate-500 italic m-0">
              You can find your access token in Meta Business Manager under WhatsApp Business API
              settings.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="whatsapp-token"
              className="text-sm font-medium text-slate-100"
            >
              Access Token
            </label>
            <input
              id="whatsapp-token"
              type="text"
              className="w-full px-4 py-3 border border-slate-600 rounded-lg bg-slate-700 text-slate-100 text-sm outline-none transition-all font-mono placeholder:text-slate-500 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Enter your WhatsApp Business API access token"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError("");
              }}
              disabled={verifying}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !verifying) {
                  handleVerify();
                }
              }}
            />
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-slate-700">
          <button
            className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleClose}
            disabled={verifying}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleVerify}
            disabled={verifying || !token.trim()}
          >
            {verifying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Verifying...
              </>
            ) : (
              "Verify & Connect"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnectModal;
