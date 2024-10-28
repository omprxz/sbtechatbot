// src/app/api/stream/route.js

export async function GET() {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Simulate data fetching or generation over time
          for (let i = 1; i <= 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay
  
            // Stream each "chunk" as a JSON string
            controller.enqueue(encoder.encode(JSON.stringify({ data: `Chunk ${i}` }) + "\n"));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
  