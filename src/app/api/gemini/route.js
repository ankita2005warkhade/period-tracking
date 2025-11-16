// src/app/api/gemini/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { mood, symptoms } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    // NEW Gemini SDK client
    const genAI = new GoogleGenerativeAI(apiKey);

    // BEST Free Model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    // The PERFECT PROMPT (copy-paste EXACT)
    const prompt = `
You are a supportive period and women's health assistant.
Based on the user's mood and symptoms, provide insights in the EXACT format below.

Mood: ${mood}
Symptoms: ${symptoms?.join(", ")}

Return the response strictly in this format:

✨ Insight

🌸 Daily Note:  
- Write a short emotional + physical summary combining mood and symptoms.

💡 Remedies: 
- Give 2–3 home remedies that are simple and effective.

🧘 Tips: 
- Provide 2 practical lifestyle or self-care tips.

⚠️ Warning:  
- If symptoms look concerning, say what to watch for.  
- If not, say: "No major warning today."

🌞 Reminder:
- Give a gentle, positive reminder for the day.

Keep the tone warm, short, and easy to read.
Do NOT add anything outside this format.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ ok: true, insight: text });
  } catch (error) {
    console.error("❌ Gemini API Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
