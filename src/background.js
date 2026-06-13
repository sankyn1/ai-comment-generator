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

  // Generous limits — the prompt instructs length, not the token cap.
  // Token cap is just a safety ceiling to prevent runaway output.
  const maxTokens = length === 'short' ? 300 : 600;

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

  // Check finish reason — if MAX_TOKENS the reply was cut; warn in console
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    console.warn('[AI Reply] Gemini hit token limit — consider raising maxOutputTokens further');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini did not return any reply text.');
  }

  return ensureComplete(text.trim(), length);
}

async function generateWithOllama(prompt, settings, length) {
  const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');
  const model = settings.ollamaModel;

  if (!model) {
    throw new Error('No Ollama model selected. Open the extension popup and choose one.');
  }

  // num_predict is the reply budget only — prompt tokens are separate in Ollama
  const num_predict = length === 'short' ? 300 : 600;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.9,
        num_predict,
        stop: []           // let the model decide when to stop naturally
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

  return ensureComplete(text.trim(), length);
}

/**
 * If the reply was cut mid-sentence (no terminal punctuation at the end),
 * trim back to the last complete sentence so it never reads as truncated.
 */
function ensureComplete(text, length) {
  if (!text) return text;

  // Already ends with sentence-ending punctuation — nothing to do
  if (/[.!?'"]$/.test(text)) return text;

  // Find the last sentence boundary
  const sentenceEnd = /[.!?][^.!?]*$/;
  const match = text.match(/^([\s\S]*[.!?])/);

  if (match && match[1] && match[1].trim().length > 20) {
    console.warn('[AI Reply] Reply was trimmed to last complete sentence (was cut mid-thought)');
    return match[1].trim();
  }

  // If we can't find any sentence ending, return as-is — better than nothing
  return text;
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
    short:  `1–2 sentences maximum. Every sentence must be complete. End with a period, exclamation mark, or question mark. Never stop mid-sentence.`,
    medium: `3–4 sentences. Write every sentence in full. The last sentence must end with proper punctuation. Do not trail off or leave a thought unfinished.`
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
- CRITICAL: Every sentence must be grammatically complete. The reply must end with . or ! or ?
- CRITICAL: Do not stop writing until the final sentence is fully finished
- Output only the reply itself, nothing else

Post:
"""
${postContent}
"""

Reply:`;
}