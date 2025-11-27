// Instagram Contacts Component
import React, { useState } from "react";
import { Search } from "lucide-react";

const InstagramContacts = ({
  conversations,
  loading,
  onSelectContact,
  selectedContact,
  instagramUserId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-slate-400 py-8">Loading conversations...</div>
      </div>
    );
  }
  // Note: We can show stored conversations even without instagramUserId
  // since they come from webhook messages, not API connections
  if (conversations.length === 0 && instagramUserId) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-slate-400 py-8">
          <p className="mb-2">No Instagram conversations</p>
          <p className="text-sm">Start a conversation on Instagram</p>
        </div>
      </div>
    );
  }

  if (!instagramUserId) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-slate-400 py-8">
          <p className="mb-2">
            Instagram not connected. Please Connect to Instagram from the Channels page to see
            contacts
          </p>
        </div>
      </div>
    );
  }

  // Filter conversations based on search term (by name)
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchTerm) return true;
    const name = conversation?.name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 pl-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 && searchTerm ? (
          <div className="p-10 text-center text-slate-400">
            <p className="m-0 mb-2 text-base text-slate-100">No contacts found</p>
            <small className="text-sm">Try a different search term</small>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
          // Check if this is a stored conversation (from stored messages API)
          const isStoredConversation = conversation.source === "stored";

          let contactName;
          let contactUserId;

          if (isStoredConversation) {
            // For stored conversations, use data from API response
            contactName = conversation.name;
            contactUserId = conversation.userId;
          }

          const isSelected =
            selectedContact?.id === conversation.id ||
            selectedContact?.userId === contactUserId ||
            selectedContact?.conversationId === conversation.conversationId;

          return (
            <div
              key={conversation.id || conversation.userId}
              onClick={() => {
                const contactData = {
                  id: conversation.id || conversation.userId,
                  name: contactName,
                  conversationId:
                    conversation.conversationId || conversation.id || conversation.userId,
                  userId: contactUserId || conversation.userId, // Use userId for stored messages API
                  platform: "instagram",
                };

                // Add source property for stored conversations
                if (isStoredConversation) {
                  contactData.source = "stored";
                }

                onSelectContact(contactData);
              }}
              className={`p-3 mb-1 cursor-pointer transition-colors ${
                isSelected ? "bg-blue-500/20 border-l-4 border-blue-500" : "hover:bg-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {getInitials(conversation?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm text-slate-100 truncate">
                      {conversation?.name}
                    </div>
                    {conversation.lastMessageTime && (
                      <div className="text-xs text-slate-400 ml-2 flex-shrink-0">
                        {formatTime(conversation.lastMessageTime)}
                      </div>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <div className="text-xs text-slate-400 truncate">
                      {conversation.lastMessage || "No messages"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
};
export default InstagramContacts;
