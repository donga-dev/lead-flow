import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Instagram } from "lucide-react";
import whatsappAPI from "../../services/whatsapp.api";
import { useSocket } from "../../contexts/SocketContext";
import { markMessagesAsRead } from "../../utils/readMessages.utils";
import Contacts from "./Contacts";
import InstagramContacts from "./InstagramContacts";
import MessagesContent from "./MessagesContent.js";

const Messages = ({ onSendMessage }) => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("whatsapp"); // "whatsapp" or "instagram"
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramUserId, setInstagramUserId] = useState(null);
  const [instagramConversations, setInstagramConversations] = useState([]);
  const [loadingInstagramConversations, setLoadingInstagramConversations] = useState(false);
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [templateName, setTemplateName] = useState("hello_world");
  const [sending, setSending] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const messagesEndRef = useRef(null);

  // Check Instagram connection status
  useEffect(() => {
    const checkInstagramConnection = async () => {
      const userId = localStorage.getItem("instagram_user_id");
      if (userId) {
        setInstagramUserId(userId);
        try {
          const backendUrl =
            process.env.REACT_APP_BACKEND_URL ||
            "https://unexigent-felisha-calathiform.ngrok-free.dev";
          const response = await fetch(`${backendUrl}/api/instagram/tokens/page/${userId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && !data.isExpired) {
              setInstagramConnected(true);
            } else {
              setInstagramConnected(false);
            }
          } else {
            setInstagramConnected(false);
          }
        } catch (error) {
          console.error("Error checking Instagram connection:", error);
          setInstagramConnected(false);
        }
      } else {
        setInstagramConnected(false);
      }
    };
    checkInstagramConnection();
  }, []);

  // Load Instagram conversations
  const loadInstagramConversations = useCallback(async () => {
    if (!instagramUserId || !instagramConnected) {
      setInstagramConversations([]);
      return;
    }

    setLoadingInstagramConversations(true);
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";
      const response = await fetch(`${backendUrl}/api/instagram/conversations/${instagramUserId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conversations) {
          setInstagramConversations(data.conversations);
        }
      }
    } catch (error) {
      console.error("Error loading Instagram conversations:", error);
    } finally {
      setLoadingInstagramConversations(false);
    }
  }, [instagramUserId, instagramConnected]);

  useEffect(() => {
    if (activeTab === "instagram" && instagramConnected) {
      loadInstagramConversations();
    }
  }, [activeTab, instagramConnected, loadInstagramConversations]);

  // Sync selected contact with URL and contacts list
  // On page refresh, clear selected contact
  useEffect(() => {
    // On initial mount (page refresh), clear selected contact and navigate to base messages route
    if (isInitialMount) {
      setIsInitialMount(false);
      setSelectedContact(null);
      if (contactId) {
        navigate("/messages");
      }
      return;
    }

    // Only sync contact if contactId exists and it's not the initial mount
    if (contactId) {
      if (activeTab === "whatsapp") {
        const decodedPhone = decodeURIComponent(contactId);
        // Find contact in the contacts list
        const contact = contacts.find(
          (c) =>
            c.phoneNumber === decodedPhone ||
            c.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+") ===
              decodedPhone.replace(/\s/g, "").replace(/^\+?/, "+")
        );
        if (contact) {
          setSelectedContact(contact);
        } else {
          // If contact not found in list, create a minimal contact object
          setSelectedContact({ phoneNumber: decodedPhone });
        }
      } else if (activeTab === "instagram") {
        // Find Instagram conversation
        const conversation = instagramConversations.find((c) => c.id === contactId);
        if (conversation) {
          const participants = conversation.participants?.data || [];
          const otherParticipant =
            participants.find((p) => p.id && String(p.id) !== String(instagramUserId)) ||
            participants[0];

          setSelectedContact({
            id: conversation.id,
            name: otherParticipant?.username || otherParticipant?.name || conversation.id,
            conversationId: conversation.id,
            platform: "instagram",
            senderId: otherParticipant?.id,
            participants: participants,
            from: otherParticipant?.id,
          });
        }
      }
    } else {
      setSelectedContact(null);
    }
  }, [
    contactId,
    contacts,
    activeTab,
    instagramConversations,
    instagramUserId,
    isInitialMount,
    navigate,
  ]);

  const handleContactSelect = (contact) => {
    if (activeTab === "whatsapp") {
      const encodedPhone = encodeURIComponent(contact.phoneNumber);
      navigate(`/messages/${encodedPhone}`);
      setSelectedContact(contact);
    } else if (activeTab === "instagram") {
      navigate(`/messages/${contact.id}`);
      // Find the conversation to get participant information
      const conversation = instagramConversations.find((c) => c.id === contact.id);
      const participants = conversation?.participants?.data || [];
      const otherParticipant =
        participants.find((p) => p.id && String(p.id) !== String(instagramUserId)) ||
        participants[0];

      setSelectedContact({
        ...contact,
        platform: "instagram",
        senderId: otherParticipant?.id,
        participants: participants,
        from: otherParticipant?.id,
      });
    }
  };

  const loadMessages = useCallback(async () => {
    if (!selectedContact) {
      setMessages([]);
      return;
    }

    setMessages([]);
    setLoading(true);
    setError(null);

    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

      if (selectedContact.platform === "instagram") {
        // Load Instagram messages
        if (selectedContact.conversationId && instagramUserId) {
          try {
            const response = await fetch(
              `${backendUrl}/api/instagram/conversations/${instagramUserId}/${selectedContact.conversationId}/messages`,
              {
                headers: {
                  "Content-Type": "application/json",
                  "ngrok-skip-browser-warning": "true",
                },
              }
            );

            if (response.ok) {
              const responseData = await response.json();

              // Handle Instagram API response format: {data: [...]} or {success: true, data: [...]} or {success: true, messages: [...]}
              const messagesArray = responseData.data || responseData.messages || [];

              // Transform Instagram messages to match WhatsApp message format
              const transformedMessages = messagesArray.map((msg) => ({
                id: msg.id,
                from: msg.from?.id || "unknown",
                to: "me",
                text: msg.message ? { body: msg.message } : null,
                type: msg.type || "text",
                timestamp: msg.created_time ? new Date(msg.created_time).getTime() : Date.now(),
                direction: msg.from?.id === instagramUserId ? "outgoing" : "incoming",
                status: "received",
                username: msg.from?.username, // Store username for display
              }));

              const sortedMessages = transformedMessages.sort((a, b) => a.timestamp - b.timestamp);

              setMessages(sortedMessages);
              return;
            }
          } catch (error) {
            console.error("Error loading Instagram messages:", error);
            setError("Failed to load Instagram messages");
          }
        }
      } else {
        const token = localStorage.getItem("whatsapp_token");
        if (!token) {
          return;
        }
        // Load WhatsApp messages
        const normalizedPhone = selectedContact.phoneNumber
          ?.replace(/\s/g, "")
          ?.replace(/^\+?/, "+");

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
              const sortedMessages = data.messages.sort((a, b) => a.timestamp - b.timestamp);
              const uniqueMessages = sortedMessages.filter(
                (value, index, self) =>
                  index === self.findIndex((message) => message.id === value.id)
              );
              setMessages(uniqueMessages);
              return;
            }
          }
        } catch (backendError) {
          console.warn("Backend not available, using localStorage:", backendError);
        }

        const storedMessages = localStorage.getItem(`whatsapp_messages_${normalizedPhone}`);
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          const sortedMessages = parsedMessages.sort((a, b) => a.timestamp - b.timestamp);
          setMessages(sortedMessages);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedContact, instagramUserId]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setError(null);

    if (selectedContact) {
      const timer = setTimeout(() => {
        loadMessages();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [selectedContact, loadMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark messages as read when contact is selected and messages are loaded
  useEffect(() => {
    if (selectedContact && messages.length > 0 && !loading) {
      // Only mark as read for WhatsApp contacts (Instagram doesn't use phone numbers)
      if (selectedContact.platform !== "instagram" && selectedContact.phoneNumber) {
        const normalizedPhone = selectedContact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
        markMessagesAsRead(normalizedPhone, messages);

        // Emit event to update unread counts in Contacts component
        if (socket) {
          socket.emit("messages_read", { phoneNumber: normalizedPhone });
        }
      }
    }
  }, [selectedContact, messages, loading, socket]);

  // Template loading is commented out for now
  // useEffect(() => {
  //   const loadTemplates = async () => {
  //     setLoadingTemplates(true);
  //     try {
  //       const backendUrl =
  //         process.env.REACT_APP_BACKEND_URL ||
  //         "https://unexigent-felisha-calathiform.ngrok-free.dev";
  //       const response = await fetch(`${backendUrl}/api/templates`, {
  //         method: "GET",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${API_CONFIG.ACCESS_TOKEN}`,
  //           "ngrok-skip-browser-warning": "true",
  //         },
  //       });

  //       if (response.ok) {
  //         const data = await response.json();
  //         if (data.success && data.templates) {
  //           setTemplates(data.templates);
  //           if (data.templates.length > 0 && !templateName) {
  //             setTemplateName(data.templates[0].name);
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Error loading templates:", error);
  //     } finally {
  //       setLoadingTemplates(false);
  //     }
  //   };
  //   loadTemplates();
  // }, [templateName]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      const currentSelectedContact = selectedContact;
      if (!currentSelectedContact) return;

      let normalizedFrom = (data.phoneNumber || "").replace(/\s/g, "").replace(/[-\s()]/g, "");
      if (!normalizedFrom.startsWith("+")) {
        normalizedFrom = `+${normalizedFrom}`;
      }

      let normalizedPhone = currentSelectedContact.phoneNumber
        ?.replace(/\s/g, "")
        ?.replace(/[-\s()]/g, "");
      if (!normalizedPhone?.startsWith("+")) {
        normalizedPhone = `+${normalizedPhone}`;
      }

      if (normalizedFrom === normalizedPhone) {
        setMessages((prevMessages) => {
          if (
            !selectedContact ||
            selectedContact.phoneNumber !== currentSelectedContact.phoneNumber
          ) {
            return prevMessages;
          }

          const exists = prevMessages.some((msg) => msg.id === data.message.id);
          if (exists) {
            return prevMessages;
          }

          const updated = [...prevMessages, data.message];
          return updated.sort((a, b) => a.timestamp - b.timestamp);
        });

        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";
        fetch(`${backendUrl}/api/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ phoneNumber: normalizedFrom, message: data.message }),
        }).catch((err) => console.warn("Failed to save message to backend:", err));

        try {
          const storedMessages = localStorage.getItem(`whatsapp_messages_${normalizedFrom}`);
          const storedMessagesList = storedMessages ? JSON.parse(storedMessages) : [];
          const exists = storedMessagesList.some((msg) => msg.id === data.message.id);
          if (!exists) {
            storedMessagesList.push(data.message);
            if (storedMessagesList.length > 1000) {
              storedMessagesList.splice(0, storedMessagesList.length - 1000);
            }
            localStorage.setItem(
              `whatsapp_messages_${normalizedFrom}`,
              JSON.stringify(storedMessagesList)
            );
          }
        } catch (err) {
          console.warn("Failed to save message to localStorage:", err);
        }
      }
    };

    const handleStatusUpdate = (data) => {
      setMessages((prevMessages) => {
        const messageIndex = prevMessages.findIndex((msg) => msg.id === data.messageId);
        if (messageIndex === -1) return prevMessages;

        let newStatus = prevMessages[messageIndex].status;
        if (data.status === "sent") newStatus = "sent";
        else if (data.status === "delivered") newStatus = "delivered";
        else if (data.status === "read") newStatus = "read";
        else if (data.status === "failed") newStatus = "failed";

        const statusOrder = { sent: 1, delivered: 2, read: 3, failed: 0 };
        const currentOrder = statusOrder[prevMessages[messageIndex].status] || 0;
        const newOrder = statusOrder[newStatus] || 0;

        if (newOrder > currentOrder || data.status === "failed") {
          const updated = [...prevMessages];
          updated[messageIndex] = { ...updated[messageIndex], status: newStatus };
          return updated;
        }
        return prevMessages;
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
    };
  }, [socket, selectedContact]);

  const saveMessage = async (message) => {
    if (!selectedContact) return;

    const normalizedPhone = selectedContact.phoneNumber.replace(/\s/g, "").replace(/^\+?/, "+");
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

    try {
      await fetch(`${backendUrl}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ phoneNumber: normalizedPhone, message }),
      });
    } catch (backendError) {
      console.warn("Backend not available, saving to localStorage:", backendError);
    }

    const storedMessages = localStorage.getItem(`whatsapp_messages_${normalizedPhone}`);
    const storedMessagesList = storedMessages ? JSON.parse(storedMessages) : [];
    const exists = storedMessagesList.some((msg) => msg.id === message.id);
    if (!exists) {
      storedMessagesList.push(message);
    }

    if (storedMessagesList.length > 1000) {
      storedMessagesList.splice(0, storedMessagesList.length - 1000);
    }

    localStorage.setItem(
      `whatsapp_messages_${normalizedPhone}`,
      JSON.stringify(storedMessagesList)
    );

    setMessages((prevMessages) => {
      const exists = prevMessages.some((msg) => msg.id === message.id);
      if (exists) return prevMessages;
      const updated = [...prevMessages, message];
      return updated.sort((a, b) => a.timestamp - b.timestamp);
    });
  };

  const handleSend = async (messageText = null) => {
    if (!selectedContact) return;

    const textToSend = messageText || newMessage;

    if (
      messageType === "text" &&
      (!textToSend || (typeof textToSend === "string" && !textToSend.trim()))
    ) {
      setError("Please enter a message");
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Handle Instagram messages
      if (selectedContact.platform === "instagram") {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";

        // Get recipient ID from the contact (this is the sender ID from the conversation)
        // For Instagram, we need to get the participant ID who is not the current user
        const recipientId = selectedContact.senderId || selectedContact.from || "24609143302098989"; // Fallback to hardcoded ID if needed

        if (!recipientId || !instagramUserId) {
          setError("Missing recipient or Instagram account information");
          setSending(false);
          return;
        }

        const response = await fetch(`${backendUrl}/api/instagram/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            userId: instagramUserId,
            recipientId: "24609143302098989",
            message: textToSend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Failed to send Instagram message");
          setSending(false);
          return;
        }

        const data = await response.json();

        // Create message object for local state
        const sentMessage = {
          id: data.messageId || `instagram_${Date.now()}`,
          from: instagramUserId,
          to: recipientId,
          text: { body: textToSend },
          type: "text",
          timestamp: Date.now(),
          direction: "outgoing",
          status: "sent",
          platform: "instagram",
          conversationId: selectedContact.conversationId,
        };

        // Add message to local state
        setMessages((prevMessages) => {
          const updated = [...prevMessages, sentMessage];
          return updated.sort((a, b) => a.timestamp - b.timestamp);
        });

        setNewMessage("");
        setSending(false);

        if (onSendMessage) {
          onSendMessage(sentMessage);
        }
        return;
      }

      // Handle WhatsApp messages
      let response;
      const recipient = selectedContact.phoneNumber;

      if (messageType === "template") {
        response = await whatsappAPI.sendTemplateMessage(recipient, templateName);
      } else {
        response = await whatsappAPI.sendMessage(recipient, textToSend);
      }

      const sentMessage = {
        id: response.messages?.[0]?.id || `msg_${Date.now()}`,
        from: "me",
        to: recipient,
        text: messageType === "text" ? { body: textToSend } : null,
        type: messageType,
        template: messageType === "template" ? { name: templateName } : null,
        timestamp: Date.now(),
        direction: "outgoing",
        status: "sent",
      };

      saveMessage(sentMessage);
      setNewMessage("");

      if (onSendMessage) {
        onSendMessage(sentMessage);
      }
    } catch (err) {
      setError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSuggestedReply = (replyText) => {
    handleSend(replyText);
  };

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

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return "Today";
    }

    // Check if it's yesterday
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    }

    // Format as "DD-MM-YYYY" or "DD MMM YYYY"
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

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

  const getInitials = (name, phone) => {
    if (name && name !== phone) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    if (phone) {
      // Get first two characters from phone number (skip +)
      const cleaned = phone.replace(/\s/g, "").replace(/^\+/, "");
      if (cleaned.length >= 2) {
        return cleaned.substring(0, 2).toUpperCase();
      }
      return cleaned.charAt(0).toUpperCase() || "?";
    }
    return "?";
  };

  const getMessageAvatar = (message) => {
    if (message.direction === "outgoing") {
      // For outgoing messages, use current user initials (e.g., "AU" or "Me")
      return "AU"; // You can change this to get from user context
    } else {
      // For incoming messages, use contact initials
      return getInitials(selectedContact?.name, selectedContact?.phoneNumber);
    }
  };

  return (
    <div className="flex h-full w-full md:p-6 p-0 bg-[#111827]">
      <div className="w-[300px] min-w-[300px] max-w-[500px] border-r border-slate-700 flex flex-col overflow-hidden bg-slate-800">
        {/* Platform Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800">
          <button
            onClick={() => {
              setActiveTab("whatsapp");
              setSelectedContact(null);
              navigate("/messages");
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "whatsapp"
                ? "bg-slate-700 text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-750"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.77.966-.944 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                  fill={activeTab === "whatsapp" ? "#25D366" : "#9CA3AF"}
                />
              </svg>
              WhatsApp
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab("instagram");
              setSelectedContact(null);
              navigate("/messages");
            }}
            // disabled={!instagramConnected}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "instagram"
                ? "bg-slate-700 text-white border-b-2 border-pink-500"
                : instagramConnected
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-750"
                : "text-slate-600 cursor-not-allowed opacity-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Instagram
                className={`w-4 h-4 ${activeTab === "instagram" ? "text-pink-500" : ""}`}
              />
              Instagram
            </div>
          </button>
        </div>

        {/* Contacts List */}
        {activeTab === "whatsapp" ? (
          <Contacts
            onSelectContact={handleContactSelect}
            selectedContact={selectedContact}
            setSelectedContact={setSelectedContact}
            onContactsLoaded={setContacts}
          />
        ) : (
          <InstagramContacts
            conversations={instagramConversations}
            loading={loadingInstagramConversations}
            onSelectContact={handleContactSelect}
            selectedContact={selectedContact}
          />
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        {selectedContact ? (
          <MessagesContent
            selectedContact={selectedContact}
            onSendMessage={onSendMessage}
            messages={messages}
            setMessages={setMessages}
            loading={loading}
            error={error}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            messageType={messageType}
            setMessageType={setMessageType}
            templateName={templateName}
            setTemplateName={setTemplateName}
            sending={sending}
            setSending={setSending}
            messagesEndRef={messagesEndRef}
            socket={socket}
            formatPhoneNumber={formatPhoneNumber}
            formatTime={formatTime}
            formatDate={formatDate}
            getMessageAvatar={getMessageAvatar}
            handleSend={handleSend}
            handleSuggestedReply={handleSuggestedReply}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <div className="text-center text-slate-400 p-10">
              <div className="w-[120px] h-[120px] mx-auto mb-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full flex items-center justify-center">
                <MessageSquare className="w-20 h-20 text-purple-500 opacity-80" />
              </div>
              <h3 className="text-2xl font-semibold m-0 mb-2 text-slate-100">
                Welcome to LeadFlow Chat
              </h3>
              <p className="text-sm m-0">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
