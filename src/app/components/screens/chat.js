import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { SendHorizontal, LoaderCircle, Plus, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";

function Question({ text, handleQuickSend }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      className="px-3 py-2 bg-blue-500/10 text-blue-500 rounded-full text-sm whitespace-nowrap"
      onClick={() => handleQuickSend(text)}
    >
      {text}
    </motion.button>
  );
}

export default function Chat() {
  const [ip, setIp] = useState("");
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState([]);
  const [isFirst, setIsFirst] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (userInput.length >= 3) {
        setDebouncedValue(userInput);
      } else if (userInput.length === 0) {
        if(isExpanded){
        getSuggestedQuestions();
        }
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [userInput]);

  useEffect(() => {
    if (debouncedValue && debouncedValue.length >= 3 && isExpanded) {
      getQuickInputQuestions(debouncedValue);
    }
  }, [debouncedValue]);

  useEffect(() => {
    axios.get("/api/ip").then(response => setIp(response.data.ip)).catch(console.error);
    getSuggestedQuestions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const getSuggestedQuestions = () => {
    axios.get("/api/question/suggest/5")
      .then(response => setQuickQuestions(response.data.questions.map(q => q.question)))
      .catch(error => {
        console.error("Error fetching quick questions:", error);
        toast.error("Failed to fetch suggested questions");
      });
  };

  const getQuickInputQuestions = async (input) => {
    try {
      const response = await axios.post("/api/question/suggest/input", { input });
      setQuickQuestions(response.data.questions.map(q => q.question));
    } catch (err) {
      await getSuggestedQuestions();
    }
  };

  const handleSend = async (text = "") => {
    if (isSending || !text.trim()) return;
    
    setUserInput("");
    setMessages(prev => [...prev, { type: "user", message: text }]);
    setIsSending(true);

    try {
      if (!chatId) {
        const createChat = await axios.post("/api/newchat", { ip });
        setChatId(createChat.data.chatId);
        await sendMessageToApi(text, createChat.data.chatId);
      } else {
        await sendMessageToApi(text, chatId);
      }
    } catch (error) {
      console.error("Error in handleSend:", error);
      toast.error("Sorry, something went wrong!");
      setMessages(prev => [...prev, { type: "bot", message: "Sorry, something went wrong!", isError: true }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const sendMessageToApi = async (text, chatId) => {
    try {
      const response = await axios.post("/api/response", {
        question: text,
        history: messages,
        ip,
        chatId,
        isFirst
      });
      setIsFirst(false);
      
      let answer = response?.data?.answer || "Something went wrong";
      try {
        answer = JSON.parse(JSON.stringify(answer));
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
      }

      setMessages(prev => [...prev, { type: "bot", message: answer }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: "bot",
        message: error?.response?.data?.error || error?.message || "Something went wrong",
        isError: true
      }]);
    }
  };

  const newChat = () => {
    setMessages([]);
    setUserInput("");
    setChatId("");
    setDebouncedValue("");
    setIsFirst(true);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 max-w-2xl mx-auto">
      <motion.div 
        className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assets/sbtelogo.png" width={40} height={40} alt="SBTE Logo" className="rounded-full" />
          <h1 className="text-xl font-bold text-gray-800">SBTE Chatbot</h1>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
          onClick={newChat}
          disabled={isSending}
          title="New Chat"
        >
          <Plus size={24} />
        </motion.button>
      </motion.div>

      <motion.div 
        className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-lg p-6 mb-4"
        ref={messagesContainerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <Image src="/assets/sbtelogo.png" width={150} height={150} alt="SBTE Logo" className="opacity-20" />
          </div>
        )}
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} mb-4`}
            >
              <div className={`max-w-[80%] p-3 rounded-lg ${
                message.type === "user" 
                  ? "bg-indigo-500 text-white" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {message.type === "bot" ? (
                  <Markdown remarkPlugins={[remarkGfm]} className={message.isError ? "text-red-500" : ""}>
                    {message.message}
                  </Markdown>
                ) : (
                  message.message
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isSending && (
          <motion.div 
            className="flex justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gray-100 text-gray-800 rounded-lg p-3">
              <LoaderCircle className="animate-spin" />
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div 
        className="bg-white rounded-2xl shadow-lg p-4"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <motion.div 
          className="mb-4 overflow-hidden"
          animate={{ height: isExpanded ? "auto" : 0 }}
        >
          <div className="flex overflow-x-auto gap-2 pb-2 px-3">
            {quickQuestions.map((question, index) => (
              <Question key={index} text={question} handleQuickSend={handleSend} />
            ))}
          </div>
        </motion.div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <ChevronDown className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </motion.button>
          <input
            type="text"
            className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
            placeholder="Ask anything..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(userInput)}
            ref={inputRef}
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-3 rounded-full ${isSending ? "bg-gray-300" : "bg-indigo-500 hover:bg-indigo-600"} text-white transition-colors`}
            disabled={isSending}
            onClick={() => handleSend(userInput)}
          >
            <SendHorizontal size={24} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
