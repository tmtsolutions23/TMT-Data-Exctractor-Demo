import { NextRequest, NextResponse } from "next/server";
import { getClientIP, checkRateLimit } from "@/lib/rate-limit";
import { getOpenAI } from "@/lib/openai";
import { VERTICALS, VERTICAL_IDS } from "@/lib/intake-schemas";

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

// Strip <!--INTAKE_DATA:{...}--> from assistant messages before re-sending to API
function stripIntakeData(content: string): string {
  return content.replace(/<!--INTAKE_DATA:\{[\s\S]*?\}-->/g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    // Shared rate limiting
    const ip = getClientIP(request.headers);
    const rateLimitResponse = checkRateLimit(ip);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { messages, vertical } = body;

    // Validate vertical
    if (!vertical || !VERTICAL_IDS.includes(vertical)) {
      return NextResponse.json(
        { error: "Invalid vertical." },
        { status: 400 }
      );
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: "Conversation too long. Please start a new chat." },
        { status: 400 }
      );
    }

    // Validate each message
    for (const msg of messages) {
      if (!ALLOWED_ROLES.has(msg.role) || !msg.content || typeof msg.content !== "string") {
        return NextResponse.json(
          { error: "Invalid message format." },
          { status: 400 }
        );
      }
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json(
          { error: "Message too long. Please keep messages under 2000 characters." },
          { status: 400 }
        );
      }
    }

    const config = VERTICALS[vertical];

    // Clean assistant messages of INTAKE_DATA before sending to API
    const cleanedMessages = messages.map(
      (msg: { role: "user" | "assistant"; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content:
          msg.role === "assistant"
            ? stripIntakeData(msg.content)
            : msg.content,
      })
    );

    const openai = getOpenAI();

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...cleanedMessages,
      ],
    });

    // Return a ReadableStream of text chunks
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: "AI service rate limit reached. Please wait a moment." },
        { status: 503 }
      );
    }
    if (status === 529 || status === 503) {
      return NextResponse.json(
        { error: "AI service temporarily overloaded. Please retry shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 }
    );
  }
}
