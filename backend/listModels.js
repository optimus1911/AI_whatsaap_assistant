import dotenv from "dotenv";
dotenv.config();

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`
);

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
