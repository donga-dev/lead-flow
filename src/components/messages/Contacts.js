import React, { useState, useEffect, useCallback } from "react";
import { Filter, Check } from "lucide-react";
import whatsappAPI from "../../services/whatsapp.api";
import { useSocket } from "../../contexts/SocketContext";
import { getUnreadCount } from "../../utils/readMessages.utils";

const Contacts = ({ onSelectContact, selectedContact }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [unreadCounts, setUnreadCounts] = useState({});

  const { socket } = useSocket();

  const loadMessagesForContact = useCallback(async (phoneNumber) => {
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
      const normalizedPhone = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");

      // Try backend first
      try {
        const response = await fetch(
          `${backendUrl}/api/messages/${encodeURIComponent(normalizedPhone)}`,
          {
            headers: {
              "ngrok-skip-browser-warning": "true",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages) {
            return data.messages;
          }
        }
      } catch (backendError) {
        // Fall back to localStorage
      }

      // Fall back to localStorage
      const storedMessages = localStorage.getItem(`whatsapp_messages_${normalizedPhone}`);
      if (storedMessages) {
        return JSON.parse(storedMessages);
      }
      return [];
    } catch (error) {
      console.warn("Error loading messages for contact:", error);
      return [];
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contactsData = await whatsappAPI.getContacts();
      setContacts(contactsData);

      // Calculate unread counts for each contact
      const counts = {};
      for (const contact of contactsData) {
        if (contact.hasMessages) {
          const messages = await loadMessagesForContact(contact.phoneNumber);
          counts[contact.phoneNumber] = getUnreadCount(contact.phoneNumber, messages);
        } else {
          counts[contact.phoneNumber] = 0;
        }
      }
      setUnreadCounts(counts);
    } catch (err) {
      setError(err.message || "Failed to load contacts");
      console.error("Error loading contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [loadMessagesForContact]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Update unread count when a contact is selected
  useEffect(() => {
    if (selectedContact) {
      // Normalize phone number consistently
      let normalizedPhone = selectedContact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");

      // Also check all possible phone number formats in unreadCounts keys
      // and update them to ensure consistency
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        // Update the normalized version
        updated[normalizedPhone] = 0;

        // Also check if there are any variations of this phone number
        Object.keys(prev).forEach((key) => {
          const normalizedKey = key.replace(/\s/g, "").replace(/^\+?/, "+");
          if (normalizedKey === normalizedPhone) {
            updated[key] = 0;
          }
        });

        return updated;
      });
    }
  }, [selectedContact]);

  useEffect(() => {
    if (!socket) return;

    const handleContactUpdate = () => {
      loadContacts();
    };

    const handleNewMessage = async (data) => {
      // Reload contacts and update unread count for the specific contact
      const contactsData = await whatsappAPI.getContacts();
      setContacts(contactsData);

      // Update unread count for the contact that received the message
      // Handle different socket event structures
      const phoneNumber = data.phoneNumber || data.message?.from || data.from;
      if (phoneNumber) {
        const normalizedPhone = phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
        const messages = await loadMessagesForContact(normalizedPhone);
        setUnreadCounts((prev) => ({
          ...prev,
          [normalizedPhone]: getUnreadCount(normalizedPhone, messages),
        }));
      }
    };

    const handleMessagesRead = async (data) => {
      // Update unread count to 0 when messages are marked as read
      if (data.phoneNumber) {
        const normalizedPhone = data.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
        setUnreadCounts((prev) => ({
          ...prev,
          [normalizedPhone]: 0,
        }));
      }
    };

    socket.on("contact_update", handleContactUpdate);
    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);

    return () => {
      socket.off("contact_update", handleContactUpdate);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
    };
  }, [socket, loadContacts, loadMessagesForContact]);

  const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\s/g, "");
    if (!cleaned.startsWith("+")) {
      cleaned = `+${cleaned}`;
    }
    if (cleaned.startsWith("+91") && cleaned.length === 13) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 8)} ${cleaned.substring(8)}`;
    }
    return cleaned;
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.phoneNumber.includes(searchTerm) ||
      (contact.name && contact.name.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesFilter = true;
    if (filter === "with-messages") {
      matchesFilter = contact.hasMessages === true;
    } else if (filter === "without-messages") {
      matchesFilter = contact.hasMessages === false || !contact.hasMessages;
    }

    return matchesSearch && matchesFilter;
  });

  const getInitials = (name, phone) => {
    if (name && name !== phone) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    return phone?.charAt(1)?.toUpperCase() || "?";
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "No messages";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-slate-800">
      <div className="flex items-center justify-between p-6 bg-slate-800 border-b border-slate-700">
        <Filter className="w-5 h-5 text-white cursor-pointer" />
        <div className="flex items-center gap-2 text-white">
          <span>Assigned to me</span>
          <input
            type="checkbox"
            className="w-4 h-4 cursor-pointer"
            defaultChecked
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950 border-l-4 border-red-500 m-4 rounded text-red-200">
          <p className="m-0 mb-2 font-medium">{error}</p>
          <small className="text-red-300 block">
            Note: If the API doesn't return phone numbers, you may need to check your permissions or
            add phone numbers manually.
          </small>
        </div>
      )}

      {loading && <div className="p-5 text-center text-slate-400">Loading contacts...</div>}

      <div className="flex-1 overflow-y-auto bg-slate-800">
        {filteredContacts.length === 0 && !loading ? (
          <div className="p-10 text-center text-slate-400">
            <p className="m-0 mb-2 text-base text-slate-100">No contacts found</p>
            <small className="text-sm">
              {filter !== "all"
                ? `No contacts ${filter === "with-messages" ? "with" : "without"} messages`
                : "Start a conversation or add phone numbers to see contacts here"}
            </small>
          </div>
        ) : (
          filteredContacts.map((contact, index) => {
            const initials = getInitials(contact.name, contact.phoneNumber);
            const normalizedPhone = contact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
            const unreadCount = unreadCounts[normalizedPhone] || 0;
            const assignedTo = contact.assignedTo || "Alex Rodriguez";
            const showConvertToLead = !contact.hasMessages && Math.random() > 0.5;

            const isSelected =
              selectedContact &&
              (selectedContact.phoneNumber === contact.phoneNumber ||
                (selectedContact.id && selectedContact.id === contact.id));

            return (
              <div
                key={contact.phoneNumber || index}
                className={`flex items-center px-4 py-3 border-b border-slate-700 cursor-pointer transition-colors ${
                  isSelected ? "bg-slate-700 border-l-4 border-l-blue-500" : "hover:bg-slate-700"
                }`}
                onClick={() => {
                  if (onSelectContact) {
                    onSelectContact(contact);
                  }
                  // Immediately update unread count to 0 when clicked
                  const normalizedPhone = contact.phoneNumber
                    .replace(/\s/g, "")
                    .replace(/^\+?/, "+");
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [normalizedPhone]: 0,
                  }));
                }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center font-semibold text-base mr-3 flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium text-sm text-slate-100">
                      {contact.name || formatPhoneNumber(contact.phoneNumber)}
                    </div>
                    <div className="flex items-center gap-2">
                      {contact.timestamp && (
                        <span className="text-xs text-slate-400">
                          {formatTime(contact.timestamp)}
                        </span>
                      )}
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-500 text-white rounded-full text-[11px] font-semibold">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {showConvertToLead ? (
                      <span className="text-blue-500 font-medium">Convert to Lead</span>
                    ) : (
                      <span>Assigned to {assignedTo}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Contacts;
