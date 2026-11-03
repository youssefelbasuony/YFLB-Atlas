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

const { roadmaps, copy, featured } = dataContext.window.AtlasData;
const siteUrl = (process.env.ATLAS_SITE_URL || "https://yflb-atlas.vercel.app").replace(/\/+$/, "");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const plainText = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const localized = (value, language) => typeof value === "string" ? value : value?.[language] || value?.en || "";
const routeUrl = (pathname) => `${siteUrl}${pathname}`;
const pagePath = (segments = [], language = "en") => `/${language === "ar" ? "ar/" : ""}${segments.map(encodeURIComponent).join("/")}${segments.length ? "/" : ""}`;
const shortDescription = (value) => {
  const clean = plainText(value);
  if (clean.length <= 158) return clean;
  const boundary = clean.lastIndexOf(" ", 155);
  return `${clean.slice(0, boundary > 100 ? boundary : 155).trimEnd()}…`;
};
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const setMeta = (html, key, value, property = false) => {
  const attribute = property ? "property" : "name";
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}="${escapedKey}"[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
};
const setLink = (html, rel, href, hreflang = "") => {
  const pattern = hreflang
    ? new RegExp(`<link\\s+rel="${rel}"\\s+hreflang="${hreflang}"[^>]*>`, "i")
    : new RegExp(`<link\\s+rel="${rel}"[^>]*>`, "i");
  const tag = `<link rel="${rel}"${hreflang ? ` hreflang="${hreflang}"` : ""} href="${escapeHtml(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
};

const pageBreadcrumbs = (route, language) => {
  const copyForLanguage = copy[language];
  const crumbs = [{ name: copyForLanguage.home, path: pagePath([], language) }];
  if (route.type === "home") return crumbs;
  crumbs.push({ name: copyForLanguage.allRoadmaps, path: pagePath(["paths"], language) });
  if (route.roadmap) {
    const title = localized(route.roadmap.title, language);
    crumbs.push({ name: title, path: pagePath(["roadmaps", route.roadmap.id], language) });
  }
  if (route.topic) crumbs.push({ name: localized(route.topic.title, language), path: pagePath(["learn", route.roadmap.id, route.topic.id], language) });
  return crumbs;
};

const linkMarkup = (href, label, className = "") => `<a${className ? ` class="${className}"` : ""} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
const breadcrumbMarkup = (items, language) => `<nav class="breadcrumbs" aria-label="${language === "ar" ? "مسار التنقل" : "Breadcrumbs"}">${items.map((item, index) => `${index ? '<span aria-hidden="true">/</span>' : ""}${index === items.length - 1 ? `<span aria-current="page">${escapeHtml(item.name)}</span>` : linkMarkup(item.path, item.name)}`).join("")}</nav>`;

const staticContent = (route, language) => {
  const copyForLanguage = copy[language];
  const categoryNames = copyForLanguage.categoryNames || copy.en.categoryNames;
  const pathTitle = (roadmap) => localized(roadmap.title, language);
  const pathHref = (roadmap) => pagePath(["roadmaps", roadmap.id], language);
  const topicHref = (roadmap, topic) => pagePath(["learn", roadmap.id, topic.id], language);
  const heading = route.heading || route.title;
  const intro = route.description;
  if (route.type === "home") {
    const featuredPaths = featured.map((id) => roadmaps.find((roadmap) => roadmap.id === id)).filter(Boolean).slice(0, 12);
    const categoryLinks = Object.entries(categoryNames).map(([id, name]) => `<li>${linkMarkup(`${pagePath(["paths"], language)}?category=${encodeURIComponent(id)}`, name)}</li>`).join("");
    const pathLinks = featuredPaths.map((roadmap) => `<li>${linkMarkup(pathHref(roadmap), pathTitle(roadmap))}</li>`).join("");
    return `<article class="seo-fallback"><header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(language === "ar" ? "تعلّم ذاتي" : "Self-paced learning")}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p></div><a class="button button-primary" href="${escapeHtml(pagePath(["paths"], language))}">${escapeHtml(copyForLanguage.startLearning)}</a></header><section class="learning-card"><h2>${escapeHtml(copyForLanguage.categories)}</h2><ul class="seo-link-list">${categoryLinks}</ul></section><section class="learning-card"><h2>${escapeHtml(language === "ar" ? "مسارات مقترحة" : "Popular learning paths")}</h2><ul class="seo-link-list">${pathLinks}</ul></section></article>`;
  }
  if (route.type === "paths") {
    const roadmapLinks = roadmaps.map((roadmap) => `<li><span class="eyebrow">${escapeHtml(categoryNames[roadmap.category] || roadmap.category)}</span>${linkMarkup(pathHref(roadmap), pathTitle(roadmap))}<span>${escapeHtml(localized(roadmap.summary, language))}</span></li>`).join("");
    return `<article class="seo-fallback">${breadcrumbMarkup(pageBreadcrumbs(route, language), language)}<header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(language === "ar" ? "كل المجالات" : "All fields")}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p></div></header><section class="learning-card"><ul class="seo-roadmap-list">${roadmapLinks}</ul></section></article>`;
  }
  if (route.type === "roadmap") {
    const modules = route.roadmap.modules.map((module) => `<section class="learning-card"><h2>${escapeHtml(localized(module.title, language))}</h2><ul class="seo-link-list">${module.topics.map((topic) => `<li>${linkMarkup(topicHref(route.roadmap, topic), localized(topic.title, language))}</li>`).join("")}</ul></section>`).join("");
    return `<article class="seo-fallback">${breadcrumbMarkup(pageBreadcrumbs(route, language), language)}<header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(categoryNames[route.roadmap.category] || route.roadmap.category)}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p></div></header><div class="seo-module-list">${modules}</div></article>`;
  }
  if (route.type === "topic") {
    const conceptNames = (route.topic.subtopics || []).map((subtopic) => localized(subtopic, language)).filter(Boolean);
    const topicText = localized(route.topic.overview, language) || (language === "ar"
      ? `تعلّم ${localized(route.topic.title, language)} ضمن ${localized(route.roadmap.title, language)} من خلال مفاهيم مثل ${conceptNames.slice(0, 4).join("، ") || "المفاهيم الأساسية والتطبيقات"}.`
      : `Learn ${localized(route.topic.title, language)} within ${localized(route.roadmap.title, language)}, including concepts such as ${conceptNames.slice(0, 4).join(", ") || "foundations and practical applications"}.`);
    const subtopics = conceptNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
    return `<article class="seo-fallback">${breadcrumbMarkup(pageBreadcrumbs(route, language), language)}<header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(localized(route.roadmap.title, language))}</span><h1>${escapeHtml(heading)}</h1></div></header><section class="learning-card"><h2>${escapeHtml(language === "ar" ? "نبذة عن الموضوع" : "About this topic")}</h2>${plainText(topicText).split(/\n\s*\n/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}${subtopics ? `<h2>${escapeHtml(language === "ar" ? "مفاهيم مرتبطة" : "Related concepts")}</h2><ul class="seo-link-list">${subtopics}</ul>` : ""}</section><section class="learning-card">${linkMarkup(pathHref(route.roadmap), language === "ar" ? "العودة إلى خريطة التعلم" : "Back to the learning roadmap", "button button-secondary")}</section></article>`;
  }
  return `<article class="seo-fallback"><header class="page-header"><div class="page-header-copy"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p></div>${linkMarkup(pagePath(["paths"], language), copyForLanguage.allRoadmaps, "button button-primary")}</header></article>`;
};

const renderSeoPage = (baseHtml, { pathname, defaultPath, title, description, indexable = true, language = "en", route }) => {
  const canonical = routeUrl(pathname);
  const englishUrl = routeUrl(defaultPath);
  const arabicPath = pagePath(defaultPath === "/" ? [] : defaultPath.split("/").filter(Boolean), "ar");
  const arabicUrl = routeUrl(arabicPath);
  const locale = language === "ar" ? "ar_EG" : "en_US";
  let html = baseHtml.replace(/<html\b[^>]*>/i, (tag) => tag
    .replace(/\blang="[^"]*"/i, `lang="${language}"`)
    .replace(/\bdir="[^"]*"/i, `dir="${language === "ar" ? "rtl" : "ltr"}"`));
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "description", description);
  html = setMeta(html, "robots", indexable ? "index,follow" : "noindex,nofollow");
  html = setMeta(html, "og:site_name", "YFLB Atlas", true);
  html = setMeta(html, "og:title", title, true);
  html = setMeta(html, "og:description", description, true);
  html = setMeta(html, "og:url", canonical, true);
  html = setMeta(html, "og:type", "website", true);
  html = setMeta(html, "og:locale", locale, true);
  html = setMeta(html, "og:locale:alternate", language === "ar" ? "en_US" : "ar_EG", true);
  html = setMeta(html, "twitter:card", "summary");
  html = setMeta(html, "twitter:title", title);
  html = setMeta(html, "twitter:description", description);
  html = setLink(html, "canonical", canonical);
  html = setLink(html, "alternate", englishUrl, "en");
  html = setLink(html, "alternate", arabicUrl, "ar");
  html = setLink(html, "alternate", englishUrl, "x-default");
  const breadcrumbs = pageBreadcrumbs(route, language);
  const organizationId = `${siteUrl}/#organization`;
  const websiteId = `${siteUrl}/#website`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": organizationId, name: "YFLB Atlas", alternateName: "YFLB", url: `${siteUrl}/`, logo: `${siteUrl}/assets/logos/YFLB-logo-black.svg` },
      { "@type": "WebSite", "@id": websiteId, name: "YFLB Atlas", alternateName: ["YFLB", "Atlas", "منصة أطلس للتعلم"], url: `${siteUrl}/`, inLanguage: ["en", "ar"] },
      { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: language === "ar" ? "ar" : "en", isPartOf: { "@id": websiteId }, breadcrumb: { "@id": `${canonical}#breadcrumb` } },
      { "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumb`, itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: routeUrl(item.path) })) }
    ]
  };
  const schemaMarkup = `<script type="application/ld+json">${jsonForHtml(schema)}</script>`;
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, schemaMarkup);
  const content = staticContent(route, language);
  html = html.replace(/<main id="main-content"[^>]*>[\s\S]*?<\/main>/i, `<main id="main-content" class="page-content" tabindex="-1" aria-busy="false">${content}</main>`);
  return html;
};

