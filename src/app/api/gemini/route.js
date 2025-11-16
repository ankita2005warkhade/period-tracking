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

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // Best, fast, free
    });

    // ⭐⭐ SUPER OPTIMIZED USER-CENTRIC PROMPT ⭐⭐
   const prompt = `
You are a warm, supportive period and women's health assistant.

Your job is to generate a personalized, emotionally supportive daily insight
based STRICTLY on the user’s mood and symptoms.

Start the output with:

Mood: ${mood}  
Symptoms: ${symptoms?.join(", ")}

Then write 2–3 short lines welcoming the user and introducing the insight.

AFTER THAT, follow this EXACT FORMAT:

✨ Insight

🩷 How You're Feeling Today:
Write an emotional, caring summary combining mood and symptoms.
Tone: empathetic, kind, validating.

🌸 What This Means for Your Body:
Explain what these symptoms may mean physically.
Use simple, comforting language.

💡 Home Remedies That Can Help:
- Provide 3–4 practical home remedies
- Must match the user's symptoms

🧘 Self-Care & Lifestyle Tips:
- Give 2 gentle, supportive tips

⚠️ Warning Signs to Watch:
- Only list warning signs if relevant
- Otherwise write: No major warning today — just listen to your body.

🌞 A Kind Reminder for You:
A soft, comforting closing message to make the user feel supported.

IMPORTANT RULES:
- No extra sections.
- Use simple, human language.
- Keep paragraphs short.
- Do NOT repeat mood or symptoms unnecessarily.

Generate today's insight now.
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
