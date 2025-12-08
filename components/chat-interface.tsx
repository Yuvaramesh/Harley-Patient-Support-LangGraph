"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  LogOut,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentType?: string;
  emergencyNumber?: string;
  nearbyClinicLocations?: string[];
  needsLocation?: boolean;
  severity?: string;
}

interface ChatInterfaceProps {
  patientId: string;
  email: string;
  name?: string;
  contact?: string;
}

export function ChatInterface({ patientId, email }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [summaryCreated, setSummaryCreated] = useState(false);
  const [creatingAutoSummary, setCreatingAutoSummary] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [qaPairCount, setQaPairCount] = useState(0);
  const [displayedSummary, setDisplayedSummary] = useState<string>("");
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [conversationLoop, setConversationLoop] = useState(1);
  const [showEndMessage, setShowEndMessage] = useState(false);
  const [currentLoopStartIndex, setCurrentLoopStartIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
      setShowCheckpoint(false);
      setConversationLoop(1);
      setShowEndMessage(false);
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
    // This function is now only used for explicit end keywords, not for triggering summaries during conversation
    return false;
  };

  const createAutoSummary = async (
    conversationMessages: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }>,
    agentType?: string
  ) => {
    if (conversationMessages.length === 0) return;

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

      const loopSessionId = `${sessionId}_loop${conversationLoop}`;

      const response = await fetch("/api/communications/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          email,
          messages: conversationMessages,
          severity: "medium",
          communicationType,
          sessionId: loopSessionId, // Use loop-specific sessionId
          qaPairCount,
          isConversationComplete: true,
          conversationLoop, // Include loop number
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[v0] Summary API error:", data);
        if (data.data?.summary) {
          console.log("[v0] Summary created with fallback method");
          setDisplayedSummary(data.data.summary);
          alert(
            "Your conversation summary has been saved and sent to your doctor successfully."
          );
        } else {
          throw new Error(data.error || "Failed to create summary");
        }
      } else {
        console.log(
          `[v0] Summary created successfully for loop ${conversationLoop} (${data.summarySource})`
        );
        if (data.data?.summary) {
          setDisplayedSummary(data.data.summary);
        }
        alert(
          "Your conversation summary has been saved and sent to your doctor successfully."
        );
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

  const handleEndConversation = async () => {
    if (messages.length === 0) {
      alert("No conversation to end. Start chatting to create a summary.");
      return;
    }

    setShowEndMessage(true);

    const currentLoopMessages = messages.slice(currentLoopStartIndex);

    console.log("[v0] Creating summary for current loop:", {
      conversationLoop,
      totalMessages: messages.length,
      currentLoopStartIndex,
      currentLoopMessagesCount: currentLoopMessages.length,
    });

    const messagesToSummarize: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }> = currentLoopMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp:
        msg.timestamp instanceof Date
          ? msg.timestamp.toISOString()
          : String(msg.timestamp),
    }));

    setTimeout(() => {
      createAutoSummary(messagesToSummarize, "clinical");
    }, 1000);
  };

  const handleCheckpointContinue = () => {
    console.log("[v0] User chose to continue conversation");
    setShowCheckpoint(false);
    setConversationLoop(conversationLoop + 1);
    setQaPairCount(0); // Reset Q/A pair count for the new loop
    setCurrentLoopStartIndex(messages.length);
    console.log("[v0] Starting new loop:", {
      newLoop: conversationLoop + 1,
      newStartIndex: messages.length,
    });
  };

  const handleCheckpointEnd = async () => {
    console.log("[v0] User chose to end conversation at checkpoint");
    setShowCheckpoint(false);
    await handleEndConversation();
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (showCheckpoint) return;

    const currentInput = input;
    setInput("");
    setLoading(true);
    setError(null);

    const userMessage: Message = {
      role: "user",
      content: currentInput,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      console.log("[v0] Sending message with sessionId:", sessionId);
      console.log("[v0] Current Q/A pair count:", qaPairCount);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          email: email,
          query: currentInput,
          chatHistory: newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp:
              msg.timestamp instanceof Date
                ? msg.timestamp.toISOString()
                : msg.timestamp,
          })),
          sessionId: sessionId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[v0] Received response:", data);

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
        console.log("[v0] Session ID set:", data.sessionId);
      }

      let assistantMessage: Message | null = null;

      if (data.isCheckpoint) {
        console.log("[v0] Backend sent checkpoint trigger");
        // Don't add the checkpoint message to chat, just show the dialog
        setLoading(false);
        setTimeout(() => {
          setShowCheckpoint(true);
        }, 500);
        return;
      }

      if (data.agentType === "emergency") {
        const content =
          data.response.message || data.response.answer || "Emergency response";
        assistantMessage = {
          role: "assistant",
          content,
          timestamp: new Date(),
          agentType: "emergency",
          emergencyNumber: data.response.emergencyNumber,
          nearbyClinicLocations: data.response.nearbyClinicLocations,
          needsLocation: data.response.needsLocation,
        };
      } else {
        const content =
          data.response?.answer ||
          data.response?.message ||
          "No response available";
        assistantMessage = {
          role: "assistant",
          content,
          timestamp: new Date(),
          agentType: data.agentType,
          severity: data.severity,
        };
      }

      if (assistantMessage) {
        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);

        if (data.agentType === "clinical") {
          const newQAPairCount = qaPairCount + 1;
          setQaPairCount(newQAPairCount);

          console.log("[v0] Q/A pair count updated:", {
            previousCount: qaPairCount,
            newCount: newQAPairCount,
            conversationLoop,
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Chat error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send message"
      );
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
                Session: {sessionId.substring(0, 12)}... | Loop:{" "}
                {conversationLoop} | Q/A Pairs: {qaPairCount}/7
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && !showEndMessage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEndConversation}
                className="flex items-center gap-2 bg-transparent hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="w-4 h-4" />
                End Conversation
              </Button>
            )}
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
                <li>• General health FAQs</li>
                <li>• Emergency situation assessment</li>
                <li>• Personal account information</li>
                <li>• Conversation history summaries</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                After 7 Q/A exchanges per loop, you'll be asked if you need more
                information. A summary will be created and sent to your
                Communications tab when you end the conversation.
              </p>
            </div>
          </div>
        )}

        {showCheckpoint && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Conversation Checkpoint
                </p>
                <p className="text-sm text-blue-800 mt-2">
                  I have enough information from the {qaPairCount} questions
                  we've discussed. Would you like to:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 mt-2 ml-2">
                  <li>
                    • <strong>Continue:</strong> Provide additional information
                    (7 more questions)
                  </li>
                  <li>
                    • <strong>End Conversation:</strong> I'll create a summary
                    and send it to your doctor
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleCheckpointContinue}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue (7 more questions)
              </Button>
              <Button
                onClick={handleCheckpointEnd}
                variant="outline"
                className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-100 bg-transparent"
              >
                End Conversation
              </Button>
            </div>
          </div>
        )}

        {showEndMessage && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Thank You!
                </p>
                <p className="text-sm text-green-800 mt-1">
                  Thanks for your information. I've created a summary and sent
                  it to your doctor. You can view it in the Communications tab.
                </p>
              </div>
            </div>
          </div>
        )}

        {displayedSummary && (
          <div className="bg-white border border-gray-300 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Conversation Summary
            </h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {displayedSummary}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
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

        {error && (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            showCheckpoint
              ? "Please select an option above..."
              : "Type your health question..."
          }
          onKeyPress={(e) =>
            e.key === "Enter" && !showCheckpoint && handleSendMessage()
          }
          disabled={loading || showCheckpoint || showEndMessage}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={
            loading || !input.trim() || showCheckpoint || showEndMessage
          }
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
