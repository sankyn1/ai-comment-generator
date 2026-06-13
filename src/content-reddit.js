// content-reddit.js - Reddit thread context extractor and button injector

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getMainPostContext() {
    const postEl = document.querySelector('shreddit-post');
    if (!postEl) return '';
    const title = postEl.getAttribute('post-title') || postEl.getAttribute('title') || postEl.querySelector('h1')?.textContent || '';
    const bodyText = postEl.querySelector('[slot="text-body"]')?.textContent || '';
    return `Main Post Title: ${title}\nPost Body: ${bodyText}`.replace(/\s+/g, ' ').trim();
  }

  function getCommentText(commentEl) {
    const body = commentEl.querySelector('#comment-fold-rtjson, [slot="comment"]');
    return body ? body.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function findCommentBox(anchorEl) {
    // Reddit dynamically renders text editors (shreddit-composer) below comments when replying
    // Look closely in the DOM hierarchy of the anchor element or its children
    let composers = Array.from(document.querySelectorAll('shreddit-composer div[contenteditable="true"], faceplate-tracker[noun="comment"] textarea, shreddit-composer'));
    for (const c of composers) {
      if (c.offsetParent !== null) {
        if (c.hasAttribute('contenteditable')) return c;
        const rich = c.querySelector('div[contenteditable="true"], textarea');
        if (rich) return rich;
        return c;
      }
    }
    return null;
  }

  function insertIntoCommentBox(anchorEl, text) {
    const box = findCommentBox(anchorEl);
    if (!box) {
      navigator.clipboard.writeText(text).catch(() => {});
      alert('✦ AI Reply\\n\\nComment box not found — text copied! Click "Reply" and paste.');
      return;
    }
    box.focus();
    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      const start = box.selectionStart || 0;
      box.value = box.value.substring(0, start) + text + box.value.substring(box.selectionEnd || 0);
      box.selectionStart = box.selectionEnd = start + text.length;
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
    ['input', 'keyup', 'change'].forEach(t => box.dispatchEvent(new Event(t, { bubbles: true })));
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }

  // ── Button Injection ─────────────────────────────────────────────────────────

  function injectMainPostButton(postEl) {
    if (postEl.querySelector('[data-aicg-main="true"]')) return;
    
    // Reddit main post action bar is typically <shreddit-post-action-row>
    const actionRow = postEl.querySelector('shreddit-post-action-row') || postEl.querySelector('[slot="credit-bar"]');
    if (!actionRow) return;

    const btn = document.createElement('button');
    btn.className = 'aicg-inject-btn';
    btn.setAttribute('data-aicg-main', 'true');
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<span>✦ AI Reply</span>';
    btn.style.marginLeft = '12px';
    btn.style.alignSelf = 'center';

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const context = `Main Post Context:\n${getMainPostContext()}`;
      showModal(context, postEl);
    });

    // Determine injection context based on inner html or slots
    actionRow.appendChild(btn);
  }

  function injectCommentButton(commentEl) {
    if (commentEl.querySelector('[data-aicg="true"]')) return;

    const actionRow = commentEl.querySelector('shreddit-comment-action-row') || commentEl.querySelector('[slot="commentActionRow"]');
    if (!actionRow) return;

    const btn = document.createElement('button');
    btn.className = 'aicg-inject-btn';
    btn.setAttribute('data-aicg', 'true');
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<span>✦ AI Reply</span>';
    btn.style.marginLeft = '12px';
    btn.style.alignSelf = 'center';

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const mainContext = getMainPostContext();
      const commentContext = getCommentText(commentEl);
      const fullContext = `Main Post Context:\n${mainContext}\n\nReplying to User Comment:\n${commentContext}`;
      showModal(fullContext, commentEl);
    });

    const wrapper = actionRow.shadowRoot ? actionRow : actionRow;
    wrapper.appendChild(btn);
  }

  // ── Modal ────────────────────────────────────────────────────────────────────
  function showModal(postText, anchorEl) {
    document.getElementById('aicg-modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aicg-modal-overlay';
    // Isolate styles by appending it high up
    overlay.innerHTML = buildModalHTML(postText);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('aicg-visible'));
    bindEvents(overlay, postText, text => insertIntoCommentBox(anchorEl, text));
  }

  function buildModalHTML(postText) {
    const preview = postText.slice(0, 300) + (postText.length > 300 ? '…' : '');
    const safe = preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div id="aicg-modal" role="dialog" aria-modal="true">
        <div id="aicg-modal-header">
          <div id="aicg-modal-title"><span class="aicg-sparkle">✦</span> AI Reply Generator</div>
          <button id="aicg-close-btn" type="button" aria-label="Close">✕</button>
        </div>
        <div id="aicg-controls">
          <div class="aicg-control-group">
            <label class="aicg-label">Tone</label>
            <div class="aicg-pills" id="aicg-tone">
              <button class="aicg-pill active" type="button" data-value="professional">Professional</button>
              <button class="aicg-pill" type="button" data-value="casual">Casual</button>
              <button class="aicg-pill" type="button" data-value="witty">Witty</button>
            </div>
          </div>
          <div class="aicg-control-group">
            <label class="aicg-label">Length</label>
            <div class="aicg-pills" id="aicg-length">
              <button class="aicg-pill active" type="button" data-value="short">Short</button>
              <button class="aicg-pill" type="button" data-value="medium">Medium</button>
            </div>
          </div>
          <div class="aicg-control-group">
            <label class="aicg-label">Intent</label>
            <div class="aicg-pills" id="aicg-intent">
              <button class="aicg-pill active" type="button" data-value="reply">Reply</button>
              <button class="aicg-pill" type="button" data-value="question">Question</button>
              <button class="aicg-pill" type="button" data-value="appreciation">Appreciate</button>
            </div>
          </div>
        </div>
        <div id="aicg-post-preview">
          <div class="aicg-preview-label">📄 Post context</div>
          <div id="aicg-post-text">${safe}</div>
        </div>
        <div id="aicg-output-area" class="aicg-hidden">
          <textarea id="aicg-reply-text" rows="4" spellcheck="true" placeholder="Your AI reply will appear here…"></textarea>
          <div id="aicg-disclaimer">✦ AI-generated content — please review before posting</div>
        </div>
        <div id="aicg-loading" class="aicg-hidden">
          <div class="aicg-loader"></div>
          <span>Crafting your reply…</span>
        </div>
        <div id="aicg-error" class="aicg-hidden"></div>
        <div id="aicg-actions">
          <button id="aicg-generate-btn" type="button" class="aicg-btn-primary">✦ Generate Reply</button>
          <div id="aicg-secondary-actions" class="aicg-hidden">
            <button id="aicg-regen-btn" type="button" class="aicg-btn-secondary">↺ Regen</button>
            <button id="aicg-copy-btn" type="button" class="aicg-btn-secondary">⎘ Copy</button>
            <button id="aicg-insert-btn" type="button" class="aicg-btn-accent">↳ Insert</button>
          </div>
        </div>
      </div>`;
  }

  function bindEvents(overlay, postText, insertCallback) {
    let tone = 'professional', length = 'short', intent = 'reply';

    overlay.querySelector('#aicg-close-btn').addEventListener('click', () => closeModal(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
    const esc = e => { if (e.key === 'Escape') { closeModal(overlay); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);

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

    const doGenerate = () => generateReply(overlay, postText, tone, length, intent);
    overlay.querySelector('#aicg-generate-btn').addEventListener('click', doGenerate);
    overlay.querySelector('#aicg-regen-btn').addEventListener('click', doGenerate);

    overlay.querySelector('#aicg-copy-btn').addEventListener('click', () => {
      const text = overlay.querySelector('#aicg-reply-text').value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
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

  function generateReply(overlay, postText, tone, length, intent) {
    setLoading(overlay, true);
    showError(overlay, '');
    chrome.runtime.sendMessage(
      { action: 'generateReply', payload: { postContent: postText, tone, length, intent } },
      response => {
        setLoading(overlay, false);
        if (response?.success) {
          overlay.querySelector('#aicg-reply-text').value = response.reply;
          overlay.querySelector('#aicg-output-area').classList.remove('aicg-hidden');
          overlay.querySelector('#aicg-secondary-actions').classList.remove('aicg-hidden');
        } else {
          showError(overlay, response?.error || 'Something went wrong. Please try again.');
        }
      }
    );
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
    setTimeout(() => overlay?.remove(), 300);
  }

  // ── MutationObserver ─────────────────────────────────────────────────────────

  function processPosts() {
    document.querySelectorAll('shreddit-post').forEach(injectMainPostButton);
    document.querySelectorAll('shreddit-comment').forEach(injectCommentButton);
  }

  let debounce;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(processPosts, 500);
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(processPosts, 1500);
  setTimeout(processPosts, 3500);

})();
