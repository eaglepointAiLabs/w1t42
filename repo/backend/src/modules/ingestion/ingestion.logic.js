const crypto = require("crypto");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKeyForItem(item) {
  const title = normalizeText(item.title || "untitled");
  const author = normalizeText(item.authorName || "unknown");
  const date = item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : "unknown-date";
  return crypto.createHash("sha256").update(`${title}|${author}|${date}`).digest("hex");
}

function parseRssItems(xmlText) {
  const text = String(xmlText || "");
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1] || "";
    const title = /<title>([\s\S]*?)<\/title>/i.exec(block)?.[1]?.trim() || "Untitled";
    const authorName = /<author>([\s\S]*?)<\/author>/i.exec(block)?.[1]?.trim() || "Unknown";
    const description = /<description>([\s\S]*?)<\/description>/i.exec(block)?.[1]?.trim() || "";
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block)?.[1]?.trim() || null;
    const categoryMatches = [...block.matchAll(/<category>([\s\S]*?)<\/category>/gi)];
    const tags = categoryMatches.map((m) => (m[1] || "").trim()).filter(Boolean);

    items.push({
      title,
      authorName,
      summary: description,
      bodyText: description,
      tags,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null
    });
  }
  return items;
}

function parseHtmlExtract(htmlText) {
  const text = String(htmlText || "");
  const title = /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1]?.trim() || "Untitled";
  const authorName = /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(text)?.[1]?.trim() || "Unknown";
  const summary = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(text)?.[1]?.trim() || "";
  const bodyText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const tags = [...text.matchAll(/data-tag=["']([^"']+)["']/gi)].map((m) => m[1]);

  return [
    {
      title,
      authorName,
      summary,
      bodyText,
      tags,
      publishedAt: new Date().toISOString()
    }
  ];
}

function parseJsonPayload(jsonText) {
  const parsed = JSON.parse(String(jsonText || "{}"));
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [parsed];

  return items
    .map((item) => ({
      title: item.title || item.headline || "Untitled",
      authorName: item.author || item.authorName || "Unknown",
      summary: item.summary || item.description || "",
      bodyText: item.body || item.content || item.summary || "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
      externalItemId: item.id ? String(item.id) : null
    }))
    .filter((item) => item.title);
}

function parseContentByType({ sourceType, content }) {
  if (sourceType === "rss") {
    return parseRssItems(content);
  }

  if (sourceType === "html_extract") {
    return parseHtmlExtract(content);
  }

  return parseJsonPayload(content);
}

module.exports = {
  normalizeText,
  dedupeKeyForItem,
  parseContentByType
};
