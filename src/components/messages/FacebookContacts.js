// Facebook Contacts Component
import React, { useState } from "react";
import { Search } from "lucide-react";

const FacebookContacts = ({
  conversations,
  loading,
  onSelectContact,
  selectedContact,
  facebookUserId,
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

  if (!facebookUserId) {
    return (
      <p className="p-5 text-center text-slate-400 flex items-center h-full">
        Facebook not connected. Please Connect to Facebook from the Channels page to see contacts
      </p>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-slate-400 py-8">
          <p className="mb-2">No Facebook conversations</p>
          <p className="text-sm">Start a conversation on Facebook Messenger</p>
        </div>
      </div>
    );
  }

  // Filter conversations based on search term (by name)
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchTerm) return true;
    const participants = conversation.participants?.data || [];
    const otherParticipant =
      participants.find((p) => p.id && String(p.id) !== String(facebookUserId)) ||
      participants[0];
    const contactName =
      otherParticipant?.name ||
      otherParticipant?.username ||
      otherParticipant?.id ||
      conversation.id;
    return contactName.toLowerCase().includes(searchTerm.toLowerCase());
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
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 pl-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          // Find the participant that is NOT the current Facebook page
          const participants = conversation.participants?.data || [];
          const otherParticipant =
            participants.find((p) => p.id && String(p.id) !== String(facebookUserId)) ||
            participants[0];

          const contactName =
            otherParticipant?.name ||
            otherParticipant?.username ||
            otherParticipant?.id ||
            conversation.id;
          const isSelected = selectedContact?.id === conversation.id;
          // Get last message from conversation.messages.data if available
          const lastMessage = conversation.messages?.data?.[0];
          const lastMessageTime = lastMessage?.created_time
            ? new Date(lastMessage.created_time).getTime()
            : conversation.updated_time
            ? new Date(conversation.updated_time).getTime()
            : null;

          return (
            <div
              key={conversation.id}
              onClick={() =>
                onSelectContact({
                  id: conversation.id,
                  name: contactName,
                  conversationId: conversation.id,
                  userId: otherParticipant?.id, // Use the other participant's ID
                  platform: "facebook",
                })
              }
              className={`p-3 mb-1 cursor-pointer transition-colors ${
                isSelected ? "bg-blue-500/20 border-l-4 border-blue-500" : "hover:bg-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {getInitials(contactName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm text-slate-100 truncate">
                      {contactName}
                    </div>
                    {lastMessageTime && (
                      <div className="text-xs text-slate-400 ml-2 flex-shrink-0">
                        {formatTime(lastMessageTime)}
                      </div>
                    )}
                  </div>
                  {lastMessage && (
                    <div className="text-xs text-slate-400 truncate">
                      {lastMessage.message || "Message"}
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

export default FacebookContacts;
