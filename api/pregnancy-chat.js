require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      message,
      language = "en",
      systemPrompt,
      userContext,
      attachedFile, // { name, mimeType, base64 } | null — sent when user attaches a report
    } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return res.status(500).json({ error: "Server misconfiguration: API Key missing" });
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ---- Build the system prompt ----
    const basePersona =
      systemPrompt ||
      `You are Sanjeevani, a specialized AI Pregnancy Expert for LifePulse.

RESPONSE FORMAT RULES (follow strictly):
- ALWAYS structure your response with clear section headers (e.g., 🍎 Nutrition, 🏃 Exercise, ⚠️ Health Alerts, 👩‍⚕️ Doctor's Visit). Do NOT use asterisks (**) or bolding.
- Under each section, use SHORT bullet points (one idea per bullet). Never write long paragraphs.
- If a lab value is abnormal, flag it with ⚠️ and explain why it matters.
- Keep each bullet to 1-2 lines maximum.
- End with a short warm closing line.

PERSONA: You are empathetic, medically accurate, and culturally relevant to pregnant women in rural India. Always advise consulting a doctor for pain or serious symptoms.`;

    const contextBlock = userContext
      ? `${userContext}\n\nInstructions for AI: You MUST use the patient context above to personalise your answer. Reference the user's specific pregnancy week, trimester, and health log values (weight, blood pressure, blood sugar, hemoglobin) where relevant. Flag any concerning trends in the data (e.g., elevated BP or low hemoglobin) and recommend appropriate action. Tailor all nutrition, exercise, and lifestyle advice to these specific values.\n\n`
      : "";

    const fullSystemPrompt = `${contextBlock}${basePersona}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: fullSystemPrompt
    });

    let text;

    if (attachedFile && attachedFile.base64 && attachedFile.mimeType) {
      // ---- MULTIMODAL PATH: Report file + Text ----
      const fileInstruction =
        attachedFile.mimeType === "application/pdf"
          ? "The user has attached a medical report PDF. Carefully read ALL values in the report. Identify any abnormal results, especially those related to pregnancy (haemoglobin, blood pressure, blood glucose, thyroid, vitamins). Cross-reference with the patient context above and provide specific, actionable recommendations."
          : "The user has attached a medical report image. Carefully read ALL visible values in this image. Identify any abnormal or unusual results related to pregnancy. Cross-reference with the patient context above and provide specific, actionable recommendations.";

      const prompt = `${fileInstruction}\n\nUser Question: ${message}\nResponse Language: ${language}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: attachedFile.base64,
            mimeType: attachedFile.mimeType,
          },
        },
      ]);
      const response = await result.response;
      text = response.text();
    } else {
      // ---- TEXT-ONLY PATH ----
      const prompt = `User Question: ${message}\nResponse Language: ${language}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      text = response.text();
    }

    const cleanText = text.replace(/\*\*/g, ""); // Remove bolding for TTS
    return res.status(200).json({ reply: cleanText });
  } catch (error) {
    console.error("Pregnancy AI Backend Error:", error);

    if (
      error.message?.includes("quota") ||
      error.message?.includes("429") ||
      error.message?.includes("RESOURCE_EXHAUSTED") ||
      error.status === 429
    ) {
      return res.status(429).json({ error: "API quota exceeded. Please wait a moment and try again." });
    }

    return res
      .status(500)
      .json({ error: "Failed to process request", details: error.message });
  }
};
