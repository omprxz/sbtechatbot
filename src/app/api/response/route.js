import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import natural from 'natural';

export async function POST(request) {
  try {
    const connection = await db();
    const [rows] = await connection.query(
      "SELECT question, answer FROM dataset_questions WHERE status = 'active'"
    );

    const { question: userQuestion, ip, chatId } = await request.json();
    if (!userQuestion) {
      return NextResponse.json(
        { error: "User question is required" },
        { status: 400 }
      );
    }

    const classifier = new natural.BayesClassifier();
    rows.forEach(({ question, answer }) =>
      classifier.addDocument(question, answer)
    );
    classifier.train();

    const confidenceScores = classifier.getClassifications(userQuestion);
    const bestMatch = confidenceScores.reduce((max, current) =>
      current.value > max.value ? current : max
    );

    let finalAnswer;
    if (bestMatch.value > 0) {
      finalAnswer = bestMatch.label;
    } else {
      finalAnswer = "I am trained enough to answer it. I am still in the learning phase.";
    }

    const messageSql = `INSERT INTO chatbot_questions (question, ip, chat_id) VALUES (?, ?, ?)`;
    const [messageResult] = await connection.execute(messageSql, [
      userQuestion,
      ip,
      Number(chatId),
    ]);

    const updateAnswerSql = `UPDATE chatbot_questions SET answer = ? WHERE id = ?`;
    await connection.execute(updateAnswerSql, [
      finalAnswer,
      messageResult.insertId,
    ]);

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

    return NextResponse.json({ answer: finalAnswer });
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
