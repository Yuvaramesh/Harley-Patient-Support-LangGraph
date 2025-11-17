"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  patientId: string;
  email: string;
}

export function ChatInterface({ patientId, email }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          email,
          query: input,
          chatHistory: messages,
        }),
      });

      const data = await response.json();

      if (data.success) {
        let assistantContent = "";

        if (data.agentType === "emergency") {
          assistantContent = `🚨 EMERGENCY DETECTED\n\n${data.response.message}\n\nEmergency Number: ${data.response.emergencyNumber}`;
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

  return (
    <Card className="w-full h-full max-w-2xl mx-auto flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-2xl">Harley Health Portal</CardTitle>
        <p className="text-sm text-gray-500 mt-2">
          Chat with our healthcare assistant
        </p>
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
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                Note: For emergencies, please call 911 immediately.
              </p>
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
