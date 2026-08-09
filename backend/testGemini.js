import dotenv from "dotenv";
dotenv.config();

console.log("Gemini Key:", process.env.GEMINI_API_KEY);

import { generateAiResponse } from "./services/geminiService.js";

const test = async () => {
  const response = await generateAiResponse("Hello");
  console.log("\nGemini Response:\n");
  console.log(response);
};

test();
