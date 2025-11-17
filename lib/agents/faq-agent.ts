// lib/agents/faq-agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { retryWithBackoff } from "../retry-utility";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

const FAQ_DATABASE = [
  {
    keywords: ["diabetes", "blood sugar", "glucose"],
    answer:
      "Diabetes is a condition where blood glucose levels are too high. It occurs when your body doesn't make enough insulin or can't use insulin properly. Common symptoms include increased thirst, frequent urination, fatigue, and blurred vision. Management typically involves monitoring blood sugar, healthy eating, regular exercise, and sometimes medication. Always consult your doctor for personalized advice.",
  },
  {
    keywords: ["blood pressure", "hypertension", "bp"],
    answer:
      "Blood pressure is the force of blood pushing against artery walls. Hypertension (high blood pressure) means this force is consistently too high. Normal blood pressure is around 120/80 mmHg. High blood pressure often has no symptoms but increases risk of heart disease and stroke. Management includes healthy diet, exercise, stress management, and sometimes medication. Regular monitoring is important.",
  },
  {
    keywords: ["medication", "side effects", "medicine"],
    answer:
      "Medications can have side effects, which are unwanted effects that occur along with the intended therapeutic effect. Common side effects vary by medication but may include nausea, drowsiness, or headaches. Always take medications as prescribed, report any concerning side effects to your doctor, and never stop medication without consulting your healthcare provider first.",
  },
  {
    keywords: ["cholesterol", "ldl", "hdl"],
    answer:
      "Cholesterol is a waxy substance in your blood. LDL (bad cholesterol) can build up in arteries, while HDL (good cholesterol) helps remove cholesterol. High cholesterol increases heart disease risk. Management includes healthy diet (low saturated fat), regular exercise, maintaining healthy weight, and sometimes medication. Regular screening is important.",
  },
];

export async function faqAgent(state: ChatState): Promise<string> {
  // Check local FAQ database first
  const query = state.query.toLowerCase();
  const faqMatch = FAQ_DATABASE.find((faq) =>
    faq.keywords.some((keyword) => query.includes(keyword))
  );

  if (faqMatch) {
    return faqMatch.answer;
  }

  // Use Gemini for general knowledge questions with retry
  const prompt = `You are a helpful health information assistant. Answer this general health question clearly and concisely.

Query: "${state.query}"

Important: This is general information only, not medical advice. Recommend consulting a healthcare provider for personal medical concerns.`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      3,
      1000
    );

    return response.response.text();
  } catch (error) {
    console.error("FAQ agent error after retries:", error);

    return "I'm currently experiencing technical difficulties providing detailed information. For general health questions, please consult reliable health resources or speak with your healthcare provider. If this is urgent, please contact your doctor or call emergency services.";
  }
}
