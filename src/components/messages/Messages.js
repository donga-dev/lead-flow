import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Instagram, Facebook } from "lucide-react";
import whatsappAPI from "../../services/whatsapp.api";
import { useSocket } from "../../contexts/SocketContext";
import { markMessagesAsRead } from "../../utils/readMessages.utils";
import Contacts from "./Contacts";
import InstagramContacts from "./InstagramContacts";
import FacebookContacts from "./FacebookContacts";
import MessagesContent from "./MessagesContent.js";

const Messages = ({ onSendMessage }) => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("whatsapp"); // "whatsapp", "instagram", or "facebook"
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramUserId, setInstagramUserId] = useState(null);
  const [instagramConversations, setInstagramConversations] = useState([]);
  const [loadingInstagramConversations, setLoadingInstagramConversations] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [facebookUserId, setFacebookUserId] = useState(null);
  const [facebookConversations, setFacebookConversations] = useState([]);
  const [loadingFacebookConversations, setLoadingFacebookConversations] = useState(false);
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

  // Check Instagram and Facebook connection status from integrations API
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
          setInstagramConnected(false);
          setFacebookConnected(false);
          return;
        }

        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";

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
          const integrations = data.integrations || {};

          // Check Instagram connection
          const instagramIntegration = integrations.instagram;
          if (
            instagramIntegration &&
            instagramIntegration.connected &&
            !instagramIntegration.tokenExpired &&
            instagramIntegration.platformUserId
          ) {
            setInstagramUserId(instagramIntegration.platformUserId);
            setInstagramConnected(true);
            // Store in localStorage for backward compatibility
            localStorage.setItem("instagram_user_id", instagramIntegration.platformUserId);
          } else {
            setInstagramConnected(false);
            setInstagramUserId(null);
          }

          // Check Facebook connection
          const facebookIntegration = integrations.facebook;
          if (
            facebookIntegration &&
            facebookIntegration.connected &&
            !facebookIntegration.tokenExpired &&
            facebookIntegration.platformUserId
          ) {
            setFacebookUserId(facebookIntegration.platformUserId);
            setFacebookConnected(true);
            // Store in localStorage for backward compatibility
            localStorage.setItem("facebook_user_id", facebookIntegration.platformUserId);
            if (facebookIntegration.pageId) {
              localStorage.setItem("facebook_page_id", facebookIntegration.pageId);
            }
          } else {
            setFacebookConnected(false);
            setFacebookUserId(null);
          }
        } else {
          setInstagramConnected(false);
          setFacebookConnected(false);
        }
      } catch (error) {
        console.error("Error checking platform connections:", error);
        setInstagramConnected(false);
        setFacebookConnected(false);
      }
    };
    checkConnections();
  }, []);

  // Load Facebook conversations
  const loadFacebookConversations = useCallback(async () => {
    if (!facebookUserId || !facebookConnected) {
      console.log("⚠️ Cannot load Facebook conversations:", {
        facebookUserId,
        facebookConnected,
      });
      setFacebookConversations([]);
      return;
    }

    console.log(`🔄 Loading Facebook conversations for userId: ${facebookUserId}`);
    setLoadingFacebookConversations(true);
    try {
      const authToken = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

      const response = await fetch(`${backendUrl}/api/facebook/conversations/${facebookUserId}`, {
        method: "GET",
        headers: headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conversations) {
          // Sort by most recent
          const sorted = data.conversations.sort((a, b) => {
            const timeA = a.updated_time ? new Date(a.updated_time).getTime() : 0;
            const timeB = b.updated_time ? new Date(b.updated_time).getTime() : 0;
            return timeB - timeA;
          });
          setFacebookConversations(sorted);
          console.log(`✅ Loaded ${sorted.length} Facebook conversations`);
        } else {
          setFacebookConversations([]);
        }
      } else {
        console.error("Failed to fetch Facebook conversations:", response.statusText);
        setFacebookConversations([]);
      }
    } catch (error) {
      console.error("❌ Error loading Facebook conversations:", error);
      setFacebookConversations([]);
    } finally {
      setLoadingFacebookConversations(false);
    }
  }, [facebookUserId, facebookConnected]);

  // Load Facebook conversations when userId is available
  useEffect(() => {
    if (facebookUserId && facebookConnected && activeTab === "facebook") {
      loadFacebookConversations();
    }
  }, [facebookUserId, facebookConnected, activeTab, loadFacebookConversations]);

  // Load Instagram conversations from stored messages API
  const loadInstagramConversations = useCallback(async () => {
    // Don't require instagramUserId or instagramConnected for stored conversations
    // Stored conversations are based on webhook messages, not API connections
    console.log(`🔄 Loading Instagram conversations from stored messages`);
    setLoadingInstagramConversations(true);
    if (instagramConnected) {
      try {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";

        // Load conversations from stored messages API
        const storedResponse = await fetch(`${backendUrl}/api/instagram/conversations/stored`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });

        let storedConversations = [];
        if (storedResponse.ok) {
          const storedData = await storedResponse.json();
          if (storedData.success && storedData.conversations) {
            storedConversations = storedData.conversations;
            console.log(
              `✅ Loaded ${storedConversations.length} conversations from stored messages`
            );
          }
        } else {
          console.warn("⚠️ Failed to load stored conversations:", storedResponse.status);
        }

        // Also try to load from Instagram API conversations if userId is available (for additional conversations)
        let apiConversations = [];
        // if (instagramUserId && instagramConnected) {
        //   try {
        //     const apiResponse = await fetch(
        //       `${backendUrl}/api/instagram/conversations/${instagramUserId}`,
        //       {
        //         method: "GET",
        //         headers: {
        //           "Content-Type": "application/json",
        //           "ngrok-skip-browser-warning": "true",
        //         },
        //       }
        //     );

        //     if (apiResponse.ok) {
        //       const apiData = await apiResponse.json();
        //       if (apiData.success && apiData.conversations) {
        //         apiConversations = apiData.conversations;
        //       }
        //     }
        //   } catch (apiError) {
        //     console.warn("⚠️ Error loading API conversations:", apiError);
        //   }
        // }

        // Merge stored conversations with API conversations
        // Deduplicate by userId to avoid showing same conversation twice
        const merged = [];
        const seenUserIds = new Set();

        // First, add stored conversations (prioritize these as they have usernames)
        storedConversations.forEach((storedConv) => {
          const userId = String(storedConv.userId);
          if (!seenUserIds.has(userId)) {
            seenUserIds.add(userId);
            merged.push(storedConv);
          }
        });

        // Then, add API conversations that don't exist in stored conversations
        apiConversations.forEach((apiConv) => {
          const participants = apiConv.participants?.data || [];
          // Find the participant that is NOT the current Instagram user
          const otherParticipant =
            participants.find((p) => p.id && String(p.id) !== String(instagramUserId)) ||
            participants[0];

          if (otherParticipant && otherParticipant.id) {
            const participantUserId = String(otherParticipant.id);
            if (!seenUserIds.has(participantUserId)) {
              seenUserIds.add(participantUserId);
              merged.push({
                ...apiConv,
                userId: participantUserId, // Add userId for consistency
              });
            }
          }
        });

        // Sort by most recent message (already sorted by API, but ensure consistency)
        merged.sort((a, b) => {
          const timeA =
            a.lastMessageTime ||
            a.timestamp ||
            (a.updated_time ? new Date(a.updated_time).getTime() : 0);
          const timeB =
            b.lastMessageTime ||
            b.timestamp ||
            (b.updated_time ? new Date(b.updated_time).getTime() : 0);
          return timeB - timeA;
        });

        setInstagramConversations(merged);
      } catch (error) {
        console.error("❌ Error loading Instagram conversations:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        setInstagramConversations([]);
      } finally {
        setLoadingInstagramConversations(false);
      }
    }
    setLoadingInstagramConversations(false);
  }, [instagramUserId, instagramConnected]);

  useEffect(() => {
    if (activeTab === "instagram") {
      // Load conversations even if not connected (to show stored messages)
      loadInstagramConversations();
    }
  }, [activeTab, loadInstagramConversations]);

  // Listen for Instagram contact updates from webhooks
  // useEffect(() => {
  //   if (!socket || activeTab !== "instagram") return;

  //   const handleInstagramContactUpdate = (data) => {
  //     // Update conversations directly from socket event without API call
  //     console.log("📨 Instagram contact update received", data);

  //     if (!data || !data.userId) {
  //       console.warn("⚠️ Invalid contact update data:", data);
  //       return;
  //     }

  //     setInstagramConversations((prevConversations) => {
  //       // Check if conversation already exists
  //       const existingIndex = prevConversations.findIndex(
  //         (conv) => conv.userId === data.userId || conv.id === data.contactId
  //       );

  //       const updatedConversation = {
  //         id: data.contactId,
  //         userId: data.userId,
  //         name: data.username || data.userId,
  //         lastMessage: data.lastMessage,
  //         timestamp: data.timestamp,
  //         updated_time: new Date(data.timestamp).toISOString(),
  //         participants: {
  //           data: [
  //             {
  //               id: data.userId,
  //               username: data.username || data.userId,
  //               name: data.username || data.userId,
  //             },
  //           ],
  //         },
  //         messages: {
  //           data: data.lastMessage
  //             ? [
  //                 {
  //                   id: `webhook_${data.userId}_${data.timestamp}`,
  //                   message: data.lastMessage,
  //                   created_time: new Date(data.timestamp).toISOString(),
  //                 },
  //               ]
  //             : [],
  //         },
  //         _fromWebhook: true,
  //       };

  //       let updated;
  //       if (existingIndex >= 0) {
  //         // Update existing conversation
  //         updated = [...prevConversations];
  //         updated[existingIndex] = {
  //           ...updated[existingIndex],
  //           // Preserve existing data but update with new message info
  //           lastMessage: data.lastMessage,
  //           timestamp: data.timestamp,
  //           updated_time: new Date(data.timestamp).toISOString(),
  //         };
  //       } else {
  //         // Add new conversation
  //         updated = [...prevConversations, updatedConversation];
  //       }

  //       // Sort by most recent message
  //       return updated.sort((a, b) => {
  //         const timeA = a.timestamp || (a.updated_time ? new Date(a.updated_time).getTime() : 0);
  //         const timeB = b.timestamp || (b.updated_time ? new Date(b.updated_time).getTime() : 0);
  //         return timeB - timeA;
  //       });
  //     });
  //   };

  //   socket.on("instagram_contact_update", handleInstagramContactUpdate);

  //   return () => {
  //     socket.off("instagram_contact_update", handleInstagramContactUpdate);
  //   };
  // }, [socket, activeTab]);

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
        const conversation = instagramConversations.find((c) => c.id === contactId);
        if (conversation) {
          setSelectedContact({
            id: conversation.id,
            name: conversation?.name || conversation.id,
            conversationId: conversation.id,
            platform: "instagram",
            userId: conversation.userId, // Use userId for stored messages API
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
    facebookConversations,
    facebookUserId,
    isInitialMount,
    navigate,
  ]);

  const handleContactSelect = (contact) => {
    if (activeTab === "whatsapp") {
      const encodedPhone = encodeURIComponent(contact.phoneNumber);
      navigate(`/messages/${encodedPhone}`);
      setSelectedContact(contact);
    } else if (activeTab === "instagram") {
      navigate(`/messages/${contact.id || contact.userId}`);

      // Check if this is a stored contact (from stored messages API)
      if (contact.source === "stored" || contact.userId) {
        // Stored contact - use userId directly for stored messages API
        setSelectedContact({
          id: contact.id,
          name: contact.name,
          username: contact.name,
          conversationId: contact.conversationId || contact.id || contact.userId,
          userId: contact.userId, // Use userId for stored messages API
          platform: "instagram",
        });
      }
    } else if (activeTab === "facebook") {
      navigate(`/messages/${contact.id}`);
      // Find the conversation to get participant information
      const conversation = facebookConversations.find((c) => c.id === contact.id);
      const participants = conversation?.participants?.data || [];
      const otherParticipant =
        participants.find((p) => p.id && String(p.id) !== String(facebookUserId)) ||
        participants[0];

      setSelectedContact({
        ...contact,
        platform: "facebook",
        userId: otherParticipant?.id,
        senderId: otherParticipant?.id,
        participants: participants,
        from: otherParticipant?.id,
        conversationId: contact.conversationId || contact.id,
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

      if (selectedContact.platform === "facebook") {
        console.log("🔄 Loading Facebook messages for contact:", {
          contact: selectedContact,
          facebookUserId: facebookUserId,
        });

        if (!facebookUserId) {
          console.error("❌ Facebook user ID is missing");
          setError("Facebook user ID is missing. Please reconnect your Facebook account.");
          setMessages([]);
          setLoading(false);
          return;
        }

        // Load from Facebook API conversations first (has all messages)
        if (!selectedContact.conversationId) {
          console.error("❌ Conversation ID is missing:", selectedContact);
          setError("Conversation ID is missing for this Facebook contact");
          setMessages([]);
          setLoading(false);
          return;
        }

        try {
          const apiUrl = `${backendUrl}/api/facebook/conversations/${facebookUserId}/${selectedContact.conversationId}/messages`;
          console.log(`🔄 Loading Facebook messages from API:`, {
            url: apiUrl
              .replace(facebookUserId, "USER_ID")
              .replace(selectedContact.conversationId, "CONV_ID"),
            conversationId: selectedContact.conversationId,
            userId: facebookUserId,
          });

          const authToken = localStorage.getItem("authToken");
          const headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          };
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const response = await fetch(apiUrl, {
            headers: headers,
          });

          console.log(`📡 API Response status: ${response.status}`);

          if (response.ok) {
            const responseData = await response.json();
            console.log("📥 API Response data:", {
              success: responseData.success,
              messagesCount: responseData.messages?.length || responseData.data?.length || 0,
              hasMessages: !!responseData.messages,
              hasData: !!responseData.data,
            });

            const messagesArray = responseData.messages || responseData.data || [];

            console.log(`✅ Loaded ${messagesArray.length} Facebook messages from API`);

            if (messagesArray.length === 0) {
              console.log("📭 No messages found in API response - showing empty state");
              setMessages([]);
              setLoading(false);
              setError(null); // Clear any previous errors
              return;
            }

            // Get page ID for determining message direction
            const pageId = localStorage.getItem("facebook_page_id");
            console.log(
              "📄 Page ID from localStorage:",
              pageId,
              "Facebook User ID:",
              facebookUserId
            );

            // Transform Facebook messages to match message format
            const transformedMessages = messagesArray.map((msg, index) => {
              console.log("🔄 Message:", msg);
              const msgFromId = msg.from?.id || msg.from || "unknown";
              // For Facebook Messenger, the page ID is the sender for outgoing messages
              // The recipient (other participant) is the sender for incoming messages
              const isOutgoing = msgFromId === pageId;

              console.log(`📨 Message ${index + 1}:`, {
                id: msg.id,
                from: msgFromId,
                pageId: pageId,
                isOutgoing: isOutgoing,
                message: msg.message?.substring(0, 50) || "no text",
              });

              return {
                id: msg.id,
                from: msgFromId,
                to: "me",
                text: msg.message ? { body: msg.message } : null,
                type: msg.type || "text",
                timestamp: msg.created_time ? new Date(msg.created_time).getTime() : Date.now(),
                direction: isOutgoing ? "outgoing" : "incoming",
                status: "received",
                platform: "facebook",
              };
            });

            const sortedMessages = transformedMessages.sort((a, b) => a.timestamp - b.timestamp);
            console.log(`✅ Transformed and sorted ${sortedMessages.length} messages from API`);
            setMessages(sortedMessages);
            setLoading(false);
            setError(null);
            return;
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Failed to load Facebook messages from API:", {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
              conversationId: selectedContact.conversationId,
              userId: facebookUserId,
            });
            setError(
              errorData.error?.message || `Failed to load Facebook messages: ${response.statusText}`
            );
            setMessages([]);
          }
        } catch (error) {
          console.error("❌ Error loading Facebook messages from API:", error);
          setError(`Failed to load Facebook messages: ${error.message}`);
          setMessages([]);
        } finally {
          setLoading(false);
        }
      } else if (selectedContact.platform === "instagram") {
        // Load Instagram messages from stored messages API
        if (selectedContact.userId) {
          try {
            const storedMessagesUrl = `${backendUrl}/api/instagram/stored-messages/${selectedContact.userId}`;
            console.log(`📡 Calling stored messages API: ${storedMessagesUrl}`);

            const storedMessagesResponse = await fetch(storedMessagesUrl, {
              headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
              },
            });

            if (storedMessagesResponse.ok) {
              const storedData = await storedMessagesResponse.json();

              if (storedData.success && storedData.messages) {
                // Normalize timestamps for all messages
                const normalizedMessages = storedData.messages.map((msg) => {
                  let normalizedTimestamp = msg.timestamp;
                  if (typeof normalizedTimestamp === "number") {
                    // If timestamp is very large (> 1e13), it's likely in microseconds, convert to milliseconds
                    // Current time in milliseconds is ~1.7e12, so > 1e13 is definitely microseconds
                    if (normalizedTimestamp > 1e13) {
                      normalizedTimestamp = normalizedTimestamp / 1000;
                    }
                    // If timestamp is small (< 1e9), it's likely in seconds, convert to milliseconds
                    else if (normalizedTimestamp < 1e9) {
                      normalizedTimestamp = normalizedTimestamp * 1000;
                    }
                    // Otherwise assume it's already in milliseconds
                  } else if (typeof normalizedTimestamp === "string") {
                    normalizedTimestamp = new Date(normalizedTimestamp).getTime();
                  } else {
                    normalizedTimestamp = Date.now();
                  }

                  return {
                    ...msg,
                    timestamp: normalizedTimestamp,
                  };
                });

                // Messages from stored API already have correct structure
                const sortedMessages = normalizedMessages.sort(
                  (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
                );
                setMessages(sortedMessages);
                setLoading(false);
                setError(null);
                return;
              } else if (storedData.success && storedData.messages?.length === 0) {
                // No messages found
                console.log("📭 No messages found in stored messages");
                setMessages([]);
                setLoading(false);
                setError(null);
                return;
              }
            } else {
              const errorData = await storedMessagesResponse.json().catch(() => ({}));
              console.warn("⚠️ Stored messages API error:", {
                status: storedMessagesResponse.status,
                error: errorData,
              });
              setError("Failed to load stored messages");
              setMessages([]);
            }
          } catch (storedError) {
            console.error("❌ Error loading stored messages:", storedError);
            setError("Failed to load Instagram messages");
            setMessages([]);
          }
        } else {
          // No userId available
          console.warn("⚠️ Cannot load Instagram messages: missing userId");
          setError("Missing contact information. Cannot load messages.");
          setMessages([]);
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
  }, [selectedContact, facebookUserId]);

  // Track the last loaded contact ID to prevent reloading on message updates
  const lastLoadedContactRef = useRef(null);

  // Get a stable identifier for the contact (extracted for dependency array)
  const contactIdentifier =
    selectedContact?.platform === "instagram"
      ? selectedContact?.userId || selectedContact?.id
      : selectedContact?.platform === "facebook"
      ? selectedContact?.conversationId || selectedContact?.id
      : selectedContact?.phoneNumber;

  useEffect(() => {
    // Only load messages if this is a different contact than last time
    if (contactIdentifier && contactIdentifier !== lastLoadedContactRef.current) {
      lastLoadedContactRef.current = contactIdentifier;
      setMessages([]);
      setLoading(true);
      setError(null);

      console.log(`🔄 Loading messages for contact:`, {
        platform: selectedContact?.platform,
        contactId: contactIdentifier,
        conversationId: selectedContact?.conversationId,
      });

      loadMessages();
    } else if (!selectedContact) {
      lastLoadedContactRef.current = null;
      setLoading(false);
      setMessages([]);
    }
  }, [contactIdentifier, loadMessages, selectedContact]);

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

    // Handle Instagram webhook messages - update in real-time
    const handleNewInstagramMessage = (data) => {
      const messageUserId = data.message?.from;
      const currentSelectedContact = selectedContact;

      // Update messages if this contact is currently selected
      if (
        currentSelectedContact?.platform === "instagram" &&
        messageUserId === currentSelectedContact.from
      ) {
        setMessages((prevMessages) => {
          const exists = prevMessages.some((msg) => msg.id === data.message.id);
          if (exists) {
            return prevMessages;
          }

          // Normalize timestamp to milliseconds for proper date formatting
          // Handle different timestamp formats: microseconds, milliseconds, or seconds
          let normalizedTimestamp = data.message.timestamp;
          if (typeof normalizedTimestamp === "number") {
            // If timestamp is very large (> 1e13), it's likely in microseconds, convert to milliseconds
            // Current time in milliseconds is ~1.7e12, so > 1e13 is definitely microseconds
            if (normalizedTimestamp > 1e13) {
              normalizedTimestamp = normalizedTimestamp / 1000;
            }
            // If timestamp is small (< 1e9), it's likely in seconds, convert to milliseconds
            else if (normalizedTimestamp < 1e9) {
              normalizedTimestamp = normalizedTimestamp * 1000;
            }
            // Otherwise assume it's already in milliseconds
          } else if (typeof normalizedTimestamp === "string") {
            normalizedTimestamp = new Date(normalizedTimestamp).getTime();
          } else {
            normalizedTimestamp = Date.now();
          }

          const normalizedMessage = {
            ...data.message,
            timestamp: normalizedTimestamp,
          };

          const updated = [...prevMessages, normalizedMessage];
          return updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      }
    };

    // Handle Instagram messages refresh - update all messages in real-time
    const handleInstagramMessagesRefresh = (data) => {
      const currentSelectedContact = selectedContact;
      const messageUserId = data.userId;

      // Update messages if this contact is currently selected
      if (
        currentSelectedContact?.platform === "instagram" &&
        messageUserId === currentSelectedContact.userId &&
        data.messages &&
        Array.isArray(data.messages)
      ) {
        // Normalize timestamps to milliseconds for proper date formatting
        // Handle different timestamp formats: microseconds, milliseconds, or seconds
        const normalizedMessages = data.messages.map((msg) => {
          let normalizedTimestamp = msg.timestamp;
          if (typeof normalizedTimestamp === "number") {
            // If timestamp is very large (> 1e13), it's likely in microseconds, convert to milliseconds
            // Current time in milliseconds is ~1.7e12, so > 1e13 is definitely microseconds
            if (normalizedTimestamp > 1e13) {
              normalizedTimestamp = normalizedTimestamp / 1000;
            }
            // If timestamp is small (< 1e9), it's likely in seconds, convert to milliseconds
            else if (normalizedTimestamp < 1e9) {
              normalizedTimestamp = normalizedTimestamp * 1000;
            }
            // Otherwise assume it's already in milliseconds
          } else if (typeof normalizedTimestamp === "string") {
            normalizedTimestamp = new Date(normalizedTimestamp).getTime();
          } else {
            normalizedTimestamp = Date.now();
          }

          return {
            ...msg,
            timestamp: normalizedTimestamp,
          };
        });

        // Set all messages from socket - real-time update
        setMessages(normalizedMessages);
        setLoading(false);
      }
    };

    const handleInstagramStatusUpdate = (data) => {
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

    // Facebook message handlers
    const handleNewFacebookMessage = (data) => {
      const messageUserId = data.message?.from;
      const contactUserId = data.userId || data.contactId;
      const currentSelectedContact = selectedContact;

      console.log("📥 Received new_facebook_message:", {
        messageUserId,
        contactUserId,
        contactId: data.contactId,
        selectedContactUserId: currentSelectedContact?.userId,
        selectedContactFrom: currentSelectedContact?.from,
        selectedContactId: currentSelectedContact?.id,
        platform: currentSelectedContact?.platform,
      });

      // Update messages if this contact is currently selected
      // Match by userId, from, contactId, or conversationId
      const isMatchingContact =
        currentSelectedContact?.platform === "facebook" &&
        (String(contactUserId) === String(currentSelectedContact.userId) ||
          String(contactUserId) === String(currentSelectedContact.from) ||
          String(contactUserId) === String(currentSelectedContact.senderId) ||
          String(data.contactId) === String(currentSelectedContact.id) ||
          String(data.contactId) === String(currentSelectedContact.conversationId) ||
          String(messageUserId) === String(currentSelectedContact.userId) ||
          String(messageUserId) === String(currentSelectedContact.from) ||
          String(messageUserId) === String(currentSelectedContact.senderId));

      if (isMatchingContact) {
        console.log("✅ Facebook message matches selected contact, adding to messages");
        setMessages((prevMessages) => {
          const exists = prevMessages.some((msg) => msg.id === data.message.id);
          if (exists) {
            console.log("⚠️ Facebook message already exists, skipping duplicate");
            return prevMessages;
          }

          // Normalize timestamp to milliseconds
          let normalizedTimestamp = data.message.timestamp;
          if (typeof normalizedTimestamp === "number") {
            if (normalizedTimestamp > 1e13) {
              normalizedTimestamp = normalizedTimestamp / 1000;
            } else if (normalizedTimestamp < 1e9) {
              normalizedTimestamp = normalizedTimestamp * 1000;
            }
          } else if (typeof normalizedTimestamp === "string") {
            normalizedTimestamp = new Date(normalizedTimestamp).getTime();
          } else {
            normalizedTimestamp = Date.now();
          }

          const newMessage = {
            ...data.message,
            timestamp: normalizedTimestamp,
          };

          console.log("➕ Adding new Facebook message:", {
            id: newMessage.id,
            from: newMessage.from,
            text: newMessage.text?.body?.substring(0, 50),
            timestamp: newMessage.timestamp,
          });

          return [...prevMessages, newMessage].sort(
            (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
          );
        });
        setLoading(false);
      } else {
        console.log("⚠️ Facebook message does not match selected contact, ignoring");
      }
    };

    const handleFacebookMessagesRefresh = (data) => {
      const currentSelectedContact = selectedContact;
      const messageUserId = data.userId || data.contactId;
      const contactId = data.contactId;

      console.log("📥 Received facebook_messages_refresh:", {
        messageUserId,
        contactId,
        selectedContactUserId: currentSelectedContact?.userId,
        selectedContactFrom: currentSelectedContact?.from,
        selectedContactId: currentSelectedContact?.id,
        messageCount: data.messages?.length,
      });

      // Update messages if this contact is currently selected
      // Match by userId, from, contactId, or conversationId
      const isMatchingContact =
        currentSelectedContact?.platform === "facebook" &&
        data.messages &&
        Array.isArray(data.messages) &&
        (String(messageUserId) === String(currentSelectedContact.userId) ||
          String(messageUserId) === String(currentSelectedContact.from) ||
          String(messageUserId) === String(currentSelectedContact.senderId) ||
          String(contactId) === String(currentSelectedContact.id) ||
          String(contactId) === String(currentSelectedContact.conversationId));

      if (isMatchingContact) {
        console.log("✅ Facebook messages refresh matches selected contact, updating messages");
        // Normalize timestamps to milliseconds
        const normalizedMessages = data.messages.map((msg) => {
          let normalizedTimestamp = msg.timestamp;
          if (typeof normalizedTimestamp === "number") {
            if (normalizedTimestamp > 1e13) {
              normalizedTimestamp = normalizedTimestamp / 1000;
            } else if (normalizedTimestamp < 1e9) {
              normalizedTimestamp = normalizedTimestamp * 1000;
            }
          } else if (typeof normalizedTimestamp === "string") {
            normalizedTimestamp = new Date(normalizedTimestamp).getTime();
          } else {
            normalizedTimestamp = Date.now();
          }

          return {
            ...msg,
            timestamp: normalizedTimestamp,
          };
        });

        // Merge with existing messages instead of replacing
        // This ensures we don't lose messages that were loaded from API
        setMessages((prevMessages) => {
          // Create a map of existing messages by ID for quick lookup
          const existingMessagesMap = new Map(prevMessages.map((msg) => [msg.id, msg]));

          // Add or update messages from webhook
          normalizedMessages.forEach((msg) => {
            existingMessagesMap.set(msg.id, msg);
          });

          // Convert back to array and sort by timestamp
          const mergedMessages = Array.from(existingMessagesMap.values()).sort(
            (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
          );

          console.log(
            `🔄 Merged Facebook messages: ${prevMessages.length} existing + ${normalizedMessages.length} new = ${mergedMessages.length} total`
          );
          return mergedMessages;
        });
        setLoading(false);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("new_instagram_message", handleNewInstagramMessage);
    socket.on("instagram_messages_refresh", handleInstagramMessagesRefresh);
    socket.on("instagram_message_status_update", handleInstagramStatusUpdate);
    socket.on("new_facebook_message", handleNewFacebookMessage);
    socket.on("facebook_messages_refresh", handleFacebookMessagesRefresh);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("new_instagram_message", handleNewInstagramMessage);
      socket.off("instagram_messages_refresh", handleInstagramMessagesRefresh);
      socket.off("instagram_message_status_update", handleInstagramStatusUpdate);
      socket.off("new_facebook_message", handleNewFacebookMessage);
      socket.off("facebook_messages_refresh", handleFacebookMessagesRefresh);
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
      // Handle Facebook messages
      if (selectedContact.platform === "facebook") {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";

        const recipientId =
          selectedContact.senderId || selectedContact.from || selectedContact.userId;

        if (!recipientId || !facebookUserId) {
          setError("Missing recipient or Facebook account information");
          setSending(false);
          return;
        }

        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(`${backendUrl}/api/facebook/send-message`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            userId: facebookUserId,
            recipientId: recipientId,
            message: textToSend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Failed to send Facebook message");
          setSending(false);
          return;
        }

        const data = await response.json();

        // Create message object for local state
        const sentMessage = {
          id: data.messageId || `facebook_${Date.now()}`,
          from: facebookUserId,
          to: recipientId,
          text: { body: textToSend },
          type: "text",
          timestamp: Date.now(),
          direction: "outgoing",
          status: "sent",
          platform: "facebook",
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

      // Handle Instagram messages
      if (selectedContact.platform === "instagram") {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL ||
          "https://unexigent-felisha-calathiform.ngrok-free.dev";

        // Get recipient ID from the contact (this is the sender ID from the conversation)
        // For Instagram, we need to get the participant ID who is not the current user
        const recipientId = selectedContact.id; // Fallback to hardcoded ID if needed

        if (!recipientId || !instagramUserId) {
          setError("Missing recipient or Instagram account information");
          setSending(false);
          return;
        }

        const authToken = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(`${backendUrl}/api/instagram/send-message`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            userId: instagramUserId,
            recipientId: recipientId,
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

        setInstagramConversations((prevConversations) => {
          // Extract message text from sentMessage object
          const lastMessageText =
            sentMessage.text?.body ||
            sentMessage.message ||
            sentMessage.text ||
            (typeof sentMessage.body === "string" ? sentMessage.body : null) ||
            null;

          // Check if conversation already exists
          const existingIndex = prevConversations.findIndex(
            (conv) =>
              conv.userId === selectedContact.userId ||
              conv.id === selectedContact.id ||
              conv.conversationId === selectedContact.conversationId
          );

          let updated;
          if (existingIndex >= 0) {
            // Update existing conversation
            updated = [...prevConversations];
            updated[existingIndex] = {
              ...updated[existingIndex],
              lastMessage: lastMessageText,
              lastMessageTime: sentMessage.timestamp,
            };
          } else {
            // Add new conversation
            updated = [
              ...prevConversations,
              {
                ...selectedContact,
                lastMessage: lastMessageText,
                lastMessageTime: sentMessage.timestamp,
              },
            ];
          }

          return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
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

  const handleRefreshInstagramMessages = () => {
    if (selectedContact && selectedContact.platform === "instagram") {
      loadMessages();
    }
  };

  const handleRefreshFacebookMessages = () => {
    if (selectedContact && selectedContact.platform === "facebook") {
      loadMessages();
    }
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
                : "text-slate-600 opacity-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Instagram
                className={`w-4 h-4 ${activeTab === "instagram" ? "text-pink-500" : ""}`}
              />
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab("facebook");
              setSelectedContact(null);
              navigate("/messages");
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "facebook"
                ? "bg-slate-700 text-white border-b-2 border-blue-500"
                : facebookConnected
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-750"
                : "text-slate-600 opacity-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Facebook className={`w-4 h-4 ${activeTab === "facebook" ? "text-blue-500" : ""}`} />
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
        ) : activeTab === "instagram" ? (
          <InstagramContacts
            conversations={instagramConversations}
            loading={loadingInstagramConversations}
            onSelectContact={handleContactSelect}
            selectedContact={selectedContact}
            instagramUserId={instagramUserId}
          />
        ) : (
          <FacebookContacts
            conversations={facebookConversations}
            loading={loadingFacebookConversations}
            onSelectContact={handleContactSelect}
            selectedContact={selectedContact}
            facebookUserId={facebookUserId}
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
            onRefreshInstagramMessages={handleRefreshInstagramMessages}
            onRefreshFacebookMessages={handleRefreshFacebookMessages}
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
