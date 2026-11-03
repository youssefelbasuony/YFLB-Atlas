# Atlas

A self-paced, bilingual learning-roadmap platform across 14 broad catalog families. The catalog contains 517 independent pathways and 46,104 ordered learning checkpoints spanning business, accounting, finance, economics, marketing, people, communication, psychology, operations, analysis, information systems, data, applied industries and professional skills.

## Run locally

From this folder, start a local web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. No build step or JavaScript package install is required.

## Learning experience

- Browse all pathways by field, search by subject, save roadmaps, or continue from the personal learning page.
- Each roadmap is an original, expanded connected map with broad modules, specialist checkpoints and four searchable subtopic links under every checkpoint. Routes have 88–160 checkpoints; database administration has 160.
- Every checkpoint is open from the start. Mark it as Learning, Done, or Skip, and revisit it whenever you like. Done checkpoints count toward progress; skipped checkpoints are excluded from its denominator.
- Checkpoints appear in a vertical stack on each map branch. Hovering a checkpoint reveals a small horizontal Learning/Done/Skip bar divided into three segments; it disappears when the pointer leaves. Choosing Learning opens a side panel over the map with the same status controls, progress, an overview, smaller searchable concepts, resource searches, and a study prompt.
- Done and Skip can be clicked again to clear their status. Done counts toward progress; skipped checkpoints are excluded from its denominator. The map remains uncluttered until a learner hovers or focuses a checkpoint.
- Foundational topics retain their label while their checkpoint cards use the same status colors as other branches. The map's connectors show suggested order without numbered steps or locked checkpoints. Related pathways appear after the map and open at the top of the selected path.
- A continuous central spine links the main topics. Dotted curves connect each checkpoint card directly to its main topic; no horizontal crossbar runs through the branch.
- Search checks pathway names and topic titles, tolerates common spelling mistakes, and offers a one-click suggested correction.
- The full interface and all roadmap titles, summaries, topics, controls, and metadata switch between English and Arabic. Learning progress is kept locally in this browser.
- Light and dark themes use the existing palette in `src/tokens.css`. The supplied YFLB logos are included unchanged.

## Content scope

These routes are suggested learning guides. They are not university syllabi, accredited degrees, academic-credit equivalencies, professional licenses, or guarantees of recognition by a university or employer. Recognition and licensing rules depend on the relevant country, regulator, and institution.

The interaction takes high-level inspiration from the connected maps and catalog patterns in [roadmap.sh](https://roadmap.sh/). Its files, illustrations, text, and roadmap data are not republished here. Names of broad subject areas were checked against the supplied study-plan headings and six supplied professional roadmaps; year and class labels were left out. Online study searches draw on public university and professional curricula. The source map and its limits are documented in [research/learning-pathway-source-map.md](research/learning-pathway-source-map.md).

## Project files

- `src/data.js` contains the original bilingual catalog.
- `src/roadmap-library.js` contains the 14-family taxonomy, original pathways, initial map modules, and bilingual names.
- `src/roadmap-expansion.js` adds 402 specialist pathways, including roles and fields covered by the supplied roadmaps, plus communication, psychology, and adjacent professional fields.
- `src/roadmap-depth.js` adds the deeper cross-field curriculum, four searchable subtopics per checkpoint, specialist deep dives, and active links between related pathways.
- `src/app.js` contains catalog routing, typo-tolerant search, language and theme controls, independent Learning/Done/Skip checkpoint states, topic learning pages, resources, and local progress.
- `src/tokens.css` preserves the project's color palette and design tokens.
- `src/styles.css` contains the responsive catalog, roadmap maps, and learning panels.
- `design-system/professional-atlas/MASTER.md` documents the visual and interaction rules.
- `assets/logos/` contains the supplied YFLB logos, unchanged.
