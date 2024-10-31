import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request) {
    const body = await request.json();
    const input = body?.input
    console.log("calling input")
    if(!input){
        return NextResponse.json({error: "Input field required"}, {status: 400})
    }
try{
    const conn = await db()
    const getQSql = `select question from dataset_questions where question like '%${input}%' limit 5`;
    const [questions] = await conn.execute(getQSql);
    console.log("Questions: ", questions[0])
    return NextResponse.json({questions: questions})
}catch(error){
    return NextResponse.json({error: error?.message || "Something went wrong!"}, {status: 500})
}
}