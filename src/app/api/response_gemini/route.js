import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
} from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import {db} from '@/lib/db';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

async function authorize() {
    const googleApi = JSON.parse(process.env.DRIVE_CREDS);
    const jwtClient = new google.auth.JWT(
        googleApi.client_email,
        null,
        googleApi.private_key,
        ['https://www.googleapis.com/auth/drive']
    );
    await jwtClient.authorize();
    return jwtClient;
}

async function readFileContent(authClient, fileId) {
    const drive = google.drive({ version: 'v3', auth: authClient });

    return new Promise((resolve, reject) => {
        drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' },
            (err, res) => {
                if (err) return reject(err);

                let fileData = '';
                res.data
                    .on('data', (chunk) => {
                        fileData += chunk.toString();
                    })
                    .on('end', () => resolve(fileData))
                    .on('error', reject);
            }
        );
    });
}

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(request) {
  const { q: studentQuery, history: chatHistory, ip, chatId } = await request.json();
  if (!studentQuery) {
    return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
  }

  try {
    const connection = await db();

    const [rows] = await connection.query(
      "SELECT question, answer FROM dataset_questions WHERE status = 'active'"
    );
    
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "You are an intelligent chatbot designed to assist students with a wide range of inquiries related to college matters with proper detail or context with to the point response without being too much lengthy of useless.\nYour responses should be based solely on the provided dataset files of frequently asked questions (FAQs) and their answers, as well as raw dataset files.\n\nIf the question asked is outside the scope of the provided dataset, please respond with: \"Thank you for your question, but I cannot provide information on that topic as it falls outside my training data.\"\n\nDataset Questions and Answers:\n" +     rows.map(({ question, answer }) => `Q: ${question}\nA: ${answer}`).join('\n\n') + "\n\nBased on the dataset files provided, answer the following question from the student in the best way possible, ensuring clarity and understanding.\nStudent Query:\n",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

    const messageSql = `insert into chatbot_questions (question, ip, chat_id) values (?, ?, ?)`
    const message = await connection.execute(messageSql, [studentQuery, ip, Number(chatId)])
    const appendToChatSql = `
    UPDATE chat_sessions 
    SET msg_ids = COALESCE(
        JSON_ARRAY_APPEND(msg_ids, '$', CAST(? AS UNSIGNED)), 
        JSON_ARRAY(CAST(? AS UNSIGNED))
    ) 
    WHERE id = ?;
`;

const appendToChat = await connection.execute(appendToChatSql, [
    message[0].insertId,
    message[0].insertId,
    chatId
]);

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
          let accumulatedText = "";

          for await (const chunk of result.stream) {
            const chunkText = chunk.candidates[0].content.parts[0].text;
            accumulatedText += chunkText;
            controller.enqueue(encoder.encode(`${chunkText}`));
          }
          const updateAnswerSql = `update chatbot_questions set answer = ? where id = ?`
          const updateAnswer = await connection.execute(updateAnswerSql, [accumulatedText, message[0].insertId])
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
