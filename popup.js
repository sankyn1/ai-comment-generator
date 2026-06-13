const providerSelect = document.getElementById('providerSelect');
const providerHint = document.getElementById('providerHint');
const geminiSection = document.getElementById('geminiSection');
const apiKeyInput = document.getElementById('apiKeyInput');
const geminiModelSelect = document.getElementById('geminiModelSelect');
const toggleVis = document.getElementById('toggleVis');
const ollamaSection = document.getElementById('ollamaSection');
const ollamaBaseUrlInput = document.getElementById('ollamaBaseUrl');
const ollamaModelSelect = document.getElementById('ollamaModelSelect');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const modelStatus = document.getElementById('modelStatus');
const saveBtn = document.getElementById('saveBtn');
const feedback = document.getElementById('feedback');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

init();

async function init() {
  const settings = await chrome.storage.sync.get({
    provider: 'gemini',
    apiKey: '',
    geminiModel: 'gemini-2.5-flash',
    ollamaBaseUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: ''
  });

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey || '';
  geminiModelSelect.value = settings.geminiModel || 'gemini-2.5-flash';
  ollamaBaseUrlInput.value = settings.ollamaBaseUrl || DEFAULT_OLLAMA_URL;

  syncProviderUI();

  if (providerSelect.value === 'ollama') {
    await loadOllamaModels({ preserveSelection: settings.ollamaModel || '' });
  } else {
    updateStatus(Boolean(settings.apiKey), 'gemini');
  }
}

providerSelect.addEventListener('change', async () => {
  syncProviderUI();
  feedback.classList.add('hidden');

  if (providerSelect.value === 'ollama') {
    await loadOllamaModels({ preserveSelection: ollamaModelSelect.value });
  } else {
    updateStatus(Boolean(apiKeyInput.value.trim()), 'gemini');
  }
});

saveBtn.addEventListener('click', saveSettings);

toggleVis.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVis.textContent = isPassword ? 'Hide' : 'Show';
});

apiKeyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveBtn.click();
});

ollamaBaseUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') refreshModelsBtn.click();
});

refreshModelsBtn.addEventListener('click', async () => {
  await loadOllamaModels({ preserveSelection: ollamaModelSelect.value });
});

async function saveSettings() {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const geminiModel = geminiModelSelect.value;
  const ollamaBaseUrl = normalizeBaseUrl(ollamaBaseUrlInput.value);
  const ollamaModel = ollamaModelSelect.value;

  if (provider === 'gemini') {
    if (!apiKey) {
      showFeedback('Please enter your Gemini API key.', 'error');
      updateStatus(false, provider);
      return;
    }

    // if (!apiKey.startsWith('AIza')) {
    //   showFeedback('This does not look like a valid Gemini API key.', 'error');
    //   updateStatus(false, provider);
    //   return;
    // }
  }

  if (provider === 'ollama') {
    if (!ollamaBaseUrl) {
      showFeedback('Please enter your Ollama server URL.', 'error');
      updateStatus(false, provider);
      return;
    }

    if (!ollamaModel) {
      showFeedback('Choose an Ollama model before saving.', 'error');
      updateStatus(false, provider);
      return;
    }
  }

  await chrome.storage.sync.set({
    provider,
    apiKey,
    geminiModel,
    ollamaBaseUrl,
    ollamaModel
  });

  showFeedback(
    provider === 'gemini'
      ? 'Gemini settings saved.'
      : `Ollama settings saved with model "${ollamaModel}".`,
    'success'
  );
  updateStatus(true, provider);
}

function syncProviderUI() {
  const provider = providerSelect.value;
  geminiSection.style.display = provider === 'gemini' ? 'block' : 'none';
  ollamaSection.style.display = provider === 'ollama' ? 'block' : 'none';
  providerHint.textContent =
    provider === 'gemini'
      ? 'Use your Gemini API key for cloud generation.'
      : 'Use your local Ollama server and pick a model to run on-device.';
}

async function loadOllamaModels({ preserveSelection = '' } = {}) {
  const baseUrl = normalizeBaseUrl(ollamaBaseUrlInput.value) || DEFAULT_OLLAMA_URL;
  modelStatus.textContent = 'Loading local models...';
  refreshModelsBtn.disabled = true;
  ollamaModelSelect.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'listOllamaModels',
      payload: { baseUrl }
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Unable to load Ollama models.');
    }

    const models = response.models || [];
    ollamaModelSelect.innerHTML = '';

    if (!models.length) {
      ollamaModelSelect.appendChild(new Option('No models found', ''));
      modelStatus.textContent = 'No local models available. Pull one with Ollama first.';
      updateStatus(false, 'ollama');
      return;
    }

    ollamaModelSelect.appendChild(new Option('Choose a model', ''));
    models.forEach(model => ollamaModelSelect.appendChild(new Option(model, model)));

    const selectedModel = models.includes(preserveSelection) ? preserveSelection : models[0];
    ollamaModelSelect.value = selectedModel;
    modelStatus.textContent = `${models.length} model${models.length === 1 ? '' : 's'} available locally.`;
    updateStatus(true, 'ollama');
  } catch (error) {
    ollamaModelSelect.innerHTML = '';
    ollamaModelSelect.appendChild(new Option('Unable to connect', ''));
    modelStatus.textContent = error.message;
    updateStatus(false, 'ollama');
  } finally {
    refreshModelsBtn.disabled = false;
    ollamaModelSelect.disabled = false;
  }
}

function normalizeBaseUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function updateStatus(isReady, provider) {
  statusDot.classList.toggle('inactive', !isReady);

  if (!isReady) {
    statusText.textContent =
      provider === 'ollama'
        ? 'Ollama needs a reachable server and selected model'
        : 'Gemini API key required';
    return;
  }

  statusText.textContent =
    provider === 'ollama'
      ? 'Ready with local Ollama'
      : 'Ready with Gemini';
}

function showFeedback(msg, type) {
  feedback.textContent = msg;
  feedback.className = `feedback ${type}`;
}
