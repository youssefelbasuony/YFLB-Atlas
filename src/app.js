(() => {
  "use strict";

  const DATA = window.AtlasData;
  if (!DATA) return;

  const { copy, CATEGORIES, roadmaps, featured } = DATA;
  const root = document.getElementById("main-content");
  const searchInput = document.getElementById("globalSearch");
  const searchResults = document.getElementById("searchResults");
  const searchWrap = document.getElementById("searchWrap");
  const toast = document.getElementById("toast");
  const STORAGE_KEY = "professional-atlas-v3";
  const byId = new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap]));
  const topicIndex = new Map();
  roadmaps.forEach((roadmap) => roadmap.modules.forEach((module) => module.topics.forEach((topic, index) => {
    topicIndex.set(topic.id, { roadmap, module, topic, moduleIndex: roadmap.modules.indexOf(module), index });
  })));

  const freshState = () => ({ language: "en", theme: "light", favorites: [], started: [], progress: {}, learning: {}, skipped: {} });
  const readState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return freshState();
      const next = freshState();
      next.language = saved.language === "ar" ? "ar" : "en";
      next.theme = saved.theme === "dark" ? "dark" : "light";
      next.favorites = Array.isArray(saved.favorites) ? [...new Set(saved.favorites.filter((id) => byId.has(id)))] : [];
      next.started = Array.isArray(saved.started) ? [...new Set(saved.started.filter((id) => byId.has(id)))] : [];
      const completedSource = saved.progress && typeof saved.progress === "object" ? saved.progress : {};
      const learningSource = saved.learning && typeof saved.learning === "object" ? saved.learning : {};
      const skippedSource = saved.skipped && typeof saved.skipped === "object" ? saved.skipped : {};
      roadmaps.forEach((roadmap) => {
        const ordered = roadmap.modules.flatMap((module) => module.topics.map((topic) => topic.id));
        const marked = new Set(Array.isArray(completedSource[roadmap.id]) ? completedSource[roadmap.id] : []);
        const skipped = new Set(Array.isArray(skippedSource[roadmap.id]) ? skippedSource[roadmap.id] : []);
        const learning = new Set(Array.isArray(learningSource[roadmap.id]) ? learningSource[roadmap.id] : []);
        const completed = ordered.filter((id) => marked.has(id));
        const ignored = ordered.filter((id) => skipped.has(id) && !marked.has(id));
        const inProgress = ordered.filter((id) => learning.has(id) && !marked.has(id) && !skipped.has(id));
        if (completed.length) next.progress[roadmap.id] = completed;
        if (ignored.length) next.skipped[roadmap.id] = ignored;
        if (inProgress.length) next.learning[roadmap.id] = inProgress;
      });
      next.started = [...new Set([...next.started, ...Object.keys(next.progress), ...Object.keys(next.learning), ...Object.keys(next.skipped)])];
      return next;
    } catch {
      return freshState();
    }
  };
  const state = readState();
  let searchFocusIndex = -1;
  let focusTopicAfterRender = false;
  let scrollToTopAfterRender = false;
  let toastTimer = 0;
  let searchIndexCache = null;

  const tr = (key) => copy[state.language][key] ?? copy.en[key] ?? key;
  const localized = (value) => value?.[state.language] ?? "";
  const formatNumber = (value) => new Intl.NumberFormat(state.language === "ar" ? "ar-EG" : "en").format(value);
  const percentSymbol = () => state.language === "ar" ? "٪" : "%";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const icon = (name, extra = "") => {
    const paths = {
      search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      bookmark: '<path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21z"/>',
      check: '<path d="m5 12.5 4.3 4.3L19.5 6.8"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2m-17.1 7.1 1.4-1.4m11.4-11.4 1.4-1.4"/>',
      moon: '<path d="M20.7 14.2A8.5 8.5 0 0 1 9.8 3.3 8.6 8.6 0 1 0 20.7 14.2Z"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      chart: '<path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7"/>',
      category: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      spark: '<path d="m12 3 1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/>',
      play: '<path d="m8 5 11 7-11 7z"/>',
      reset: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/>'
    };
    return `<svg ${extra} viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.category}</svg>`;
  };

  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Private browsing can disable storage. */ }
  };
  const setDocumentLanguage = () => {
    const isArabic = state.language === "ar";
    document.documentElement.lang = state.language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.dataset.theme = state.theme;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = tr(element.dataset.i18n);
      if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => element.setAttribute("aria-label", tr(element.dataset.i18nAria)));
    document.querySelectorAll("[data-i18n-title]").forEach((element) => element.setAttribute("title", tr(element.dataset.i18nTitle)));
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => element.setAttribute("placeholder", tr(element.dataset.i18nPlaceholder)));
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => element.setAttribute("alt", tr(element.dataset.i18nAlt)));
    searchInput.setAttribute("aria-label", tr("search"));
    document.querySelector(".platform-nav")?.setAttribute("aria-label", tr("primaryNav"));
    document.querySelector(".mobile-nav")?.setAttribute("aria-label", tr("primaryNav"));
    document.querySelector(".platform-tools")?.setAttribute("dir", isArabic ? "rtl" : "ltr");
    const themeLabel = state.theme === "dark" ? tr("themeLight") : tr("themeDark");
    const themeButton = document.getElementById("themeToggle");
    themeButton.setAttribute("aria-label", themeLabel);
    themeButton.title = themeLabel;
    themeButton.innerHTML = icon(state.theme === "dark" ? "sun" : "moon");
    document.querySelector(".search-wrap kbd").textContent = isArabic ? "بحث" : "Ctrl K";
    document.querySelector("meta[name='theme-color']").content = state.theme === "dark" ? "#101c23" : "#183244";
    document.querySelector("meta[name='description']").content = tr("metaDescription");
    document.title = tr("pageTitle");
    syncNavigation();
  };
  const activeRouteName = () => {
    const path = location.hash.replace(/^#\/?/, "").split("?")[0];
    return path.startsWith("roadmap/") || path.startsWith("learn/") ? "paths" : (path || "home");
  };
  const syncNavigation = () => {
    const route = activeRouteName();
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };
  const categoryName = (id) => copy[state.language].categoryNames[id] || id;
  const completedIds = (roadmap) => state.progress[roadmap.id] || [];
  const learningIds = (roadmap) => state.learning[roadmap.id] || [];
  const skippedIds = (roadmap) => state.skipped[roadmap.id] || [];
  const topicList = (roadmap) => roadmap.modules.flatMap((module) => module.topics.map((topic) => ({ topic, module })));
  const topicStatus = (roadmap, topicId) => {
    if (completedIds(roadmap).includes(topicId)) return "done";
    if (skippedIds(roadmap).includes(topicId)) return "skip";
    if (learningIds(roadmap).includes(topicId)) return "learning";
    return "idle";
  };
  const roadmapProgress = (roadmap) => {
    const topics = topicList(roadmap);
    const completed = new Set(completedIds(roadmap));
    const skipped = new Set(skippedIds(roadmap));
    const learning = new Set(learningIds(roadmap));
    const done = topics.reduce((count, { topic }) => count + Number(completed.has(topic.id)), 0);
    const skippedCount = topics.reduce((count, { topic }) => count + Number(skipped.has(topic.id)), 0);
    const learningCount = topics.reduce((count, { topic }) => count + Number(learning.has(topic.id)), 0);
    const total = topics.length - skippedCount;
    const next = topics.find(({ topic }) => learning.has(topic.id)) || topics.find(({ topic }) => !completed.has(topic.id) && !skipped.has(topic.id)) || null;
    return { total, all: topics.length, done, skipped: skippedCount, learning: learningCount, percent: total ? Math.round(done * 100 / total) : 0, next };
  };
  const normalizeSearch = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ|ئ/g, "ء")
    .toLocaleLowerCase(state.language)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const searchWords = (value) => normalizeSearch(value).split(/\s+/).filter(Boolean);
  const searchIndex = () => {
    if (searchIndexCache?.language === state.language) return searchIndexCache;
    const records = [];
    const vocabulary = new Map();
    const remember = (value) => {
      for (const word of searchWords(value)) {
        if (word.length < 3) continue;
        const existing = vocabulary.get(word);
        if (existing) existing.count += 1;
        else vocabulary.set(word, { word, display: state.language === "en" ? `${word[0].toLocaleUpperCase(state.language)}${word.slice(1)}` : word, count: 1 });
      }
    };
    const addRecord = (record, title, otherFields) => {
      const fields = otherFields.map(normalizeSearch);
      const titleWords = searchWords(title);
      const otherWords = [...new Set(fields.flatMap((field) => searchWords(field)))];
      records.push({ ...record, titleWords, otherWords, searchText: [normalizeSearch(title), ...fields].join(" ") });
      remember(title);
      for (const field of otherFields) remember(field);
    };
    for (const roadmap of roadmaps) {
      const title = localized(roadmap.title);
      const category = categoryName(roadmap.category);
      addRecord({ type: "roadmap", roadmap }, title, [localized(roadmap.summary), category]);
      for (const module of roadmap.modules) {
        const moduleTitle = localized(module.title);
        for (const topic of module.topics) {
          const subtopics = (topic.subtopics || []).map(localized);
          addRecord({ type: "topic", roadmap, module, topic }, localized(topic.title), [moduleTitle, title, category, ...subtopics]);
        }
      }
    }
    searchIndexCache = { language: state.language, records, vocabulary: [...vocabulary.values()], vocabularyWords: new Set(vocabulary.keys()) };
    return searchIndexCache;
  };
  const editDistance = (left, right, limit) => {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let minimum = row;
      for (let column = 1; column <= right.length; column += 1) {
        current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + Number(left[row - 1] !== right[column - 1]));
        minimum = Math.min(minimum, current[column]);
      }
      if (minimum > limit) return limit + 1;
      previous = current;
    }
    return previous[right.length];
  };
  const resolveSearchQuery = (value) => {
    const originalWords = searchWords(value);
    if (!originalWords.length) return { query: "", suggestion: "", changed: false };
    const index = searchIndex();
    const words = [];
    const displayWords = [];
    let changed = false;
    for (const word of originalWords) {
      let best = null;
      const limit = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
      if (limit && !index.vocabularyWords.has(word) && !index.vocabulary.some((entry) => entry.word.startsWith(word))) {
        for (const entry of index.vocabulary) {
          if (Math.abs(entry.word.length - word.length) > limit) continue;
          const distance = editDistance(word, entry.word, limit);
          if (distance <= limit && (!best || distance < best.distance || (distance === best.distance && entry.count > best.count))) best = { ...entry, distance };
        }
      }
      const resolved = best?.word || word;
      words.push(resolved);
      displayWords.push(best?.display || word);
      changed ||= resolved !== word;
    }
    return { query: words.join(" "), suggestion: changed ? displayWords.join(" ") : "", changed };
  };
  const scoreSearchRecord = (record, query, queryWords) => {
    let score = record.type === "roadmap" ? 2 : 0;
    for (const word of queryWords) {
      if (record.titleWords.includes(word)) score += 18;
      else if (record.titleWords.some((candidate) => candidate.startsWith(word))) score += 13;
      else if (record.otherWords.includes(word)) score += 7;
      else if (record.otherWords.some((candidate) => candidate.startsWith(word))) score += 4;
      else return -1;
    }
    if (record.searchText.includes(query)) score += 20;
    return score;
  };
  const rankedSearchRecords = (query, limit = 8) => {
    const normalized = normalizeSearch(query);
    const words = normalized.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const bestByRoadmap = new Map();
    for (const record of searchIndex().records) {
      const score = scoreSearchRecord(record, normalized, words);
      if (score < 0) continue;
      const match = { record, score };
      const routeMatches = bestByRoadmap.get(record.roadmap.id) || [];
      const index = routeMatches.findIndex((item) => score > item.score);
      if (index === -1) {
        if (routeMatches.length < 2) routeMatches.push(match);
      } else {
        routeMatches.splice(index, 0, match);
        if (routeMatches.length > 2) routeMatches.pop();
      }
      bestByRoadmap.set(record.roadmap.id, routeMatches);
    }
    return [...bestByRoadmap.values()].flat().sort((left, right) => right.score - left.score).slice(0, limit).map(({ record }) => record);
  };
  const matchingRoadmapIds = (query) => {
    const normalized = normalizeSearch(query);
    const words = normalized.split(/\s+/).filter(Boolean);
    const matches = new Set();
    if (!words.length) return matches;
    for (const record of searchIndex().records) if (scoreSearchRecord(record, normalized, words) >= 0) matches.add(record.roadmap.id);
    return matches;
  };
  const setHash = (value, replace = false) => {
    if (replace) history.replaceState(null, "", value);
    else location.hash = value;
    if (replace) render();
  };
  const roadmapHref = (roadmap, topicId) => `#/roadmap/${encodeURIComponent(roadmap.id)}${topicId ? `?topic=${encodeURIComponent(topicId)}` : ""}`;
  const learningHref = (roadmap, topicId) => `#/learn/${encodeURIComponent(roadmap.id)}?topic=${encodeURIComponent(topicId)}`;
  const categoryHref = (category) => `#/paths${category && category !== "all" ? `?category=${encodeURIComponent(category)}` : ""}`;
  const librarySearchHref = (category, query) => {
    const params = new URLSearchParams();
    if (category && category !== "all") params.set("category", category);
    if (query) params.set("q", query);
    const queryString = params.toString();
    return `#/paths${queryString ? `?${queryString}` : ""}`;
  };
  const findCategoryCounts = () => Object.fromEntries(CATEGORIES.map((category) => [category, roadmaps.filter((roadmap) => roadmap.category === category).length]));
  const statusTag = (roadmap) => {
    const progress = roadmapProgress(roadmap);
    if (progress.total > 0 && progress.done === progress.total) return `<span class="status-tag status-done">${icon("check")}<span>${escapeHtml(tr("completed"))}</span></span>`;
    if (progress.done > 0 || progress.skipped > 0 || progress.learning > 0) return `<span class="status-tag status-progress">${icon("play")}<span>${escapeHtml(tr("inProgress"))}</span></span>`;
    return `<span class="status-tag">${icon("clock")}<span>${escapeHtml(tr("selfPaced"))}</span></span>`;
  };
  const progressMarkup = (roadmap, compact = false) => {
    const { total, done, percent } = roadmapProgress(roadmap);
    const skipped = skippedIds(roadmap).length;
    return `<div class="progress-meta ${compact ? "progress-meta-compact" : ""}"><span>${formatNumber(done)} ${escapeHtml(tr("of"))} ${formatNumber(total)} ${escapeHtml(tr("topics"))}${skipped ? ` · ${formatNumber(skipped)} ${escapeHtml(tr("skippedExcluded"))}` : ""}</span><strong>${formatNumber(percent)}${percentSymbol()}</strong></div><div class="progress-track" role="progressbar" aria-label="${escapeHtml(tr("progress"))}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`;
  };
  const topicStatusControls = (roadmap, topic) => {
    const status = topicStatus(roadmap, topic.id);
    const actions = [
      ["learning", "book", tr("statusLearning")],
      ["done", "check", tr("statusDone")],
      ["skip", "close", tr("statusSkip")]
    ];
    return `<div class="topic-status-controls" role="group" aria-label="${escapeHtml(tr("topicStatus"))}">${actions.map(([value, glyph, label]) => `<button class="topic-status-control status-control-${value} ${status === value ? "is-active" : ""}" type="button" data-action="set-topic-status" data-status="${value}" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-pressed="${status === value}" aria-label="${escapeHtml(label)}">${icon(glyph)}<span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
  };
  const roadmapCard = (roadmap, options = {}) => {
    const progress = roadmapProgress(roadmap);
    const saved = state.favorites.includes(roadmap.id);
    const status = statusTag(roadmap);
    const cardClass = options.featured ? "roadmap-card roadmap-card-featured" : "roadmap-card";
    return `<article class="${cardClass}">
      <div class="roadmap-card-top"><span class="roadmap-card-icon">${icon(options.icon || "layers")}</span><button class="bookmark-button ${saved ? "is-saved" : ""}" type="button" data-action="toggle-save" data-roadmap="${escapeHtml(roadmap.id)}" aria-label="${escapeHtml(saved ? tr("removeSaved") : tr("saveRoadmap"))}" aria-pressed="${saved}">${icon("bookmark")}</button></div>
      <a class="roadmap-card-link" href="${roadmapHref(roadmap)}"><span class="eyebrow">${escapeHtml(categoryName(roadmap.category))}</span><h3>${escapeHtml(localized(roadmap.title))}</h3><p>${escapeHtml(localized(roadmap.summary))}</p><span class="roadmap-card-meta">${status}<span>${formatNumber(progress.total)} ${escapeHtml(tr("learningSteps"))}</span></span>${progress.done || progress.skipped || progress.learning ? progressMarkup(roadmap, true) : ""}<span class="card-action">${escapeHtml(progress.done || progress.learning || progress.skipped ? tr("continueRoadmap") : tr("openRoadmap"))}${icon("arrow")}</span></a>
    </article>`;
  };
  const sectionHeading = (title, description = "", href = "") => `<div class="section-heading"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${href ? `<a class="text-link" href="${href}">${escapeHtml(tr("browseAll"))}${icon("arrow")}</a>` : ""}</div>`;
  const renderHome = () => {
    const topRoadmaps = featured.map((id) => byId.get(id)).filter(Boolean);
    const popular = topRoadmaps.slice(0, 6);
    const counts = findCategoryCounts();
    root.innerHTML = `<section class="catalog-hero">
        <div class="hero-copy"><span class="eyebrow hero-eyebrow">${icon("spark")}${escapeHtml(tr("homeEyebrow"))}</span><h1>${escapeHtml(tr("homeTitle"))}</h1><p>${escapeHtml(tr("homeIntro"))}</p>
          <button class="hero-search" type="button" data-action="focus-search">${icon("search")}<span>${escapeHtml(tr("searchPlaceholder"))}</span><kbd>${state.language === "ar" ? "بحث" : "Ctrl K"}</kbd></button>
          <div class="hero-actions"><a class="button button-primary" href="${categoryHref("all")}">${escapeHtml(tr("browseAll"))}${icon("arrow")}</a><a class="button button-ghost" href="#/learning">${escapeHtml(tr("navLearning"))}</a></div>
        </div><div class="hero-visual" aria-hidden="true"><svg class="hero-lines" viewBox="0 0 500 360" preserveAspectRatio="none"><path d="M248 25v70M248 100C248 150 90 130 90 215M248 100c0 50 160 30 160 115M90 220v95M408 220v95M90 262h160M408 262H250"/><path d="M248 25v70" class="hero-line-strong"/></svg><span class="hero-node hero-node-main">${icon("layers")}<span>${escapeHtml(tr("homeMapRoot"))}</span></span><span class="hero-node hero-node-left">${escapeHtml(tr("categoryNames").business)}</span><span class="hero-node hero-node-right">${escapeHtml(tr("categoryNames").data)}</span><span class="hero-node hero-node-bottom hero-node-left-bottom">${escapeHtml(tr("categoryNames").accounting)}</span><span class="hero-node hero-node-bottom hero-node-right-bottom">${escapeHtml(tr("categoryNames").systems)}</span></div>
      </section>
      <section class="category-strip"><div class="section-heading"><div><h2>${escapeHtml(tr("categories"))}</h2><p>${escapeHtml(tr("categoryIntro"))}</p></div><a class="text-link" href="${categoryHref("all")}">${escapeHtml(tr("allRoadmaps"))}${icon("arrow")}</a></div><div class="category-chips">${CATEGORIES.map((category) => `<a class="category-chip" href="${categoryHref(category)}"><span>${icon("category")}</span><span>${escapeHtml(categoryName(category))}</span><small>${formatNumber(counts[category])}</small></a>`).join("")}</div></section>
      <section>${sectionHeading(tr("popular"), tr("popularIntro"), categoryHref("all"))}<div class="roadmap-grid roadmap-grid-home">${popular.map((roadmap, index) => roadmapCard(roadmap, { featured: true, icon: ["chart", "layers", "book", "category", "chart", "spark"][index] })).join("")}</div></section>
      <section class="browse-banner"><span class="browse-banner-icon">${icon("category")}</span><div><h2>${escapeHtml(tr("allRoadmaps"))}</h2><p>${formatNumber(roadmaps.length)} ${escapeHtml(tr("fieldsCountLabel"))} · ${formatNumber(roadmaps.reduce((sum, roadmap) => sum + roadmap.topicCount, 0))} ${escapeHtml(tr("learningSteps"))}</p></div><a class="button button-secondary" href="${categoryHref("all")}">${escapeHtml(tr("browseAll"))}${icon("arrow")}</a></section>`;
  };
  const renderLibrary = (params, mode = "all") => {
    const selectedCategory = params.get("category") || "all";
    const rawQuery = (params.get("q") || "").trim();
    const queryResolution = resolveSearchQuery(rawQuery);
    const query = queryResolution.query;
    let list = roadmaps;
    if (mode === "saved") list = roadmaps.filter((roadmap) => state.favorites.includes(roadmap.id));
    if (mode === "learning") list = roadmaps.filter((roadmap) => state.started.includes(roadmap.id) || completedIds(roadmap).length > 0);
    if (mode === "all" && selectedCategory !== "all") list = list.filter((roadmap) => roadmap.category === selectedCategory);
    if (rawQuery) {
      const matchingIds = matchingRoadmapIds(query);
      list = list.filter((roadmap) => matchingIds.has(roadmap.id));
    }
    const heading = mode === "learning" ? tr("learningTitle") : mode === "saved" ? tr("savedRoadmaps") : selectedCategory === "all" ? tr("allRoadmaps") : categoryName(selectedCategory);
    const description = mode === "learning" ? tr("learningIntro") : mode === "saved" ? tr("savedIntro") : tr("libraryIntro");
    const counts = findCategoryCounts();
    const hasRoadmaps = list.length > 0;
    const noItems = mode === "saved" ? tr("noSaved") : mode === "learning" ? tr("noLearning") : tr("noResults");
    root.innerHTML = `<header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(mode === "all" ? tr("categories") : tr("yourSpace"))}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>${mode === "learning" && state.started.length ? `<button class="button button-secondary" type="button" data-action="reset-progress">${icon("reset")}${escapeHtml(tr("resetProgress"))}</button>` : ""}</header>
      <div class="library-layout"><aside class="category-rail" aria-label="${escapeHtml(tr("categories"))}"><h2>${escapeHtml(tr("categories"))}</h2><a class="category-link ${selectedCategory === "all" ? "is-active" : ""}" href="${categoryHref("all")}"><span>${escapeHtml(tr("allCategories"))}</span><b>${formatNumber(mode === "all" ? roadmaps.length : list.length)}</b></a>${CATEGORIES.map((category) => `<a class="category-link ${selectedCategory === category ? "is-active" : ""}" href="${categoryHref(category)}"><span>${escapeHtml(categoryName(category))}</span><b>${formatNumber(mode === "all" ? counts[category] : (list.filter((roadmap) => roadmap.category === category).length))}</b></a>`).join("")}</aside>
        <section class="library-results" aria-label="${escapeHtml(heading)}"><div class="results-toolbar"><span>${formatNumber(list.length)} ${escapeHtml(tr("results"))}</span>${rawQuery ? `<span class="query-chip">${icon("search")}${escapeHtml(rawQuery)}<a href="${categoryHref(selectedCategory)}" aria-label="${escapeHtml(tr("clearSearch"))}">×</a></span>` : ""}</div>${rawQuery && queryResolution.changed ? `<button type="button" class="search-correction library-search-correction" data-action="apply-library-search-suggestion" data-query="${escapeHtml(query)}" data-category="${escapeHtml(selectedCategory)}">${icon("search")}<span>${escapeHtml(tr("didYouMean"))} <strong dir="auto">${escapeHtml(queryResolution.suggestion)}</strong>?</span></button>` : ""}${hasRoadmaps ? `<div class="roadmap-grid">${list.map((roadmap) => roadmapCard(roadmap)).join("")}</div>` : `<div class="empty-state">${icon(mode === "saved" ? "bookmark" : mode === "learning" ? "play" : "search")}<h2>${escapeHtml(noItems)}</h2>${mode === "saved" || mode === "learning" ? `<a class="button button-primary" href="${categoryHref("all")}">${escapeHtml(tr("browseAll"))}${icon("arrow")}</a>` : ""}</div>`}</section>
      </div>`;
  };
  const renderLearningPage = (roadmap, selected) => {
    const { topic, module } = selected;
    const title = localized(topic.title);
    const moduleTitle = localized(module.title);
    const roadmapTitle = localized(roadmap.title);
    const microTopics = topic.subtopics || [];
    const overview = state.language === "ar"
      ? `يتناول هذا الموضوع «${title}» من خلال ${microTopics.map(localized).join("، ")}. تساعدك هذه المفاهيم على فهم علاقتها بـ«${moduleTitle}» وتطبيقها ضمن مجال «${roadmapTitle}».`
      : `This topic covers ${title} through ${microTopics.map(localized).join(", ")}. These concepts help explain how it connects to ${moduleTitle} and where it is used in ${roadmapTitle}.`;
    const backHref = roadmapHref(roadmap, topic.id);
    state.started = [...new Set([...state.started, roadmap.id])];
    persist();
    return `<div class="learning-drawer-layer"><button class="learning-drawer-scrim" type="button" data-action="return-to-map" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-label="${escapeHtml(tr("backToMap"))}"></button><aside class="learning-drawer" role="dialog" aria-modal="true" aria-labelledby="selectedTopicTitle"><div class="learning-page">
      <header class="learning-page-toolbar"><div class="learning-page-status">${topicStatusControls(roadmap, topic)}</div><button class="panel-close" type="button" data-action="return-to-map" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-label="${escapeHtml(tr("backToMap"))}">${icon("close")}</button></header>
      <div class="learning-page-progress">${progressMarkup(roadmap, true)}</div>
      <nav class="breadcrumbs" aria-label="${escapeHtml(tr("breadcrumbs"))}"><a href="${categoryHref("all")}">${escapeHtml(tr("allRoadmaps"))}</a><span aria-hidden="true">/</span><a href="${categoryHref(roadmap.category)}">${escapeHtml(categoryName(roadmap.category))}</a><span aria-hidden="true">/</span><a href="${backHref}">${escapeHtml(roadmapTitle)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav>
      <main class="learning-panel learning-page-content" id="learningPanel" aria-labelledby="selectedTopicTitle"><div class="detail-context"><span>${escapeHtml(roadmapTitle)}</span><span aria-hidden="true">/</span><span>${escapeHtml(moduleTitle)}</span></div>
      <h1 id="selectedTopicTitle">${escapeHtml(title)}</h1>
      <section class="topic-overview"><h2>${escapeHtml(tr("topicOverview"))}</h2><p>${escapeHtml(overview)}</p></section>
      <section class="detail-section"><h2>${escapeHtml(tr("whatToLearn"))}</h2><p>${escapeHtml(tr("learnNote"))}</p><div class="subtopic-links">${microTopics.map((subtopic) => `<a class="subtopic-link" href="${resourceUrl("articles", localized(subtopic), `${title} ${moduleTitle}`, roadmap)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(localized(subtopic))}</span>${icon("arrow")}</a>`).join("")}</div></section>
      <section class="detail-section practice-section"><h2>${escapeHtml(tr("practice"))}</h2><p>${escapeHtml(tr("practiceNote"))}</p><div class="practice-output"><span>${icon("check")}</span><div><strong>${escapeHtml(tr("checkpointOutput"))}</strong><span>${escapeHtml(tr("checkpointOutputNote"))}</span></div></div></section>
      <section class="detail-section"><h2>${escapeHtml(tr("resources"))}</h2><p>${escapeHtml(tr("searchNote"))}</p><div class="resource-links"><a href="${resourceUrl("official", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("book")}<span>${escapeHtml(tr("searchOfficial"))}</span>${icon("arrow")}</a><a href="${resourceUrl("articles", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("book")}<span>${escapeHtml(tr("searchArticles"))}</span>${icon("arrow")}</a><a href="${resourceUrl("videos", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("play")}<span>${escapeHtml(tr("searchVideos"))}</span>${icon("arrow")}</a><a href="${resourceUrl("academic", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("chart")}<span>${escapeHtml(tr("searchAcademic"))}</span>${icon("arrow")}</a><button type="button" data-action="copy-prompt" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}">${icon("spark")}<span>${escapeHtml(tr("studyPrompt"))}</span>${icon("arrow")}</button></div></section>
      <p class="detail-footnote">${escapeHtml(tr("selfPacedNote"))}</p></main></div></aside></div>`;
  };
  const moduleState = (roadmap, module) => {
    const statuses = module.topics.map((topic) => topicStatus(roadmap, topic.id));
    if (statuses.every((status) => status === "done")) return "done";
    if (statuses.every((status) => status === "skip")) return "skip";
    if (statuses.some((status) => status !== "idle")) return "current";
    return "available";
  };
  const renderMapRow = (roadmap, module, moduleIndex, selectedId) => {
    const moduleStatus = moduleState(roadmap, module);
    const start = roadmap.modules.slice(0, moduleIndex).reduce((sum, item) => sum + item.topics.length, 0);
    const nextTopicInModule = module.topics.findIndex((topic) => !["done", "skip"].includes(topicStatus(roadmap, topic.id)));
    const targetIndex = start + (nextTopicInModule < 0 ? module.topics.length - 1 : nextTopicInModule);
    const branchSide = moduleIndex % 2 === 0 ? "left" : "right";
    const branch = `<div class="map-branch branch-${branchSide}"><div class="topic-grid">${module.topics.map((topic) => {
      const status = topicStatus(roadmap, topic.id);
      const current = selectedId === topic.id;
      const label = localized(topic.title);
      const statusLabel = tr(status === "done" ? "statusDone" : status === "skip" ? "statusSkip" : status === "learning" ? "statusLearning" : "available");
      const marker = status === "done" ? icon("check") : status === "skip" ? icon("close") : status === "learning" ? icon("book") : "";
      const action = `data-action="open-topic" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}"`;
      return `<div class="topic-item topic-item-${status} ${current ? "is-selected" : ""}"><button class="topic-node node-${status} ${current ? "is-selected" : ""}" type="button" ${action} aria-label="${escapeHtml(`${label}. ${statusLabel}`)}" ${current ? `aria-current="step"` : ""}><span class="node-marker">${marker}</span><span class="node-label" dir="auto">${escapeHtml(label)}</span></button>${topicStatusControls(roadmap, topic)}</div>`;
    }).join("")}</div></div>`;
    const empty = '<div class="map-spacer" aria-hidden="true"></div>';
    const moduleCopy = localized(module.title);
    const isFoundation = moduleIndex === 0 || /foundation|introduction|core|basic|أسس|مقدمة|المفاهيم الأساسية|الأساسيات/iu.test(moduleCopy);
    const hubMarker = moduleStatus === "done" ? icon("check") : moduleStatus === "skip" ? icon("close") : moduleStatus === "current" ? icon("play") : icon("layers");
    const hubLabel = moduleStatus === "done" ? tr("statusDone") : moduleStatus === "skip" ? tr("statusSkip") : moduleStatus === "current" ? tr("inProgress") : isFoundation ? tr("foundations") : tr("available");
    const hub = `<button class="map-hub hub-${moduleStatus}" type="button" data-action="open-module" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(roadmap.modules.flatMap((item) => item.topics)[targetIndex].id)}"><span class="hub-marker">${hubMarker}</span><span class="hub-copy"><strong dir="auto">${escapeHtml(moduleCopy)}</strong><small>${escapeHtml(hubLabel)}</small></span>${icon("arrow")}</button>`;
    const left = branchSide === "left" ? branch : empty;
    const right = branchSide === "right" ? branch : empty;
    return `<section class="map-row row-${branchSide}" aria-label="${escapeHtml(moduleCopy)}">${left}${hub}${right}</section>`;
  };
  const drawMapConnectors = () => {
    const map = root.querySelector(".roadmap-map");
    const layer = map?.querySelector(".map-connector-layer");
    if (!map || !layer) return;
    const mapRect = map.getBoundingClientRect();
    const width = Math.max(1, map.clientWidth);
    const height = Math.max(1, map.scrollHeight);
    layer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    layer.setAttribute("width", width);
    layer.setAttribute("height", height);
    const paths = [];
    map.querySelectorAll(".map-row").forEach((row) => {
      const hub = row.querySelector(".map-hub");
      const branch = row.querySelector(".map-branch");
      if (!hub || !branch) return;
      const hubRect = hub.getBoundingClientRect();
      const hubX = hubRect.left + hubRect.width / 2 - mapRect.left;
      const hubY = hubRect.top + hubRect.height / 2 - mapRect.top;
      const vertical = hubRect.top < branch.getBoundingClientRect().top;
      const nodes = [...row.querySelectorAll(".topic-node")];
      nodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        let path;
        if (vertical) {
          const startX = hubX;
          const startY = hubRect.bottom - mapRect.top;
          const endX = rect.left + rect.width / 2 - mapRect.left;
          const endY = rect.top - mapRect.top;
          const spread = (index - (nodes.length - 1) / 2) * 14;
          path = `M ${startX} ${startY} C ${startX + spread} ${startY + 22}, ${endX + spread} ${endY - 20}, ${endX} ${endY}`;
        } else {
          const nodeX = rect.left + rect.width / 2 - mapRect.left;
          const nodeIsLeft = nodeX < hubX;
          const startX = (nodeIsLeft ? rect.right : rect.left) - mapRect.left;
          const startY = rect.top + rect.height / 2 - mapRect.top;
          const endX = (nodeIsLeft ? hubRect.left : hubRect.right) - mapRect.left;
          const middleX = (startX + endX) / 2;
          path = `M ${startX} ${startY} C ${middleX} ${startY}, ${middleX} ${hubY}, ${endX} ${hubY}`;
        }
        paths.push(`<path class="map-connector" d="${path}"/>`);
      });
    });
    layer.innerHTML = paths.join("");
  };
  const renderRoadmap = (roadmap, params, drawerTopic = null) => {
    const progress = roadmapProgress(roadmap);
    const flattened = topicList(roadmap);
    const requestedId = params.get("topic");
    const requestedIndex = requestedId ? flattened.findIndex(({ topic }) => topic.id === requestedId) : -1;
    const selectedIndex = requestedIndex >= 0 ? requestedIndex : -1;
    const selected = selectedIndex >= 0 ? flattened[selectedIndex] : null;
    const selectedId = selected?.topic.id;
    const allDone = progress.total > 0 && progress.done === progress.total;
    const allSkipped = progress.total === 0 && progress.skipped === progress.all && progress.all > 0;
    const connectedPaths = (roadmap.related || []).map((id) => byId.get(id)).filter(Boolean);
    const connectedPathsMarkup = connectedPaths.length ? `<section class="connected-paths" aria-labelledby="connectedPathsTitle"><div class="section-heading"><div><h2 id="connectedPathsTitle">${escapeHtml(tr("connectedPaths"))}</h2><p>${escapeHtml(tr("connectedPathsNote"))}</p></div></div><div class="connected-path-grid">${connectedPaths.map((related) => `<a class="connected-path-card" href="${roadmapHref(related)}" data-action="open-related-roadmap" data-roadmap="${escapeHtml(related.id)}"><span class="eyebrow">${escapeHtml(categoryName(related.category))}</span><strong>${escapeHtml(localized(related.title))}</strong>${icon("arrow")}</a>`).join("")}</div></section>` : "";
    state.started = [...new Set([...state.started, roadmap.id])];
    persist();
    root.innerHTML = `<div class="roadmap-page"><nav class="breadcrumbs" aria-label="${escapeHtml(tr("breadcrumbs"))}"><a href="${categoryHref("all")}">${escapeHtml(tr("allRoadmaps"))}</a><span aria-hidden="true">/</span><a href="${categoryHref(roadmap.category)}">${escapeHtml(categoryName(roadmap.category))}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(localized(roadmap.title))}</span></nav>
        <header class="roadmap-header"><div class="roadmap-header-copy"><span class="eyebrow">${escapeHtml(categoryName(roadmap.category))}</span><h1>${escapeHtml(localized(roadmap.title))}</h1><p>${escapeHtml(localized(roadmap.summary))}</p></div><button class="bookmark-button roadmap-bookmark ${state.favorites.includes(roadmap.id) ? "is-saved" : ""}" type="button" data-action="toggle-save" data-roadmap="${escapeHtml(roadmap.id)}" aria-label="${escapeHtml(state.favorites.includes(roadmap.id) ? tr("removeSaved") : tr("saveRoadmap"))}" aria-pressed="${state.favorites.includes(roadmap.id)}">${icon("bookmark")}<span>${escapeHtml(state.favorites.includes(roadmap.id) ? tr("saved") : tr("save"))}</span></button></header>
        <section class="roadmap-progress-card"><div class="roadmap-progress-copy"><span class="progress-icon">${icon(allDone ? "check" : "chart")}</span><div><strong>${allDone ? escapeHtml(tr("journeyComplete")) : allSkipped ? escapeHtml(tr("allTopicsSkipped")) : escapeHtml(tr("nextUp"))}</strong><span>${allDone ? escapeHtml(tr("journeyCompleteNote")) : allSkipped ? escapeHtml(tr("allTopicsSkippedNote")) : escapeHtml(tr("allTopicsOpen"))}</span></div></div><div class="roadmap-progress-value"><strong>${formatNumber(progress.done)}<span> / ${formatNumber(progress.total)}</span></strong><span>${formatNumber(progress.percent)}${percentSymbol()} ${escapeHtml(tr("progress"))}</span></div>${progressMarkup(roadmap, true)}</section>
        <div class="roadmap-guidance">${icon("layers")}<p>${escapeHtml(tr("mapHint"))}</p></div>
        ${allDone ? `<div class="journey-complete-banner">${icon("check")}<span>${escapeHtml(tr("journeyComplete"))}</span></div>` : ""}
        <div class="roadmap-workspace"><section class="roadmap-map" aria-label="${escapeHtml(tr("roadmapMap"))}"><svg class="map-connector-layer" aria-hidden="true"></svg>${roadmap.modules.map((module, moduleIndex) => renderMapRow(roadmap, module, moduleIndex, selectedId)).join("")}</section></div>${connectedPathsMarkup}
      </div>${drawerTopic ? renderLearningPage(roadmap, drawerTopic) : ""}`;
    drawMapConnectors();
  };
  const frameworkHints = {
    business: { en: "Harvard Business School curriculum", ar: "منهج إدارة الأعمال في جامعة هارفارد" },
    accounting: { en: "AACSB accounting education standards", ar: "معايير التعليم المحاسبي المهنية" },
    finance: { en: "CFA Institute curriculum", ar: "منهج التحليل والاستثمار المالي" },
    economics: { en: "Wharton economics courses", ar: "مقررات الاقتصاد للأعمال في جامعة وارتون" },
    marketing: { en: "American Marketing Association competency model", ar: "إطار كفاءات التسويق المهنية" },
    people: { en: "SHRM body of applied skills and knowledge", ar: "إطار المهارات والمعرفة المهنية للموارد البشرية" },
    communication: { en: "PMI power skills framework and communication research", ar: "إطار المهارات المهنية وبحوث التواصل" },
    psychology: { en: "APA psychology specialties and psychological research", ar: "تخصصات علم النفس والبحوث النفسية" },
    operations: { en: "ASCM supply chain operations reference model", ar: "معيار عمليات سلاسل الإمداد" },
    analysis: { en: "IIBA business analysis standard PMI project management", ar: "معايير تحليل الأعمال وإدارة المشروعات" },
    systems: { en: "ACM AIS information systems curriculum", ar: "منهج نظم المعلومات الأكاديمي" },
    data: { en: "ACM data science curriculum", ar: "إطار علوم البيانات الأكاديمي" },
    applied: { en: "university curriculum professional framework", ar: "مناهج جامعية وأطر مهنية" },
    professional: { en: "university research and professional skills curriculum", ar: "مناهج البحث والمهارات المهنية" }
  };
  const resourceUrl = (kind, title, moduleTitle, roadmap) => {
    const framework = roadmap.id === "database-administration"
      ? (state.language === "ar" ? "توثيق بوستجريس الرسمي" : "PostgreSQL official documentation")
      : frameworkHints[roadmap.category]?.[state.language] || (state.language === "ar" ? "مصادر جامعية ومهنية" : "university learning resources");
    const localeHint = state.language === "ar" ? "مصادر تعليمية موثوقة" : "learning resources";
    const databaseDocs = roadmap.id === "database-administration" ? " site:postgresql.org/docs/current" : "";
    const officialHint = state.language === "ar" ? "التوثيق الرسمي والمعايير المهنية" : "official documentation and professional standards";
    const query = kind === "official"
      ? `${title} ${moduleTitle} ${framework} ${officialHint} ${localeHint}${databaseDocs}`
      : kind === "articles"
        ? `${title} ${moduleTitle} ${framework} ${localeHint}`
        : `${title} ${moduleTitle} ${localized(roadmap.title)} ${localeHint}`;
    const value = encodeURIComponent(query);
    const locale = state.language === "ar" ? "ar" : "en";
    if (kind === "videos") return `https://www.youtube.com/results?search_query=${value}&hl=${locale}`;
    if (kind === "academic") return `https://scholar.google.com/scholar?q=${value}&hl=${locale}`;
    return `https://www.google.com/search?q=${value}&hl=${locale}`;
  };
  const parseRoute = () => {
    const raw = location.hash.replace(/^#/, "") || "/home";
    const separator = raw.indexOf("?");
    const path = (separator < 0 ? raw : raw.slice(0, separator)).replace(/^\/+/, "");
    const params = new URLSearchParams(separator < 0 ? "" : raw.slice(separator + 1));
    const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
    return { page: segments[0] || "home", id: segments[1] || "", params };
  };
  const render = () => {
    setDocumentLanguage();
    document.getElementById("platformNavMobile").hidden = true;
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
    const route = parseRoute();
    document.body.classList.toggle("has-learning-drawer", route.page === "learn");
    if (route.page === "roadmap") {
      const roadmap = byId.get(route.id);
      if (roadmap) renderRoadmap(roadmap, route.params);
      else { setHash("#/paths", true); return; }
    } else if (route.page === "learn") {
      const roadmap = byId.get(route.id);
      const selected = roadmap ? topicList(roadmap).find(({ topic }) => topic.id === route.params.get("topic")) : null;
      if (roadmap && selected) renderRoadmap(roadmap, route.params, selected);
      else if (roadmap) { setHash(roadmapHref(roadmap), true); return; }
      else { setHash("#/paths", true); return; }
    } else if (route.page === "paths") {
      renderLibrary(route.params, "all");
    } else if (route.page === "learning") {
      renderLibrary(route.params, "learning");
    } else if (route.page === "saved") {
      renderLibrary(route.params, "saved");
    } else {
      renderHome();
    }
    syncNavigation();
    if (searchInput.value && document.activeElement === searchInput) updateSearchResults(searchInput.value);
    else closeSearchResults();
    if (focusTopicAfterRender) {
      const heading = document.getElementById("selectedTopicTitle");
      const fallback = document.querySelector(".learning-drawer .learning-page-status .topic-status-control, .topic-item.is-selected .topic-node, .topic-item.is-selected .topic-status-control");
      const target = heading || fallback;
      if (target) { target.setAttribute("tabindex", "-1"); target.focus(); }
      focusTopicAfterRender = false;
    }
    if (scrollToTopAfterRender) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      scrollToTopAfterRender = false;
    }
  };
  const updateSearchResults = (query) => {
    const rawQuery = query.trim();
    if (!rawQuery) { closeSearchResults(); return; }
    const resolution = resolveSearchQuery(rawQuery);
    const matches = rankedSearchRecords(resolution.query, 8);
    const results = matches.map((record) => {
      if (record.type === "roadmap") return { type: "roadmap", href: roadmapHref(record.roadmap), title: localized(record.roadmap.title), meta: categoryName(record.roadmap.category) };
      const queryWords = searchWords(resolution.query);
      const matchedSubtopic = (record.topic.subtopics || []).find((subtopic) => {
        const words = searchWords(localized(subtopic));
        return queryWords.every((word) => words.some((candidate) => candidate === word || candidate.startsWith(word)));
      });
      const meta = [localized(record.roadmap.title), localized(record.module.title), matchedSubtopic ? localized(matchedSubtopic) : ""].filter(Boolean).join(" · ");
      return { type: "topic", href: roadmapHref(record.roadmap, record.topic.id), title: localized(record.topic.title), meta };
    });
    const hasSuggestion = resolution.changed;
    searchFocusIndex = results.length || hasSuggestion ? 0 : -1;
    searchInput.setAttribute("aria-expanded", "true");
    searchResults.hidden = false;
    const suggestion = hasSuggestion ? `<button type="button" role="option" class="search-correction" aria-selected="${searchFocusIndex === 0}" data-search-index="0" data-search-suggestion="${escapeHtml(resolution.query)}" data-action="apply-search-suggestion">${icon("search")}<span>${escapeHtml(tr("didYouMean"))} <strong dir="auto">${escapeHtml(resolution.suggestion)}</strong>?</span></button>` : "";
    const resultOffset = hasSuggestion ? 1 : 0;
    const resultMarkup = results.length ? results.map((result, index) => `<a class="search-result" role="option" aria-selected="${index + resultOffset === searchFocusIndex}" href="${result.href}" data-search-index="${index + resultOffset}"><span class="search-result-icon">${icon(result.type === "roadmap" ? "layers" : "book")}</span><span><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.meta)}</small></span>${icon("arrow")}</a>`).join("") : `<div class="search-empty">${icon("search")}<span>${escapeHtml(tr("noResults"))}</span></div>`;
    searchResults.innerHTML = `${suggestion}${resultMarkup}`;
  };
  const closeSearchResults = () => {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchFocusIndex = -1;
  };
  const chooseSearchResult = () => {
    const option = searchResults.querySelector(`[data-search-index="${searchFocusIndex}"]`);
    if (option?.dataset.searchSuggestion) {
      searchInput.value = option.dataset.searchSuggestion;
      updateSearchResults(searchInput.value);
      searchInput.select();
      return;
    }
    if (option?.getAttribute("href")) { location.hash = option.getAttribute("href"); closeSearchResults(); searchInput.blur(); }
  };
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  };
  const copyStudyPrompt = async (roadmap, topicId) => {
    const found = topicIndex.get(topicId);
    if (!found || found.roadmap.id !== roadmap.id) return;
    const title = localized(found.topic.title);
    const moduleTitle = localized(found.module.title);
    const prompt = state.language === "ar"
      ? `اشرح لي موضوع «${title}» بلغة عربية واضحة. ابدأ بتعريف مختصر، ثم وضّح علاقته بـ«${moduleTitle}» وبمجال «${localized(roadmap.title)}». استخدم مثالاً عملياً من مؤسسة، واذكر سؤالاً قصيراً أختبر به فهمي، ثم رشّح كلمات بحث عن مصادر موثوقة. لا تفترض أنني أعرف المصطلحات المتخصصة.`
      : `Teach me “${title}” in clear English. Start with a concise definition, connect it to “${moduleTitle}” and “${localized(roadmap.title)}”, give a practical organizational example, ask one short question to check my understanding, and suggest search terms for trustworthy sources. Assume I am new to the subject.`;
    try {
      await navigator.clipboard.writeText(prompt);
      showToast(tr("copied"));
    } catch {
      const field = document.createElement("textarea");
      field.value = prompt;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      showToast(copied ? tr("copied") : tr("copyFailed"));
    }
  };
  const toggleSaved = (id) => {
    if (!byId.has(id)) return;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
    persist();
    render();
  };
  const setTopicStatus = (roadmapId, topicId, status) => {
    const roadmap = byId.get(roadmapId);
    if (!roadmap || !["learning", "done", "skip"].includes(status)) return;
    const ordered = topicList(roadmap).map(({ topic }) => topic.id);
    if (!ordered.includes(topicId)) return;
    const currentStatus = topicStatus(roadmap, topicId);
    const nextStatus = currentStatus === status && ["done", "skip"].includes(status) ? "idle" : status;
    const sets = {
      learning: new Set(learningIds(roadmap)),
      done: new Set(completedIds(roadmap)),
      skip: new Set(skippedIds(roadmap))
    };
    Object.values(sets).forEach((set) => set.delete(topicId));
    if (nextStatus !== "idle") sets[nextStatus].add(topicId);
    for (const [key, set] of Object.entries(sets)) {
      const orderedIds = ordered.filter((id) => set.has(id));
      const stateKey = key === "done" ? "progress" : key === "skip" ? "skipped" : "learning";
      if (orderedIds.length) state[stateKey][roadmap.id] = orderedIds;
      else delete state[stateKey][roadmap.id];
    }
    state.started = [...new Set([...state.started, roadmap.id])];
    persist();
    focusTopicAfterRender = true;
    if (nextStatus === "learning") {
      const target = learningHref(roadmap, topicId);
      if (location.hash === target) setHash(target, true);
      else location.hash = target;
      return;
    }
    const mapTarget = roadmapHref(roadmap, topicId);
    if (location.hash.startsWith(`#/learn/${encodeURIComponent(roadmap.id)}`)) location.hash = mapTarget;
    else setHash(mapTarget, true);
  };
  const resetProgress = () => {
    if (!window.confirm(tr("resetConfirm"))) return;
    state.started = [];
    state.progress = {};
    state.learning = {};
    state.skipped = {};
    persist();
    render();
    showToast(tr("resetDone"));
  };
  const delegatedClick = (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const name = action.dataset.action;
    if (name === "toggle-save") { event.preventDefault(); toggleSaved(action.dataset.roadmap); }
    if (name === "open-related-roadmap") {
      event.preventDefault();
      const roadmap = byId.get(action.dataset.roadmap);
      if (roadmap) {
        focusTopicAfterRender = false;
        scrollToTopAfterRender = true;
        location.hash = roadmapHref(roadmap);
      }
    }
    if (name === "open-topic" || name === "open-module") {
      event.preventDefault();
      const roadmap = byId.get(action.dataset.roadmap);
      const topicId = action.dataset.topic;
      if (roadmap && topicList(roadmap).some(({ topic }) => topic.id === topicId)) {
        focusTopicAfterRender = true;
        setHash(roadmapHref(roadmap, topicId), true);
      }
    }
  if (name === "apply-search-suggestion") {
    event.preventDefault();
    searchInput.value = action.dataset.searchSuggestion || "";
    updateSearchResults(searchInput.value);
    searchInput.focus();
    searchInput.select();
  }
    if (name === "apply-library-search-suggestion") {
      event.preventDefault();
      location.hash = librarySearchHref(action.dataset.category, action.dataset.query);
    }
    if (name === "set-topic-status") { event.preventDefault(); setTopicStatus(action.dataset.roadmap, action.dataset.topic, action.dataset.status); }
    if (name === "return-to-map") { event.preventDefault(); focusTopicAfterRender = true; location.hash = roadmapHref(byId.get(action.dataset.roadmap), action.dataset.topic); }
    if (name === "copy-prompt") { event.preventDefault(); copyStudyPrompt(action.dataset.roadmap, action.dataset.topic); }
    if (name === "reset-progress") { event.preventDefault(); resetProgress(); }
    if (name === "focus-search") { searchInput.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  document.addEventListener("click", delegatedClick);
  document.addEventListener("click", (event) => {
    if (!searchWrap.contains(event.target)) closeSearchResults();
  });
  document.addEventListener("keydown", (event) => {
    const route = parseRoute();
    if (route.page !== "learn") return;
    const drawer = root.querySelector(".learning-drawer");
    if (!drawer) return;
    if (event.key === "Escape") {
      const roadmap = byId.get(route.id);
      if (roadmap) {
        event.preventDefault();
        focusTopicAfterRender = true;
        location.hash = roadmapHref(roadmap, route.params.get("topic"));
      }
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", drawMapConnectors);
  searchInput.addEventListener("input", () => updateSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeSearchResults(); searchInput.blur(); return; }
    const options = [...searchResults.querySelectorAll("[data-search-index]")];
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
      event.preventDefault();
      searchFocusIndex = (searchFocusIndex + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === searchFocusIndex)));
      options[searchFocusIndex].scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && !searchResults.hidden) { event.preventDefault(); chooseSearchResult(); }
  });
  document.getElementById("languageToggle").addEventListener("click", () => {
    state.language = state.language === "en" ? "ar" : "en";
    searchInput.value = "";
    persist();
    render();
  });
  document.getElementById("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    persist();
    setDocumentLanguage();
    render();
  });
  document.getElementById("menuToggle").addEventListener("click", (event) => {
    const menu = document.getElementById("platformNavMobile");
    const open = menu.hidden;
    menu.hidden = !open;
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); searchInput.focus(); searchInput.select();
    } else if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault(); searchInput.focus();
    }
  });

  setDocumentLanguage();
  if (!location.hash) history.replaceState(null, "", "#/home");
  render();
})();
