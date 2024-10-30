import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req){
    const {ip} = await req.json();
    const connection = await db();
    const createChatSQL = `insert into chat_sessions (ip) values (?)`;
    const chat = await connection.execute(createChatSQL, [ip])
    return NextResponse.json({chatId: chat[0].insertId})
    
}