const baseHtml = await readFile(path.join(root, "index.html"), "utf8");
const indexablePaths = new Set();
const writeRoute = async (segments, metadata, language = "en") => {
  const pathname = pagePath(segments, language);
  const defaultPath = pagePath(segments, "en");
  const destination = path.join(output, ...pathname.split("/").filter(Boolean), "index.html");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, renderSeoPage(baseHtml, { pathname, defaultPath, ...metadata, language }));
  if (metadata.indexable !== false) indexablePaths.add(defaultPath);
};

const en = copy.en;
const ar = copy.ar;
const homeTitle = {
  en: "YFLB Atlas | Business, Accounting & Data Learning Paths",
  ar: "مسارات تعلم الأعمال والمحاسبة والبيانات | YFLB Atlas"
};
const homeDescription = {
  en: "Explore self-paced learning paths for business administration, accounting, finance, economics, data analytics, data engineering, information systems and professional skills.",
  ar: "اكتشف مسارات تعلم ذاتي لإدارة الأعمال والمحاسبة والتمويل والاقتصاد وتحليل البيانات وهندسة البيانات ونظم المعلومات والمهارات المهنية."
};
const pathsTitle = { en: "All Learning Roadmaps | YFLB Atlas", ar: "كل مسارات التعلم | YFLB Atlas" };
const pathsDescription = {
  en: "Browse hundreds of connected learning paths across business, accounting, finance, economics, communication, psychology, information systems, data and professional practice.",
  ar: "تصفّح مئات مسارات التعلم في الأعمال والمحاسبة والتمويل والاقتصاد والتواصل وعلم النفس ونظم المعلومات والبيانات والمهارات المهنية."
};

