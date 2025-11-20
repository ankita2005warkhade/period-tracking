import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const body = await req.json();

    // Extract values safely
    const mood = body.mood || "";
    const symptoms = body.symptoms || [];
    const flowLevel = body.flowLevel || ""; // ⭐ NEW

    console.log("🔵 API RECEIVED:", { mood, symptoms, flowLevel });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    // ⭐ Updated prompt including Flow Level
    const prompt = `
You are a women's health assistant.

Generate a clear, simple daily insight using ONLY:
Mood: ${mood}
Symptoms: ${symptoms.join(", ")}
Flow Level: ${flowLevel}

Write in very easy English. Keep everything SHORT and in bullet points.
Do NOT write long paragraphs.

Use EXACTLY this format:

✨ Insight

🩷 Mood: ${mood}
🌸 Symptoms: ${symptoms.join(", ")}
❤️ Flow Level: ${flowLevel}

🌼 What This Means  
- 2 short bullet points  
- Explain why these symptoms + flow happen  
- Use everyday language  

💡 What Can Help  
- 4 helpful home remedies (short)

🧘 Self-care  
- 3 gentle self-care tips  

⚠️ Warning  
- If symptoms are normal → “No serious warning today — just rest well.”  

🌞 Reminder  
- One positive reminder  
`;

    const result = await model.generateContent(prompt);
    const insight = result.response.text().trim();

    return NextResponse.json({
      ok: true,
      insight,
    });
  } catch (error) {
    console.error("❌ Gemini API Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
