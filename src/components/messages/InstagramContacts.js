// Instagram Contacts Component
const InstagramContacts = ({ conversations, loading, onSelectContact, selectedContact }) => {
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

  if (conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-slate-400 py-8">
          <p className="mb-2">No Instagram conversations</p>
          <p className="text-sm">Start a conversation on Instagram</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div>
        {conversations.map((conversation) => {
          const participant = conversation.participants?.data?.[0];
          const contactName =
            participant?.name || participant?.username || participant?.id || conversation.id;
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
                  platform: "instagram",
                })
              }
              className={`p-3 mb-1 cursor-pointer transition-colors ${
                isSelected ? "bg-blue-500/20 border-l-4 border-blue-500" : "hover:bg-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
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
                      {lastMessage.message || lastMessage.id ? "Message" : "No messages"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default InstagramContacts;