const homeRoute = (language) => ({ type: "home", title: homeTitle[language], heading: copy[language].homeTitle, description: homeDescription[language] });
const pathsRoute = (language) => ({ type: "paths", title: pathsTitle[language], heading: copy[language].allRoadmaps, description: pathsDescription[language] });
for (const language of ["en", "ar"]) {
  await writeRoute([], { title: homeTitle[language], description: homeDescription[language], route: homeRoute(language) }, language);
  await writeRoute(["paths"], { title: pathsTitle[language], description: pathsDescription[language], route: pathsRoute(language) }, language);
}

for (const [segments, title, description, indexable] of [
  [["learning"], "My learning | YFLB Atlas", en.learningIntro, false],
  [["saved"], "Saved learning paths | YFLB Atlas", en.savedIntro, false],
  [["login"], "Sign in | YFLB Atlas", en.authIntro, false],
  [["admin"], "Content administration | YFLB Atlas", "Manage learning pathway content.", false]
]) {
  for (const language of ["en", "ar"]) {
    const copyForLanguage = copy[language];
    const localizedTitle = language === "ar" ? `${localized(copyForLanguage[segments[0] === "learning" ? "learningTitle" : segments[0] === "saved" ? "savedRoadmaps" : segments[0] === "login" ? "authTitle" : "navAdmin"], language)} | YFLB Atlas` : title;
    const localizedDescription = language === "ar" ? copyForLanguage[segments[0] === "learning" ? "learningIntro" : segments[0] === "saved" ? "savedIntro" : segments[0] === "login" ? "authIntro" : "sourceNote"] : description;
    const route = { type: "private", title: localizedTitle, description: localizedDescription };
    await writeRoute(segments, { title: localizedTitle, description: shortDescription(localizedDescription), indexable, route }, language);
  }
}

