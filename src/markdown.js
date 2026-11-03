(() => {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const safeHref = (value) => {
    const href = String(value || "").trim().replace(/&amp;/g, "&");
    if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
    if (/^(\/|#|\.\/|\.\.\/)/.test(href) && !href.startsWith("//")) return href;
    return "";
  };

  const inlineMarkdown = (value) => {
    const protectedHtml = [];
    const protect = (html) => `\u0000${protectedHtml.push(html) - 1}\u0000`;
    let source = String(value ?? "");

    source = source.replace(/`([^`\n]+)`/g, (_, code) => protect(`<code>${escapeHtml(code)}</code>`));
    source = source.replace(/!?\[([^\]]+)\]\((<[^>]+>|[^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (match, label, target, title) => {
      const href = safeHref(target.replace(/^<|>$/g, ""));
      if (!href) return protect(inlineMarkdown(label));
      const external = /^https?:\/\//i.test(href);
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
      const externalAttributes = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return protect(`<a href="${escapeHtml(href)}"${titleAttribute}${externalAttributes}>${inlineMarkdown(label)}</a>`);
    });

    let html = escapeHtml(source)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/(^|[^\w])\*([^*\n]+)\*(?=$|[^\w])/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_(?=$|[^\w])/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br>");
    html = html.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedHtml[Number(index)] || "");
    return html;
  };

  const slugify = (value) => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "section";

  const splitTableRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
  const isTableDivider = (line) => {
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };
  const headingText = (value) => String(value || "")
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();

  const render = (markdown, options = {}) => {
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    const headings = [];
    const usedHeadingIds = new Set();
    const blocks = [];
    let index = 0;
    const isListItem = (line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
    const isSpecialBlock = (line) => /^(?:\s*```|\s*#{1,6}\s+|\s*>|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(line) || isListItem(line);

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }

      const fence = line.match(/^\s*```\s*([\w.+-]{0,24})\s*$/);
      if (fence) {
        const codeLines = [];
        index += 1;
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) codeLines.push(lines[index++]);
        if (index < lines.length) index += 1;
        const language = fence[1];
        blocks.push(`<figure class="markdown-code-block">${language ? `<figcaption>${escapeHtml(language)}</figcaption>` : ""}<pre><code dir="ltr"${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre></figure>`);
        continue;
      }

      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const rawText = headingText(heading[2]);
        const baseId = `${options.idPrefix ? `${slugify(options.idPrefix)}-` : "lesson-"}${slugify(rawText)}`;
        let id = baseId;
        let duplicate = 2;
        while (usedHeadingIds.has(id)) id = `${baseId}-${duplicate++}`;
        usedHeadingIds.add(id);
        const level = Math.min(heading[1].length + 1, 6);
        headings.push({ id, text: rawText, level });
        blocks.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
        const headerCells = splitTableRow(line);
        const alignments = splitTableRow(lines[index + 1]).map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : "");
        index += 2;
        const bodyRows = [];
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) bodyRows.push(splitTableRow(lines[index++]));
        const renderCell = (cell, cellIndex, header = false) => {
          const tag = header ? "th" : "td";
          const align = alignments[cellIndex] ? ` data-align="${alignments[cellIndex]}"` : "";
          if (header) return `<th scope="col"${align} dir="auto">${inlineMarkdown(cell || "")}</th>`;
          const label = escapeHtml(headingText(headerCells[cellIndex] || ""));
          return `<td${align} dir="auto"><span class="markdown-table-cell-label" aria-hidden="true">${label}</span><span class="markdown-table-cell-value">${inlineMarkdown(cell || "")}</span></td>`;
        };
        const table = `<table><thead><tr>${headerCells.map((cell, cellIndex) => renderCell(cell, cellIndex, true)).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${headerCells.map((_, cellIndex) => renderCell(row[cellIndex] || "", cellIndex)).join("")}</tr>`).join("")}</tbody></table>`;
        blocks.push(`<div class="markdown-table-wrap" role="region" tabindex="0" aria-label="${escapeHtml(options.tableLabel || "Scrollable table")}">${table}</div>`);
        continue;
      }

      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push("<hr>");
        index += 1;
        continue;
      }

      if (/^\s*>/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quoteLines.push(lines[index++].replace(/^\s*>\s?/, ""));
        blocks.push(`<blockquote>${quoteLines.map((item) => `<p>${inlineMarkdown(item)}</p>`).join("")}</blockquote>`);
        continue;
      }

      if (isListItem(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const listItems = [];
        let start = 1;
        if (ordered) start = Number(line.match(/^\s*(\d+)/)?.[1] || 1);
        while (index < lines.length && isListItem(lines[index]) && /^\s*\d+[.)]\s+/.test(lines[index]) === ordered) {
          let content = lines[index++].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "");
          const task = content.match(/^\[([ xX])\]\s+(.*)$/);
          if (task) {
            const checked = task[1].toLowerCase() === "x";
            listItems.push(`<li class="markdown-task-item"><input type="checkbox" disabled${checked ? " checked" : ""}><span>${inlineMarkdown(task[2])}</span></li>`);
          } else {
            listItems.push(`<li>${inlineMarkdown(content)}</li>`);
          }
        }
        blocks.push(ordered ? `<ol start="${Math.max(1, start)}">${listItems.join("")}</ol>` : `<ul>${listItems.join("")}</ul>`);
        continue;
      }

      const paragraphLines = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isSpecialBlock(lines[index]) && !(index + 1 < lines.length && lines[index].includes("|") && isTableDivider(lines[index + 1]))) {
        paragraphLines.push(lines[index++]);
      }
      blocks.push(`<p>${inlineMarkdown(paragraphLines.join("\n"))}</p>`);
    }

    return { html: blocks.join("\n"), headings };
  };

  window.AtlasMarkdown = Object.freeze({ render });
})();
