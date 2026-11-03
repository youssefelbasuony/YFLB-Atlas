import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, "dist");
if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error(`Refusing to clear unexpected build output: ${output}`);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "robots.txt", "src", "assets"]) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

const dataContext = { window: {} };
vm.createContext(dataContext);
for (const file of ["data.js", "roadmap-library.js", "roadmap-expansion.js", "roadmap-depth.js"]) {
  const source = await readFile(path.join(root, "src", file), "utf8");
  vm.runInContext(source, dataContext, { filename: file, timeout: 15_000 });
}

const { roadmaps, copy } = dataContext.window.AtlasData;
const siteUrl = (process.env.ATLAS_SITE_URL || "https://yflb-atlas.vercel.app").replace(/\/+$/, "");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const routeUrl = (pathname) => `${siteUrl}${pathname}`;
const pagePath = (segments = []) => `/${segments.map(encodeURIComponent).join("/")}${segments.length ? "/" : ""}`;
const setMeta = (html, key, value, property = false) => {
  const attribute = property ? "property" : "name";
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}="${escapedKey}"[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
};
const setCanonical = (html, canonical) => {
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}" />`;
  return /<link\s+rel="canonical"[^>]*>/i.test(html)
    ? html.replace(/<link\s+rel="canonical"[^>]*>/i, tag)
    : html.replace("</head>", `  ${tag}\n  </head>`);
};
const renderSeoPage = (baseHtml, { pathname, title, description, indexable = true, locale = "en_US" }) => {
  const canonical = routeUrl(pathname);
  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "description", description);
  html = setMeta(html, "robots", indexable ? "index,follow" : "noindex,nofollow");
  html = setMeta(html, "og:title", title, true);
  html = setMeta(html, "og:description", description, true);
  html = setMeta(html, "og:url", canonical, true);
  html = setMeta(html, "og:type", "website", true);
  html = setMeta(html, "og:locale", locale, true);
  html = setMeta(html, "twitter:card", "summary");
  html = setMeta(html, "twitter:title", title);
  html = setMeta(html, "twitter:description", description);
  html = setCanonical(html, canonical);
  return html;
};
const shortDescription = (value) => {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= 158) return clean;
  const boundary = clean.lastIndexOf(" ", 155);
  return `${clean.slice(0, boundary > 100 ? boundary : 155).trimEnd()}…`;
};
const writeRoute = async (segments, metadata) => {
  const pathname = pagePath(segments);
  const destination = path.join(output, ...segments, "index.html");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, renderSeoPage(baseHtml, { pathname, ...metadata }));
  if (metadata.indexable !== false) sitemapUrls.push(pathname);
};

const baseHtml = await readFile(path.join(root, "index.html"), "utf8");
const sitemapUrls = ["/", "/paths/"];
const en = copy.en;
await writeFile(path.join(output, "index.html"), renderSeoPage(baseHtml, {
  pathname: "/",
  title: en.pageTitle,
  description: shortDescription(en.metaDescription)
}));
for (const [segments, title, description, indexable] of [
  [["paths"], "Learning pathways | YFLB Atlas", en.libraryIntro, true],
  [["learning"], "My learning | YFLB Atlas", en.learningIntro, false],
  [["saved"], "Saved pathways | YFLB Atlas", en.savedIntro, false],
  [["login"], "Sign in | YFLB Atlas", en.authIntro, false],
  [["admin"], "Content administration | YFLB Atlas", "Manage learning pathway content.", false]
]) {
  await writeRoute(segments, { title, description: shortDescription(description), indexable });
}

for (const roadmap of roadmaps) {
  const roadmapTitle = roadmap.title?.en || roadmap.id;
  const roadmapDescription = shortDescription(roadmap.summary?.en || `${roadmapTitle} learning pathway.`);
  await writeRoute(["roadmaps", roadmap.id], {
    title: `${roadmapTitle} | YFLB Atlas`,
    description: roadmapDescription
  });
  for (const module of roadmap.modules || []) {
    for (const topic of module.topics || []) {
      const topicTitle = topic.title?.en || topic.id;
      const conceptTitles = (topic.subtopics || []).map((item) => typeof item === "string" ? item : item?.en).filter(Boolean);
      const description = topic.overview?.en || `${topicTitle} in ${roadmapTitle}${conceptTitles.length ? `, including ${conceptTitles.slice(0, 4).join(", ")}` : ""}.`;
      await writeRoute(["learn", roadmap.id, topic.id], {
        title: `${topicTitle} | ${roadmapTitle} | YFLB Atlas`,
        description: shortDescription(description)
      });
    }
  }
}

const uniqueUrls = [...new Set(sitemapUrls)].sort();
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map((pathname) => `  <url><loc>${escapeHtml(routeUrl(pathname))}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(output, "sitemap.xml"), sitemap);
console.log(`Built ${roadmaps.length} pathways and ${uniqueUrls.length} indexable URLs into dist/.`);
