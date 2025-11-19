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
You are a women's health assistant.

Generate a short, very simple daily insight based ONLY on the user's mood and symptoms.
Write in very easy words that anyone can understand.
Use only bullet points and short lines. Avoid long paragraphs.

➡️ Use EXACTLY this format:

✨ Insight

🩷 Mood: ${mood}
🌸 Symptoms: ${symptoms.join(", ")}

🌼 What This Means  
- Write 2 simple bullet points about why these symptoms and mood may happen.  
- Use everyday language only.

💡 What Can Help  
- 4 practical home remedies (one short line each).  
- Keep them simple and realistic.

🧘 Self-care  
- 3 short self-care tips.  
- Very simple and comforting.

⚠️ Warning  
- If normal symptoms → "No serious warning today — just take care and rest well."  
- If anything is concerning → 1 short warning line.

🌞 Reminder  
- One short, kind reminder for the day.

Generate the insight now.
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
