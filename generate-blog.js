#!/usr/bin/env node
/**
 * generate-blog.js — PanoArt360 Blog Automation
 *
 * Reads blog-queue.json, generates full HTML articles via OpenRouter API,
 * downloads Pexels images, and updates blog.html with new article cards.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-or-... node generate-blog.js [--count N] [--model MODEL]
 *
 * Examples:
 *   OPENROUTER_API_KEY=sk-or-... node generate-blog.js
 *   OPENROUTER_API_KEY=sk-or-... node generate-blog.js --count 3
 *   OPENROUTER_API_KEY=sk-or-... node generate-blog.js --count 1 --model openai/gpt-4o
 */

'use strict';

const https = require('https');
const fs   = require('fs');
const path = require('path');

// ─── Paths ────────────────────────────────────────────────────────────────────
const QUEUE_FILE = path.join(__dirname, 'blog-queue.json');
const APP_DIR    = path.join(__dirname, 'app');
const IMG_DIR    = path.join(APP_DIR, 'img', 'blog');
const BLOG_HTML  = path.join(APP_DIR, 'blog.html');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
const COUNT = parseInt(getArg('--count', '1'), 10);
const MODEL = getArg('--model', 'anthropic/claude-sonnet-4-5');

// ─── Env ──────────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── Utility: HTTPS GET (follows redirects) ───────────────────────────────────
function httpsGet(url, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: headers }, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function()  { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Utility: HTTPS POST ──────────────────────────────────────────────────────
function httpsPost(urlStr, headers, body) {
  return new Promise(function(resolve, reject) {
    const u    = new URL(urlStr);
    const data = JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      port:     443,
      path:     u.pathname,
      method:   'POST',
      headers:  Object.assign({
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      }, headers),
    };
    const req = https.request(opts, function(res) {
      const chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function() {
        const text = Buffer.concat(chunks).toString('utf8');
        try   { resolve(JSON.parse(text)); }
        catch (e) { reject(new Error('JSON parse error: ' + text.slice(0, 300))); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Pexels: Download one image ───────────────────────────────────────────────
async function downloadPexelsImage(query, pexelsApiKey, filename) {
  const dest = path.join(IMG_DIR, filename);
  if (fs.existsSync(dest)) {
    console.log('    [pexels] already exists: ' + filename);
    return filename;
  }
  console.log('    [pexels] search: "' + query + '"');
  const searchUrl = 'https://api.pexels.com/v1/search?query=' +
    encodeURIComponent(query) + '&per_page=3&orientation=landscape';
  const buf  = await httpsGet(searchUrl, { Authorization: pexelsApiKey });
  const data = JSON.parse(buf.toString('utf8'));

  if (!data.photos || data.photos.length === 0) {
    console.warn('    [pexels] no results for "' + query + '"');
    return null;
  }
  // Pick a random photo from the first 3 results to get variety across images
  const photo  = data.photos[Math.floor(Math.random() * data.photos.length)];
  const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
  console.log('    [pexels] downloading...');
  const imgBuf = await httpsGet(imgUrl, {});
  fs.writeFileSync(dest, imgBuf);
  console.log('    [pexels] saved ' + filename + ' (' + Math.round(imgBuf.length / 1024) + ' KB)');
  return filename;
}

// ─── Format date in German ────────────────────────────────────────────────────
function formatDateDE(iso) {
  const months = ['Jan.','Feb.','März','Apr.','Mai','Juni',
                  'Juli','Aug.','Sep.','Okt.','Nov.','Dez.'];
  const parts = iso.split('-').map(Number);
  return parts[2] + '. ' + months[parts[1] - 1] + ' ' + parts[0];
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Escape JSON string value ─────────────────────────────────────────────────
function escJ(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// ─── Generate article body HTML via OpenRouter ────────────────────────────────
async function generateArticleContent(article) {
  console.log('    [openrouter] generating content via model: ' + MODEL);

  const systemPrompt =
    'Du bist ein erfahrener Content-Autor für PanoArt360, eine Werbe- und Webdesign-Agentur ' +
    'aus Limbach-Oberfrohna, Sachsen. Du schreibst professionelle, SEO-optimierte Blogartikel ' +
    'auf Deutsch für kleine und mittlere Unternehmen (KMU) in der Region Chemnitz/Sachsen. ' +
    'Dein Stil ist sachkundig, praxisorientiert und verständlich – kein unnötiger Fachjargon. ' +
    'Unternehmen: PanoArt360, Inhaberin Yvonne Weishar. Leistungen: Webdesign, SEO, ' +
    'Fotografie, Branding, 360°-Fotografie.';

  const userPrompt =
    'Schreibe den vollständigen Inhalt für folgenden Blogartikel:\n\n' +
    'Titel: "' + article.title + '"\n' +
    'Kategorie: ' + article.category + '\n' +
    'SEO-Keywords: ' + article.keywords.join(', ') + '\n' +
    'Ziel-Lesezeit: ca. ' + article.read_time + ' Minuten\n' +
    'Teaser: ' + article.excerpt + '\n\n' +
    'FORMAT-REGELN:\n' +
    '- Gib NUR den Inhalt zurück, der direkt in <article class="article-content"> eingefügt wird.\n' +
    '- Kein <!DOCTYPE>, kein <html>, kein <head>, kein <body>, kein <article>-Tag.\n' +
    '- Verwende <h2>-Tags für Abschnitte (4–6 Abschnitte).\n' +
    '- Verwende <p>-Tags für Absätze, <strong> für Schlüsselbegriffe.\n' +
    '- Füge maximal 2 Listen (<ul><li>…</li></ul>) ein.\n' +
    '- Callouts: <div class="article-highlight"><p>Wichtiger Hinweis hier.</p></div>\n' +
    '- Füge an genau 2 Stellen einen Bild-Platzhalter ein:\n' +
    '  <figure class="article-figure" data-slot="1"><figcaption>Kurze Bildbeschreibung</figcaption></figure>\n' +
    '  <figure class="article-figure" data-slot="2"><figcaption>Kurze Bildbeschreibung</figcaption></figure>\n' +
    '- Letzter Abschnitt muss "Fazit" heißen.\n' +
    '- Erwähne PanoArt360 natürlich 1–2 Mal als lokale Agentur (nicht werblich).\n' +
    '- Kein abschließender CTA-Block (wird automatisch ergänzt).';

  const resp = await httpsPost(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      'Authorization':  'Bearer ' + OPENROUTER_API_KEY,
      'HTTP-Referer':   'https://www.panoart360.de',
      'X-Title':        'PanoArt360 Blog Generator',
    },
    {
      model:      MODEL,
      messages:   [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens:  4096,
      temperature: 0.72,
    }
  );

  if (resp.error) {
    throw new Error('OpenRouter API error: ' + JSON.stringify(resp.error));
  }

  const content = resp.choices && resp.choices[0] && resp.choices[0].message &&
    resp.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from OpenRouter. Full response: ' + JSON.stringify(resp).slice(0, 400));
  }

  console.log('    [openrouter] received ' + content.length + ' chars');
  return content;
}

// ─── Inject images into body content ─────────────────────────────────────────
function injectImages(content, img1Path, img2Path, title) {
  const imgTag = function(src, alt) {
    return '<img src="' + src + '" alt="' + esc(alt) + '" loading="lazy">';
  };

  // Replace data-slot="1" and data-slot="2" placeholders
  content = content.replace(
    /<figure class="article-figure" data-slot="1">([\s\S]*?)<\/figure>/,
    function(_, inner) {
      return img1Path
        ? '<figure class="article-figure">' + imgTag(img1Path, title) + inner + '</figure>'
        : '';
    }
  );
  content = content.replace(
    /<figure class="article-figure" data-slot="2">([\s\S]*?)<\/figure>/,
    function(_, inner) {
      return img2Path
        ? '<figure class="article-figure">' + imgTag(img2Path, title) + inner + '</figure>'
        : '';
    }
  );

  // Fallback: if no placeholders found, insert after second <h2>
  if (img1Path && !content.includes('<figure class="article-figure">')) {
    const h2s = [...content.matchAll(/<h2[^>]*>/g)];
    if (h2s.length >= 2) {
      const pos = h2s[1].index;
      const fig = '<figure class="article-figure">' + imgTag(img1Path, title) +
        '<figcaption>Abbildung: ' + esc(title) + '</figcaption></figure>\n';
      content = content.slice(0, pos) + fig + content.slice(pos);
    }
  }

  return content;
}

// ─── Build complete article HTML page ────────────────────────────────────────
function buildArticleHTML(article, bodyContent, images) {
  const dateDE      = formatDateDE(article.date);
  const slug        = article.slug;
  const canonical   = 'https://www.panoart360.de/blog/' + slug.replace(/^blog-/, '') + '/';
  const cardImg     = images.card   ? 'img/blog/' + images.card   : '';
  const heroImg     = images.hero   ? 'img/blog/' + images.hero   : '';
  const inline1Path = images.inline1 ? 'img/blog/' + images.inline1 : '';
  const inline2Path = images.inline2 ? 'img/blog/' + images.inline2 : '';

  const content = injectImages(bodyContent, inline1Path, inline2Path, article.title);

  return `<!DOCTYPE html>
<html lang="de" dir="ltr">

  <head>
    <meta charset="utf-8">
    <title>${esc(article.title)} | PanoArt360 Blog</title>
    <meta name="description" content="${esc(article.excerpt)}">
    <meta name="author" content="PanoArt360">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="canonical" href="${canonical}">

    <link rel="icon" href="img/favicon/favicon.ico" sizes="any">
    <link rel="icon" href="img/favicon/icon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="img/favicon/apple-touch-icon.png">
    <link rel="manifest" href="img/favicon/manifest.webmanifest">

    <meta property="og:title" content="${esc(article.title)}">
    <meta property="og:description" content="${esc(article.excerpt)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="de_DE">
    <meta property="og:site_name" content="PanoArt360">
    <meta property="og:image" content="https://www.panoart360.de/${cardImg || heroImg}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(article.title)}">
    <meta name="twitter:description" content="${esc(article.excerpt)}">
    <meta name="twitter:image" content="https://www.panoart360.de/${cardImg || heroImg}">

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "${escJ(article.title)}",
      "description": "${escJ(article.excerpt)}",
      "datePublished": "${article.date}",
      "dateModified": "${article.date}",
      "inLanguage": "de-DE",
      "author": { "@type": "Organization", "name": "PanoArt360", "url": "https://www.panoart360.de" },
      "publisher": {
        "@type": "Organization", "name": "PanoArt360",
        "logo": { "@type": "ImageObject", "url": "https://www.panoart360.de/img/pano-Logo.png" }
      },
      "image": "https://www.panoart360.de/${heroImg || cardImg}",
      "@id": "${canonical}",
      "mainEntityOfPage": "${canonical}",
      "articleSection": "${escJ(article.category)}",
      "keywords": "${article.keywords.map(escJ).join(', ')}"
    }
    </script>

    <link rel="stylesheet" type="text/css" href="css/loaders/loader.css">
    <link rel="stylesheet" type="text/css" href="css/plugins.css">
    <link rel="stylesheet" type="text/css" href="css/main.css">
    <meta name="theme-color" content="#1af2dc">

    <style>
      html, body { overflow: auto !important; height: auto !important; }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .article-page {
        background: #0d0d0f;
        min-height: 100vh;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e5e5e5;
      }

      /* ── Hero ── */
      .article-hero {
        position: relative;
        background: #0a0a0c;
        padding: 56px 0 48px;
        overflow: hidden;
        border-bottom: 1px solid rgba(26,242,220,0.12);
      }
      .article-hero::before {
        content: '';
        position: absolute; inset: 0;
        background-image:
          linear-gradient(rgba(26,242,220,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26,242,220,0.04) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      .article-hero::after {
        content: '';
        position: absolute; inset: 0;
        background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(26,242,220,0.07) 0%, transparent 70%);
        pointer-events: none;
      }
      .article-topbar {
        position: relative; z-index: 2;
        max-width: 880px; margin: 0 auto;
        padding: 0 32px 24px;
      }
      .article-topbar img { height: 38px; width: auto; display: block; }
      .article-hero__inner {
        position: relative; z-index: 1;
        max-width: 880px; margin: 0 auto;
        padding: 0 32px;
      }
      .article-hero__back {
        display: inline-flex; align-items: center; gap: 8px;
        color: rgba(255,255,255,0.4); text-decoration: none;
        font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
        margin-bottom: 28px; transition: color .2s;
      }
      .article-hero__back:hover { color: #1af2dc; }
      .article-hero__cat {
        display: inline-block;
        font-size: 10px; font-weight: 700;
        letter-spacing: 0.18em; text-transform: uppercase;
        color: #1af2dc; margin-bottom: 14px;
      }
      .article-hero__h1 {
        font-size: clamp(28px, 4.5vw, 52px);
        font-weight: 800; color: #fff;
        line-height: 1.1; margin-bottom: 20px;
        letter-spacing: -0.02em;
      }
      .article-hero__meta {
        display: flex; flex-wrap: wrap; gap: 20px;
        font-size: 12px; color: rgba(255,255,255,0.35);
      }
      .article-hero__meta span { display: flex; align-items: center; gap: 6px; }

      /* ── Banner ── */
      .article-banner {
        width: 100%; max-height: 480px; object-fit: cover;
        display: block; border-bottom: 1px solid rgba(255,255,255,0.06);
      }

      /* ── Content ── */
      .article-content {
        max-width: 820px;
        margin: 0 auto;
        padding: 52px 32px 80px;
      }
      .article-content h2 {
        font-size: clamp(20px, 3vw, 28px);
        font-weight: 700; color: #fff;
        margin: 48px 0 16px; letter-spacing: -0.01em;
      }
      .article-content h2:first-child { margin-top: 0; }
      .article-content p {
        font-size: 15px; line-height: 1.85;
        color: rgba(255,255,255,0.65); margin-bottom: 18px;
      }
      .article-content a { color: #1af2dc; text-decoration: none; }
      .article-content a:hover { text-decoration: underline; }
      .article-content strong { color: rgba(255,255,255,0.85); }
      .article-content ul, .article-content ol {
        padding-left: 24px; margin-bottom: 20px;
      }
      .article-content li {
        font-size: 15px; line-height: 1.8;
        color: rgba(255,255,255,0.65); margin-bottom: 6px;
      }
      .article-highlight {
        background: #16151a;
        border: 1px solid rgba(26,242,220,0.15);
        border-left: 3px solid #1af2dc;
        border-radius: 0 12px 12px 0;
        padding: 20px 24px; margin: 28px 0;
      }
      .article-highlight p { margin: 0; font-size: 14px; }

      /* ── Inline images ── */
      .article-figure {
        margin: 36px 0;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .article-figure img {
        width: 100%; display: block;
        max-height: 440px; object-fit: cover;
      }
      .article-figure figcaption {
        padding: 12px 16px;
        font-size: 12px; color: rgba(255,255,255,0.3);
        background: #16151a; border-top: 1px solid rgba(255,255,255,0.05);
        font-style: italic;
      }

      /* ── Related posts ── */
      .article-related {
        max-width: 820px; margin: 0 auto;
        padding: 0 32px 48px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .article-related__label {
        font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
        color: rgba(255,255,255,0.3); margin: 32px 0 20px;
        display: flex; align-items: center; gap: 12px;
      }
      .article-related__label::after {
        content: ''; flex: 1; height: 1px;
        background: rgba(255,255,255,0.07);
      }
      .article-related__grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
      }
      .article-related__card {
        background: #16151a; border: 1px solid rgba(255,255,255,0.07);
        border-radius: 14px; padding: 20px 22px;
        text-decoration: none; display: flex; flex-direction: column; gap: 8px;
        transition: border-color .2s;
      }
      .article-related__card:hover { border-color: rgba(26,242,220,0.25); }
      .article-related__cat {
        font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
        color: #1af2dc;
      }
      .article-related__title {
        font-size: 14px; font-weight: 600; color: #fff; line-height: 1.4;
      }

      /* ── CTA ── */
      .article-cta {
        max-width: 820px; margin: 0 auto 80px;
        padding: 0 32px;
      }
      .article-cta__inner {
        background: #16151a;
        border: 1px solid rgba(26,242,220,0.15);
        border-radius: 20px; padding: 40px 44px;
        position: relative; overflow: hidden;
        display: flex; align-items: center; justify-content: space-between;
        gap: 32px; flex-wrap: wrap;
      }
      .article-cta__inner::before {
        content: ''; position: absolute;
        top: -60px; right: -60px;
        width: 240px; height: 240px;
        background: radial-gradient(circle, rgba(26,242,220,0.08) 0%, transparent 70%);
        pointer-events: none;
      }
      .article-cta__text h2 {
        font-size: 20px; font-weight: 700; color: #fff;
        margin-bottom: 8px; letter-spacing: -0.01em;
      }
      .article-cta__text p {
        font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.6;
      }
      .article-cta__btn {
        flex-shrink: 0;
        display: inline-flex; align-items: center; gap: 10px;
        background: #1af2dc; color: #09090b;
        font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
        border: none; padding: 14px 28px; border-radius: 10px;
        cursor: pointer; text-decoration: none;
        transition: opacity .2s, transform .2s;
      }
      .article-cta__btn:hover { opacity: .87; transform: translateY(-2px); }

      @media (max-width: 600px) {
        .article-hero__inner, .article-content, .article-related, .article-cta {
          padding-left: 16px; padding-right: 16px;
        }
        .article-related__grid { grid-template-columns: 1fr; }
        .article-cta__inner { padding: 28px 24px; }
      }
    </style>
  </head>

  <body>
    <div class="article-page">

      <header class="article-hero">
        <div class="article-topbar">
          <a href="index.html"><img src="img/pano-Logo.png" alt="PanoArt360 Logo"></a>
        </div>
        <div class="article-hero__inner">
          <a href="blog.html" class="article-hero__back">&#8592; Zur&uuml;ck zum Blog</a>
          <div class="article-hero__cat">${esc(article.category)}</div>
          <h1 class="article-hero__h1">${esc(article.title)}</h1>
          <div class="article-hero__meta">
            <span>&#128197; ${dateDE}</span>
            <span>&#9201; ${article.read_time} Min. Lekt&uuml;re</span>
            <span>&#9997; PanoArt360</span>
          </div>
        </div>
      </header>
${heroImg ? '\n      <img class="article-banner" src="' + heroImg + '" alt="' + esc(article.title) + '" loading="eager">\n' : ''}
      <article class="article-content">
        ${content}
      </article>

      <section class="article-related">
        <div class="article-related__label">Weitere Beitr&auml;ge</div>
        <div class="article-related__grid">
          <a href="blog-dsgvo-2024.html" class="article-related__card">
            <div class="article-related__cat">DSGVO &amp; Recht</div>
            <div class="article-related__title">DSGVO 2025: Was Unternehmen jetzt wissen m&uuml;ssen</div>
          </a>
          <a href="blog-ki-chatgpt-dos-donts.html" class="article-related__card">
            <div class="article-related__cat">KI &amp; Digitalisierung</div>
            <div class="article-related__title">ChatGPT &amp; OpenAI im Unternehmen: 10 Dos &amp; Don'ts</div>
          </a>
        </div>
      </section>

      <section class="article-cta">
        <div class="article-cta__inner">
          <div class="article-cta__text">
            <h2>Ihr Projekt verdient mehr Perspektive.</h2>
            <p>PanoArt360 unterst&uuml;tzt Unternehmen in Limbach-Oberfrohna und der Region Chemnitz
               mit Webdesign, SEO und digitalem Marketing.</p>
          </div>
          <a href="mailto:info@panoart360.de" class="article-cta__btn">Jetzt anfragen &#8594;</a>
        </div>
      </section>

    </div><!-- /.article-page -->
  </body>

</html>`;
}

// ─── Update blog.html: prepend card to .blog-grid__posts ─────────────────────
function updateBlogHtml(article, images) {
  const html    = fs.readFileSync(BLOG_HTML, 'utf8');
  const dateDE  = formatDateDE(article.date);
  const cardImg = images.card ? 'img/blog/' + images.card : '';
  const marker  = '<div class="blog-grid__posts">';

  if (!html.includes(marker)) {
    console.warn('    [blog.html] grid marker not found — skipping card insertion');
    return;
  }

  const card = `
          <!-- Auto-generated: ${esc(article.title)} -->
          <a href="${article.slug}.html" class="blog-card" style="text-decoration:none;">
            <div class="blog-card__img-wrap">
              <img src="${cardImg}" class="blog-card__img" loading="lazy" alt="${esc(article.title)}">
            </div>
            <div class="blog-card__body">
              <div class="blog-card__meta">
                <span class="blog-card__date">${dateDE}</span>
                <span class="blog-card__sep"></span>
                <span class="blog-card__read">${article.read_time} Min. Lekt&uuml;re</span>
              </div>
              <h2 class="blog-card__title">${esc(article.title)}</h2>
              <p class="blog-card__excerpt">${esc(article.excerpt)}</p>
            </div>
            <div class="blog-card__footer">
              <span class="blog-card__author">PanoArt360</span>
              <div class="blog-card__arrow"><i class="fa-solid fa-arrow-right"></i></div>
            </div>
          </a>
`;

  const updated = html.replace(marker, marker + card);
  fs.writeFileSync(BLOG_HTML, updated, 'utf8');
  console.log('    [blog.html] card added for "' + article.title + '"');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Guard: API key
  if (!OPENROUTER_API_KEY) {
    console.error('\nERROR: OPENROUTER_API_KEY is not set.\n');
    console.error('Usage:');
    console.error('  OPENROUTER_API_KEY=sk-or-... node generate-blog.js [--count N] [--model MODEL]\n');
    console.error('Popular models via OpenRouter:');
    console.error('  anthropic/claude-sonnet-4-5   (default, recommended)');
    console.error('  openai/gpt-4o');
    console.error('  google/gemini-pro-1.5\n');
    process.exit(1);
  }

  // Ensure img/blog dir exists
  if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
  }

  // Load queue
  if (!fs.existsSync(QUEUE_FILE)) {
    console.error('ERROR: blog-queue.json not found at ' + QUEUE_FILE);
    process.exit(1);
  }
  const queue   = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const pending = queue.articles.filter(function(a) { return a.status === 'pending'; });

  if (pending.length === 0) {
    console.log('\nNo pending articles in blog-queue.json. All done!');
    return;
  }

  const batch = pending.slice(0, COUNT);
  console.log('\nPanoArt360 Blog Generator');
  console.log('═════════════════════════════════════════════');
  console.log('Model  : ' + MODEL);
  console.log('Queue  : ' + pending.length + ' pending articles');
  console.log('Batch  : generating ' + batch.length + ' article(s)\n');

  let successCount = 0;

  for (let i = 0; i < batch.length; i++) {
    const article = batch[i];
    console.log('[' + (i + 1) + '/' + batch.length + '] ' + article.title);
    console.log('    slug: ' + article.slug + '.html');
    console.log('    date: ' + article.date + ' | ' + article.read_time + ' min | ' + article.category);

    try {
      // 1. Images — download in parallel with varied queries for variety
      console.log('\n  ▸ Downloading Pexels images...');
      const cardFile    = article.slug + '-card.jpg';
      const heroFile    = article.slug + '-hero.jpg';
      const inline1File = article.slug + '-img1.jpg';
      const inline2File = article.slug + '-img2.jpg';
      const pexelsKey   = queue.meta.pexels_api_key;

      const imgResults = await Promise.all([
        downloadPexelsImage(article.pexels_query,                           pexelsKey, cardFile),
        downloadPexelsImage(article.pexels_query + ' office',               pexelsKey, heroFile),
        downloadPexelsImage(article.pexels_query + ' work',                 pexelsKey, inline1File),
        downloadPexelsImage(article.keywords[0] || article.pexels_query,    pexelsKey, inline2File),
      ]);

      const images = {
        card:    imgResults[0],
        hero:    imgResults[1],
        inline1: imgResults[2],
        inline2: imgResults[3],
      };

      // 2. Generate article content via OpenRouter
      console.log('\n  ▸ Generating article content...');
      const bodyContent = await generateArticleContent(article);

      // 3. Build full HTML
      console.log('\n  ▸ Building HTML file...');
      const html       = buildArticleHTML(article, bodyContent, images);
      const outputFile = path.join(APP_DIR, article.slug + '.html');
      fs.writeFileSync(outputFile, html, 'utf8');
      console.log('    Written: app/' + article.slug + '.html');

      // 4. Update blog.html grid
      console.log('\n  ▸ Updating blog.html...');
      updateBlogHtml(article, images);

      // 5. Mark done in queue
      article.status = 'done';
      article.generated_at = new Date().toISOString();
      queue.meta.generated = (queue.meta.generated || 0) + 1;
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');

      successCount++;
      console.log('\n  ✓ Done: ' + article.slug + '.html\n');

    } catch (err) {
      console.error('\n  ✗ Failed: ' + err.message + '\n');
      article.status = 'error';
      article.error  = err.message;
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
    }

    // Small pause between articles to be kind to APIs
    if (i < batch.length - 1) {
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
  }

  const remaining = queue.articles.filter(function(a) { return a.status === 'pending'; }).length;
  console.log('═════════════════════════════════════════════');
  console.log('Generated : ' + successCount + '/' + batch.length + ' articles');
  console.log('Total done: ' + queue.meta.generated);
  console.log('Remaining : ' + remaining + ' pending in queue');
  console.log('═════════════════════════════════════════════\n');
}

main().catch(function(err) {
  console.error('Fatal: ' + err.message);
  process.exit(1);
});