for (const roadmap of roadmaps) {
  for (const language of ["en", "ar"]) {
    const name = localized(roadmap.title, language) || roadmap.id;
    const summary = localized(roadmap.summary, language) || (language === "ar" ? `مسار تعلم ذاتي في ${name}.` : `${name} self-paced learning roadmap.`);
    const title = language === "ar" ? `${name} — مسار تعلم | YFLB Atlas` : `${name} Learning Roadmap | YFLB Atlas`;
    const description = shortDescription(`${summary} ${language === "ar" ? "خريطة تعلم وخطوات مترابطة للبحث والتطبيق." : "A connected learning map with topics to research and practice."}`);
    const route = { type: "roadmap", roadmap, title, heading: name, description };
    await writeRoute(["roadmaps", roadmap.id], { title, description, route }, language);
    for (const module of roadmap.modules || []) {
      for (const topic of module.topics || []) {
        const topicName = localized(topic.title, language) || topic.id;
        const conceptNames = (topic.subtopics || []).map((subtopic) => localized(subtopic, language)).filter(Boolean);
        const topicDescription = localized(topic.overview, language) || (language === "ar"
          ? `تعلّم ${topicName} ضمن مسار ${name} من خلال مفاهيم مثل ${conceptNames.slice(0, 4).join("، ") || "المفاهيم الأساسية والتطبيقات"}.`
          : `Learn ${topicName} within the ${name} pathway, including concepts such as ${conceptNames.slice(0, 4).join(", ") || "foundations and practical applications"}.`);
        const topicTitle = language === "ar" ? `${topicName} | ${name} | أطلس` : `${topicName} | ${name} | YFLB Atlas`;
        const topicRoute = { type: "topic", roadmap, module, topic, title: topicName, heading: topicName, description: topicDescription };
        await writeRoute(["learn", roadmap.id, topic.id], { title: topicTitle, description: shortDescription(topicDescription), route: topicRoute }, language);
      }
    }
  }
}

const sortedPaths = [...indexablePaths].sort();
const sitemapChunkSize = 20_000;
const sitemapFiles = [];
for (let offset = 0; offset < sortedPaths.length; offset += sitemapChunkSize) {
  const chunk = sortedPaths.slice(offset, offset + sitemapChunkSize);
  const sitemapNumber = sitemapFiles.length + 1;
  const entries = chunk.map((defaultPath) => {
    const enPath = defaultPath;
    const arPath = pagePath(defaultPath === "/" ? [] : defaultPath.split("/").filter(Boolean), "ar");
    return `  <url><loc>${escapeHtml(routeUrl(enPath))}</loc><xhtml:link rel="alternate" hreflang="en" href="${escapeHtml(routeUrl(enPath))}"/><xhtml:link rel="alternate" hreflang="ar" href="${escapeHtml(routeUrl(arPath))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(routeUrl(enPath))}"/></url>`;
  }).join("\n");
  const name = `sitemap-${sitemapNumber}.xml`;
  await writeFile(path.join(output, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`);
  sitemapFiles.push(name);
}
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles.map((name) => `  <sitemap><loc>${escapeHtml(routeUrl(`/${name}`))}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
await writeFile(path.join(output, "sitemap.xml"), sitemapIndex);
console.log(`Built ${roadmaps.length} pathways in English and Arabic, with ${sortedPaths.length * 2} indexable pages and ${sitemapFiles.length} sitemap files in dist/.`);
