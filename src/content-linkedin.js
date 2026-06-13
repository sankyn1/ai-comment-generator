// content-linkedin.js - LinkedIn post detector and button injector
// Selectors verified against live LinkedIn DOM (April 2025)
// LinkedIn uses hashed CSS classes — we rely entirely on stable semantic attributes.

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getPostText(postEl) {
    // Attempt to expand "...see more" buttons to ensure full text is visible/loaded
    const seeMoreBtns = postEl.querySelectorAll('button');
    for (const btn of seeMoreBtns) {
      const btnText = (btn.textContent || '').trim().toLowerCase();
      if (btnText === 'see more' || btnText.includes('see more')) {
        try { btn.click(); } catch(e) {}
      }
    }

    // Accumulate text from all text boxes (e.g., standard post + shared article/repost)
    const boxes = postEl.querySelectorAll('[data-testid="expandable-text-box"]');
    const fullTextBlocks = [];
    for (const box of boxes) {
      let text = (box.innerText || box.textContent || '').trim();
      if (text) {
        // Remove trailing "…see more" artifacts if they still incorrectly appear
        text = text.replace(/…\s*see more\s*/gi, '').trim();
        fullTextBlocks.push(text);
      }
    }
    
    if (fullTextBlocks.length > 0) {
      return fullTextBlocks.join('\n\n').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function getActionBar(postEl) {
    // Strategy 1: LinkedIn sets min-height: 4.4rem on the Like/Comment/Repost/Send bar
    for (const div of postEl.querySelectorAll('div[style]')) {
      if (div.style.minHeight === '4.4rem') return div;
    }

    // Strategy 2: Find the "Reaction button state" button (Like), walk up to action bar
    for (const btn of postEl.querySelectorAll('button')) {
      const label = btn.getAttribute('aria-label') || '';
      if (label.includes('Reaction button state')) {
        let el = btn.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!el) break;
          if (el.textContent.includes('Comment') && el.textContent.includes('Repost')) return el;
          el = el.parentElement;
        }
      }
    }

    // Strategy 3: Find a div that contains Like + Comment + Repost text
    for (const div of postEl.querySelectorAll('div')) {
      const kids = div.children.length;
      if (kids >= 3 && kids <= 10) {
        const t = div.textContent || '';
        if (t.includes('Like') && t.includes('Comment') && t.includes('Repost')) return div;
      }
    }

    return null;
  }

  function findCommentBox(postEl) {
    const selectors = [
      '[aria-label="Text editor for creating comment"]',
      '[data-testid="ui-core-tiptap-text-editor-wrapper"] [contenteditable="true"]',
      '.tiptap.ProseMirror[contenteditable="true"]',
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]'
    ];
    for (const sel of selectors) {
      const el = postEl.querySelector(sel) || document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function insertIntoCommentBox(postEl, text) {
    const box = findCommentBox(postEl);
    if (!box) {
      navigator.clipboard.writeText(text).catch(() => {});
      alert('✦ AI Reply\n\nComment box not found — text copied to clipboard!\nClick "Comment" on the post first, then paste.');
      return;
    }
    box.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    ['input', 'keyup', 'change'].forEach(t => box.dispatchEvent(new Event(t, { bubbles: true })));
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }

  // ── Button Injection ─────────────────────────────────────────────────────────

  function injectButton(postEl) {
    if (postEl.querySelector('[data-aicg="true"]')) return;

    const postText = getPostText(postEl);
    if (!postText) return;

    const btn = document.createElement('button');
    btn.className = 'aicg-inject-btn';
    btn.setAttribute('data-aicg', 'true');
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<span>✦ AI Reply</span>';

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      showModal(postText, postEl);
    });

    const actionBar = getActionBar(postEl);
    if (actionBar) {
      actionBar.appendChild(btn);
    } else {
      // Fallback: insert after the post text
      const anchor = postEl.querySelector('[data-testid="expandable-text-box"]')
        ?.closest('p')?.parentElement || postEl;
      const wrapper = document.createElement('div');
      wrapper.className = 'aicg-btn-wrapper';
      wrapper.appendChild(btn);
      anchor.insertAdjacentElement('afterend', wrapper);
    }
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  function showModal(postText, postEl) {
    document.getElementById('aicg-modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aicg-modal-overlay';
    overlay.innerHTML = buildModalHTML(postText);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('aicg-visible'));
    bindEvents(overlay, postText, text => insertIntoCommentBox(postEl, text));
  }

  function buildModalHTML(postText) {
    const preview = postText.slice(0, 280) + (postText.length > 280 ? '…' : '');
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
    // role="listitem" + componentkey is LinkedIn's stable feed post wrapper
    document.querySelectorAll('[role="listitem"][componentkey]').forEach(el => {
      if (el.querySelector('[data-aicg="true"]')) return;
      if (!el.querySelector('[data-testid="expandable-text-box"]')) return;
      injectButton(el);
    });
  }

  let debounce;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(processPosts, 500);
  }).observe(document.body, { childList: true, subtree: true });

  // LinkedIn lazy-loads — retry a few times on initial load
  setTimeout(processPosts, 1500);
  setTimeout(processPosts, 3500);
  setTimeout(processPosts, 7000);

})();
