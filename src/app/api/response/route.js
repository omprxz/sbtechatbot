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

async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      process.stdout.write(".");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      file = await fileManager.getFile(name);
    }
    if (file.state !== "ACTIVE") {
      throw new Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready\n");
}

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "You are an intelligent chatbot designed to assist students with a wide range of inquiries related to college matters.\nYour responses should be based solely on the provided dataset files of frequently asked questions (FAQs) and their answers, as well as raw dataset files.\n\nIf the question asked is outside the scope of the provided dataset, please respond with: \"Thank you for your question, but I cannot provide information on that topic as it falls outside my training data.\"\nBased on the dataset files provided, answer the following question from the student in the best way possible, ensuring clarity and understanding.\nStudent Query:\n",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
      },
    },
    required: ["message"],
  },
};

export async function POST(request) {
  const { q: studentQuery, history: chatHistory } = await request.json();
  try {

    if (!studentQuery) {
      return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
    }

    const files = [
      await uploadToGemini("./public/dataset/Debarred_Student_FAQ_CollegeBoard_Dataset.txt", "text/plain"),
    ];

    await waitForFilesActive(files);

    const history = chatHistory.map((message) => ({
      role: message.type === "user" ? "user" : "model",
      parts: [{ "text": message?.message}],
    }));


    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: files[0].mimeType,
                fileUri: files[0].uri,
              },
            },
          ],
        },
        ...history,
      ],
    });

    const result = await chatSession.sendMessage(studentQuery);
    const responseText = result.response.text();

    try {
      const repairedResponse = jsonrepair(responseText);
      return NextResponse.json({ response: JSON.parse(repairedResponse) }, { status: 200 });
    } catch (err) {
      return NextResponse.json({ response: err.message }, { status: 500 });
    }
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json({ response: error.message }, { status: 500 });
  }
}