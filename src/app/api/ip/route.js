import { NextResponse } from 'next/server';

export async function GET(req) {
    const ip = 
        req.headers.get('x-forwarded-for') || 
        req.socket.remoteAddress || 
        'Unknown IP';

    const formattedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    return NextResponse.json({ ip: formattedIp });
}
