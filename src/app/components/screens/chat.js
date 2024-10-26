"use client";
import Image from "next/image";
import { SendHorizontal, LoaderCircle } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import Question from "../question";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState([
    "What criteria must students meet to avoid being debarred?",
    "If a student is debarred, will it affect their future semesters?",
    "Who should a student contact if they wish to appeal against a debarment decision?",
    "What actions can lead to a student being debarred from examinations?",
    "Is there any impact on a student's academic record beyond missing exams if they are debarred?"
  ])
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight + 20,
        behavior: 'smooth'
      });
    }
  };

useEffect(() => {
  scrollToBottom();
}, [messages]);


  const handleSend = async (text = "") => {
    if(!isSending){
    if (!text.trim()) return;
    setUserInput("");
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: "user", message: text },
    ]);
    setIsSending(true);

    try {
      const response = await axios.post("/api/response", {
        q: text,
        history: messages,
      });

      setMessages((prevMessages) => [
        ...prevMessages,
        { type: "bot", message: response.data.response.message, isError: false },
      ]);

      setIsSending(false);
    } catch (error) {
      console.error("Error fetching response:", error);
      toast.error("Sorry, something went wrong!");
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          type: "bot",
          message: error?.message || "Sorry, something went wrong!",
          isError: true,
        },
      ]);
      setIsSending(false);
      setUserInput(userInput);
    }
}else{
    toast(
        'Please wait for the current question to finish.',
        {
            icon: '⏳',
        }
    )
}
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
      if (!isSending) {
        handleSend(userInput);
      }
    }
  };

  const newChat = () => {
    setMessages([]);
    setUserInput("");
  };

  const handleQuickSend = (text) => {
    setUserInput(text);
    handleSend(text);
  };

  const userMessageStyle =
    "bg-primary text-white rounded-t-lg rounded-bl-lg w-4/5 p-3 mb-2 shadow-md";
  const botMessageStyle =
    "bg-neutral-content text-black rounded-t-lg rounded-br-lg w-4/5 p-3 mb-2 shadow-sm";

  return (
    <div className="flex flex-col h-screen bg-base-200 px-3 py-3">
      {/* Header */}
      <div className="navbar bg-base-100 rounded-xl shadow-md p-4 flex items-center justify-between sticky top-2 z-10">
        <div className="flex items-center gap-2">
          <Image src="/assets/sbtelogo.png" width={35} height={35} alt="SBTE Logo" />
          <span className="font-bold text-lg">SBTE Chatbot</span>
        </div>
        <button
          className="p-2 rounded-full hover:bg-gray-200"
          title="New Chat"
          onClick={newChat}
          disabled={isSending}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-6 w-6"
          >
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v12m6-6H6"
              fill="none"
              stroke="black"
            />
          </svg>
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <Image
            src="/assets/sbtelogo.png"
            width={150}
            height={150}
            alt="SBTE Logo"
            className="opacity-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message?.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={message?.type === "user" ? userMessageStyle : botMessageStyle}>
              {message?.type === "bot" ? (
                <ReactMarkdown className={`${message?.isError ? "text-red-500" : ""}`}>
                  {message.message}
                </ReactMarkdown>
              ) : (
                message?.message
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input and Send Button */}
      <div className="sticky bottom-2 bg-base-100 rounded-xl p-4 shadow-md flex flex-col gap-y-4">
      {/* Suggested Questions */}
      <div className="flex overflow-x-auto gap-2">
        {
            quickQuestions.map((question, index) => (
            <Question key={index} text={question} handleQuickSend={handleQuickSend} />
          ))
        }
      </div>

      {/* Input Box */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 border rounded-lg p-2 focus:outline-none"
          placeholder="Ask anything?"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          title="Send (CTRL + Enter)"
          className={`p-2 rounded-full ${isSending ? "bg-neutral-content" : "bg-primary"}`}
          disabled={isSending}
          onClick={() => handleSend(userInput)}
        >
          {isSending ? (
            <LoaderCircle className="animate-spin text-white" />
          ) : (
            <SendHorizontal className="text-white" />
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
