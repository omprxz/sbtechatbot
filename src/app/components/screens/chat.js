"use client";
import Image from "next/image";
import { SendHorizontal, LoaderCircle } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";
import Question from "../suggestedQuestions";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chat({ headers }) {
  const [ip, setIp] = useState("");
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingDots, setLoadingDots] = useState("•");
  const [quickQuestions, setQuickQuestions] = useState([]);
  const [isFirst , setIsFirst] = useState(true);

  const inputRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (userInput.length >= 3) {
        setDebouncedValue(userInput);
      }else if(userInput.length === 0){
        getSuggestedQuestions()
      }
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [userInput]);

  useEffect(() => {
    if (debouncedValue) {
      getQuickInputQuestions(debouncedValue);
    }
  }, [debouncedValue]);

  const getSuggestedQuestions = () => {
    axios
      .get("/api/question/suggest/5")
      .then((response) => {
        setQuickQuestions(
          response.data.questions.map((question) => question.question)
        );
      })
      .catch((error) => {
        console.error("Error fetching quick questions:", error);
        toast.error(
          "Sorry, something went wrong while fetching suggested questions!"
        );
      });
  };

  useEffect(() => {
    axios
      .get("/api/ip")
      .then((response) => {
        setIp(response.data.ip);
      })
      .catch((error) => {
        console.error("Error fetching IP:", error);
      });
  }, []);

  useEffect(() => {
    getSuggestedQuestions();
  }, []);

  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight + 20,
        behavior: "smooth",
      });
    }
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Loading indicator dots handler
  useEffect(() => {
    if (isSending) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => (prev.length < 3 ? prev + "•" : "•"));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isSending]);

  const handleSend = async (text = "") => {
    if (!isSending) {
      if (!text.trim()) return;
      setUserInput("");
      setMessages((prevMessages) => [
        ...prevMessages,
        { type: "user", message: text },
      ]);
      setIsSending(true);

      try {
        if (!chatId) {
          try {
            const createChat = await axios.post("/api/newchat", { ip: ip });
            setChatId(createChat.data.chatId);
            const newChatId = createChat.data.chatId;
            await sendMessageToApi(text, newChatId);
          } catch (error) {
            throw new Error("Error creating chat session");
          }
        } else {
          await sendMessageToApi(text, chatId);
        }

        setIsSending(false);
        inputRef.current.focus();
      } catch (error) {
        console.error("Error in handleSend:", error);
        toast.error("Sorry, something went wrong!");
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            type: "bot",
            message: error.message || "Sorry, something went wrong!",
            isError: true,
          },
        ]);
        setIsSending(false);
        inputRef.current.focus();
      }
    } else {
      toast("Please wait for the current question to finish.", { icon: "⏳" });
    }
  };

  const sendMessageToApi = async (text, chatId) => {
    try {
      const response = await axios.post("/api/response", {
        question: text,
        history: messages,
        ip: ip,
        chatId: chatId,
        isFirst: isFirst
      });
      setIsFirst(false)

      let answer = response?.data?.answer || "Something went wrong";

      try {
        answer = JSON.parse(`"${answer.replace(/"/g, '\\"')}"`);
        answer = answer.replace(/\n/g, "<br />");
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { type: "bot", message: answer },
      ]);
    } catch (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          type: "bot",
          message:
            error?.response?.data?.error ||
            error?.message ||
            "Something went wrong",
          isError: true,
        },
      ]);
    }
  };

  const getQuickInputQuestions = async (input) => {
    try {
      const response = await axios.post("/api/question/suggest/input", {
        input,
      });
        setQuickQuestions(
          response.data.questions.map((question) => question.question)
        );
    } catch (err) {
      await getSuggestedQuestions();
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
    setChatId("")
    setDebouncedValue("")
  };

  const handleQuickSend = (text) => {
    setUserInput(text);
    handleSend(text);
  };

  const userMessageStyle =
    "bg-primary text-white rounded-t-lg rounded-bl-lg w-4/5 p-3 mb-2 shadow-md animate-fadeIn";
  const botMessageStyle =
    "bg-neutral-content text-black rounded-t-lg rounded-br-lg w-4/5 p-3 mb-2 shadow-sm animate-fadeIn overflow-x-auto";

  return (
    <div className="flex flex-col h-screen bg-base-200 px-3 py-3 max-w-xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="navbar bg-base-100 rounded-xl shadow-md p-4 flex items-center justify-between sticky top-2 z-10">
        <div className="flex items-center gap-2">
          <Image
            src="/assets/sbtelogo.png"
            width={35}
            height={35}
            alt="SBTE Logo"
          />
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
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 relative pt-8"
        ref={messagesContainerRef}
      >
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
            className={`flex ${
              message?.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={
                message?.type === "user" ? userMessageStyle : botMessageStyle
              }
            >
              {message?.type === "bot" ? (
                <Markdown  remarkPlugins={[remarkGfm]} className={`${message?.isError ? "text-red-500" : ""}`}>{message.message}
                </Markdown>
              ) : (
                message?.message
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className={`${botMessageStyle} animate-pulse`}>
              {loadingDots}
            </div>
          </div>
        )}
      </div>

      {/* Input and Send Button */}
      <div className="sticky bottom-2 bg-base-100 rounded-xl p-4 shadow-md flex flex-col gap-y-4">
        {/* Suggested Questions */}
        {quickQuestions && quickQuestions.length > 0 && (
          <div className="flex overflow-x-auto gap-2 pb-2">
            {quickQuestions.map((question, index) => (
              <Question
                key={index}
                text={question}
                handleQuickSend={handleQuickSend}
              />
            ))}
          </div>
        )}

        {/* Input Box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary transition duration-150"
            placeholder="Ask anything?"
            value={userInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            ref={inputRef}
          />
          <button
            title="Send (CTRL + Enter)"
            className={`p-2 rounded-full ${
              isSending ? "bg-neutral-content" : "bg-primary"
            }`}
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
