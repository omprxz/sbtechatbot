import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import natural from 'natural';
import { GoogleGenerativeAI } from "@google/generative-ai";

let questionsList = [];
let genAI;

const initializeGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("Generative AI initialized");
};

const fetchQuestionsList = async () => {
  const connection = await db();
  const [rows] = await connection.query(
    "SELECT question, answer FROM dataset_questions WHERE status = 'active'"
  );
  questionsList = rows;
  console.log("Questions list fetched from database:", questionsList);
};

const genAIQuery = async (question, chatHistory = []) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction:
      'You are an intelligent chatbot designed to assist students with a wide range of inquiries related to college matters with proper detail or context with to the point response without being too much lengthy of useless.\nIf the question asked is outside the scope of the college, school or study related, please respond with: "Thank you for your question, but I cannot provide information on that topic as it falls outside my training data.\n Query:',
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  console.log("Generating response from GenAI for question:", question);
  let chatSession;
  if (chatHistory) {
    const history = chatHistory.map((message) => ({
      role: message.type === "user" ? "user" : "model",
      parts: [{ text: message?.message }],
    }));
    chatSession = model.startChat({
      generationConfig,
      history,
    });
    console.log("Chat history included in GenAI query:", chatHistory);
  } else {
    chatSession = model.startChat({
      generationConfig,
    });
  }

  const result = await chatSession.sendMessage(question);
  console.log("GenAI response:", result.response.text());
  return result.response.text();
};

export async function POST(request) {
  let connection;
  try {
    const {
      question: userQuestion,
      ip,
      chatId,
      isFirst,
      history: chatHistory,
    } = await request.json();
    console.log("Received user question:", userQuestion);

    if (!userQuestion) {
      console.log("No user question provided");
      return NextResponse.json(
        { error: "User question is required" },
        { status: 400 }
      );
    }

    if (isFirst || questionsList.length === 0) {
      await fetchQuestionsList();
    }

    if (isFirst || !genAI) {
      initializeGenAI();
    }

    let bestMatch = { question: null, answer: null, score: 0 };
    questionsList.forEach(({ question, answer }) => {
      const similarity = natural.JaroWinklerDistance(userQuestion, question);
      console.log(`Comparing with question: "${question}" - Similarity:`, similarity);
      if (similarity > bestMatch.score) {
        bestMatch = { question, answer, score: similarity };
      }
    });
    console.log("Best match found:", bestMatch);

    let finalAnswer;
    if (bestMatch.score > 0.8) {
      console.log("Best match above threshold, using pre-defined answer.");
      finalAnswer = bestMatch.answer;
    } else {
      console.log("No adequate match found, proceeding with GenAI.");
      const genAIAnswer = await genAIQuery(userQuestion);
      finalAnswer =
        genAIAnswer || "I'm still learning and don't have an answer for that.";
    }

    connection = await db();
    const messageSql = `INSERT INTO chatbot_questions (question, ip, chat_id) VALUES (?, ?, ?)`;
    const [messageResult] = await connection.execute(messageSql, [
      userQuestion,
      ip,
      Number(chatId),
    ]);
    console.log("Question logged in database with ID:", messageResult.insertId);

    const updateAnswerSql = `UPDATE chatbot_questions SET answer = ? WHERE id = ?`;
    await connection.execute(updateAnswerSql, [
      finalAnswer,
      messageResult.insertId,
    ]);
    console.log("Answer updated in database for question ID:", messageResult.insertId);

    const appendToChatSql = `
      UPDATE chat_sessions 
      SET msg_ids = COALESCE(
          JSON_ARRAY_APPEND(msg_ids, '$', CAST(? AS UNSIGNED)), 
          JSON_ARRAY(CAST(? AS UNSIGNED))
      ) 
      WHERE id = ?;
    `;
    await connection.execute(appendToChatSql, [
      messageResult.insertId,
      messageResult.insertId,
      chatId,
    ]);
    console.log("Message ID appended to chat session:", chatId);

    return NextResponse.json({ answer: finalAnswer });
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
      console.log("Database connection closed.");
    }
  }
}
