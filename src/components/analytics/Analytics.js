import React, { useState } from "react";
import { Instagram, Linkedin, Facebook } from "lucide-react";
import LinkedInAnalytics from "./LinkedInAnalytics";
import InstagramAnalytics from "./InstagramAnalytics";
import FacebookAnalytics from "./FacebookAnalytics";

const Analytics = () => {
  const [activeTab, setActiveTab] = useState("instagram"); // Default to Instagram

  return (
    <div className="flex-1 bg-[#111827] h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Analytics</h1>
            <p className="text-slate-400 text-sm">Key performance indicators and insights</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab("instagram")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "instagram"
                ? "border-pink-500 text-pink-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Instagram className="w-4 h-4" />
              Instagram
            </div>
          </button>
          <button
            onClick={() => setActiveTab("facebook")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "facebook"
                ? "border-blue-600 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Facebook className="w-4 h-4" />
              Facebook
            </div>
          </button>
          <button
            onClick={() => setActiveTab("linkedin")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "linkedin"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "linkedin" ? (
          <LinkedInAnalytics />
        ) : activeTab === "facebook" ? (
          <FacebookAnalytics />
        ) : (
          <InstagramAnalytics />
        )}
      </div>
    </div>
  );
};

export default Analytics;
