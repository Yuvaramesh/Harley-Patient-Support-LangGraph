"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, RefreshCw, CheckCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  patientId: string;
  email: string;
  name?: string;
  contact?: string;
}

export function ChatInterface({
  patientId,
  email,
  name,
  contact,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [summaryCreated, setSummaryCreated] = useState(false);
  const [creatingAutoSummary, setCreatingAutoSummary] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [qaPairCount, setQaPairCount] = useState(0);
  const [displayedSummary, setDisplayedSummary] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `chat_messages_${patientId}`;
  const sessionStorageKey = `session_id_${patientId}`;

  useEffect(() => {
    const loadMessages = () => {
      try {
        const stored = sessionStorage.getItem(storageKey);
        let currentSessionId = sessionStorage.getItem(sessionStorageKey);
        if (!currentSessionId) {
          currentSessionId = `session_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          sessionStorage.setItem(sessionStorageKey, currentSessionId);
        }
        setSessionId(currentSessionId);

        if (stored) {
          const parsed = JSON.parse(stored);
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(messagesWithDates);
          setShowWelcome(messagesWithDates.length === 0);
          const userMessages = messagesWithDates.filter(
            (m: Message) => m.role === "user"
          ).length;
          setQaPairCount(userMessages);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();
  }, [patientId, storageKey, sessionStorageKey]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (error) {
        console.error("Error saving messages:", error);
      }
    }
  }, [messages, storageKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
      setShowWelcome(true);
      setSummaryCreated(false);
      setDisplayedSummary("");
      setQaPairCount(0);
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(sessionStorageKey);
      const newSessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      sessionStorage.setItem(sessionStorageKey, newSessionId);
      setSessionId(newSessionId);
    }
  };

  const shouldAutoCreateSummary = (assistantMessage: string): boolean => {
    const completionKeywords = [
      "sent it to your doctor",
      "sent to your doctor",
      "i have sent",
      "emergency alert sent",
      "emergency services",
      "is there anything else",
      "anything else i can help",
      "thank you for using",
    ];

    const lowerMessage = assistantMessage.toLowerCase();
    const matchCount = completionKeywords.filter((keyword) =>
      lowerMessage.includes(keyword)
    ).length;

    return matchCount >= 1;
  };

  const createAutoSummary = async (
    conversationMessages: Message[],
    agentType?: string
  ) => {
    if (conversationMessages.length === 0) return;

    if (summaryCreated) {
      console.log(
        "[v0] Summary already created for this conversation, skipping duplicate"
      );
      return;
    }

    setCreatingAutoSummary(true);
    try {
      const communicationType =
        agentType === "emergency"
          ? "emergency"
          : agentType === "personal"
          ? "personal"
          : agentType === "generic_faq"
          ? "faq"
          : "clinical";

      const response = await fetch("/api/communications/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          email,
          messages: conversationMessages,
          severity: "medium",
          communicationType,
          sessionId,
          qaPairCount,
          isConversationComplete: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[v0] Summary API error:", data);
        if (data.data?.summary) {
          console.log("[v0] Summary created with fallback method");
          setSummaryCreated(true);
          if (communicationType === "emergency") {
            alert(
              "Emergency summary has been sent to your doctor. Emergency services have been notified."
            );
          } else {
            alert("Your conversation summary has been saved successfully.");
          }
        } else {
          throw new Error(data.error || "Failed to create summary");
        }
      } else {
        setSummaryCreated(true);
        console.log(
          `[v0] Summary created successfully (${data.summarySource})`
        );
        if (communicationType === "emergency") {
          alert(
            "Emergency summary has been sent to your doctor. Emergency services have been notified."
          );
        } else {
          alert("Your conversation summary has been saved successfully.");
        }
      }
    } catch (error) {
      console.error("[v0] Error creating auto-summary:", error);
      alert(
        "Summary creation encountered an issue, but your conversation was saved."
      );
    } finally {
      setCreatingAutoSummary(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowWelcome(false);
    setLoading(true);

    try {
      const messagesToSend = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));

      console.log("[Chat] Sending message with history:", {
        patientId,
        email,
        query: input,
        sessionId,
        chatHistoryLength: messagesToSend.length,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          email,
          query: input,
          chatHistory: messagesToSend,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[Chat] API returned error status:", response.status);
        console.error("[Chat] Error response:", data);
        throw new Error(data.error || "Failed to get response");
      }

      if (data.success) {
        let assistantContent = "";

        if (data.agentType === "emergency") {
          assistantContent = `🚨 EMERGENCY DETECTED\n\n${data.response.message}\n\nEmergency Number: ${data.response.emergencyNumber}`;

          if (
            data.response.nearbyClinicLocations &&
            data.response.nearbyClinicLocations.length > 0
          ) {
            assistantContent += "\n\nNearby Emergency Facilities:\n";
            data.response.nearbyClinicLocations
              .slice(0, 3)
              .forEach((location: string) => {
                assistantContent += `\n${location}`;
              });
          }
        } else if (
          data.agentType === "personal" &&
          data.response.personalData
        ) {
          assistantContent = data.response.answer || "";

          const pd = data.response.personalData;
          if (pd) {
            assistantContent = `Here is your personal information:\n\n`;
            if (pd.email) assistantContent += `📧 Email: ${pd.email}\n`;
            if (pd.name) assistantContent += `👤 Name: ${pd.name}\n`;
            if (pd.contact) assistantContent += `📞 Contact: ${pd.contact}\n`;
            if (pd.age) assistantContent += `📅 Age: ${pd.age} years\n`;

            if (pd.medicalHistory && pd.medicalHistory.length > 0) {
              assistantContent += `\n🏥 Medical History:\n`;
              pd.medicalHistory.forEach((item: string, index: number) => {
                assistantContent += `   ${index + 1}. ${item}\n`;
              });
            }

            assistantContent += `\nIs there anything else you'd like to know about your account?`;
          }
        } else if (data.response.answer) {
          assistantContent = data.response.answer;
        } else if (data.response.message) {
          assistantContent = data.response.message;
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        const newQAPairCount = qaPairCount + 1;
        setQaPairCount(newQAPairCount);

        if (data.summary && data.agentType === "clinical") {
          setDisplayedSummary(data.summary);
          setSummaryCreated(true);
        }

        if (
          data.agentType === "clinical" &&
          newQAPairCount >= 5 &&
          !summaryCreated
        ) {
          console.log("[v0] 5 Q/A pairs reached, creating summary...");
          setTimeout(() => {
            const updatedMessages = [
              ...messages,
              userMessage,
              assistantMessage,
            ];
            createAutoSummary(updatedMessages, data.agentType);
          }, 1000);
        } else if (
          shouldAutoCreateSummary(assistantContent) &&
          !summaryCreated
        ) {
          console.log("[v0] Completion keywords detected, creating summary...");
          setTimeout(() => {
            const updatedMessages = [
              ...messages,
              userMessage,
              assistantMessage,
            ];
            createAutoSummary(updatedMessages, data.agentType);
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const displayMessages = messages;

  return (
    <Card className="w-full h-full max-w-2xl mx-auto flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Harley Health Portal</CardTitle>
            <p className="text-sm text-gray-500 mt-2">
              Chat with our healthcare assistant
            </p>
            {sessionId && (
              <p className="text-xs text-gray-400 mt-1">
                Session: {sessionId.substring(0, 12)}... | Q/A Pairs:{" "}
                {qaPairCount}/5
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Chat
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
        {showWelcome && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 text-sm">🏥</span>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 flex-1">
              <p className="text-sm font-semibold mb-2">Welcome to Harley</p>
              <p className="text-sm text-gray-700 mb-2">
                I'm your healthcare assistant. I can help with:
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Clinical health questions</li>
                <li>• Genetic and hereditary health information</li>
                <li>• General health FAQs</li>
                <li>• Emergency situation assessment</li>
                <li>• Personal account information</li>
                <li>• Conversation history summaries</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                After 5 Q/A exchanges, a summary will automatically be created
                and sent to your Communications tab.
              </p>
            </div>
          </div>
        )}

        {messages.length > 0 && !summaryCreated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">
              <span className="text-sm font-semibold">{qaPairCount}/5</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                Conversation Progress
              </p>
              <p className="text-sm text-blue-700">
                {qaPairCount < 5
                  ? `${
                      5 - qaPairCount
                    } more Q/A exchanges until automatic summary is created.`
                  : "Summary is being created..."}
              </p>
            </div>
          </div>
        )}

        {displayedSummary && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                Conversation Summary
              </p>
              <p className="text-sm text-green-700 mt-2 whitespace-pre-wrap">
                {displayedSummary}
              </p>
              <p className="text-xs text-green-600 mt-2">
                This summary has been sent to your doctor's dashboard.
              </p>
            </div>
          </div>
        )}

        {summaryCreated && !displayedSummary && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Summary Created
              </p>
              <p className="text-sm text-green-700">
                Your conversation summary has been automatically saved and sent
                to the Communications tab with timestamp.
              </p>
            </div>
          </div>
        )}

        {creatingAutoSummary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-blue-800">
                Creating Summary
              </p>
              <p className="text-sm text-blue-700">
                Your conversation summary is being created and sent to both
                dashboards...
              </p>
            </div>
          </div>
        )}

        {displayMessages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 ${
              message.role === "user" ? "justify-end" : ""
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 text-sm">🏥</span>
              </div>
            )}
            <div
              className={`max-w-xs lg:max-w-md rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span
                className={`text-xs mt-1 block ${
                  message.role === "user" ? "text-blue-100" : "text-gray-500"
                }`}
              >
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            {message.role === "user" && (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-700 text-sm">👤</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing your query...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your health question..."
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </Card>
  );
}
