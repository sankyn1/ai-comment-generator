// content-utils.js - Shared utilities for content scripts
// This file is inlined into each content script

window.__AICommentGen = window.__AICommentGen || {

  // ── Modal Management ────────────────────────────────────────────────────────

  createModal(postText, insertCallback) {
    // Remove any existing modal
    document.getElementById('aicg-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'aicg-modal-overlay';
    overlay.innerHTML = `
      <div id="aicg-modal" role="dialog" aria-modal="true" aria-label="AI Comment Generator">
        <div id="aicg-modal-header">
          <div id="aicg-modal-title">
            <span class="aicg-sparkle">✦</span>
            AI Reply Generator
          </div>
          <button id="aicg-close-btn" aria-label="Close">✕</button>
        </div>

        <div id="aicg-controls">
          <div class="aicg-control-group">
            <label class="aicg-label">Tone</label>
            <div class="aicg-pills" id="aicg-tone">
              <button class="aicg-pill active" data-value="professional">Professional</button>
              <button class="aicg-pill" data-value="casual">Casual</button>
              <button class="aicg-pill" data-value="witty">Witty</button>
            </div>
          </div>
          <div class="aicg-control-group">
            <label class="aicg-label">Length</label>
            <div class="aicg-pills" id="aicg-length">
              <button class="aicg-pill active" data-value="short">Short</button>
              <button class="aicg-pill" data-value="medium">Medium</button>
            </div>
          </div>
          <div class="aicg-control-group">
            <label class="aicg-label">Intent</label>
            <div class="aicg-pills" id="aicg-intent">
              <button class="aicg-pill active" data-value="reply">Reply</button>
              <button class="aicg-pill" data-value="question">Question</button>
              <button class="aicg-pill" data-value="appreciation">Appreciate</button>
            </div>
          </div>
        </div>

        <div id="aicg-post-preview">
          <div class="aicg-preview-label">Post context</div>
          <div id="aicg-post-text">${this.escapeHtml(postText.slice(0, 280))}${postText.length > 280 ? '…' : ''}</div>
        </div>

        <div id="aicg-output-area" class="aicg-hidden">
          <textarea id="aicg-reply-text" placeholder="Your AI reply will appear here..." rows="4" spellcheck="true"></textarea>
          <div id="aicg-disclaimer">✦ AI-generated — review before posting</div>
        </div>

        <div id="aicg-loading" class="aicg-hidden">
          <div class="aicg-loader"></div>
          <span>Crafting your reply…</span>
        </div>

        <div id="aicg-error" class="aicg-hidden"></div>

        <div id="aicg-actions">
          <button id="aicg-generate-btn" class="aicg-btn-primary">
            <span class="aicg-sparkle">✦</span> Generate Reply
          </button>
          <div id="aicg-secondary-actions" class="aicg-hidden">
            <button id="aicg-regen-btn" class="aicg-btn-secondary">↺ Regenerate</button>
            <button id="aicg-copy-btn" class="aicg-btn-secondary">⎘ Copy</button>
            <button id="aicg-insert-btn" class="aicg-btn-accent">↳ Insert</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.bindModalEvents(overlay, postText, insertCallback);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('aicg-visible'));
    return overlay;
  },

  bindModalEvents(overlay, postText, insertCallback) {
    const modal = overlay.querySelector('#aicg-modal');
    let currentTone = 'professional';
    let currentLength = 'short';
    let currentIntent = 'reply';

    // Close
    overlay.querySelector('#aicg-close-btn').addEventListener('click', () => this.closeModal(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(overlay); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModal(overlay); }, { once: true });

    // Pills
    overlay.querySelectorAll('#aicg-tone .aicg-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('#aicg-tone .aicg-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTone = btn.dataset.value;
      });
    });
    overlay.querySelectorAll('#aicg-length .aicg-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('#aicg-length .aicg-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLength = btn.dataset.value;
      });
    });
    overlay.querySelectorAll('#aicg-intent .aicg-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('#aicg-intent .aicg-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentIntent = btn.dataset.value;
      });
    });

    const doGenerate = () => this.generateReply(overlay, postText, currentTone, currentLength, currentIntent);

    overlay.querySelector('#aicg-generate-btn').addEventListener('click', doGenerate);
    overlay.querySelector('#aicg-regen-btn').addEventListener('click', doGenerate);

    overlay.querySelector('#aicg-copy-btn').addEventListener('click', () => {
      const text = overlay.querySelector('#aicg-reply-text').value;
      navigator.clipboard.writeText(text).then(() => {
        const btn = overlay.querySelector('#aicg-copy-btn');
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = '⎘ Copy', 2000);
      });
    });

    overlay.querySelector('#aicg-insert-btn').addEventListener('click', () => {
      const text = overlay.querySelector('#aicg-reply-text').value;
      if (insertCallback && text) {
        insertCallback(text);
        this.closeModal(overlay);
      }
    });
  },

  async generateReply(overlay, postText, tone, length, intent) {
    const { apiKey } = await chrome.storage.sync.get('apiKey');

    this.showLoading(overlay, true);
    this.showError(overlay, '');

    chrome.runtime.sendMessage({
      action: 'generateReply',
      payload: { postContent: postText, tone, length, intent, apiKey }
    }, response => {
      this.showLoading(overlay, false);
      if (response?.success) {
        overlay.querySelector('#aicg-reply-text').value = response.reply;
        overlay.querySelector('#aicg-output-area').classList.remove('aicg-hidden');
        overlay.querySelector('#aicg-secondary-actions').classList.remove('aicg-hidden');
        overlay.querySelector('#aicg-generate-btn').textContent = '✦ Regenerate';
      } else {
        this.showError(overlay, response?.error || 'Something went wrong. Please try again.');
      }
    });
  },

  showLoading(overlay, show) {
    overlay.querySelector('#aicg-loading').classList.toggle('aicg-hidden', !show);
    overlay.querySelector('#aicg-generate-btn').disabled = show;
  },

  showError(overlay, msg) {
    const el = overlay.querySelector('#aicg-error');
    el.textContent = msg;
    el.classList.toggle('aicg-hidden', !msg);
  },

  closeModal(overlay) {
    overlay.classList.remove('aicg-visible');
    setTimeout(() => overlay.remove(), 300);
  },

  // ── Inject Button ────────────────────────────────────────────────────────────

  createButton(label = '✦ AI Reply') {
    const btn = document.createElement('button');
    btn.className = 'aicg-inject-btn';
    btn.innerHTML = `<span>${label}</span>`;
    btn.setAttribute('data-aicg', 'true');
    return btn;
  },

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }
};
