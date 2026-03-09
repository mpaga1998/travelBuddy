import OpenAI from 'openai';
export function initializeOpenAI() {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
}
