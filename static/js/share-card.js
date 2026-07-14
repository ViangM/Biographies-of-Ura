/**
 * Share Card Generator
 * Generates a shareable image from the current article's title and content using html2canvas.
 */

let shareCardImageDataUrl = null;

/**
 * Load an external script dynamically.
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Don't reload if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Get the plain text content from the article body, preserving paragraphs.
 */
function getArticleContent() {
    const contentEl = document.querySelector('.post-content');
    if (!contentEl) return '';

    // Clone the content to avoid modifying the visible DOM
    const clone = contentEl.cloneNode(true);

    // Remove share-card elements from the clone (button, hidden render card, modal)
    const elementsToRemove = clone.querySelectorAll(
        '.share-card-wrapper, #share-card-render, #share-card-modal'
    );
    elementsToRemove.forEach(el => el.remove());

    // Build an array of text blocks from the HTML content
    const blocks = [];
    const children = clone.children;

    for (const child of children) {
        const tag = child.tagName ? child.tagName.toLowerCase() : '';
        // Skip style/script/noscript tags and hidden elements
        if (['style', 'script', 'noscript'].includes(tag)) continue;
        const text = child.textContent?.trim();
        if (!text) continue;

        // Handle headings
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            blocks.push({ type: 'heading', text });
        }
        // Handle blockquotes
        else if (tag === 'blockquote') {
            blocks.push({ type: 'quote', text });
        }
        // Handle lists
        else if (tag === 'ul' || tag === 'ol') {
            const items = child.querySelectorAll('li');
            items.forEach(item => {
                const itemText = item.textContent?.trim();
                if (itemText) blocks.push({ type: 'list-item', text: '• ' + itemText });
            });
        }
        // Handle code blocks
        else if (tag === 'pre') {
            const code = child.querySelector('code');
            const codeText = code ? code.textContent?.trim() : text;
            if (codeText) blocks.push({ type: 'code', text: codeText });
        }
        // Everything else as paragraph
        else {
            blocks.push({ type: 'paragraph', text });
        }
    }

    return blocks;
}

/**
 * Build the HTML content for the share card body.
 */
function buildCardBody(blocks) {
    if (!blocks.length) return '<p style="color:#999;">（无正文内容）</p>';

    return blocks.map(block => {
        switch (block.type) {
            case 'heading':
                return `<h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:16px 0 8px;line-height:1.5;">${escapeHtml(block.text)}</h2>`;
            case 'quote':
                return `<blockquote style="border-left:3px solid #4a90d9;padding:8px 16px;margin:12px 0;color:#555;background:#f5f7fa;border-radius:0 4px 4px 0;line-height:1.7;">${escapeHtml(block.text)}</blockquote>`;
            case 'list-item':
                return `<p style="margin:4px 0 4px 16px;line-height:1.7;color:#333;">${escapeHtml(block.text)}</p>`;
            case 'code':
                return `<pre style="background:#f4f4f4;padding:12px 16px;border-radius:6px;font-size:13px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-wrap:break-word;margin:10px 0;font-family:'SF Mono','Fira Code','Consolas',monospace;">${escapeHtml(block.text)}</pre>`;
            case 'paragraph':
            default:
                return `<p style="margin:8px 0;line-height:1.8;color:#333;">${escapeHtml(block.text)}</p>`;
        }
    }).join('\n');
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format a date string to Chinese format like "2024年6月30日".
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Try parsing as ISO date (from the title attribute)
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
        }
    } catch (e) { /* fall through */ }
    // Fallback: return the raw string
    return dateStr;
}

/**
 * Extract the post date from the page meta.
 */
function getPostDate() {
    const metaEl = document.querySelector('.post-meta');
    if (!metaEl) return '';

    // Try to find a time element or a span with a title (date) attribute
    const timeEl = metaEl.querySelector('time');
    if (timeEl) {
        return timeEl.getAttribute('datetime') || timeEl.textContent.trim();
    }

    // Look for a span with a title attribute that looks like a date
    const spans = metaEl.querySelectorAll('span[title]');
    for (const span of spans) {
        const title = span.getAttribute('title');
        if (/\d{4}-\d{2}-\d{2}/.test(title)) {
            return title;
        }
    }

    // Last resort: first span's text
    const firstSpan = metaEl.querySelector('span');
    return firstSpan ? firstSpan.textContent.trim() : '';
}

/**
 * Main function: generate the share card image.
 */
