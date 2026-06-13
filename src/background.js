chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReply') {
    handleGenerateReply(request.payload || {})
      .then(reply => sendResponse({ success: true, reply }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'listOllamaModels') {
    handleListOllamaModels(request.payload || {})
      .then(models => sendResponse({ success: true, models }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleGenerateReply({ postContent, tone, length, intent }) {
  const settings = await chrome.storage.sync.get({
    provider: 'gemini',
    apiKey: '',
    geminiModel: 'gemini-2.5-flash',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: ''
  });

  const prompt = buildPrompt(postContent, tone, length, intent);

  if (settings.provider === 'ollama') {
    return generateWithOllama(prompt, settings, length);
  }

  return generateWithGemini(prompt, settings.apiKey, length, settings.geminiModel);
}

async function handleListOllamaModels({ baseUrl }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || 'http://localhost:11434');
  const response = await fetch(`${normalizedBaseUrl}/api/tags`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with ${response.status}.`);
  }

  const data = await response.json();
  return (data.models || []).map(model => model.name).filter(Boolean);
}

async function generateWithGemini(prompt, apiKey, length, model = 'gemini-2.5-flash') {
  if (!apiKey) {
    throw new Error('No Gemini API key found. Open the extension popup and save it first.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini did not return any reply text.');
  }

  return text.trim();
}

async function generateWithOllama(prompt, settings, length) {
  const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');
  const model = settings.ollamaModel;

  if (!model) {
    throw new Error('No Ollama model selected. Open the extension popup and choose one.');
  }

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.85,
        num_predict: length === 'short' ? 100 : 240
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || `Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.response;

  if (!text) {
    throw new Error('Ollama did not return any reply text.');
  }

  return text.trim();
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function buildPrompt(postContent, tone, length, intent) {
  const toneMap = {
    professional: 'professional, thoughtful, and insightful',
    casual: 'natural, friendly, and conversational',
    witty: 'clever, sharp, and lightly humorous (never forced)'
  };

  const intentMap = {
    reply: 'contribute a meaningful perspective or insight',
    question: 'ask a specific and thought-provoking follow-up question',
    appreciation: 'express genuine appreciation tied to a specific detail'
  };

  const lengthMap = {
    short: '1-2 sentences',
    medium: '2-4 sentences'
  };

  const variationStyles = [
    'Focus on a practical takeaway',
    'Offer a slightly different perspective if relevant',
    'Highlight a subtle insight others might miss',
    'Keep it reflective and thoughtful',
    'Relate it briefly to a real-world scenario'
  ];

  const randomStyle =
    variationStyles[Math.floor(Math.random() * variationStyles.length)];

  return `
You are a smart, authentic human engaging thoughtfully on social media.

Your objective is to ${intentMap[intent] || intentMap.reply}.

### Style Guidelines
- Tone: ${toneMap[tone] || toneMap.professional}
- Length: ${lengthMap[length] || lengthMap.short}
- Write like a real person: natural, clear, and specific

### How to Think Before Writing
1. Identify the most meaningful, interesting, or unique idea in the post.
2. Focus only on that idea and do not respond to everything.
3. Add value by doing one of the following:
   - Share a perspective
   - Add insight
   - Extend the idea
   - Ask a thoughtful question if the intent allows

### Additional Guidance
- ${randomStyle}

### Strict Rules
- Do not start with generic phrases like "Great post" or "Nice"
- Do not repeat or summarize the post
- Do not add hashtags unless truly natural
- Do not invent facts or assumptions
- Do not sound robotic, promotional, or AI-generated
- Avoid emojis unless tone is casual or witty, and even then use at most one

### Output Rules
- Return only the final reply
- No quotes, no labels, no explanations
- Ensure the reply is a complete thought and ends with appropriate punctuation. Do not cut off abruptly.

### Post
"""
${postContent}
"""
`;
}
