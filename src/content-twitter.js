// content-twitter.js - Twitter/X post detector and button injector

(function () {
  'use strict';

  const SELECTORS = {
    postContainer: [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]'
    ],
    postText: [
      '[data-testid="tweetText"]'
    ],
    actionBar: [
      '[role="group"][aria-label]',
      '[data-testid="tweet"] > div > div > div:last-child [role="group"]'
    ],
    commentBox: [
      '[data-testid="tweetTextarea_0"]',
      '.public-DraftEditor-content',
      '[contenteditable="true"][role="textbox"]'
    ]
  };

  function getPostText(postEl) {
    for (const sel of SELECTORS.postText) {
      const el = postEl.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim().replace(/\s+/g, ' ');
    }
    return '';
  }

  function getActionBar(postEl) {
    for (const sel of SELECTORS.actionBar) {
      const el = postEl.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function insertIntoCommentBox(text) {
    for (const sel of SELECTORS.commentBox) {
      const box = document.querySelector(sel);
      if (box) {
        box.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        ['input', 'keyup'].forEach(evt => box.dispatchEvent(new Event(evt, { bubbles: true })));
        return;
      }
    }
    navigator.clipboard.writeText(text);
    alert('Reply box not found — text copied to clipboard! Click Reply on the tweet first.');
  }

  function injectButton(postEl) {
    if (postEl.querySelector('[data-aicg="true"]')) return;

    const postText = getPostText(postEl);
    if (!postText || postText.length < 10) return;

    const btn = document.createElement('button');
    btn.className = 'aicg-inject-btn aicg-twitter';
    btn.setAttribute('data-aicg', 'true');
    btn.innerHTML = '<span>✦ AI Reply</span>';

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      showModal(postText);
    });

    const actionBar = getActionBar(postEl);
    if (actionBar) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.appendChild(btn);
      actionBar.appendChild(wrapper);
    }
  }

  function showModal(postText) {
    document.getElementById('aicg-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'aicg-modal-overlay';
    overlay.innerHTML = buildModalHTML(postText);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('aicg-visible'));
    bindEvents(overlay, postText, (text) => insertIntoCommentBox(text));
  }

  function buildModalHTML(postText) {
    const preview = postText.slice(0, 280) + (postText.length > 280 ? '…' : '');
    const safe = preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div id="aicg-modal" role="dialog" aria-modal="true">
        <div id="aicg-modal-header">
          <div id="aicg-modal-title"><span class="aicg-sparkle">✦</span> AI Reply Generator</div>
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
          <div class="aicg-preview-label">🐦 Tweet context</div>
          <div id="aicg-post-text">${safe}</div>
        </div>
        <div id="aicg-output-area" class="aicg-hidden">
          <textarea id="aicg-reply-text" rows="4" spellcheck="true"></textarea>
          <div id="aicg-disclaimer">✦ AI-generated content — please review before posting</div>
        </div>
        <div id="aicg-loading" class="aicg-hidden">
          <div class="aicg-loader"></div>
          <span>Crafting your reply…</span>
        </div>
        <div id="aicg-error" class="aicg-hidden"></div>
        <div id="aicg-actions">
          <button id="aicg-generate-btn" class="aicg-btn-primary">✦ Generate Reply</button>
          <div id="aicg-secondary-actions" class="aicg-hidden">
            <button id="aicg-regen-btn" class="aicg-btn-secondary">↺ Regen</button>
            <button id="aicg-copy-btn" class="aicg-btn-secondary">⎘ Copy</button>
            <button id="aicg-insert-btn" class="aicg-btn-accent">↳ Insert</button>
          </div>
        </div>
      </div>`;
  }

  function bindEvents(overlay, postText, insertCallback) {
    let tone = 'professional', length = 'short', intent = 'reply';

    overlay.querySelector('#aicg-close-btn').addEventListener('click', () => closeModal(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });

    const bindPills = (id, setter) => {
      overlay.querySelectorAll(`#${id} .aicg-pill`).forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll(`#${id} .aicg-pill`).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          setter(btn.dataset.value);
        });
      });
    };
    bindPills('aicg-tone', v => tone = v);
    bindPills('aicg-length', v => length = v);
    bindPills('aicg-intent', v => intent = v);

    const doGenerate = () => {
      setLoading(overlay, true);
      showError(overlay, '');
      chrome.runtime.sendMessage(
        { action: 'generateReply', payload: { postContent: postText, tone, length, intent } },
        res => {
          setLoading(overlay, false);
          if (res?.success) {
            overlay.querySelector('#aicg-reply-text').value = res.reply;
            overlay.querySelector('#aicg-output-area').classList.remove('aicg-hidden');
            overlay.querySelector('#aicg-secondary-actions').classList.remove('aicg-hidden');
          } else {
            showError(overlay, res?.error || 'Something went wrong.');
          }
        }
      );
    };

    overlay.querySelector('#aicg-generate-btn').addEventListener('click', doGenerate);
    overlay.querySelector('#aicg-regen-btn').addEventListener('click', doGenerate);
    overlay.querySelector('#aicg-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(overlay.querySelector('#aicg-reply-text').value).then(() => {
        const btn = overlay.querySelector('#aicg-copy-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = '⎘ Copy', 2000);
      });
    });
    overlay.querySelector('#aicg-insert-btn').addEventListener('click', () => {
      const text = overlay.querySelector('#aicg-reply-text').value;
      if (text) { insertCallback(text); closeModal(overlay); }
    });
  }

  function setLoading(overlay, show) {
    overlay.querySelector('#aicg-loading').classList.toggle('aicg-hidden', !show);
    overlay.querySelector('#aicg-generate-btn').disabled = show;
  }
  function showError(overlay, msg) {
    const el = overlay.querySelector('#aicg-error');
    el.textContent = msg;
    el.classList.toggle('aicg-hidden', !msg);
  }
  function closeModal(overlay) {
    overlay.classList.remove('aicg-visible');
    setTimeout(() => overlay.remove(), 300);
  }

  // ── Observer ─────────────────────────────────────────────────────────────────
  function processTweets() {
    document.querySelectorAll(SELECTORS.postContainer.join(', ')).forEach(injectButton);
  }

  new MutationObserver(processTweets).observe(document.body, { childList: true, subtree: true });
  setTimeout(processTweets, 2000);

})();
