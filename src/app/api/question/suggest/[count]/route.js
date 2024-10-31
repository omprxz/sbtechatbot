import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request, { params }) {
    console.log("calling count")
    try {
        const count = parseInt(params.count, 10);
        if (isNaN(count) || count <= 0) {
            return NextResponse.json({ error: "Invalid count parameter" }, { status: 400 });
        }

        const connection = await db();
        const getQSql = `SELECT question, COUNT(question) AS question_count FROM chatbot_questions GROUP BY question ORDER BY question_count DESC LIMIT ${count}`;
        const [questions] = await connection.execute(getQSql);

        return NextResponse.json({ questions: questions });
    } catch (error) {
        console.error("Error fetching questions:", error?.message);
        return NextResponse.json({ error: "An error occurred while fetching questions" }, { status: 500 });
    }
}