async function generateShareCard() {
    const btn = document.querySelector('.share-card-btn');
    if (!btn) return;

    // Show loading state
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span>⏳ 生成中...</span>';
    btn.disabled = true;

    try {
        // Dynamically load html2canvas if not already available
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        }

        // --- Collect data ---

        // Title
        const titleEl = document.querySelector('.post-title');
        const title = titleEl ? titleEl.textContent.trim() : document.title;

        // Date
        const rawDate = getPostDate();
        const formattedDate = formatDate(rawDate);

        // Author
        const author = '@Viang';

        // Article content blocks
        const blocks = getArticleContent();
        const cardBodyHtml = buildCardBody(blocks);

        // QR code for current page URL
        const pageUrl = window.location.href;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(pageUrl)}`;

        // --- Populate the hidden card ---
        document.getElementById('share-card-title').textContent = title;
        document.getElementById('share-card-date').textContent = formattedDate;
        document.getElementById('share-card-author').textContent = author;
        document.getElementById('share-card-body').innerHTML = cardBodyHtml;

        // Load QR code image and wait for it
        const qrImg = document.getElementById('share-card-qrcode');
        qrImg.src = qrUrl;
        qrImg.style.display = 'block';
        await new Promise((resolve) => {
            qrImg.onload = resolve;
            qrImg.onerror = () => {
                qrImg.style.display = 'none';
                resolve();
            };
            setTimeout(resolve, 5000);
        });

        // --- Render with html2canvas ---
        const cardEl = document.getElementById('share-card-render');

        // Temporarily move it into view so html2canvas can render it properly
        cardEl.style.position = 'fixed';
        cardEl.style.left = '0';
        cardEl.style.top = '0';
        cardEl.style.zIndex = '-1';
        cardEl.style.opacity = '1';

        const canvas = await html2canvas(cardEl, {
            backgroundColor: '#ffffff',
            scale: 2, // 2x for retina quality
            useCORS: true,
            logging: false,
        });

        // Hide the card again
        cardEl.style.position = 'absolute';
        cardEl.style.left = '-9999px';
        cardEl.style.top = '0';
        cardEl.style.zIndex = '';
        cardEl.style.opacity = '';

        // Get the image data URL
        shareCardImageDataUrl = canvas.toDataURL('image/png');

        // Show the modal (will auto-trigger share if available)
        const modal = document.getElementById('share-card-modal');
        const img = document.getElementById('share-card-image');
        img.src = shareCardImageDataUrl;
        modal.style.display = 'flex';

        // Update share button visibility
        updateShareButtonVisibility();

    } catch (error) {
        console.error('Share card generation failed:', error);
        alert('生成分享图片失败，请稍后再试。');
    } finally {
        // Restore button state
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

/**
 * Convert base64 data URL to a Blob.
 */
function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bytes = atob(parts[1]);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        buffer[i] = bytes.charCodeAt(i);
    }
    return new Blob([buffer], { type: mime });
}

/**
 * Get the cached share-card blob (create on demand).
 */
function getShareCardBlob() {
    if (!shareCardImageDataUrl) return null;
    return dataUrlToBlob(shareCardImageDataUrl);
}

/**
 * Get the filename for the share card.
 */
function getShareCardFilename() {
    const titleEl = document.querySelector('.post-title');
    const title = titleEl ? titleEl.textContent.trim() : 'share-card';
    return title.replace(/[\\/:*?"<>|]/g, '-').substring(0, 50) + '.png';
}

/**
 * Show/hide the native share button based on browser support.
 */
function updateShareButtonVisibility() {
    const shareBtn = document.getElementById('share-card-share-btn');
    if (!shareBtn) return;
    // Web Share API with file support
    if (navigator.share && navigator.canShare) {
        const blob = getShareCardBlob();
        const file = new File([blob], getShareCardFilename(), { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
            shareBtn.style.display = '';
            return;
        }
    }
    shareBtn.style.display = 'none';
}

/**
 * Share the card image using Web Share API.
 */
async function shareCardImage() {
    if (!shareCardImageDataUrl) return;
    try {
        const blob = getShareCardBlob();
        const file = new File([blob], getShareCardFilename(), { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: document.title,
            });
            return;
        }
        // Fallback: try sharing just the URL
        if (navigator.share) {
            await navigator.share({
                title: document.title,
                url: window.location.href,
            });
        }
    } catch (error) {
        // User cancelled or API error — silently ignore
        if (error.name !== 'AbortError') {
            console.error('Share failed:', error);
        }
    }
}

/**
 * Copy the share card image to clipboard.
 */
async function copyShareCard(btn) {
    if (!shareCardImageDataUrl) return;
    try {
        const blob = getShareCardBlob();
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        // Show brief feedback on the clicked button
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅ 已复制';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
    } catch (error) {
        console.error('Copy failed:', error);
        alert('复制失败，请尝试保存图片。');
    }
}

/**
 * Close the share card modal.
 */
function closeShareModal() {
    const modal = document.getElementById('share-card-modal');
    modal.style.display = 'none';
}

/**
 * Download the generated share card image.
 */
function downloadShareCard() {
    if (!shareCardImageDataUrl) return;
    const filename = getShareCardFilename();
    const link = document.createElement('a');
    link.download = filename;
    link.href = shareCardImageDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Close modal on background click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('share-card-modal');
    if (e.target === modal) {
        closeShareModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeShareModal();
    }
});
