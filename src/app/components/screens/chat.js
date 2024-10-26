"use client";
import Image from "next/image";
import { SendHorizontal, LoaderCircle } from 'lucide-react';
import { use, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import ReactMarkdown from 'react-markdown';
import Question from "../question";


export default function Chat() {
  const [messages, setMessages] = useState([
  ]);
  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const handleSend = async (text = "") => {
    if (!text.trim()) return;
    setUserInput("");
    setMessages(prevMessages => [...prevMessages, { type: "user", message: text }]);
    setIsSending(true);

    try {
      const response = await axios.post('/api/response', { q: text, history: messages });

      setMessages(prevMessages => [
        ...prevMessages,
        { type: "bot", message: response.data.response.message, isError: false }
      ]);
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });

      setIsSending(false);
    } catch (error) {
      console.error("Error fetching response:", error);
      toast.error("Sorry, something went wrong!");
      setMessages(prevMessages => [
        ...prevMessages,
        { type: "bot", message: error?.message || "Sorry, something went wrong!", isError: true }
      ]);
      setIsSending(false);
      setUserInput(userInput);
    }  };

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



    const userMessageStyle = "bg-info text-white rounded-t-lg rounded-bl-lg w-4/5 p-3 break-words z-10";
    const botMessageStyle = "bg-neutral-content text-black rounded-t-lg rounded-br-lg w-4/5 p-3 break-words z-10";
    


  return (
    <div className="bg-base-200 h-screen flex flex-col py-4 px-5">
      <div className="navbar bg-base-100 rounded-lg shadow-lg sticky top-1 z-10">
        <div className="flex-1">
          <Image
            src="/assets/sbtelogo.png"
            className="ms-3"
            width={35}
            height={35}
            alt="SBTE Logo"
          />
          <p className="btn btn-ghost text-xl font-bold ms-1">SBTE Chatbot</p>
        </div>
        <div className="flex-none">
          <button className="btn btn-square btn-ghost" title="New Chat" onClick={newChat} disabled={isSending}>
          <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  className="inline-block h-6 w-6"
>
  <circle cx="12" cy="12" r="11" fill="none" stroke="black" strokeWidth="2" />
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
      </div>

      <div className={`flex-1 px-4 mt-2 mb-4 overflow-y-auto flex flex-col-reverse gap-y-3 w-full scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar scrollbar-thumb-neutral scrollbar-track-neutral-content relative`} ref={messagesEndRef}>
      <Image
            src="/assets/sbtelogo.png"
            className={`ms-3 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 z-0 ${messages.length > 0 ? "opacity-10" : "opacity-20"}`}
            width={150}
            height={150}
            alt="SBTE Logo"
          />
        {messages.slice().reverse().map((message, index) => (
          <div key={index} className={`flex ${message?.type === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`${message?.type === "user" ? userMessageStyle : botMessageStyle}`}>
          {message?.type === "bot" ? (
          <ReactMarkdown className={`${message?.isError ? "text-red-500" : "text-black"}`}>{message.message}</ReactMarkdown>
        ) : (
          message?.message
        )}
          </div>
        </div>
        ))}
      </div>

      <div className="sticky bottom-1">
        <div className="flex items-center gap-2 min-w-full mb-2.5 overflow-x-scroll">
            <Question text="What is debar?" handleQuickSend={handleQuickSend} />
        </div>
        <div className="navbar bg-base-100 rounded-lg shadow-xl px-3 flex items-center gap-2 w-full">
        <input type="text" className="rounded-sm outline-none w-full px-2" placeholder="Ask anything?" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={handleKeyDown} />
        <button title="Send (CTRL + &#9166;)" className={`rounded-full p-2 cursor-pointer ${isSending ? "bg-neutral-content" : "bg-primary"}`}  disabled={isSending} onClick={() => handleSend(userInput)}>
            {
                isSending ? (<span className="loading loading-spinner loading-sm p-3 text-neutral"></span>) : (
                    <SendHorizontal className="text-white" />
                )
            }
          
        </button>
        </div>
        
      </div>
    </div>
  );
}
