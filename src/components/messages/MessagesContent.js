import {
  Bell,
  CircleX,
  FileUser,
  Instagram,
  Mic,
  NotebookPen,
  Paperclip,
  Send,
  Smile,
} from "lucide-react";
import React from "react";

const MessagesContent = ({
  selectedContact,
  onSendMessage,
  messages,
  setMessages,
  loading,
  error,
  newMessage,
  setNewMessage,
  messageType,
  setMessageType,
  templateName,
  setTemplateName,
  sending,
  setSending,
  messagesEndRef,
  socket,
  formatPhoneNumber,
  formatTime,
  formatDate,
  getMessageAvatar,
  handleSend,
  handleSuggestedReply,
}) => {
  const suggestedReplies = [
    "Hi there! How can I help you today?",
    "Hi! I'm here to answer your questions and help you find what you need.",
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 bg-[url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23d4d4d4\\' fill-opacity=\\'0.03\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]">
      <div className="bg-slate-800 border-b border-slate-700 px-5 py-4 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold text-base flex-shrink-0 ${
              selectedContact.platform === "instagram"
                ? "bg-gradient-to-br from-pink-500 to-purple-500"
                : "bg-gradient-to-br from-purple-500 to-indigo-500"
            }`}
          >
            {selectedContact.name?.charAt(0).toUpperCase() ||
              selectedContact.phoneNumber?.charAt(1) ||
              "?"}
          </div>
          <div>
            <div className="font-semibold text-base text-slate-100 mb-0.5">
              {selectedContact.name ||
                selectedContact.username ||
                formatPhoneNumber(selectedContact.phoneNumber)}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              {selectedContact.platform === "instagram" ? (
                <Instagram className="w-3.5 h-3.5 text-pink-500" />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.77.966-.944 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                    fill="#25D366"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent rounded-md text-base cursor-pointer transition-all hover:bg-slate-700 text-[#2b82f6]">
            <FileUser className="w-5 h-5" />
            Go to Lead
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent rounded-md text-base cursor-pointer transition-all hover:bg-slate-700 text-[#2b82f6]">
            <NotebookPen className="w-5 h-5" />
            Note
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent rounded-md text-base cursor-pointer transition-all hover:bg-slate-700 text-[#2b82f6]">
            <Bell className="w-5 h-5" />
            Snooze
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent rounded-md text-base cursor-pointer transition-all hover:bg-slate-700 text-red-500">
            <CircleX className="w-5 h-5" />
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 bg-slate-900">
        {loading && <div className="text-center p-5 text-slate-400">Loading messages...</div>}
        {error && (
          <div className="p-3 bg-red-950 border-l-4 border-red-500 rounded text-red-200 mb-4">
            {error}
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <div className="text-center text-slate-400">
            <p className="m-0 mb-1 text-base text-slate-100">No messages yet</p>
            <small className="text-sm">Start the conversation by sending a message</small>
          </div>
        ) : (
          messages.map((message, index) => {
            const avatarInitials = getMessageAvatar(message);

            // Check if this is the first message of a new day
            const messageDay = formatDate(message.timestamp);
            const isNewDay =
              index === 0 || messageDay !== formatDate(messages[index - 1]?.timestamp);

            return (
              <React.Fragment key={message.id || `msg-${index}-${message.timestamp}`}>
                {/* Date Separator */}
                {isNewDay && (
                  <div className="flex items-center justify-center my-4 -mx-5 px-5 py-2">
                    <div className="bg-slate-700/50 text-slate-300 text-xs px-3 py-1.5 rounded-full">
                      {messageDay}
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-start gap-2 ${
                    message.direction === "outgoing" ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Avatar for incoming messages (left side) */}
                  {message.direction === "incoming" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center font-semibold text-xs">
                        {avatarInitials}
                      </div>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[70%] px-3.5 py-2.5 rounded-xl relative break-words shadow-sm ${
                      message.direction === "outgoing"
                        ? "bg-blue-500 text-white rounded-br-sm"
                        : "bg-slate-700 text-slate-100 rounded-bl-sm"
                    }`}
                  >
                    {message.template && (
                      <div className="mb-1">
                        <span className="inline-block bg-black/10 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-400">
                          Template: {message.template.name}
                        </span>
                      </div>
                    )}
                    {message.text?.body && (
                      <div className="text-sm leading-relaxed mb-1">{message.text.body}</div>
                    )}
                    {message.type === "template" && !message.text?.body && (
                      <div className="text-sm leading-relaxed mb-1">
                        Template message: {message.template?.name || templateName}
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-1 mt-1 ${
                        message.direction === "outgoing" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`text-[11px] ${
                          message.direction === "outgoing" ? "text-white/70" : "text-slate-400"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>

                  {/* Avatar for outgoing messages (right side) */}
                  {message.direction === "outgoing" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center font-semibold text-xs">
                        {avatarInitials}
                      </div>
                    </div>
                  )}
                </div>
                {/* Suggested Quick Replies - Show below messages */}
              </React.Fragment>
            );
          })
        )}
        {selectedContact && selectedContact.platform === "whatsapp" && (
          <div className=" flex gap-2 flex-wrap justify-end">
            {suggestedReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedReply(reply)}
                disabled={sending}
                className="px-4 py-1 text-sm border border-purple-400 text-purple-400 rounded-full hover:bg-purple-500 hover:text-white transition"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-slate-800 border-t border-slate-700 px-5 py-4 ">
        {/* Input Area */}
        <div className="flex gap-2 items-center bg-slate-700 rounded-lg p-2">
          <button
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-all flex-shrink-0"
            type="button"
          >
            <Paperclip />
          </button>

          {/* Text Input */}
          <div className="w-full relative">
            <input
              type="text"
              className="w-full px-4 py-2.5 pr-12 border border-slate-600 rounded-lg text-sm font-sans outline-none bg-slate-700 text-slate-100 placeholder:text-slate-400 disabled:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed border-0"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
            />
            {/* Emoji Icon */}
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-all rounded"
              type="button"
            >
              <Smile />
            </button>
          </div>

          {/* Microphone Icon */}
          <button
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-all flex-shrink-0"
            type="button"
          >
            <Mic />
          </button>

          {/* Send Button */}
          <button
            className="w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-lg cursor-pointer transition-all hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60 flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
            disabled={
              sending ||
              (messageType === "text" && (!newMessage || (typeof newMessage === "string" && !newMessage.trim()))) ||
              (messageType === "template" && !templateName)
            }
            type="button"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Send />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessagesContent;
