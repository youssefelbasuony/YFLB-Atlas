(async () => {
  "use strict";

  const DATA = window.AtlasData;
  if (!DATA) return;

  let contentStore = { configured: false, user: null, isEditor: () => false };
  let contentLoadError = null;
  try {
    const cms = await import("./content-store.js");
    contentStore = await cms.createContentStore(window.ATLAS_FIREBASE_CONFIG);
    if (contentStore.configured) await contentStore.load(DATA.roadmaps);
  } catch (error) {
    contentLoadError = error;
  }

  const { copy, CATEGORIES, roadmaps, featured } = DATA;
  const root = document.getElementById("main-content");
  const searchInput = document.getElementById("globalSearch");
  const searchResults = document.getElementById("searchResults");
  const searchWrap = document.getElementById("searchWrap");
  const toast = document.getElementById("toast");
  const STORAGE_KEY = "professional-atlas-v3";
  const GUEST_STATE_KEY = `${STORAGE_KEY}-guest`;
  const ACTIVE_USER_KEY = `${STORAGE_KEY}-active-user`;
  const accountStateKey = (uid) => `${STORAGE_KEY}-user-${uid}`;
  const byId = new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap]));
  const topicIndex = new Map();
  roadmaps.forEach((roadmap) => roadmap.modules.forEach((module) => module.topics.forEach((topic, index) => {
    topicIndex.set(topic.id, { roadmap, module, topic, moduleIndex: roadmap.modules.indexOf(module), index });
  })));

  const freshState = () => ({ language: "en", theme: "light", favorites: [], started: [], progress: {}, learning: {}, skipped: {} });
  const normalizeState = (saved) => {
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
  };
  const readStoredState = (key) => {
    try { return normalizeState(JSON.parse(localStorage.getItem(key) || "null")); }
    catch { return freshState(); }
  };
  const readStorageValue = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const readState = () => readStoredState(STORAGE_KEY);
  const personalState = (source) => ({
    favorites: source.favorites,
    started: source.started,
    progress: source.progress,
    learning: source.learning,
    skipped: source.skipped
  });
  const mergeLearningStates = (primary, secondary) => {
    const first = normalizeState(primary);
    const second = normalizeState(secondary);
    const merged = freshState();
    merged.language = first.language;
    merged.theme = first.theme;
    merged.favorites = [...new Set([...first.favorites, ...second.favorites])];
    merged.started = [...new Set([...first.started, ...second.started])];
    roadmaps.forEach((roadmap) => {
      const ordered = roadmap.modules.flatMap((module) => module.topics.map((topic) => topic.id));
      const completed = new Set([...(first.progress[roadmap.id] || []), ...(second.progress[roadmap.id] || [])]);
      const skipped = new Set([...(first.skipped[roadmap.id] || []), ...(second.skipped[roadmap.id] || [])]);
      const learning = new Set([...(first.learning[roadmap.id] || []), ...(second.learning[roadmap.id] || [])]);
      const doneIds = ordered.filter((id) => completed.has(id));
      const skippedIds = ordered.filter((id) => skipped.has(id) && !completed.has(id));
      const learningIds = ordered.filter((id) => learning.has(id) && !completed.has(id) && !skipped.has(id));
      if (doneIds.length) merged.progress[roadmap.id] = doneIds;
      if (skippedIds.length) merged.skipped[roadmap.id] = skippedIds;
      if (learningIds.length) merged.learning[roadmap.id] = learningIds;
    });
    merged.started = [...new Set([...merged.started, ...Object.keys(merged.progress), ...Object.keys(merged.learning), ...Object.keys(merged.skipped)])];
    return merged;
  };
  const state = readState();
  if (readStorageValue(ACTIVE_USER_KEY)) {
    const guestState = readStoredState(GUEST_STATE_KEY);
    Object.assign(state, {
      favorites: guestState.favorites,
      started: guestState.started,
      progress: guestState.progress,
      learning: guestState.learning,
      skipped: guestState.skipped
    });
  }
  let authReady = !contentStore.configured;
  let activeUserUid = null;
  let cloudSyncEnabled = false;
  let cloudSyncState = "guest";
  let lastCloudSnapshot = "";
  let cloudSyncTimer = 0;
  let authHydrationVersion = 0;
  let cloudWriteQueue = Promise.resolve();
  let syncErrorShown = false;
  let searchFocusIndex = -1;
  let focusTopicAfterRender = false;
  let focusMainAfterRender = false;
  let scrollToTopAfterRender = false;
  let toastTimer = 0;
  let googleSignInPending = false;
  let searchIndexCache = null;
  let adminDraft = null;
  let adminSelectedId = "";
  let adminModuleIndex = 0;
  let adminTopicIndex = 0;
  let adminBusy = false;
  let adminNotice = "";
  let inlineEditDraft = null;
  let inlineEditModuleIndex = 0;
  let inlineEditTopicIndex = 0;
  let inlineEditBusy = false;
  let inlineEditError = "";
  let inlineEditBaseline = "";
  let inlineEditTarget = { kind: "path" };
  let inlineEditConceptIndex = 0;
  let adminEditMode = false;
  let mobileStatusTopic = "";
  let mobileStatusTimer = 0;
  let mobilePointerStart = null;
  let suppressLongPressClick = false;
  let suppressLongPressTopic = "";
  let focusInlineEditorAfterRender = false;

  const tr = (key) => copy[state.language][key] ?? copy.en[key] ?? key;
  const localized = (value) => typeof value === "string" ? value : value?.[state.language] ?? value?.en ?? "";
  const canEditContent = () => Boolean(contentStore.isEditor?.());
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
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      play: '<path d="m8 5 11 7-11 7z"/>',
      reset: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/>'
    };
    return `<svg class="icon icon-${name}" ${extra} viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.category}</svg>`;
  };

  const queueCloudSync = () => {
    if (!cloudSyncEnabled || !activeUserUid || contentStore.user?.uid !== activeUserUid) return;
    const snapshot = JSON.stringify(personalState(state));
    if (snapshot === lastCloudSnapshot) return;
    window.clearTimeout(cloudSyncTimer);
    cloudSyncTimer = window.setTimeout(() => {
      if (!cloudSyncEnabled || !activeUserUid || contentStore.user?.uid !== activeUserUid) return;
      const uid = activeUserUid;
      const payload = JSON.parse(snapshot);
      cloudWriteQueue = cloudWriteQueue.catch(() => {}).then(() => contentStore.saveUserState(uid, payload));
      cloudWriteQueue.then(() => {
        if (activeUserUid !== uid) return;
        lastCloudSnapshot = snapshot;
        cloudSyncState = "ready";
        syncErrorShown = false;
        updateAccountControls();
      }).catch((error) => {
        console.warn("Atlas learning progress could not sync.", error);
        if (activeUserUid !== uid) return;
        cloudSyncState = "error";
        updateAccountControls();
        if (!syncErrorShown) { syncErrorShown = true; showToast(tr("accountSyncError")); }
      });
    }, 650);
  };
  const flushCloudSync = async () => {
    window.clearTimeout(cloudSyncTimer);
    if (!cloudSyncEnabled || !activeUserUid || contentStore.user?.uid !== activeUserUid) return true;
    const snapshot = JSON.stringify(personalState(state));
    if (snapshot === lastCloudSnapshot) return true;
    const uid = activeUserUid;
    const payload = JSON.parse(snapshot);
    cloudWriteQueue = cloudWriteQueue.catch(() => {}).then(() => contentStore.saveUserState(uid, payload));
    const saved = await Promise.race([
      cloudWriteQueue.then(() => true).catch(() => false),
      new Promise((resolve) => window.setTimeout(() => resolve(false), 2500))
    ]);
    if (saved && activeUserUid === uid) {
      lastCloudSnapshot = snapshot;
      cloudSyncState = "ready";
      updateAccountControls();
      return true;
    }
    if (activeUserUid === uid) {
      cloudSyncState = "error";
      updateAccountControls();
      if (!syncErrorShown) { syncErrorShown = true; showToast(tr("accountSyncError")); }
    }
    return false;
  };
  const persist = () => {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      if (authReady) localStorage.setItem(activeUserUid ? accountStateKey(activeUserUid) : GUEST_STATE_KEY, serialized);
    } catch { /* Private browsing can disable storage. */ }
    queueCloudSync();
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
    const languageToggle = document.getElementById("languageToggle");
    const languageLabel = document.getElementById("languageToggleLabel");
    const languageAction = isArabic ? tr("switchToEnglish") : tr("switchToArabic");
    languageToggle.setAttribute("aria-label", languageAction);
    languageToggle.title = languageAction;
    languageLabel.textContent = isArabic ? "الإنجليزية" : "العربية";
    languageToggle.innerHTML = `${icon("globe")}<span id="languageToggleLabel">${escapeHtml(isArabic ? "الإنجليزية" : "العربية")}</span>`;
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
    document.querySelector("meta[name='application-name']").content = tr("appName");
    document.querySelector("meta[property='og:site_name']").content = tr("appName");
    document.querySelector("meta[property='og:title']").content = tr("pageTitle");
    document.querySelector("meta[property='og:description']").content = tr("metaDescription");
    document.title = tr("pageTitle");
    updateAccountControls();
    syncNavigation();
  };
  const activeRouteName = () => {
    const page = parseRoute().page;
    return page === "roadmap" || page === "learn" ? "paths" : page;
  };
  const syncNavigation = () => {
    const route = activeRouteName();
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };
  const updateAccountControls = () => {
    const user = contentStore.user;
    const editor = contentStore.isEditor(user);
    const button = document.getElementById("accountButton");
    const label = document.getElementById("accountButtonLabel");
    const popover = document.getElementById("accountPopover");
    const email = document.getElementById("accountEmail");
    const badge = document.getElementById("accountAdminBadge");
    const indicator = document.getElementById("accountAdminIndicator");
    const note = document.getElementById("accountSyncNote");
    const editModeButton = document.getElementById("adminEditModeButton");
    const editModeLabel = document.getElementById("adminEditModeLabel");
    if (!button || !label || !popover || !email || !badge || !indicator || !note) return;
    label.textContent = user ? tr("account") : tr("signIn");
    button.setAttribute("aria-label", user ? tr("account") : tr("signIn"));
    button.setAttribute("aria-expanded", String(!popover.hidden));
    email.textContent = user?.email || user?.displayName || "";
    badge.hidden = !editor;
    indicator.hidden = !editor;
    note.textContent = user ? tr(cloudSyncState === "error" ? "accountSyncError" : "accountSyncReady") : tr("accountSyncHelp");
    if (!user) popover.hidden = true;
    document.querySelectorAll('[data-route="admin"]').forEach((link) => { link.hidden = !editor; });
    if (editModeButton) {
      const route = parseRoute();
      editModeButton.hidden = !editor || route.page !== "roadmap";
      editModeButton.setAttribute("aria-pressed", String(adminEditMode));
      editModeButton.setAttribute("aria-label", adminEditMode ? tr("finishEditing") : tr("editMode"));
      editModeButton.title = adminEditMode ? tr("finishEditing") : tr("editMode");
      if (editModeLabel) editModeLabel.textContent = adminEditMode ? tr("finishEditing") : tr("editMode");
    }
  };
  const categoryName = (id) => copy[state.language].categoryNames[id] || id;
  const completedIds = (roadmap) => state.progress[roadmap.id] || [];
  const learningIds = (roadmap) => state.learning[roadmap.id] || [];
  const skippedIds = (roadmap) => state.skipped[roadmap.id] || [];
  const topicList = (roadmap) => roadmap.modules.flatMap((module) => module.topics.map((topic) => ({ topic, module })));
  const rebuildTopicIndex = () => {
    topicIndex.clear();
    roadmaps.forEach((roadmap) => roadmap.modules.forEach((module, moduleIndex) => module.topics.forEach((topic, index) => {
      topicIndex.set(topic.id, { roadmap, module, topic, moduleIndex, index });
    })));
  };
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
  const setRoute = (value, replace = false) => {
    const next = new URL(value, location.href);
    if (next.origin !== location.origin) return;
    const currentPath = `${location.pathname}${location.search}`;
    const nextPath = `${next.pathname}${next.search}`;
    if (currentPath === nextPath) {
      if (replace) history.replaceState(null, "", nextPath);
      render();
      return;
    }
    if (replace) history.replaceState(null, "", nextPath);
    else history.pushState(null, "", nextPath);
    if (!focusTopicAfterRender) {
      focusMainAfterRender = true;
      if (currentPath !== nextPath) scrollToTopAfterRender = true;
    }
    render();
  };
  const roadmapHref = (roadmap, topicId) => `/roadmaps/${encodeURIComponent(roadmap.id)}/${topicId ? `?topic=${encodeURIComponent(topicId)}` : ""}`;
  const learningHref = (roadmap, topicId, conceptId = "") => `/learn/${encodeURIComponent(roadmap.id)}/${encodeURIComponent(topicId)}/${conceptId ? `?concept=${encodeURIComponent(conceptId)}` : ""}`;
  const conceptIdFor = (topic, index) => topic.subtopics?.[index]?.id || `${topic.id}-concept-${index + 1}`;
  const conceptHref = (roadmap, topic, conceptId) => learningHref(roadmap, topic.id, conceptId);
  const localizedIn = (value, language) => typeof value === "string" ? value : value?.[language] ?? value?.en ?? "";
  const topicOverviewText = (roadmap, module, topic, language = state.language) => {
    const saved = localizedIn(topic.overview, language).trim();
    if (saved) return saved;
    const topicTitle = localizedIn(topic.title, language);
    if (!topicTitle) return "";
    const moduleTitle = localizedIn(module.title, language);
    const roadmapTitle = localizedIn(roadmap.title, language);
    const concepts = (topic.subtopics || []).map((item) => localizedIn(item, language)).filter(Boolean);
    return language === "ar"
      ? `يتناول هذا الموضوع «${topicTitle}»${concepts.length ? ` من خلال ${concepts.join("، ")}` : ""}. تساعدك هذه المفاهيم على فهم علاقتها بـ«${moduleTitle}» وتطبيقها ضمن مجال «${roadmapTitle}».`
      : `This topic covers ${topicTitle}${concepts.length ? ` through ${concepts.join(", ")}` : ""}. These concepts help explain how it connects to ${moduleTitle} and where it is used in ${roadmapTitle}.`;
  };
  const conceptOverviewText = (roadmap, module, topic, concept, language = state.language) => {
    const saved = localizedIn(concept?.overview, language).trim();
    if (saved) return saved;
    const title = localizedIn(concept, language);
    if (!title) return "";
    const topicTitle = localizedIn(topic.title, language);
    const moduleTitle = localizedIn(module.title, language);
    return language === "ar"
      ? `يرتبط مفهوم «${title}» بموضوع «${topicTitle}» ضمن «${moduleTitle}». اقرأ عنه، وابحث في المصادر المقترحة، ثم دوّن مثالاً يوضح استخدامه.`
      : `“${title}” is one of the concepts within “${topicTitle}” in ${moduleTitle}. Explore the suggested sources and note an example of how it is used.`;
  };
  const categoryHref = (category) => `/paths/${category && category !== "all" ? `?category=${encodeURIComponent(category)}` : ""}`;
  const librarySearchHref = (category, query) => {
    const params = new URLSearchParams();
    if (category && category !== "all") params.set("category", category);
    if (query) params.set("q", query);
    const queryString = params.toString();
    return `/paths/${queryString ? `?${queryString}` : ""}`;
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
  const topicStatusControls = (roadmap, topic, forceVisible = false) => {
    const status = topicStatus(roadmap, topic.id);
    const actions = [
      ["learning", "book", tr("statusLearning")],
      ["done", "check", tr("statusDone")],
      ["skip", "close", tr("statusSkip")]
    ];
    return `<div class="topic-status-controls ${forceVisible ? "is-forced" : ""}" role="group" aria-label="${escapeHtml(tr("topicStatus"))}">${actions.map(([value, glyph, label]) => `<button class="topic-status-control status-control-${value} ${status === value ? "is-active" : ""}" type="button" data-action="set-topic-status" data-status="${value}" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-pressed="${status === value}" aria-label="${escapeHtml(label)}">${icon(glyph)}<span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
  };
  const roadmapCard = (roadmap, options = {}) => {
    const progress = roadmapProgress(roadmap);
    const lessonCount = topicList(roadmap).length;
    const studyMinutes = lessonCount * 15;
    const studyTime = studyMinutes < 60
      ? `${formatNumber(studyMinutes)} ${tr("minutesShort")}`
      : `${formatNumber(Math.ceil(studyMinutes / 60))} ${tr("hoursShort")}`;
    const saved = state.favorites.includes(roadmap.id);
    const status = statusTag(roadmap);
    const cardClass = options.featured ? "roadmap-card roadmap-card-featured" : "roadmap-card";
    return `<article class="${cardClass}">
      <div class="roadmap-card-top"><span class="roadmap-card-icon">${icon(options.icon || "layers")}</span><button class="bookmark-button ${saved ? "is-saved" : ""}" type="button" data-action="toggle-save" data-roadmap="${escapeHtml(roadmap.id)}" aria-label="${escapeHtml(saved ? tr("removeSaved") : tr("saveRoadmap"))}" aria-pressed="${saved}">${icon("bookmark")}</button></div>
      <a class="roadmap-card-link" href="${roadmapHref(roadmap)}"><span class="eyebrow">${escapeHtml(categoryName(roadmap.category))}</span><h3>${escapeHtml(localized(roadmap.title))}</h3><p>${escapeHtml(localized(roadmap.summary))}</p><span class="roadmap-card-meta">${status}<span class="roadmap-card-facts">${formatNumber(lessonCount)} ${escapeHtml(tr("learningSteps"))}<span aria-hidden="true">·</span>≈ ${escapeHtml(studyTime)}</span></span>${progress.done || progress.skipped || progress.learning ? progressMarkup(roadmap, true) : ""}<span class="card-action">${escapeHtml(progress.done || progress.learning || progress.skipped ? tr("continueRoadmap") : tr("openRoadmap"))}${icon("arrow")}</span></a>
    </article>`;
  };
  const sectionHeading = (title, description = "", href = "") => `<div class="section-heading"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${href ? `<a class="text-link" href="${href}">${escapeHtml(tr("browseAll"))}${icon("arrow")}</a>` : ""}</div>`;
  const renderHome = () => {
    const topRoadmaps = featured.map((id) => byId.get(id)).filter(Boolean);
    const popular = topRoadmaps.slice(0, 6);
    const counts = findCategoryCounts();
    root.innerHTML = `<section class="catalog-hero">
      <div class="hero-copy"><span class="eyebrow hero-eyebrow">${icon("spark")}${escapeHtml(tr("homeEyebrow"))}</span><h1>${escapeHtml(tr("homeTitle"))}</h1><p>${escapeHtml(tr("homeIntro"))}</p>
          <div class="hero-actions"><a class="button button-primary" href="${categoryHref("all")}">${escapeHtml(tr("startLearning"))}${icon("arrow")}</a></div>
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
    const noItems = mode === "saved" ? tr("emptySavedTitle") : mode === "learning" ? tr("emptyLearningTitle") : tr("noResults");
    const emptyCopy = mode === "saved" ? tr("emptySavedCopy") : tr("emptyLearningCopy");
    const emptyHref = mode === "learning" ? roadmapHref(byId.get(featured[0])) : categoryHref("all");
    const emptyAction = mode === "learning" ? tr("startFirstRoadmap") : tr("browseAll");
    root.innerHTML = `<header class="page-header"><div class="page-header-copy"><span class="eyebrow">${escapeHtml(mode === "all" ? tr("categories") : tr("yourSpace"))}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>${mode === "learning" && state.started.length ? `<button class="button button-secondary" type="button" data-action="reset-progress">${icon("reset")}${escapeHtml(tr("resetProgress"))}</button>` : ""}</header>
      <div class="library-layout"><aside class="category-rail" aria-label="${escapeHtml(tr("categories"))}"><h2>${escapeHtml(tr("categories"))}</h2><a class="category-link ${selectedCategory === "all" ? "is-active" : ""}" href="${categoryHref("all")}"><span>${escapeHtml(tr("allCategories"))}</span><b>${formatNumber(mode === "all" ? roadmaps.length : list.length)}</b></a>${CATEGORIES.map((category) => `<a class="category-link ${selectedCategory === category ? "is-active" : ""}" href="${categoryHref(category)}"><span>${escapeHtml(categoryName(category))}</span><b>${formatNumber(mode === "all" ? counts[category] : (list.filter((roadmap) => roadmap.category === category).length))}</b></a>`).join("")}</aside>
        <section class="library-results" aria-label="${escapeHtml(heading)}"><div class="results-toolbar"><span>${formatNumber(list.length)} ${escapeHtml(tr("results"))}</span>${rawQuery ? `<span class="query-chip">${icon("search")}${escapeHtml(rawQuery)}<a href="${categoryHref(selectedCategory)}" aria-label="${escapeHtml(tr("clearSearch"))}">×</a></span>` : ""}</div>${rawQuery && queryResolution.changed ? `<button type="button" class="search-correction library-search-correction" data-action="apply-library-search-suggestion" data-query="${escapeHtml(query)}" data-category="${escapeHtml(selectedCategory)}">${icon("search")}<span>${escapeHtml(tr("didYouMean"))} <strong dir="auto">${escapeHtml(queryResolution.suggestion)}</strong>?</span></button>` : ""}${hasRoadmaps ? `<div class="roadmap-grid">${list.map((roadmap) => roadmapCard(roadmap)).join("")}</div>` : `<div class="empty-state">${icon(mode === "saved" ? "bookmark" : mode === "learning" ? "play" : "search")}<h2>${escapeHtml(noItems)}</h2>${mode === "saved" || mode === "learning" ? `<p>${escapeHtml(emptyCopy)}</p><a class="button button-primary" href="${emptyHref}">${escapeHtml(emptyAction)}${icon("arrow")}</a>` : ""}</div>`}</section>
      </div>`;
  };
  const renderLearningPage = (roadmap, selected, conceptId = "") => {
    const { topic, module } = selected;
    const conceptIndex = (topic.subtopics || []).findIndex((item, index) => conceptIdFor(topic, index) === conceptId);
    const selectedConcept = conceptIndex >= 0 ? topic.subtopics[conceptIndex] : null;
    const activeConceptId = selectedConcept ? conceptId : "";
    const title = localized(selectedConcept || topic.title);
    const topicTitle = localized(topic.title);
    const moduleTitle = localized(module.title);
    const roadmapTitle = localized(roadmap.title);
    const moduleIndex = roadmap.modules.indexOf(module);
    const topicIndex = module.topics.indexOf(topic);
    const microTopics = topic.subtopics || [];
    const lessonSteps = topicList(roadmap).flatMap((entry) => [
      { topic: entry.topic, conceptId: "" },
      ...(entry.topic.subtopics || []).map((item, index) => ({ topic: entry.topic, conceptId: conceptIdFor(entry.topic, index) }))
    ]);
    const lessonStepIndex = lessonSteps.findIndex((step) => step.topic.id === topic.id && step.conceptId === activeConceptId);
    const previousStep = lessonSteps[lessonStepIndex - 1];
    const nextStep = lessonSteps[lessonStepIndex + 1];
    const currentStatus = topicStatus(roadmap, topic.id);
    const completionAction = `<button class="button ${currentStatus === "done" ? "button-secondary" : "button-primary"} lesson-complete-button" type="button" data-action="set-topic-status" data-status="done" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-pressed="${currentStatus === "done"}">${icon(currentStatus === "done" ? "check" : "check")}<span>${escapeHtml(currentStatus === "done" ? tr("reopenLesson") : tr("markComplete"))}</span></button>`;
    const lessonNavigation = `<nav class="lesson-navigation" aria-label="${escapeHtml(tr("lessonNavigation"))}">${previousStep ? `<a class="button button-secondary" rel="prev" href="${learningHref(roadmap, previousStep.topic.id, previousStep.conceptId)}">${icon("arrow")}<span>${escapeHtml(tr("previousLesson"))}</span></a>` : `<span aria-hidden="true"></span>`}${nextStep ? `<a class="button button-secondary" rel="next" href="${learningHref(roadmap, nextStep.topic.id, nextStep.conceptId)}"><span>${escapeHtml(tr("nextLesson"))}</span>${icon("arrow")}</a>` : `<span aria-hidden="true"></span>`}</nav>`;
    const topicOverview = topicOverviewText(roadmap, module, topic);
    const conceptOverview = conceptOverviewText(roadmap, module, topic, selectedConcept);
    const overview = selectedConcept ? conceptOverview : topicOverview;
    const customResources = [...(selectedConcept?.resources || []), ...(topic.resources || [])].filter((resource) => resource?.url && /^https:\/\//i.test(resource.url));
    const backHref = roadmapHref(roadmap, topic.id);
    state.started = [...new Set([...state.started, roadmap.id])];
    persist();
    return `<div class="learning-drawer-layer"><button class="learning-drawer-scrim" type="button" data-action="return-to-map" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-label="${escapeHtml(tr("backToMap"))}"></button><aside class="learning-drawer" role="dialog" aria-modal="true" aria-labelledby="selectedTopicTitle"><div class="learning-page">
      <header class="learning-page-toolbar"><div class="learning-page-status">${topicStatusControls(roadmap, topic)}</div><div class="learning-toolbar-actions">${canEditContent() ? `<button class="learning-edit-trigger" type="button" data-action="edit-current-learning-item" aria-label="${escapeHtml(at("editContent"))}" title="${escapeHtml(at("editContent"))}">${icon("edit")}<span>${escapeHtml(at("editContent"))}</span></button>` : ""}<button class="panel-close" type="button" data-action="return-to-map" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}" aria-label="${escapeHtml(tr("backToMap"))}">${icon("close")}</button></div></header>
      <div class="learning-page-progress">${progressMarkup(roadmap, true)}</div>
      <article class="learning-panel learning-page-content" id="learningPanel" aria-labelledby="selectedTopicTitle">
        <nav class="breadcrumbs learning-breadcrumbs" aria-label="${escapeHtml(tr("breadcrumbs"))}"><a href="${categoryHref("all")}">${escapeHtml(tr("allRoadmaps"))}</a><span aria-hidden="true">/</span><a href="${categoryHref(roadmap.category)}">${escapeHtml(categoryName(roadmap.category))}</a><span aria-hidden="true">/</span><a href="${backHref}">${escapeHtml(roadmapTitle)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(selectedConcept ? `${topicTitle} / ${title}` : title)}</span></nav>
        <header class="learning-topic-hero" id="lesson-overview"><div class="learning-topic-heading"><div class="detail-context"><span>${escapeHtml(roadmapTitle)}</span><span aria-hidden="true">/</span><span>${escapeHtml(moduleTitle)}</span></div><span class="learning-topic-kicker">${escapeHtml(selectedConcept ? at("editConcept") : tr("selected"))}</span></div><h1 id="selectedTopicTitle">${escapeHtml(title)}</h1><p>${escapeHtml(overview)}</p>${completionAction}</header>
        <div class="learning-content-grid"><aside class="learning-toc"><section class="learning-card"><h2>${escapeHtml(tr("lessonContents"))}</h2><nav aria-label="${escapeHtml(tr("lessonContents"))}"><a href="#lesson-overview">${escapeHtml(tr("lessonOverview"))}</a><a href="#lesson-concepts">${escapeHtml(tr("whatToLearn"))}</a><a href="#lesson-practice">${escapeHtml(tr("practice"))}</a><a href="#lesson-resources">${escapeHtml(tr("resources"))}</a></nav></section></aside><div class="learning-content-primary">
          ${selectedConcept ? `<section class="learning-card"><div class="learning-card-heading"><span class="learning-card-icon">${icon("book")}</span><div><h2>${escapeHtml(topicTitle)}</h2><p>${escapeHtml(moduleTitle)}</p></div></div><a class="button button-secondary" href="${learningHref(roadmap, topic.id)}">${escapeHtml(at("backToParent"))}${icon("arrow")}</a></section>` : ""}
          <section class="learning-card learning-concepts" id="lesson-concepts"><div class="learning-card-heading"><span class="learning-card-icon">${icon("book")}</span><div><h2>${escapeHtml(tr("whatToLearn"))}</h2><p>${escapeHtml(tr("learnNote"))}</p></div></div><div class="concept-grid">${microTopics.map((subtopic, index) => `<a class="concept-card ${conceptId === conceptIdFor(topic, index) ? "is-current" : ""}" href="${conceptHref(roadmap, topic, conceptIdFor(topic, index))}" data-action="open-learning-concept" data-roadmap="${escapeHtml(roadmap.id)}" data-module="${moduleIndex}" data-topic="${topicIndex}" data-concept="${index}" aria-current="${conceptId === conceptIdFor(topic, index) ? "page" : "false"}"><span class="concept-card-icon">${icon("search")}</span><span dir="auto">${escapeHtml(localized(subtopic))}</span>${icon("arrow")}</a>`).join("")}</div></section>
          <section class="learning-card practice-card" id="lesson-practice"><div class="learning-card-heading"><span class="learning-card-icon">${icon("check")}</span><div><h2>${escapeHtml(tr("practice"))}</h2><p>${escapeHtml(tr("practiceNote"))}</p></div></div><div class="practice-output"><span class="practice-output-icon">${icon("check")}</span><div><strong>${escapeHtml(tr("checkpointOutput"))}</strong><span>${escapeHtml(tr("checkpointOutputNote"))}</span></div></div></section>
        </div><aside class="learning-content-aside"><section class="learning-card learning-resources" id="lesson-resources"><div class="learning-card-heading"><span class="learning-card-icon">${icon("layers")}</span><div><h2>${escapeHtml(tr("resources"))}</h2><p>${escapeHtml(tr("searchNote"))}</p></div></div><div class="resource-links">${customResources.map((resource) => `<a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${icon("book")}<span>${escapeHtml(localized(resource.title) || resource.url)}</span>${icon("arrow")}</a>`).join("")}<a href="${resourceUrl("official", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("book")}<span>${escapeHtml(tr("searchOfficial"))}</span>${icon("arrow")}</a><a href="${resourceUrl("articles", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("book")}<span>${escapeHtml(tr("searchArticles"))}</span>${icon("arrow")}</a><a href="${resourceUrl("videos", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("play")}<span>${escapeHtml(tr("searchVideos"))}</span>${icon("arrow")}</a><a href="${resourceUrl("academic", title, moduleTitle, roadmap)}" target="_blank" rel="noopener noreferrer">${icon("chart")}<span>${escapeHtml(tr("searchAcademic"))}</span>${icon("arrow")}</a><button type="button" data-action="copy-prompt" data-roadmap="${escapeHtml(roadmap.id)}" data-topic="${escapeHtml(topic.id)}">${icon("spark")}<span>${escapeHtml(tr("studyPrompt"))}</span>${icon("arrow")}</button></div></section></aside></div>
        ${lessonNavigation}<p class="detail-footnote">${escapeHtml(tr("selfPacedNote"))}</p></article></div></aside></div>`;
  };
  const adminCopy = {
    en: {
      title: "Content editor", intro: "Edit a roadmap and publish it for everyone. Changes appear after visitors refresh.",
      login: "Sign in with Google", loginNote: "Only the two approved Atlas editors can publish changes.", signedOut: "Sign out", unauthorized: "This Google account is not on the Atlas editor list.",
      choose: "Choose a roadmap", addRoadmap: "Add a roadmap", roadmap: "Roadmap", category: "Field", titleEn: "Title in English", titleAr: "Title in Arabic", summaryEn: "Summary in English", summaryAr: "Summary in Arabic",
      module: "Main topic", chooseModule: "Choose a main topic", addModule: "Add main topic", removeModule: "Remove main topic", moduleTitleEn: "Main topic title in English", moduleTitleAr: "Main topic title in Arabic",
      checkpoint: "Learning topic", chooseCheckpoint: "Choose a learning topic", addCheckpoint: "Add learning topic", removeCheckpoint: "Remove learning topic", topicTitleEn: "Topic title in English", topicTitleAr: "Topic title in Arabic", overviewEn: "Explanation in English", overviewAr: "Explanation in Arabic",
      subtopics: "Smaller concepts to explore", subtopicEn: "Concept in English", subtopicAr: "Concept in Arabic", addSubtopic: "Add concept", remove: "Remove", sources: "Your sources", sourceTitleEn: "Source label in English", sourceTitleAr: "Source label in Arabic", sourceUrl: "Source link (https://)", addSource: "Add source",
      save: "Publish changes", deleteRoadmap: "Remove this roadmap", saveNote: "Your published edits become visible to all visitors.", saved: "Published. Visitors will see it after refreshing.", saving: "Publishing…", createTitle: "New roadmap", config: "The content editor is still being connected.",
      loadError: "Could not load published edits. The original roadmap content is still available.", invalid: "Add an English title before publishing.",
      editContent: "Edit content", quickEditHint: "Edits publish for everyone. Use the full editor to add or remove paths and topics.", pathDetails: "Path details", connections: "Connected paths", relatedPaths: "Related learning paths", relatedHint: "Choose other paths that learners may find useful.", connectionsHint: "Choose other paths that learners may find useful.", editStructure: "Manage all content", cancelEdit: "Cancel", closeEditor: "Close editor", selectModuleTopic: "Choose a main topic and learning checkpoint", editCheckpoint: "Learning checkpoint", contentSaved: "Changes published for everyone.", discardEdit: "Discard your unsaved edits?", relatedEmpty: "No connected paths selected.", editPath: "Edit path", editMainTopic: "Edit main topic", editLearningTopic: "Edit learning topic", quickEditTitle: "Edit selected content",
      editMode: "Edit roadmap", finishEditing: "Finish editing", adminEditModeHint: "Select a card to edit it. Visitors can still open any card to learn.", editModule: "Edit main topic", editTopic: "Edit checkpoint", editConcept: "Edit concept", addTopic: "Add checkpoint", removeTopic: "Delete checkpoint", childTopics: "Topics in this section", conceptsSection: "Concepts to explore", conceptOverviewEn: "Explanation in English", conceptOverviewAr: "Explanation in Arabic", openEdit: "Edit", backToParent: "Back", noDescription: "Add a short explanation for this concept.",
      concept: "Concept",
      noChildTopics: "No learning checkpoints here yet.", noSubtopics: "No concepts here yet.", removeTopicConfirm: "Delete this checkpoint and its concepts?", removeModuleConfirm: "Delete this main topic and everything inside it?", removeConceptConfirm: "Delete this concept and its sources?",
    },
    ar: {
      title: "محرر المحتوى", intro: "عدّل المسار وانشره ليظهر للجميع. تظهر التعديلات بعد تحديث الصفحة.",
      login: "سجّل الدخول بحساب Google", loginNote: "النشر متاح للبريدين المعتمدين لإدارة أطلس فقط.", signedOut: "تسجيل الخروج", unauthorized: "هذا الحساب غير مضاف إلى قائمة محرري أطلس.",
      choose: "اختر مساراً", addRoadmap: "إضافة مسار", roadmap: "المسار", category: "المجال", titleEn: "العنوان بالإنجليزية", titleAr: "العنوان بالعربية", summaryEn: "النبذة بالإنجليزية", summaryAr: "النبذة بالعربية",
      module: "موضوع رئيسي", chooseModule: "اختر موضوعاً رئيسياً", addModule: "إضافة موضوع رئيسي", removeModule: "حذف الموضوع الرئيسي", moduleTitleEn: "عنوان الموضوع الرئيسي بالإنجليزية", moduleTitleAr: "عنوان الموضوع الرئيسي بالعربية",
      checkpoint: "موضوع للتعلم", chooseCheckpoint: "اختر موضوعاً للتعلم", addCheckpoint: "إضافة موضوع للتعلم", removeCheckpoint: "حذف موضوع التعلم", topicTitleEn: "عنوان الموضوع بالإنجليزية", topicTitleAr: "عنوان الموضوع بالعربية", overviewEn: "الشرح بالإنجليزية", overviewAr: "الشرح بالعربية",
      subtopics: "مفاهيم فرعية للبحث والتعلم", subtopicEn: "المفهوم بالإنجليزية", subtopicAr: "المفهوم بالعربية", addSubtopic: "إضافة مفهوم", remove: "حذف", sources: "مصادرك", sourceTitleEn: "اسم المصدر بالإنجليزية", sourceTitleAr: "اسم المصدر بالعربية", sourceUrl: "رابط المصدر (https://)", addSource: "إضافة مصدر",
      save: "نشر التعديلات", deleteRoadmap: "حذف هذا المسار", saveNote: "تظهر التعديلات المنشورة لكل الزوار.", saved: "تم النشر. تظهر التعديلات للزوار بعد تحديث الصفحة.", saving: "جارٍ النشر…", createTitle: "مسار جديد", config: "يجري إعداد محرر المحتوى.",
      loadError: "تعذر تحميل التعديلات المنشورة. ما زال محتوى المسارات الأصلي متاحاً.", invalid: "أضف عنواناً بالإنجليزية قبل النشر.",
      editContent: "تعديل المحتوى", quickEditHint: "التغييرات المنشورة تظهر للجميع. استخدم الإدارة الكاملة لإضافة المسارات أو الموضوعات وحذفها.", pathDetails: "بيانات المسار", connections: "المسارات المرتبطة", relatedPaths: "مسارات تعلم مرتبطة", relatedHint: "اختر مسارات أخرى قد تفيد المتعلم.", connectionsHint: "اختر المسارات الأخرى التي قد تفيد المتعلم.", editStructure: "إدارة كل المحتوى", cancelEdit: "إلغاء", closeEditor: "إغلاق المحرر", selectModuleTopic: "اختر موضوعاً رئيسياً ونقطة تعلم", editCheckpoint: "نقطة التعلم", contentSaved: "تم نشر التعديلات للجميع.", discardEdit: "هل تريد إلغاء تعديلاتك غير المنشورة؟", relatedEmpty: "لا توجد مسارات مرتبطة محددة.", editPath: "تعديل المسار", editMainTopic: "تعديل الموضوع الرئيسي", editLearningTopic: "تعديل موضوع التعلم", quickEditTitle: "تعديل المحتوى المحدد",
      editMode: "تعديل المسار", finishEditing: "إنهاء التعديل", adminEditModeHint: "اضغط على العنصر الذي تريد تعديله. يظل بإمكان الزوار فتح أي عنصر للتعلم.", editModule: "تعديل الموضوع الرئيسي", editTopic: "تعديل نقطة التعلم", editConcept: "تعديل المفهوم", addTopic: "إضافة نقطة تعلم", removeTopic: "حذف نقطة التعلم", childTopics: "موضوعات هذا القسم", conceptsSection: "مفاهيم للتعلم", conceptOverviewEn: "الشرح بالإنجليزية", conceptOverviewAr: "الشرح بالعربية", openEdit: "تعديل", backToParent: "رجوع", noDescription: "أضف شرحاً مختصراً لهذا المفهوم.",
      concept: "مفهوم",
      noChildTopics: "لا توجد نقاط تعلم في هذا القسم بعد.", noSubtopics: "لا توجد مفاهيم فرعية بعد.", removeTopicConfirm: "هل تريد حذف نقطة التعلم ومفاهيمها الفرعية؟", removeModuleConfirm: "هل تريد حذف الموضوع الرئيسي وكل ما بداخله؟", removeConceptConfirm: "هل تريد حذف هذا المفهوم ومصادره؟",
    }
  };
  const at = (key) => adminCopy[state.language][key] || adminCopy.en[key] || key;
  const cloneContent = (value) => JSON.parse(JSON.stringify(value));
  const adminField = (label, path, value, multiline = false) => `<label class="cms-field"><span>${escapeHtml(label)}</span>${multiline
    ? `<textarea data-admin-path="${escapeHtml(path)}" rows="3">${escapeHtml(value || "")}</textarea>`
    : `<input data-admin-path="${escapeHtml(path)}" value="${escapeHtml(value || "")}" />`}</label>`;
  const newRoadmapDraft = () => ({ id: "", category: "business", title: { en: "", ar: "" }, summary: { en: "", ar: "" }, related: [], modules: [{ id: "", title: { en: "", ar: "" }, topics: [{ id: "", title: { en: "", ar: "" }, overview: { en: "", ar: "" }, subtopics: [], resources: [] }] }] });
  const ensureAdminDraft = (routeId) => {
    if (routeId === "new") {
      if (adminSelectedId !== "__new__" || !adminDraft) {
        adminSelectedId = "__new__";
        adminDraft = newRoadmapDraft();
        adminModuleIndex = 0;
        adminTopicIndex = 0;
      }
      return;
    }
    const desiredId = routeId && byId.has(routeId) ? routeId : (adminSelectedId && byId.has(adminSelectedId) ? adminSelectedId : roadmaps[0]?.id);
    if (desiredId && (adminSelectedId !== desiredId || !adminDraft)) {
      adminSelectedId = desiredId;
      adminDraft = cloneContent(byId.get(desiredId));
      adminModuleIndex = 0;
      adminTopicIndex = 0;
    }
  };
  const setAdminValue = (path, value) => {
    const parts = path.split(".");
    let target = adminDraft;
    for (const part of parts.slice(0, -1)) {
      if (target?.[part] === undefined) return;
      target = target[part];
    }
    if (target) target[parts.at(-1)] = value;
  };
  const adminOptions = (items, selected, placeholder) => `<option value="">${escapeHtml(placeholder)}</option>${items.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}`;
  const renderAdmin = (routeId = "") => {
    ensureAdminDraft(routeId);
    const signedIn = contentStore.user;
    if (!contentStore.configured) {
      root.innerHTML = `<section class="cms-gate"><span class="eyebrow">YFLB Atlas</span><h1>${escapeHtml(at("title"))}</h1><p>${escapeHtml(at("config"))}</p></section>`;
      return;
    }
    if (!signedIn) {
      root.innerHTML = `<section class="cms-gate"><span class="eyebrow">YFLB Atlas</span><h1>${escapeHtml(at("title"))}</h1><p>${escapeHtml(at("intro"))}</p>${contentLoadError ? `<p class="cms-alert">${escapeHtml(at("loadError"))}</p>` : ""}<div class="cms-login-card"><p>${escapeHtml(at("loginNote"))}</p><button class="button button-primary" type="button" data-action="admin-login">${escapeHtml(at("login"))}</button></div></section>`;
      return;
    }
    if (!contentStore.isEditor(signedIn)) {
      root.innerHTML = `<section class="cms-gate"><h1>${escapeHtml(at("title"))}</h1><p class="cms-alert">${escapeHtml(at("unauthorized"))}</p><button class="button button-secondary" type="button" data-action="admin-logout">${escapeHtml(at("signedOut"))}</button></section>`;
      return;
    }
    if (!adminDraft) {
      root.innerHTML = `<section class="cms-gate"><h1>${escapeHtml(at("title"))}</h1><button class="button button-primary" type="button" data-action="admin-new">${escapeHtml(at("addRoadmap"))}</button></section>`;
      return;
    }
    const modules = adminDraft.modules || (adminDraft.modules = []);
    adminModuleIndex = Math.max(0, Math.min(adminModuleIndex, modules.length - 1));
    const activeModule = modules[adminModuleIndex];
    const topics = activeModule?.topics || [];
    adminTopicIndex = Math.max(0, Math.min(adminTopicIndex, topics.length - 1));
    const activeTopic = topics[adminTopicIndex];
    const titleEn = localized(adminDraft.title) || "";
    adminDraft.related ||= [];
    const availableRoadmaps = roadmaps.map((item) => [item.id, `${localized(item.title)} · ${item.id}`]);
    const relatedChoices = roadmaps.filter((item) => item.id !== adminDraft.id).map((item) => `<label class="related-path-choice"><input type="checkbox" data-admin-related value="${escapeHtml(item.id)}" ${adminDraft.related.includes(item.id) ? "checked" : ""}><span>${escapeHtml(localized(item.title))}</span></label>`).join("");
    const modulesSelect = modules.map((item, index) => [String(index), localized(item.title) || `${at("module")} ${index + 1}`]);
    const topicsSelect = topics.map((item, index) => [String(index), localized(item.title) || `${at("checkpoint")} ${index + 1}`]);
    const subtopics = activeTopic ? (activeTopic.subtopics || []) : [];
    const resources = activeTopic ? (activeTopic.resources || (activeTopic.resources = [])) : [];
    root.innerHTML = `<section class="cms-page"><header class="cms-header"><div><span class="eyebrow">YFLB Atlas · ${escapeHtml(at("title"))}</span><h1>${escapeHtml(titleEn || at("createTitle"))}</h1><p>${escapeHtml(at("intro"))}</p></div><button class="button button-secondary" type="button" data-action="admin-logout">${escapeHtml(at("signedOut"))}</button></header>
      <div class="cms-toolbar"><label class="cms-field"><span>${escapeHtml(at("choose"))}</span><select id="adminRoadmapSelect">${adminOptions(availableRoadmaps, adminSelectedId === "__new__" ? "" : adminSelectedId, at("choose"))}</select></label><button class="button button-secondary" type="button" data-action="admin-new">${escapeHtml(at("addRoadmap"))}</button></div>
      ${contentLoadError ? `<p class="cms-alert">${escapeHtml(at("loadError"))}</p>` : ""}
      <form class="cms-editor" id="adminEditor">
        <section class="cms-card"><h2>${escapeHtml(at("roadmap"))}</h2><div class="cms-grid">${adminField(at("titleEn"), "title.en", adminDraft.title?.en)}${adminField(at("titleAr"), "title.ar", adminDraft.title?.ar)}${adminField(at("summaryEn"), "summary.en", adminDraft.summary?.en, true)}${adminField(at("summaryAr"), "summary.ar", adminDraft.summary?.ar, true)}<label class="cms-field"><span>${escapeHtml(at("category"))}</span><select data-admin-path="category">${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}" ${adminDraft.category === category ? "selected" : ""}>${escapeHtml(categoryName(category))}</option>`).join("")}</select></label></div></section>
        <section class="cms-card"><div class="cms-card-heading"><div><h2>${escapeHtml(at("relatedPaths"))}</h2><p>${escapeHtml(at("relatedHint"))}</p></div></div><div class="related-path-options">${relatedChoices || `<p class="related-path-empty">${escapeHtml(at("relatedEmpty"))}</p>`}</div></section>
        <section class="cms-card"><div class="cms-card-heading"><h2>${escapeHtml(at("module"))}</h2><div class="cms-actions"><label class="cms-field cms-select"><span>${escapeHtml(at("chooseModule"))}</span><select id="adminModuleSelect">${adminOptions(modulesSelect, String(adminModuleIndex), at("chooseModule"))}</select></label><button class="button button-secondary" type="button" data-action="admin-add-module">${escapeHtml(at("addModule"))}</button>${activeModule ? `<button class="button button-danger" type="button" data-action="admin-remove-module">${escapeHtml(at("removeModule"))}</button>` : ""}</div></div>
          ${activeModule ? `<div class="cms-grid">${adminField(at("moduleTitleEn"), `modules.${adminModuleIndex}.title.en`, activeModule.title?.en)}${adminField(at("moduleTitleAr"), `modules.${adminModuleIndex}.title.ar`, activeModule.title?.ar)}</div>` : `<p>${escapeHtml(at("chooseModule"))}</p>`}</section>
        ${activeModule ? `<section class="cms-card"><div class="cms-card-heading"><h2>${escapeHtml(at("checkpoint"))}</h2><div class="cms-actions"><label class="cms-field cms-select"><span>${escapeHtml(at("chooseCheckpoint"))}</span><select id="adminTopicSelect">${adminOptions(topicsSelect, String(adminTopicIndex), at("chooseCheckpoint"))}</select></label><button class="button button-secondary" type="button" data-action="admin-add-topic">${escapeHtml(at("addCheckpoint"))}</button>${activeTopic ? `<button class="button button-danger" type="button" data-action="admin-remove-topic">${escapeHtml(at("removeCheckpoint"))}</button>` : ""}</div></div>
          ${activeTopic ? `<div class="cms-grid">${adminField(at("topicTitleEn"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.title.en`, activeTopic.title?.en)}${adminField(at("topicTitleAr"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.title.ar`, activeTopic.title?.ar)}${adminField(at("overviewEn"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.overview.en`, topicOverviewText(adminDraft, activeModule, activeTopic, "en"), true)}${adminField(at("overviewAr"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.overview.ar`, topicOverviewText(adminDraft, activeModule, activeTopic, "ar"), true)}</div>
            <div class="cms-list"><div class="cms-card-heading"><h3>${escapeHtml(at("subtopics"))}</h3><button class="button button-secondary" type="button" data-action="admin-add-subtopic">${escapeHtml(at("addSubtopic"))}</button></div>${subtopics.map((subtopic, index) => `<div class="cms-repeater"><div class="cms-grid">${adminField(at("subtopicEn"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.subtopics.${index}.en`, typeof subtopic === "string" ? subtopic : subtopic.en)}${adminField(at("subtopicAr"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.subtopics.${index}.ar`, typeof subtopic === "string" ? "" : subtopic.ar)}${adminField(at("conceptOverviewEn"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.subtopics.${index}.overview.en`, conceptOverviewText(adminDraft, activeModule, activeTopic, subtopic, "en"), true)}${adminField(at("conceptOverviewAr"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.subtopics.${index}.overview.ar`, conceptOverviewText(adminDraft, activeModule, activeTopic, subtopic, "ar"), true)}</div><button class="button button-danger" type="button" data-action="admin-remove-subtopic" data-index="${index}">${escapeHtml(at("remove"))}</button></div>`).join("")}</div>
            <div class="cms-list"><div class="cms-card-heading"><h3>${escapeHtml(at("sources"))}</h3><button class="button button-secondary" type="button" data-action="admin-add-resource">${escapeHtml(at("addSource"))}</button></div>${resources.map((resource, index) => `<div class="cms-repeater"><div class="cms-grid">${adminField(at("sourceTitleEn"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.resources.${index}.title.en`, resource.title?.en)}${adminField(at("sourceTitleAr"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.resources.${index}.title.ar`, resource.title?.ar)}${adminField(at("sourceUrl"), `modules.${adminModuleIndex}.topics.${adminTopicIndex}.resources.${index}.url`, resource.url)}</div><button class="button button-danger" type="button" data-action="admin-remove-resource" data-index="${index}">${escapeHtml(at("remove"))}</button></div>`).join("")}</div>` : `<p>${escapeHtml(at("chooseCheckpoint"))}</p>`}</section>` : ""}
        <footer class="cms-publish"><p>${escapeHtml(at("saveNote"))}</p><div>${adminDraft.id ? `<button class="button button-danger" type="button" data-action="admin-delete-roadmap">${escapeHtml(at("deleteRoadmap"))}</button>` : ""}<button class="button button-primary" type="button" data-action="admin-save" ${adminBusy ? "disabled" : ""}>${escapeHtml(adminBusy ? at("saving") : at("save"))}</button></div></footer>
        ${adminNotice ? `<p class="cms-alert" role="status">${escapeHtml(adminNotice)}</p>` : ""}
      </form></section>`;
  };
  const inlineEditorField = (label, path, value, multiline = false) => `<label class="cms-field"><span>${escapeHtml(label)}</span>${multiline
    ? `<textarea data-inline-path="${escapeHtml(path)}" dir="auto" rows="4">${escapeHtml(value || "")}</textarea>`
    : `<input data-inline-path="${escapeHtml(path)}" dir="auto" value="${escapeHtml(value || "")}" />`}</label>`;
  const renderInlineContentEditor = () => {
    const draft = inlineEditDraft;
    if (!draft) return "";
    const modules = draft.modules || [];
    const module = modules[inlineEditModuleIndex];
    const topic = module?.topics?.[inlineEditTopicIndex];
    const concept = topic?.subtopics?.[inlineEditConceptIndex];
    const related = Array.isArray(draft.related) ? draft.related : [];
    const relatedOptions = roadmaps.filter((item) => item.id !== draft.id).map((item) => `<label class="related-path-choice"><input type="checkbox" data-inline-related value="${escapeHtml(item.id)}" ${related.includes(item.id) ? "checked" : ""}><span>${escapeHtml(localized(item.title))}</span></label>`).join("");
    const topicPath = `modules.${inlineEditModuleIndex}.topics.${inlineEditTopicIndex}`;
    const moduleTitle = localized(module?.title) || at("module");
    const topicTitle = localized(topic?.title) || at("checkpoint");
    const conceptTitle = localized(concept) || at("concept");
    const resourcesFor = (resources, path) => `<div class="cms-list"><div class="cms-card-heading"><h3>${escapeHtml(at("sources"))}</h3><button class="button button-secondary" type="button" data-action="inline-add-resource">${escapeHtml(at("addSource"))}</button></div>${resources.map((resource, index) => `<div class="cms-repeater"><div class="cms-grid">${inlineEditorField(at("sourceTitleEn"), `${path}.${index}.title.en`, resource.title?.en)}${inlineEditorField(at("sourceTitleAr"), `${path}.${index}.title.ar`, resource.title?.ar)}${inlineEditorField(at("sourceUrl"), `${path}.${index}.url`, resource.url)}</div><button class="button button-danger" type="button" data-action="inline-remove-resource" data-index="${index}">${escapeHtml(at("remove"))}</button></div>`).join("")}</div>`;
    let editorTitle = at("editPath");
    let editorBody = "";
    let backAction = "";
    if (inlineEditTarget.kind === "module" && module) {
      editorTitle = at("editModule");
      editorBody = `<section class="content-edit-section"><div class="cms-grid">${inlineEditorField(at("moduleTitleEn"), `modules.${inlineEditModuleIndex}.title.en`, module.title?.en)}${inlineEditorField(at("moduleTitleAr"), `modules.${inlineEditModuleIndex}.title.ar`, module.title?.ar)}</div></section>
        <section class="content-edit-section"><div class="cms-card-heading"><h3>${escapeHtml(at("childTopics"))}</h3><button class="button button-secondary" type="button" data-action="inline-add-topic">${escapeHtml(at("addTopic"))}</button></div><div class="inline-child-list">${module.topics.map((child, index) => `<div class="inline-child-item"><span>${escapeHtml(localized(child.title) || `${at("checkpoint")} ${index + 1}`)}</span><div><button class="button button-secondary" type="button" data-action="inline-edit-child-topic" data-topic="${index}">${escapeHtml(at("openEdit"))}</button><button class="button button-danger" type="button" data-action="inline-remove-topic" data-topic="${index}">${escapeHtml(at("remove"))}</button></div></div>`).join("") || `<p class="content-edit-note">${escapeHtml(at("noChildTopics"))}</p>`}</div><button class="button button-danger inline-delete-parent" type="button" data-action="inline-remove-module">${escapeHtml(at("removeModule"))}</button></section>`;
    } else if (inlineEditTarget.kind === "topic" && topic) {
      editorTitle = at("editTopic");
      backAction = `<button class="button button-ghost" type="button" data-action="inline-back-to-parent">${icon("arrow")}${escapeHtml(at("backToParent"))}</button>`;
      editorBody = `<section class="content-edit-section"><div class="cms-card-heading"><h3>${escapeHtml(moduleTitle)}</h3><button class="button button-danger" type="button" data-action="inline-remove-topic">${escapeHtml(at("removeTopic"))}</button></div><div class="cms-grid">${inlineEditorField(at("topicTitleEn"), `${topicPath}.title.en`, topic.title?.en)}${inlineEditorField(at("topicTitleAr"), `${topicPath}.title.ar`, topic.title?.ar)}${inlineEditorField(at("overviewEn"), `${topicPath}.overview.en`, topicOverviewText(draft, module, topic, "en"), true)}${inlineEditorField(at("overviewAr"), `${topicPath}.overview.ar`, topicOverviewText(draft, module, topic, "ar"), true)}</div></section>
        <section class="content-edit-section"><div class="cms-card-heading"><h3>${escapeHtml(at("conceptsSection"))}</h3><button class="button button-secondary" type="button" data-action="inline-add-subtopic">${escapeHtml(at("addSubtopic"))}</button></div><div class="inline-child-list">${topic.subtopics.map((item, index) => `<div class="inline-child-item inline-concept-item"><span><strong>${escapeHtml(localized(item) || `${at("concept")} ${index + 1}`)}</strong><small>${escapeHtml(conceptOverviewText(draft, module, topic, item) || at("noDescription"))}</small></span><div><button class="button button-secondary" type="button" data-action="inline-edit-concept" data-concept="${index}">${escapeHtml(at("openEdit"))}</button><button class="button button-danger" type="button" data-action="inline-remove-subtopic" data-index="${index}">${escapeHtml(at("remove"))}</button></div></div>`).join("") || `<p class="content-edit-note">${escapeHtml(at("noSubtopics"))}</p>`}</div></section>${resourcesFor(topic.resources || [], `${topicPath}.resources`)}`;
    } else if (inlineEditTarget.kind === "subtopic" && concept) {
      editorTitle = at("editConcept");
      backAction = `<button class="button button-ghost" type="button" data-action="inline-back-to-parent">${icon("arrow")}${escapeHtml(at("backToParent"))}</button>`;
      editorBody = `<section class="content-edit-section"><div class="cms-card-heading"><h3>${escapeHtml(topicTitle)}</h3><button class="button button-danger" type="button" data-action="inline-remove-selected-concept">${escapeHtml(at("remove"))}</button></div><div class="cms-grid">${inlineEditorField(at("subtopicEn"), `${topicPath}.subtopics.${inlineEditConceptIndex}.en`, concept.en)}${inlineEditorField(at("subtopicAr"), `${topicPath}.subtopics.${inlineEditConceptIndex}.ar`, concept.ar)}${inlineEditorField(at("conceptOverviewEn"), `${topicPath}.subtopics.${inlineEditConceptIndex}.overview.en`, conceptOverviewText(draft, module, topic, concept, "en"), true)}${inlineEditorField(at("conceptOverviewAr"), `${topicPath}.subtopics.${inlineEditConceptIndex}.overview.ar`, conceptOverviewText(draft, module, topic, concept, "ar"), true)}</div></section>${resourcesFor(concept.resources || [], `${topicPath}.subtopics.${inlineEditConceptIndex}.resources`)}`;
    } else {
      editorTitle = at("editPath");
      editorBody = `<section class="content-edit-section"><div class="cms-grid">${inlineEditorField(at("titleEn"), "title.en", draft.title?.en)}${inlineEditorField(at("titleAr"), "title.ar", draft.title?.ar)}${inlineEditorField(at("summaryEn"), "summary.en", draft.summary?.en, true)}${inlineEditorField(at("summaryAr"), "summary.ar", draft.summary?.ar, true)}<label class="cms-field"><span>${escapeHtml(at("category"))}</span><select data-inline-path="category">${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}" ${draft.category === category ? "selected" : ""}>${escapeHtml(categoryName(category))}</option>`).join("")}</select></label></div></section>
        <section class="content-edit-section"><div class="cms-card-heading"><div><h3>${escapeHtml(at("relatedPaths"))}</h3><p class="content-edit-note">${escapeHtml(at("relatedHint"))}</p></div></div><div class="related-path-options">${relatedOptions || `<p class="related-path-empty">${escapeHtml(at("relatedEmpty"))}</p>`}</div></section>
        <section class="content-edit-section"><div class="cms-card-heading"><h3>${escapeHtml(at("module"))}</h3><button class="button button-secondary" type="button" data-action="inline-add-module">${escapeHtml(at("addModule"))}</button></div><div class="inline-child-list">${modules.map((item, index) => `<button class="inline-child-link" type="button" data-action="inline-edit-child-module" data-module="${index}"><strong>${escapeHtml(localized(item.title) || `${at("module")} ${index + 1}`)}</strong>${icon("arrow")}</button>`).join("")}</div></section>`;
    }
    return `<dialog class="content-edit-dialog" id="contentEditDialog" aria-labelledby="contentEditTitle"><div class="content-edit-shell">
      <header class="content-edit-header"><div>${backAction}<span class="eyebrow">${escapeHtml(localized(draft.title))}</span><h2 id="contentEditTitle">${escapeHtml(editorTitle)}</h2><p>${escapeHtml(at("quickEditHint"))}</p></div><button class="panel-close" type="button" data-action="close-content-editor" aria-label="${escapeHtml(at("closeEditor"))}">${icon("close")}</button></header>
      <form id="inlineContentEditor" class="content-edit-form"><div class="content-edit-body">
        ${editorBody}
        ${inlineEditError ? `<p class="cms-alert" role="alert">${escapeHtml(inlineEditError)}</p>` : ""}
      </div><footer class="content-edit-footer"><button class="button button-secondary" type="button" data-action="open-full-editor">${escapeHtml(at("editStructure"))}</button><div><button class="button button-secondary" type="button" data-action="close-content-editor">${escapeHtml(at("cancelEdit"))}</button><button class="button button-primary" type="submit" ${inlineEditBusy ? "disabled" : ""}>${escapeHtml(inlineEditBusy ? at("saving") : at("save"))}</button></div></footer></form>
    </div></dialog>`;
  };
  const moduleState = (roadmap, module) => {
    const statuses = module.topics.map((topic) => topicStatus(roadmap, topic.id));
    if (!statuses.length) return "available";
    if (statuses.every((status) => status === "done")) return "done";
    if (statuses.every((status) => status === "skip")) return "skip";
    if (statuses.some((status) => status !== "idle")) return "current";
    return "available";
  };
  const renderMapRow = (roadmap, module, moduleIndex, selectedId) => {
    const moduleStatus = moduleState(roadmap, module);
    const nextTopicInModule = module.topics.findIndex((topic) => !["done", "skip"].includes(topicStatus(roadmap, topic.id)));
    const targetTopic = module.topics[nextTopicInModule >= 0 ? nextTopicInModule : module.topics.length - 1] || null;
    const branchSide = moduleIndex % 2 === 0 ? "left" : "right";
    const branch = `<div class="map-branch branch-${branchSide}"><div class="topic-grid">${module.topics.map((topic) => {
      const status = topicStatus(roadmap, topic.id);
      const current = selectedId === topic.id;
      const label = localized(topic.title);
      const statusLabel = tr(status === "done" ? "statusDone" : status === "skip" ? "statusSkip" : status === "learning" ? "statusLearning" : "available");
      const marker = status === "done" ? icon("check") : status === "skip" ? icon("close") : status === "learning" ? icon("book") : "";
      const topicIndex = module.topics.indexOf(topic);
      const action = `data-action="open-topic" data-roadmap="${escapeHtml(roadmap.id)}" data-module-index="${moduleIndex}" data-topic-index="${topicIndex}" data-topic="${escapeHtml(topic.id)}"`;
      const inEditMode = canEditContent() && adminEditMode;
      const statusOpen = mobileStatusTopic === topic.id;
      return `<div class="topic-item topic-item-${status} ${current ? "is-selected" : ""} ${statusOpen ? "is-status-open" : ""}"><button class="topic-node node-${status} ${current ? "is-selected" : ""} ${inEditMode ? "is-edit-selectable" : ""}" type="button" ${action} aria-label="${escapeHtml(`${label}. ${statusLabel}`)}" ${current ? `aria-current="step"` : ""}><span class="node-marker">${marker}</span><span class="node-label" dir="auto">${escapeHtml(label)}</span></button>${topicStatusControls(roadmap, topic, statusOpen)}</div>`;
    }).join("")}</div></div>`;
    const empty = '<div class="map-spacer" aria-hidden="true"></div>';
    const moduleCopy = localized(module.title);
    const isFoundation = moduleIndex === 0 || /foundation|introduction|core|basic|أسس|مقدمة|المفاهيم الأساسية|الأساسيات/iu.test(moduleCopy);
    const hubMarker = moduleStatus === "done" ? icon("check") : moduleStatus === "skip" ? icon("close") : moduleStatus === "current" ? icon("play") : icon("layers");
    const hubLabel = moduleStatus === "done" ? tr("statusDone") : moduleStatus === "skip" ? tr("statusSkip") : moduleStatus === "current" ? tr("inProgress") : isFoundation ? tr("foundations") : tr("available");
    const canEditModule = canEditContent() && adminEditMode;
    const hub = `<div class="map-hub-wrap"><button class="map-hub hub-${moduleStatus} ${canEditModule ? "is-edit-selectable" : ""}" type="button" data-action="open-module" data-roadmap="${escapeHtml(roadmap.id)}" data-module="${moduleIndex}" data-topic="${escapeHtml(targetTopic?.id || "")}" ${targetTopic || canEditModule ? "" : "disabled"}><span class="hub-marker">${hubMarker}</span><span class="hub-copy"><strong dir="auto">${escapeHtml(moduleCopy)}</strong><small>${escapeHtml(hubLabel)}</small></span>${icon("arrow")}</button></div>`;
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
        <header class="roadmap-header"><div class="roadmap-header-copy ${canEditContent() && adminEditMode ? "is-edit-selectable" : ""}" ${canEditContent() && adminEditMode ? `role="button" tabindex="0" data-action="edit-selected-path" data-roadmap="${escapeHtml(roadmap.id)}"` : ""}><span class="eyebrow">${escapeHtml(categoryName(roadmap.category))}</span><h1>${escapeHtml(localized(roadmap.title))}</h1><p>${escapeHtml(localized(roadmap.summary))}</p></div><div class="roadmap-header-actions"><button class="bookmark-button roadmap-bookmark ${state.favorites.includes(roadmap.id) ? "is-saved" : ""}" type="button" data-action="toggle-save" data-roadmap="${escapeHtml(roadmap.id)}" aria-label="${escapeHtml(state.favorites.includes(roadmap.id) ? tr("removeSaved") : tr("saveRoadmap"))}" aria-pressed="${state.favorites.includes(roadmap.id)}">${icon("bookmark")}<span>${escapeHtml(state.favorites.includes(roadmap.id) ? tr("saved") : tr("save"))}</span></button></div></header>
        <section class="roadmap-progress-card"><div class="roadmap-progress-copy"><span class="progress-icon">${icon(allDone ? "check" : "chart")}</span><div><strong>${allDone ? escapeHtml(tr("journeyComplete")) : allSkipped ? escapeHtml(tr("allTopicsSkipped")) : escapeHtml(tr("nextUp"))}</strong><span>${allDone ? escapeHtml(tr("journeyCompleteNote")) : allSkipped ? escapeHtml(tr("allTopicsSkippedNote")) : escapeHtml(tr("allTopicsOpen"))}</span></div></div><div class="roadmap-progress-value"><strong>${formatNumber(progress.done)}<span> / ${formatNumber(progress.total)}</span></strong><span>${formatNumber(progress.percent)}${percentSymbol()} ${escapeHtml(tr("progress"))}</span></div>${progressMarkup(roadmap, true)}</section>
        <div class="roadmap-guidance">${icon("layers")}<p>${escapeHtml(tr("mapHint"))}</p></div>${canEditContent() && adminEditMode ? `<div class="admin-edit-hint">${icon("edit")}<span>${escapeHtml(at("adminEditModeHint"))}</span></div>` : ""}
        ${allDone ? `<div class="journey-complete-banner">${icon("check")}<span>${escapeHtml(tr("journeyComplete"))}</span></div>` : ""}
        <div class="roadmap-workspace"><section class="roadmap-map" aria-label="${escapeHtml(tr("roadmapMap"))}"><svg class="map-connector-layer" aria-hidden="true"></svg>${roadmap.modules.map((module, moduleIndex) => renderMapRow(roadmap, module, moduleIndex, selectedId)).join("")}</section></div>${connectedPathsMarkup}
      </div>${drawerTopic ? renderLearningPage(roadmap, drawerTopic, params.get("concept") || "") : ""}${inlineEditDraft?.id === roadmap.id ? renderInlineContentEditor() : ""}`;
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
    const legacy = location.hash.startsWith("#/");
    const rawPath = legacy ? location.hash.slice(1).split("?")[0] : location.pathname;
    const rawQuery = legacy ? location.hash.split("?").slice(1).join("?") : location.search;
    const segments = rawPath.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    const params = new URLSearchParams(rawQuery);
    let page = segments[0] || "home";
    const id = segments[1] || "";
    if (page === "roadmaps" || page === "roadmap") page = "roadmap";
    if (page === "learn") {
      if (segments[2]) params.set("topic", segments[2]);
      if (segments[3]) params.set("concept", segments[3]);
    }
    return { page, id, params, segments };
  };
  const normalizeLegacyRoute = () => {
    if (!location.hash.startsWith("#/")) return;
    const [rawPath, ...queryParts] = location.hash.slice(2).split("?");
    const query = new URLSearchParams(queryParts.join("?"));
    const segments = rawPath.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    const [oldPage = "home", id = "", topicSegment = ""] = segments;
    let pathname = "/";
    if (oldPage === "roadmap") pathname = `/roadmaps/${encodeURIComponent(id)}/`;
    else if (oldPage === "learn") {
      const topicId = query.get("topic") || topicSegment;
      pathname = `/learn/${encodeURIComponent(id)}/${encodeURIComponent(topicId || "")}/`;
      query.delete("topic");
    } else if (oldPage !== "home") {
      pathname = `/${[oldPage, ...segments.slice(1)].map(encodeURIComponent).join("/")}/`;
    }
    const search = query.toString();
    history.replaceState(null, "", `${pathname}${search ? `?${search}` : ""}`);
  };
  const renderLogin = (next = "") => {
    const signedIn = contentStore.user;
    const continueToAdmin = next === "admin" && signedIn && contentStore.isEditor(signedIn);
    const continueHref = continueToAdmin ? "/admin/" : "/paths/";
    const accountLine = signedIn ? `<p class="auth-account-line">${escapeHtml(signedIn.email || tr("account"))}</p><a class="button button-primary auth-continue" href="${continueHref}">${escapeHtml(tr("authContinue"))}${icon("arrow")}</a>` : `<button class="auth-google-button" type="button" data-action="google-sign-in" ${contentStore.configured ? "" : "disabled"}><svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.6 16 44 24 44Z"/><path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.6 1 7.7 3l5.8-5.8C34 5.6 29.5 4 24 4 16 4 9.2 8.4 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg><span>${escapeHtml(tr("authGoogle"))}</span>${icon("arrow")}</button>`;
    root.innerHTML = `<section class="auth-page"><div class="auth-card"><span class="auth-emblem" aria-hidden="true">${icon("layers")}</span><span class="eyebrow">${escapeHtml(tr("brand"))}</span><h1>${escapeHtml(tr("authTitle"))}</h1><p class="auth-intro">${escapeHtml(tr("authIntro"))}</p>${signedIn ? accountLine : `<div class="auth-provider">${accountLine}${!contentStore.configured ? `<p class="auth-unavailable">${escapeHtml(tr("authUnavailable"))}</p>` : ""}</div>`}<p class="auth-footnote">${escapeHtml(signedIn ? tr("authSignedInNote") : tr("authNote"))}</p></div></section>`;
  };
  const updatePageMetadata = (route) => {
    const roadmap = byId.get(route.id);
    const selected = roadmap && topicList(roadmap).find(({ topic }) => topic.id === route.params.get("topic"));
    let title = tr("pageTitle");
    let description = tr("metaDescription");
    let indexable = ["home", "paths", "roadmap", "learn"].includes(route.page);
    if (route.page === "roadmap" && roadmap) {
      title = `${localized(roadmap.title)} | ${tr("appName")}`;
      description = localized(roadmap.summary) || tr("libraryIntro");
    } else if (route.page === "learn" && roadmap && selected) {
      const conceptId = route.params.get("concept");
      const conceptIndex = (selected.topic.subtopics || []).findIndex((item, index) => conceptIdFor(selected.topic, index) === conceptId);
      const concept = conceptIndex >= 0 ? selected.topic.subtopics[conceptIndex] : null;
      title = `${localized(concept || selected.topic.title)} | ${localized(roadmap.title)}`;
      description = concept
        ? conceptOverviewText(roadmap, selected.module, selected.topic, concept)
        : topicOverviewText(roadmap, selected.module, selected.topic);
    } else if (route.page === "paths") {
      title = tr("allRoadmaps");
      description = tr("libraryIntro");
      if (route.params.has("q") || route.params.has("category")) indexable = false;
    } else if (route.page === "learning") {
      title = tr("learningTitle");
      description = tr("learningIntro");
    } else if (route.page === "saved") {
      title = tr("savedRoadmaps");
      description = tr("savedIntro");
    } else if (route.page === "login") {
      title = tr("authTitle");
      description = tr("authIntro");
    } else if (route.page === "admin") {
      title = tr("navAdmin");
      description = tr("sourceNote");
    } else if (route.page !== "home") {
      title = tr("pageNotFound");
      description = tr("pageNotFoundCopy");
      indexable = false;
    }
    description = String(description || tr("metaDescription")).replace(/\s+/g, " ").trim();
    if (description.length > 160) description = `${description.slice(0, 157).trimEnd()}…`;
    const canonicalPath = location.pathname.endsWith("/") || location.pathname === "/" ? location.pathname : `${location.pathname}/`;
    const canonicalQuery = route.page === "learn" && route.params.has("concept")
      ? `?concept=${encodeURIComponent(route.params.get("concept"))}`
      : "";
    const canonical = `${location.origin}${canonicalPath}${canonicalQuery}`;
    const setContent = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute("content", value);
    };
    document.title = title;
    setContent("meta[name='description']", description);
    setContent("meta[name='robots']", indexable ? "index,follow" : "noindex,nofollow");
    setContent("meta[property='og:site_name']", tr("appName"));
    setContent("meta[property='og:title']", title);
    setContent("meta[property='og:description']", description);
    setContent("meta[property='og:url']", canonical);
    setContent("meta[property='og:locale']", state.language === "ar" ? "ar_EG" : "en_US");
    setContent("meta[name='twitter:title']", title);
    setContent("meta[name='twitter:description']", description);
    const canonicalLink = document.querySelector("link[rel='canonical']");
    if (canonicalLink) canonicalLink.href = canonical;
  };
  const render = () => {
    const previousContentDialog = root.querySelector("#contentEditDialog");
    const previousEditorBody = previousContentDialog?.querySelector(".content-edit-body");
    const editorScrollTop = previousContentDialog?.open ? previousEditorBody?.scrollTop || 0 : 0;
    const previousLearningDrawer = root.querySelector(".learning-drawer");
    const learningDrawerScrollTop = previousLearningDrawer?.scrollTop || 0;
    const hadLearningDrawer = Boolean(previousLearningDrawer);
    const previousFocus = previousContentDialog?.contains(document.activeElement) ? document.activeElement : null;
    const previousFocusPath = previousFocus?.dataset?.inlinePath || "";
    const previousFocusId = previousFocus?.id || "";
    const previousFocusAction = previousFocus?.closest?.("[data-action]");
    const previousActionName = previousFocusAction?.dataset.action || "";
    const previousActionIndex = previousFocusAction?.dataset.index || "";
    const route = parseRoute();
    if (!canEditContent() || !["roadmap", "learn"].includes(route.page)) adminEditMode = false;
    setDocumentLanguage();
    document.getElementById("platformNavMobile").hidden = true;
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
    document.body.classList.toggle("has-learning-drawer", route.page === "learn");
    if (route.page === "roadmap") {
      const roadmap = byId.get(route.id);
      if (roadmap) renderRoadmap(roadmap, route.params);
      else { setRoute("/paths/", true); return; }
    } else if (route.page === "learn") {
      const roadmap = byId.get(route.id);
      const selected = roadmap ? topicList(roadmap).find(({ topic }) => topic.id === route.params.get("topic")) : null;
      if (roadmap && selected) renderRoadmap(roadmap, route.params, selected);
      else if (roadmap) { setRoute(roadmapHref(roadmap), true); return; }
      else { setRoute("/paths/", true); return; }
    } else if (route.page === "paths") {
      renderLibrary(route.params, "all");
    } else if (route.page === "learning") {
      renderLibrary(route.params, "learning");
    } else if (route.page === "saved") {
      renderLibrary(route.params, "saved");
    } else if (route.page === "admin") {
      if (!authReady) {
        root.setAttribute("aria-busy", "true");
        updatePageMetadata(route);
        return;
      }
      if (!contentStore.isEditor(contentStore.user)) {
        setRoute(contentStore.user ? "/" : "/login/?next=admin", true);
        return;
      }
      renderAdmin(route.id);
    } else if (route.page === "login") {
      renderLogin(route.params.get("next") || "");
    } else if (route.page === "home") {
      renderHome();
    } else {
      root.innerHTML = `<section class="empty-state page-not-found"><span class="eyebrow">404</span><h1>${escapeHtml(tr("pageNotFound"))}</h1><p>${escapeHtml(tr("pageNotFoundCopy"))}</p><div><a class="button button-primary" href="/">${escapeHtml(tr("goHome"))}</a><a class="button button-secondary" href="/paths/">${escapeHtml(tr("allRoadmaps"))}</a></div></section>`;
    }
    const learningDrawer = root.querySelector(".learning-drawer");
    if (learningDrawer && hadLearningDrawer) learningDrawer.scrollTop = learningDrawerScrollTop;
    const contentDialog = root.querySelector("#contentEditDialog");
    if (contentDialog && !contentDialog.open) {
      contentDialog.showModal();
      contentDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeInlineContentEditor(); });
      contentDialog.addEventListener("click", (event) => { if (event.target === contentDialog) closeInlineContentEditor(); });
      if (focusInlineEditorAfterRender) {
        contentDialog.querySelector("input[data-inline-path]")?.focus();
        focusInlineEditorAfterRender = false;
      } else {
        const editorBody = contentDialog.querySelector(".content-edit-body");
        if (editorBody) editorBody.scrollTop = editorScrollTop;
        const pathField = previousFocusPath
          ? [...contentDialog.querySelectorAll("[data-inline-path]")].find((field) => field.dataset.inlinePath === previousFocusPath)
          : null;
        const idField = previousFocusId ? contentDialog.querySelector(`#${previousFocusId}`) : null;
        const actionButton = previousActionName
          ? [...contentDialog.querySelectorAll("[data-action]")].find((button) => button.dataset.action === previousActionName && (button.dataset.index || "") === previousActionIndex)
            || [...contentDialog.querySelectorAll("[data-action]")].find((button) => button.dataset.action === previousActionName)
          : null;
        (pathField || idField || actionButton)?.focus();
      }
    }
    syncNavigation();
    root.setAttribute("aria-busy", "false");
    updatePageMetadata(route);
    if (searchInput.value && document.activeElement === searchInput) updateSearchResults(searchInput.value);
    else closeSearchResults();
    if (focusTopicAfterRender) {
      const heading = document.getElementById("selectedTopicTitle");
      const fallback = document.querySelector(".learning-drawer .learning-page-status .topic-status-control, .topic-item.is-selected .topic-node, .topic-item.is-selected .topic-status-control");
      const target = route.page === "learn" ? root.querySelector(".lesson-complete-button") : heading || fallback;
      if (target) { target.setAttribute("tabindex", "-1"); target.focus(); }
      focusTopicAfterRender = false;
    } else if (focusMainAfterRender) {
      const heading = root.querySelector("h1");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
      focusMainAfterRender = false;
    }
    if (scrollToTopAfterRender) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      scrollToTopAfterRender = false;
    }
  };
  const slugify = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const currentAdminModule = () => adminDraft?.modules?.[adminModuleIndex];
  const currentAdminTopic = () => currentAdminModule()?.topics?.[adminTopicIndex];
  const finishAdminAction = () => { adminNotice = ""; renderAdmin(parseRoute().id); };
  const signOutAccount = async () => {
    await flushCloudSync();
    try { await contentStore.signOut(); }
    catch { showToast(tr("signOutError")); }
  };
  const adminLogin = async () => {
    setRoute("/login/?next=admin");
  };
  const adminSave = async () => {
    const englishTitle = adminDraft?.title?.en?.trim();
    if (!englishTitle) { adminNotice = at("invalid"); renderAdmin(parseRoute().id); return; }
    if (!adminDraft.id) {
      const baseId = `custom-${slugify(englishTitle) || Date.now()}`;
      adminDraft.id = byId.has(baseId) ? `${baseId}-${Date.now()}` : baseId;
    }
    adminDraft.modules ||= [];
    adminDraft.related = [...new Set((adminDraft.related || []).filter((id) => byId.has(id) && id !== adminDraft.id))];
    adminDraft.modules.forEach((module, moduleIndex) => {
      module.id ||= `${adminDraft.id}-module-${moduleIndex + 1}`;
      module.topics ||= [];
      module.topics.forEach((topic, topicIndex) => {
        topic.id ||= `${adminDraft.id}-topic-${moduleIndex + 1}-${topicIndex + 1}`;
        topic.subtopics ||= [];
        topic.resources ||= [];
      });
    });
    adminDraft.topicCount = adminDraft.modules.reduce((count, module) => count + module.topics.length, 0);
    adminBusy = true;
    renderAdmin(parseRoute().id);
    try {
      await contentStore.save(adminDraft);
      sessionStorage.setItem("atlas-admin-notice", at("saved"));
      window.history.replaceState(null, "", `/admin/${encodeURIComponent(adminDraft.id)}/`);
      window.location.reload();
    } catch (error) {
      adminNotice = error.message || String(error);
      adminBusy = false;
      renderAdmin(parseRoute().id);
    }
  };
  const adminDeleteRoadmap = async () => {
    if (!adminDraft?.id || !window.confirm(state.language === "ar" ? "هل تريد حذف هذا المسار لجميع الزوار؟" : "Remove this roadmap for all visitors?")) return;
    adminBusy = true;
    renderAdmin(parseRoute().id);
    try {
      await contentStore.remove(adminDraft.id);
      sessionStorage.setItem("atlas-admin-notice", state.language === "ar" ? "تم حذف المسار من الموقع." : "The roadmap was removed from the site.");
      window.history.replaceState(null, "", "/admin/");
      window.location.reload();
    } catch (error) {
      adminNotice = error.message || String(error);
      adminBusy = false;
      renderAdmin(parseRoute().id);
    }
  };
  const setInlineValue = (path, value) => {
    const parts = path.split(".");
    let target = inlineEditDraft;
    for (const part of parts.slice(0, -1)) {
      if (target?.[part] === undefined || target?.[part] === null) target[part] = {};
      target = target[part];
    }
    if (target) target[parts.at(-1)] = value;
  };
  const openInlineContentEditor = (roadmapId, moduleIndex = 0, topicIndex = 0, kind = "path", conceptIndex = 0) => {
    const roadmap = byId.get(roadmapId);
    if (!roadmap || !canEditContent()) return;
    inlineEditDraft = cloneContent(roadmap);
    inlineEditDraft.related = Array.isArray(inlineEditDraft.related) ? [...inlineEditDraft.related] : [];
    inlineEditModuleIndex = Math.max(0, Math.min(Number(moduleIndex) || 0, (inlineEditDraft.modules?.length || 1) - 1));
    inlineEditTopicIndex = Math.max(0, Number(topicIndex) || 0);
    inlineEditDraft.modules?.forEach((module) => {
      module.title ||= { en: "", ar: "" };
      module.topics?.forEach((topic) => {
        topic.title ||= { en: "", ar: "" };
        topic.overview ||= { en: "", ar: "" };
        topic.subtopics = (topic.subtopics || []).map((item, index) => ({
          ...(typeof item === "object" && item ? item : {}),
          id: item?.id || `${topic.id}-concept-${index + 1}`,
          en: typeof item === "string" ? item : item?.en || "",
          ar: typeof item === "string" ? "" : item?.ar || "",
          overview: { en: item?.overview?.en || "", ar: item?.overview?.ar || "" },
          resources: (item?.resources || []).map((resource) => ({ ...resource, title: typeof resource?.title === "string" ? { en: resource.title, ar: "" } : { en: resource?.title?.en || "", ar: resource?.title?.ar || "" }, url: resource?.url || "" }))
        }));
        topic.resources = (topic.resources || []).map((item) => ({ ...item, title: typeof item?.title === "string" ? { en: item.title, ar: "" } : { en: item?.title?.en || "", ar: item?.title?.ar || "" }, url: item?.url || "" }));
      });
    });
    inlineEditTarget = { kind };
    inlineEditConceptIndex = Math.max(0, Number(conceptIndex) || 0);
    inlineEditBaseline = JSON.stringify(inlineEditDraft);
    inlineEditBusy = false;
    inlineEditError = "";
    focusInlineEditorAfterRender = true;
    render();
  };
  const closeInlineContentEditor = () => {
    if (inlineEditDraft && JSON.stringify(inlineEditDraft) !== inlineEditBaseline && !window.confirm(at("discardEdit"))) return;
    inlineEditDraft = null;
    inlineEditBaseline = "";
    inlineEditError = "";
    inlineEditBusy = false;
    render();
  };
  const inlineEditorTopic = () => inlineEditDraft?.modules?.[inlineEditModuleIndex]?.topics?.[inlineEditTopicIndex];
  const inlineEditorConcept = () => inlineEditorTopic()?.subtopics?.[inlineEditConceptIndex];
  const setInlineEditTarget = (kind, moduleIndex = inlineEditModuleIndex, topicIndex = inlineEditTopicIndex, conceptIndex = 0) => {
    inlineEditTarget = { kind };
    inlineEditModuleIndex = Math.max(0, Number(moduleIndex) || 0);
    inlineEditTopicIndex = Math.max(0, Number(topicIndex) || 0);
    inlineEditConceptIndex = Math.max(0, Number(conceptIndex) || 0);
    inlineEditError = "";
    render();
  };
  const addInlineTopic = () => {
    const module = inlineEditDraft?.modules?.[inlineEditModuleIndex];
    if (!module) return;
    module.topics ||= [];
    module.topics.push({ id: "", title: { en: "", ar: "" }, overview: { en: "", ar: "" }, subtopics: [], resources: [] });
    inlineEditTopicIndex = module.topics.length - 1;
    setInlineEditTarget("topic", inlineEditModuleIndex, inlineEditTopicIndex);
  };
  const addInlineConcept = () => {
    const topic = inlineEditorTopic();
    if (!topic) return;
    topic.subtopics ||= [];
    topic.subtopics.push({ id: `${topic.id}-concept-${topic.subtopics.length + 1}`, en: "", ar: "", overview: { en: "", ar: "" }, resources: [] });
    inlineEditConceptIndex = topic.subtopics.length - 1;
    setInlineEditTarget("subtopic", inlineEditModuleIndex, inlineEditTopicIndex, inlineEditConceptIndex);
  };
  const addInlineResourceToTarget = () => {
    const collection = inlineEditTarget.kind === "subtopic" ? inlineEditorConcept()?.resources : inlineEditorTopic()?.resources;
    if (!collection) return;
    collection.push({ title: { en: "", ar: "" }, url: "" });
    render();
  };
  const removeInlineResourceFromTarget = (index) => {
    const collection = inlineEditTarget.kind === "subtopic" ? inlineEditorConcept()?.resources : inlineEditorTopic()?.resources;
    if (!collection?.[index]) return;
    collection.splice(index, 1);
    render();
  };
  const addInlineSubtopic = () => {
    const topic = inlineEditorTopic();
    if (!topic) return;
    topic.subtopics ||= [];
    addInlineConcept();
  };
  const addInlineResource = () => {
    const topic = inlineEditorTopic();
    if (!topic) return;
    topic.resources ||= [];
    topic.resources.push({ title: { en: "", ar: "" }, url: "" });
    render();
  };
  const removeInlineItem = (collection, index) => {
    const topic = inlineEditorTopic();
    if (!topic?.[collection]?.[index]) return;
    topic[collection].splice(index, 1);
    render();
  };
  const removeInlineTopic = (topicIndex = inlineEditTopicIndex) => {
    const module = inlineEditDraft?.modules?.[inlineEditModuleIndex];
    if (!module?.topics?.[topicIndex] || !window.confirm(at("removeTopicConfirm"))) return;
    module.topics.splice(topicIndex, 1);
    inlineEditTopicIndex = Math.max(0, Math.min(topicIndex, module.topics.length - 1));
    setInlineEditTarget("module", inlineEditModuleIndex, inlineEditTopicIndex);
  };
  const removeInlineModule = () => {
    if (!inlineEditDraft?.modules?.[inlineEditModuleIndex] || !window.confirm(at("removeModuleConfirm"))) return;
    inlineEditDraft.modules.splice(inlineEditModuleIndex, 1);
    inlineEditModuleIndex = Math.max(0, Math.min(inlineEditModuleIndex, inlineEditDraft.modules.length - 1));
    inlineEditTopicIndex = 0;
    setInlineEditTarget("path", inlineEditModuleIndex, 0);
  };
  const removeInlineConcept = (conceptIndex = inlineEditConceptIndex) => {
    const topic = inlineEditorTopic();
    if (!topic?.subtopics?.[conceptIndex] || !window.confirm(at("removeConceptConfirm"))) return;
    topic.subtopics.splice(conceptIndex, 1);
    inlineEditConceptIndex = Math.max(0, Math.min(conceptIndex, topic.subtopics.length - 1));
    setInlineEditTarget("topic", inlineEditModuleIndex, inlineEditTopicIndex, inlineEditConceptIndex);
  };
  const saveInlineContent = async () => {
    if (!inlineEditDraft || !canEditContent() || inlineEditBusy) return;
    if (!inlineEditDraft.title?.en?.trim()) { inlineEditError = at("invalid"); render(); return; }
    const original = byId.get(inlineEditDraft.id);
    if (!original) { inlineEditError = at("loadError"); render(); return; }
    const published = cloneContent(inlineEditDraft);
    published.related = [...new Set((published.related || []).filter((id) => byId.has(id) && id !== published.id))];
    published.modules ||= [];
    published.modules.forEach((module, moduleIndex) => {
      module.id ||= `${published.id}-module-${moduleIndex + 1}`;
      module.title ||= { en: "", ar: "" };
      module.topics ||= [];
      module.topics.forEach((topic, topicIndex) => {
        topic.id ||= `${published.id}-topic-${moduleIndex + 1}-${topicIndex + 1}`;
        topic.title ||= { en: "", ar: "" };
        topic.overview ||= { en: "", ar: "" };
        topic.subtopics ||= [];
        topic.resources ||= [];
      });
    });
    published.topicCount = published.modules.reduce((count, module) => count + module.topics.length, 0);
    inlineEditBusy = true;
    inlineEditError = "";
    render();
    try {
      await contentStore.save(published);
      Object.assign(original, published);
      rebuildTopicIndex();
      searchIndexCache = null;
      inlineEditDraft = null;
      inlineEditBaseline = "";
      inlineEditBusy = false;
      render();
      showToast(at("contentSaved"));
    } catch (error) {
      inlineEditError = error.message || String(error);
      inlineEditBusy = false;
      render();
    }
  };
  const adminAddRoadmap = () => {
    adminSelectedId = "__new__";
    adminDraft = newRoadmapDraft();
    adminModuleIndex = 0;
    adminTopicIndex = 0;
    adminNotice = "";
    setRoute("/admin/new/");
  };
  const adminAddModule = () => {
    const modules = adminDraft.modules || (adminDraft.modules = []);
    modules.push({ id: "", title: { en: "", ar: "" }, topics: [] });
    adminModuleIndex = modules.length - 1;
    adminTopicIndex = 0;
    finishAdminAction();
  };
  const adminRemoveModule = () => {
    const modules = adminDraft.modules || [];
    if (!modules[adminModuleIndex] || !window.confirm(state.language === "ar" ? "حذف هذا الموضوع وكل موضوعاته الفرعية؟" : "Remove this main topic and its learning topics?")) return;
    modules.splice(adminModuleIndex, 1);
    adminModuleIndex = Math.max(0, adminModuleIndex - 1);
    adminTopicIndex = 0;
    finishAdminAction();
  };
  const adminAddTopic = () => {
    const module = currentAdminModule();
    if (!module) return;
    module.topics ||= [];
    module.topics.push({ id: "", title: { en: "", ar: "" }, overview: { en: "", ar: "" }, subtopics: [], resources: [] });
    adminTopicIndex = module.topics.length - 1;
    finishAdminAction();
  };
  const adminRemoveTopic = () => {
    const topics = currentAdminModule()?.topics || [];
    if (!topics[adminTopicIndex] || !window.confirm(state.language === "ar" ? "حذف موضوع التعلم هذا؟" : "Remove this learning topic?")) return;
    topics.splice(adminTopicIndex, 1);
    adminTopicIndex = Math.max(0, adminTopicIndex - 1);
    finishAdminAction();
  };
  const adminAddSubtopic = () => {
    const topic = currentAdminTopic();
    if (!topic) return;
    topic.subtopics ||= [];
    topic.subtopics.push({ id: `${topic.id || "topic"}-concept-${topic.subtopics.length + 1}`, en: "", ar: "", overview: { en: "", ar: "" }, resources: [] });
    finishAdminAction();
  };
  const adminAddResource = () => {
    const topic = currentAdminTopic();
    if (!topic) return;
    topic.resources ||= [];
    topic.resources.push({ title: { en: "", ar: "" }, url: "" });
    finishAdminAction();
  };
  const adminRemoveRepeatedItem = (collection, index) => {
    const topic = currentAdminTopic();
    if (!topic?.[collection] || !topic[collection][index]) return;
    topic[collection].splice(index, 1);
    finishAdminAction();
  };
  const syncUserSession = async (user) => {
    const version = ++authHydrationVersion;
    const previousUid = activeUserUid;
    const storedUid = readStorageValue(ACTIVE_USER_KEY);
    window.clearTimeout(cloudSyncTimer);
    cloudSyncEnabled = false;
    authReady = false;

    if (!user) {
      if (previousUid) {
        try { localStorage.setItem(accountStateKey(previousUid), JSON.stringify(state)); } catch { /* Local persistence is optional. */ }
      }
      activeUserUid = null;
      try { localStorage.removeItem(ACTIVE_USER_KEY); } catch { /* Local persistence is optional. */ }
      const preferences = { language: state.language, theme: state.theme };
      Object.assign(state, readStoredState(GUEST_STATE_KEY), preferences);
      authReady = true;
      cloudSyncState = "guest";
      lastCloudSnapshot = "";
      persist();
      render();
      return;
    }

    if (previousUid && previousUid !== user.uid) {
      try { localStorage.setItem(accountStateKey(previousUid), JSON.stringify(state)); } catch { /* Local persistence is optional. */ }
    }
    const preferences = { language: state.language, theme: state.theme };
    const localKey = accountStateKey(user.uid);
    let accountLocal = null;
    try {
      if (localStorage.getItem(localKey)) accountLocal = readStoredState(localKey);
    } catch { /* Continue with cloud state if local storage is unavailable. */ }

    let guestState = null;
    if (!previousUid && !storedUid) {
      try {
        guestState = readStorageValue(GUEST_STATE_KEY) ? readStoredState(GUEST_STATE_KEY) : normalizeState(state);
        if (!readStorageValue(GUEST_STATE_KEY)) localStorage.setItem(GUEST_STATE_KEY, JSON.stringify(guestState));
      } catch { guestState = normalizeState(state); }
    }

    let remoteState = null;
    let cloudLoaded = false;
    try {
      remoteState = await contentStore.loadUserState(user.uid);
      cloudLoaded = true;
    } catch (error) {
      console.warn("Atlas learning progress could not load.", error);
    }
    if (version !== authHydrationVersion) return;

    const sameAccount = previousUid === user.uid || storedUid === user.uid;
    const accountBase = accountLocal || (sameAccount ? normalizeState(state) : freshState());
    let merged = mergeLearningStates(accountBase, remoteState || freshState());
    if (guestState) merged = mergeLearningStates(merged, mergeLearningStates(guestState, state));
    Object.assign(state, merged, preferences);

    activeUserUid = user.uid;
    authReady = true;
    cloudSyncEnabled = cloudLoaded;
    cloudSyncState = cloudLoaded ? "ready" : "error";
    syncErrorShown = false;
    try { localStorage.setItem(ACTIVE_USER_KEY, user.uid); } catch { /* Local persistence is optional. */ }
    lastCloudSnapshot = cloudLoaded ? JSON.stringify(personalState(normalizeState(remoteState || freshState()))) : "";
    persist();
    const route = parseRoute();
    if (route.page === "login") {
      setRoute(route.params.get("next") === "admin" && contentStore.isEditor(user) ? "/admin/" : "/paths/", true);
      return;
    }
    render();
  };
  contentStore.subscribeUser?.((user) => { void syncUserSession(user); });
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
    if (option?.getAttribute("href")) { setRoute(option.getAttribute("href")); closeSearchResults(); searchInput.blur(); }
  };
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  };
  const signInErrorMessage = (error) => {
    const messageKeys = {
      "auth/cancelled-popup-request": "signInPopupAlreadyOpen",
      "auth/popup-blocked": "signInPopupBlocked",
      "auth/popup-closed-by-user": "signInPopupClosed",
      "auth/unauthorized-domain": "signInDomainNotAllowed",
      "auth/operation-not-allowed": "signInGoogleDisabled"
    };
    const key = messageKeys[error?.code];
    const message = tr(key || "signInError");
    return key || !error?.code ? message : `${message} (${error.code})`;
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
    mobileStatusTopic = "";
    suppressLongPressClick = false;
    suppressLongPressTopic = "";
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
      if (`${location.pathname}${location.search}` === target) setRoute(target, true);
      else setRoute(target);
      return;
    }
    const mapTarget = roadmapHref(roadmap, topicId);
    if (parseRoute().page === "learn") {
      if (nextStatus === "learning") setRoute(learningHref(roadmap, topicId));
      else setRoute(`${location.pathname}${location.search}`, true);
    } else setRoute(mapTarget, true);
  };
  const resetProgress = () => {
    if (!window.confirm(tr(contentStore.user ? "resetConfirmAccount" : "resetConfirm"))) return;
    state.started = [];
    state.progress = {};
    state.learning = {};
    state.skipped = {};
    persist();
    render();
    showToast(tr(contentStore.user ? "resetDoneAccount" : "resetDone"));
  };
  const delegatedClick = (event) => {
    const action = event.target.closest("[data-action]");
    if (mobileStatusTopic) {
      const activeNode = [...root.querySelectorAll(".topic-node")].find((node) => node.dataset.topic === mobileStatusTopic);
      if (!activeNode?.closest(".topic-item")?.contains(event.target)) {
        mobileStatusTopic = "";
        const item = activeNode?.closest(".topic-item");
        item?.classList.remove("is-status-open");
        item?.querySelector(".topic-status-controls")?.classList.remove("is-forced");
      }
    }
    if (!action) return;
    const name = action.dataset.action;
    if (name === "toggle-admin-edit-mode") {
      event.preventDefault();
      if (!canEditContent()) return;
      adminEditMode = !adminEditMode;
      mobileStatusTopic = "";
      render();
      return;
    }
    if (name === "edit-selected-path") {
      if (!adminEditMode || !canEditContent()) return;
      event.preventDefault();
      openInlineContentEditor(action.dataset.roadmap, 0, 0, "path");
      return;
    }
    if (name === "edit-current-learning-item") {
      event.preventDefault();
      if (!canEditContent()) return;
      const route = parseRoute();
      const roadmap = byId.get(route.id);
      const selected = roadmap && topicList(roadmap).find(({ topic }) => topic.id === route.params.get("topic"));
      if (!selected) return;
      const { module, topic } = selected;
      const moduleIndex = roadmap.modules.indexOf(module);
      const topicIndex = module.topics.indexOf(topic);
      const conceptId = route.params.get("concept");
      const conceptIndex = conceptId ? (topic.subtopics || []).findIndex((_, index) => conceptIdFor(topic, index) === conceptId) : -1;
      if (conceptIndex >= 0) openInlineContentEditor(roadmap.id, moduleIndex, topicIndex, "subtopic", conceptIndex);
      else openInlineContentEditor(roadmap.id, moduleIndex, topicIndex, "topic");
      return;
    }
    if (name === "open-learning-concept") {
      if (adminEditMode && canEditContent()) {
        event.preventDefault();
        openInlineContentEditor(action.dataset.roadmap, action.dataset.module, action.dataset.topic, "subtopic", action.dataset.concept);
      }
      return;
    }
    if (name === "account-toggle") {
      event.preventDefault();
      if (!contentStore.user) {
        setRoute("/login/");
      } else {
        const popover = document.getElementById("accountPopover");
        popover.hidden = !popover.hidden;
        action.setAttribute("aria-expanded", String(!popover.hidden));
      }
      return;
    }
    if (name === "google-sign-in") {
      event.preventDefault();
      if (!contentStore.configured || googleSignInPending) return;
      googleSignInPending = true;
      action.disabled = true;
      action.setAttribute("aria-busy", "true");
      const label = action.querySelector("span");
      if (label) label.textContent = tr("signInOpening");
      contentStore.signIn()
        .catch((error) => showToast(signInErrorMessage(error)))
        .finally(() => {
          googleSignInPending = false;
          if (action.isConnected && !contentStore.user) {
            action.disabled = false;
            action.removeAttribute("aria-busy");
            if (label) label.textContent = tr("authGoogle");
          }
        });
      return;
    }
    if (name === "account-signout") {
      event.preventDefault();
      document.getElementById("accountPopover").hidden = true;
      void signOutAccount();
      return;
    }
    if (name === "open-content-editor") {
      event.preventDefault();
      openInlineContentEditor(action.dataset.roadmap, action.dataset.module, action.dataset.topic);
      return;
    }
    if (name === "close-content-editor") { event.preventDefault(); closeInlineContentEditor(); return; }
    if (name === "inline-edit-child-module") { event.preventDefault(); setInlineEditTarget("module", Number(action.dataset.module), 0); return; }
    if (name === "inline-edit-child-topic") { event.preventDefault(); setInlineEditTarget("topic", inlineEditModuleIndex, Number(action.dataset.topic)); return; }
    if (name === "inline-edit-concept") { event.preventDefault(); setInlineEditTarget("subtopic", inlineEditModuleIndex, inlineEditTopicIndex, Number(action.dataset.concept)); return; }
    if (name === "inline-back-to-parent") {
      event.preventDefault();
      setInlineEditTarget(inlineEditTarget.kind === "subtopic" ? "topic" : inlineEditTarget.kind === "topic" ? "module" : "path");
      return;
    }
    if (name === "inline-add-module") {
      event.preventDefault();
      inlineEditDraft.modules ||= [];
      inlineEditDraft.modules.push({ id: "", title: { en: "", ar: "" }, topics: [] });
      setInlineEditTarget("module", inlineEditDraft.modules.length - 1, 0);
      return;
    }
    if (name === "inline-remove-module") { event.preventDefault(); removeInlineModule(); return; }
    if (name === "inline-add-topic") { event.preventDefault(); addInlineTopic(); return; }
    if (name === "inline-remove-topic") { event.preventDefault(); removeInlineTopic(Number(action.dataset.topic ?? inlineEditTopicIndex)); return; }
    if (name === "inline-remove-selected-topic") { event.preventDefault(); removeInlineTopic(); return; }
    if (name === "inline-remove-selected-concept") { event.preventDefault(); removeInlineConcept(); return; }
    if (name === "open-full-editor") {
      event.preventDefault();
      if (inlineEditDraft && JSON.stringify(inlineEditDraft) !== inlineEditBaseline && !window.confirm(at("discardEdit"))) return;
      const roadmapId = inlineEditDraft?.id;
      inlineEditDraft = null;
      inlineEditBaseline = "";
      adminDraft = null;
      adminSelectedId = "";
      if (roadmapId) setRoute(`/admin/${encodeURIComponent(roadmapId)}/`);
      return;
    }
    if (name === "inline-add-subtopic") { event.preventDefault(); addInlineSubtopic(); return; }
    if (name === "inline-add-resource") { event.preventDefault(); addInlineResourceToTarget(); return; }
    if (name === "inline-remove-subtopic") { event.preventDefault(); removeInlineConcept(Number(action.dataset.index)); return; }
    if (name === "inline-remove-resource") { event.preventDefault(); removeInlineResourceFromTarget(Number(action.dataset.index)); return; }
    if (name.startsWith("admin-")) {
      event.preventDefault();
      if (name === "admin-login") adminLogin();
      else if (name === "admin-logout") void signOutAccount();
      else if (name === "admin-new") adminAddRoadmap();
      else if (name === "admin-save") adminSave();
      else if (name === "admin-delete-roadmap") adminDeleteRoadmap();
      else if (name === "admin-add-module") adminAddModule();
      else if (name === "admin-remove-module") adminRemoveModule();
      else if (name === "admin-add-topic") adminAddTopic();
      else if (name === "admin-remove-topic") adminRemoveTopic();
      else if (name === "admin-add-subtopic") adminAddSubtopic();
      else if (name === "admin-remove-subtopic") adminRemoveRepeatedItem("subtopics", Number(action.dataset.index));
      else if (name === "admin-add-resource") adminAddResource();
      else if (name === "admin-remove-resource") adminRemoveRepeatedItem("resources", Number(action.dataset.index));
      return;
    }
    if (name === "toggle-save") { event.preventDefault(); toggleSaved(action.dataset.roadmap); }
    if (name === "open-related-roadmap") {
      event.preventDefault();
      const roadmap = byId.get(action.dataset.roadmap);
      if (roadmap) {
        focusTopicAfterRender = false;
        scrollToTopAfterRender = true;
        setRoute(roadmapHref(roadmap));
      }
    }
    if (name === "open-topic" || name === "open-module") {
      event.preventDefault();
      const roadmap = byId.get(action.dataset.roadmap);
      const topicId = action.dataset.topic;
      if (name === "open-topic" && suppressLongPressClick && suppressLongPressTopic === topicId) {
        suppressLongPressClick = false;
        suppressLongPressTopic = "";
        return;
      }
      if (adminEditMode && canEditContent()) {
        if (name === "open-module") openInlineContentEditor(action.dataset.roadmap, action.dataset.module, 0, "module");
        else {
          openInlineContentEditor(action.dataset.roadmap, action.dataset.moduleIndex, action.dataset.topicIndex, "topic");
        }
        return;
      }
      if (roadmap && topicList(roadmap).some(({ topic }) => topic.id === topicId)) {
        focusTopicAfterRender = true;
        setRoute(roadmapHref(roadmap, topicId), true);
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
      setRoute(librarySearchHref(action.dataset.category, action.dataset.query));
    }
    if (name === "set-topic-status") { event.preventDefault(); setTopicStatus(action.dataset.roadmap, action.dataset.topic, action.dataset.status); }
    if (name === "return-to-map") { event.preventDefault(); focusTopicAfterRender = true; setRoute(roadmapHref(byId.get(action.dataset.roadmap), action.dataset.topic)); }
    if (name === "copy-prompt") { event.preventDefault(); copyStudyPrompt(action.dataset.roadmap, action.dataset.topic); }
    if (name === "reset-progress") { event.preventDefault(); resetProgress(); }
    if (name === "focus-search") { searchInput.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  document.addEventListener("pointerdown", (event) => {
    const node = event.target.closest?.('.topic-node[data-action="open-topic"]');
    if (event.pointerType !== "touch" || !node || canEditContent() && adminEditMode) return;
    window.clearTimeout(mobileStatusTimer);
    mobilePointerStart = { x: event.clientX, y: event.clientY, topic: node.dataset.topic };
    mobileStatusTimer = window.setTimeout(() => {
      if (!mobilePointerStart) return;
      mobileStatusTopic = mobilePointerStart.topic;
      suppressLongPressClick = true;
      suppressLongPressTopic = mobilePointerStart.topic;
      render();
      window.setTimeout(() => { suppressLongPressClick = false; suppressLongPressTopic = ""; }, 900);
    }, 560);
  }, { passive: true });
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch" || !mobilePointerStart) return;
    if (Math.hypot(event.clientX - mobilePointerStart.x, event.clientY - mobilePointerStart.y) > 12) {
      window.clearTimeout(mobileStatusTimer);
      mobileStatusTimer = 0;
      mobilePointerStart = null;
    }
  }, { passive: true });
  const clearMobileLongPress = () => {
    window.clearTimeout(mobileStatusTimer);
    mobileStatusTimer = 0;
    mobilePointerStart = null;
  };
  document.addEventListener("pointerup", clearMobileLongPress, { passive: true });
  document.addEventListener("pointercancel", clearMobileLongPress, { passive: true });
  document.addEventListener("contextmenu", (event) => {
    if (suppressLongPressClick && event.target.closest?.(".topic-node")?.dataset.topic === suppressLongPressTopic) event.preventDefault();
  });

  document.addEventListener("click", delegatedClick);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#")) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.hash) return;
    event.preventDefault();
    setRoute(`${destination.pathname}${destination.search}`);
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target.closest?.('[data-action="edit-selected-path"][role="button"]');
    if (target && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openInlineContentEditor(target.dataset.roadmap, 0, 0, "path");
    }
  });
  document.addEventListener("input", (event) => {
    const field = event.target.closest("[data-admin-path]");
    if (field) setAdminValue(field.dataset.adminPath, field.value);
    const inlineField = event.target.closest("[data-inline-path]");
    if (inlineField) setInlineValue(inlineField.dataset.inlinePath, inlineField.value);
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "inlineContentEditor") return;
    event.preventDefault();
    void saveInlineContent();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "inlineModuleSelect") {
      inlineEditModuleIndex = Math.max(0, Number(event.target.value) || 0);
      inlineEditTopicIndex = 0;
      inlineEditError = "";
      render();
      return;
    }
    if (event.target.id === "inlineTopicSelect") {
      inlineEditTopicIndex = Math.max(0, Number(event.target.value) || 0);
      inlineEditError = "";
      render();
      return;
    }
    if (event.target.matches("[data-inline-related]")) {
      const selected = [...root.querySelectorAll("[data-inline-related]:checked")].map((field) => field.value);
      inlineEditDraft.related = selected;
      return;
    }
    if (event.target.matches("[data-admin-related]")) {
      adminDraft.related = [...root.querySelectorAll("[data-admin-related]:checked")].map((field) => field.value);
      return;
    }
    if (event.target.id === "adminRoadmapSelect") {
      const id = event.target.value;
      if (id && byId.has(id)) {
        adminSelectedId = id;
        adminDraft = cloneContent(byId.get(id));
        adminModuleIndex = 0;
        adminTopicIndex = 0;
        adminNotice = "";
        setRoute(`/admin/${encodeURIComponent(id)}/`);
      }
      return;
    }
    if (event.target.id === "adminModuleSelect") {
      adminModuleIndex = Math.max(0, Number(event.target.value) || 0);
      adminTopicIndex = 0;
      renderAdmin(parseRoute().id);
      return;
    }
    if (event.target.id === "adminTopicSelect") {
      adminTopicIndex = Math.max(0, Number(event.target.value) || 0);
      renderAdmin(parseRoute().id);
      return;
    }
    const field = event.target.closest("[data-admin-path]");
    if (field) setAdminValue(field.dataset.adminPath, field.value);
    const inlineField = event.target.closest("[data-inline-path]");
    if (inlineField) setInlineValue(inlineField.dataset.inlinePath, inlineField.value);
  });
  document.addEventListener("click", (event) => {
    if (!searchWrap.contains(event.target)) closeSearchResults();
    const accountControl = document.getElementById("accountControl");
    if (!accountControl.contains(event.target)) {
      const popover = document.getElementById("accountPopover");
      popover.hidden = true;
      document.getElementById("accountButton").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (root.querySelector("#contentEditDialog")?.open) return;
    const route = parseRoute();
    if (route.page !== "learn") return;
    const drawer = root.querySelector(".learning-drawer");
    if (!drawer) return;
    if (event.key === "Escape") {
      const roadmap = byId.get(route.id);
      if (roadmap) {
        event.preventDefault();
        focusTopicAfterRender = true;
        setRoute(roadmapHref(roadmap, route.params.get("topic")));
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
  window.addEventListener("popstate", render);
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
  normalizeLegacyRoute();
  if (location.pathname === "/home" || location.pathname === "/home/") history.replaceState(null, "", "/");
  render();
  document.documentElement.classList.remove("app-hydrating");
  const adminToast = sessionStorage.getItem("atlas-admin-notice");
  if (adminToast) {
    sessionStorage.removeItem("atlas-admin-notice");
    showToast(adminToast);
  }
})();
