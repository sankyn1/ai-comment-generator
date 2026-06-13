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

  const maxTokens = length === 'short' ? 120 : 280;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topK: 50,
          topP: 0.92,
          maxOutputTokens: maxTokens
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
        temperature: 0.9,
        num_predict: length === 'short' ? 120 : 280
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
  const toneGuide = {
    professional: `Write in a confident, clear, and thoughtful tone — like a knowledgeable colleague sharing their perspective in a professional setting. No corporate jargon.`,
    casual:       `Write in a relaxed, friendly tone — like texting a smart friend. Contractions are fine. Feel free to be warm and a little personal.`,
    witty:        `Write with a sharp, clever edge — light humor, a surprising angle, or a playful observation. Natural wit, not forced jokes.`
  };

  const intentGuide = {
    reply:        `Share a genuine perspective, insight, or reaction that adds something to the conversation.`,
    question:     `Ask one specific, curious follow-up question that shows you actually read and thought about the post.`,
    appreciation: `Express appreciation for something specific in the post — not generic praise, but a real reaction to a particular idea or moment.`
  };

  const lengthGuide = {
    short:  `1–2 sentences. Tight and complete — end with a full stop, not mid-thought.`,
    medium: `3–4 sentences. Developed but focused — one clear idea, fully expressed.`
  };

  const openers = [
    'lead with the most interesting or unexpected angle you can find in the post',
    'skip the obvious reaction — find something more specific to react to',
    'pick one concrete detail from the post and make your reply about that',
    'start from a personal or practical angle that feels real',
    'find the tension or nuance in the post and respond to that'
  ];
  const opener = openers[Math.floor(Math.random() * openers.length)];

  return `You are someone who reads social media posts carefully and leaves thoughtful, human replies.

Tone: ${toneGuide[tone] || toneGuide.professional}
Goal: ${intentGuide[intent] || intentGuide.reply}
Length: ${lengthGuide[length] || lengthGuide.short}

When writing, ${opener}.

Rules:
- Never open with "Great post", "Love this", "So true", "This is amazing", or any filler praise
- Never summarise what the post already says
- Write like a real person, not a content strategist
- No hashtags
- No emojis unless the tone is casual or witty (max one if so)
- Do not trail off — finish your thought completely before stopping
- Output only the reply itself, nothing else

Post:
"""
${postContent}
"""

Reply:`;
}