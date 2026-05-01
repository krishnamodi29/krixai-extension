/**
 * Calls Groq chat completions API and returns text content.
 * @param {string} systemPrompt - System-level instructions.
 * @param {string} userContent - User payload content.
 * @param {string} apiKey - Groq API key.
 * @returns {Promise<string>} Assistant content text.
 */
async function callGroq(systemPrompt, userContent, apiKey) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq error: ${error.error?.message || response.status}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

export { callGroq };
