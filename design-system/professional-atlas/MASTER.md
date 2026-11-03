# Atlas design system

## Product direction

- Keep the brand field-neutral. The supplied YFLB white and black SVGs are permanent brand assets: use them unchanged, preserve their proportions, and provide clear space. The white logo belongs in the dark header; the black logo belongs on its light footer plate.
- The platform organizes 517 independent learning pathways across fourteen broad families: business, accounting, finance, economics, marketing, people, communication, psychology, operations, analysis, information systems, data, applied industries, and professional skills.
- The catalog should be easy to scan and search. Roadmaps use a connected suggested path, specialist checkpoint branches, smaller searchable subtopics, and direct links between related paths. Every topic opens immediately; learners may study and complete topics in any order and revisit completed topics.
- Take high-level interaction inspiration from public learning-roadmap platforms. Build original copy, maps, components, and illustrations for this project.
- Keep every existing color value in `src/tokens.css`. Use semantic tokens for surfaces, text, status, focus, and map connections. Do not introduce a replacement palette.
- Keep checkpoint cards rectangular. Preserve the central spine that links the main topics; use dotted curves from individual checkpoint cards to their topic hub and omit horizontal crossbars.
- Retain Crimson Pro for display text and Atkinson Hyperlegible for the English interface. Use system Arabic fonts for Arabic content.

## Token architecture

`src/tokens.css` is the source of truth.

1. Primitive tokens define the existing navy, teal, gold, coral, neutral, and status colors.
2. Semantic tokens map those colors to surfaces, text, borders, focus, and status.
3. Component tokens define shared buttons, cards, fields, and navigation surfaces.

New components use these tokens. Completion and selected states must use labels, outlines, and icons alongside color. Keep map connectors visually secondary to the topic nodes.

## Layout and responsive behavior

- The dark header holds the unchanged white logo, primary navigation, global search, language control, and theme control.
- The home page uses a clear field-neutral headline, a search affordance, category shortcuts, and featured roadmap cards.
- The pathway library follows a browse pattern: category list at the side and searchable cards in the main area.
- A roadmap page shows progress and a large multi-module map with vertically stacked checkpoint branches. Keep the central spine linking the main topics and connect the cards to their hubs with dotted curves. Hovering or keyboard-focusing a checkpoint reveals a horizontal, three-part status bar, centered and flush with its top edge; it hides when the pointer leaves. Selecting Learning opens a side drawer over the map. Related paths appear after the map and open at the top of the selected path.
- Keep learning copy close to the selected node. Related-path links must open an actual learning path at its next available checkpoint, not a source-reference page.
- Use a 4px base and 8px spacing rhythm. Keep long reading text to a comfortable measure.

## Interaction and accessibility

- Every topic and module is available immediately. The map suggests a visual learning flow without numbered steps or locks; opening or updating a topic never depends on another checkpoint.
- Record each topic as Learning, Done, or Skip independently. Done and Skip can be toggled off by selecting them again. Done contributes to the progress percentage, while Skip is crossed out more strongly and excluded from the denominator.
- The topic learning page repeats the status controls and progress bar, then gives a topic overview, four smaller searchable concepts, a practical learning output, searches for official, written, video, and academic material, and a copyable study prompt.
- Topic searches include a relevant professional or university curriculum phrase, selected for the topic's broad family, while keeping field frameworks out of product branding and catalog titles.
- Store pathway progress and bookmarks only in local browser storage. Offer a clear action with confirmation.
- Search supports `/`, Ctrl/Command+K, arrow-key result selection, Enter, and Escape. Match path and topic names with typo-tolerant spelling suggestions. Keep visible focus and a skip link.
- Provide complete English and Arabic interface states, including `lang`, `dir`, page metadata, accessible names, placeholders, and learning content. Do not mix languages in the visible interface.
- Respect reduced-motion preferences. Any disabled controls must look inactive, be semantically disabled, and remain out of the keyboard tab order.

## Content and trust

- Present topics as suggested self-paced study checkpoints, not a degree, accredited curriculum, formal academic-credit equivalency, license, or employment guarantee.
- Build all map artwork, component styling, and topic explanations for this project. Do not reuse third-party artwork or roadmap content.
- The supplied YFLB logos are immutable and remain visible wherever the header and footer brand lockups appear.
