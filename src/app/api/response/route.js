// src/app/api/generateResponse.js
import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { jsonrepair } from 'jsonrepair';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `You are an intelligent chatbot designed to assist students with a wide range of inquiries related to college matters with proper detail or context...
  Student Query:`,
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

export async function POST(request) {
  const { q: studentQuery, history: chatHistory } = await request.json();
  if (!studentQuery) {
    return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
  }

  try {
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
    } else {
      chatSession = model.startChat({
        generationConfig,
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await chatSession.sendMessageStream(studentQuery);

          for await (const chunk of result.stream) {
            const chunkText = chunk.candidates[0].content.parts[0].text;
            controller.enqueue(encoder.encode(`data: ${chunkText}`));
          }

          controller.close();
        } catch (error) {
          console.error("Error in streaming response:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json({ response: error.message }, { status: 500 });
  }
}
