/*
  The works catalogue. One entry per piece.

  To add a piece:
    1. Make a folder:  works/<id>/   and put its PDF(s) in it.
    2. Copy one of the entries below, paste it at the top of the list, and fill it in.
    3. Commit and push. The catalogue, the home page and the reader all read from this file.

  Fields
    id               short, lowercase, no spaces. Used in links: read.html?work=<id>
    title            the title as it should appear
    year             year of composition (a number, or a string like "2019–21")
    category         a short grouping used for the filter buttons, e.g. "Choral", "Chamber",
                     "Orchestral", "Solo", "Vocal", "Opera". Keep the spelling consistent.
    instrumentation  plain words, or a code like "3333-4331-3, perc, harp, strings"
    duration         optional, e.g. "c. 6'"
    text             optional, who wrote the words, e.g. "Psalm 42" or "words by …"
    note             a short note in your own voice. Plain text; blank lines start new paragraphs.
    files            one or more PDFs: { label: "Full score", path: "works/<id>/<file>.pdf" }
                     The first file is the one the reader opens by default.
    publisher        for a piece that's published elsewhere instead of hosted here:
                     { name: "GIA", url: "https://…" }. Leave out "files" for these;
                     the catalogue shows "Published by <name>" with a link instead.
    listen           optional links to recordings: { label: "SoundCloud", url: "https://…" }
    license          optional. Leave it out to use the site-wide license (set in assets/js/site.js).
    placeholder      true only for the dummy entries. Delete those entries once real pieces exist.
*/

window.WORKS = [
  {
    id: "vampires",
    title: "Vampires",
    year: 2019,
    category: "Choral",
    instrumentation: "SATB, unaccompanied",
    text: "Words by Charles Anthony Silvestri, from I Wonder…",
    publisher: { name: "MusicSpoke", url: "https://www.musicspoke.com/downloads/vampires/" }
  },
  {
    id: "anna-thy-charms",
    title: "Anna, Thy Charms",
    year: 2008,
    category: "Choral",
    instrumentation: "SSATBB",
    text: "Words by Robert Burns",
    publisher: { name: "GIA", url: "https://giamusic.com/resource/anna-thy-charms-print-g7459" }
  },
  {
    id: "placeholder-one",
    placeholder: true,
    title: "Placeholder Work One",
    year: 2026,
    category: "Choral",
    instrumentation: "SATB choir, unaccompanied",
    duration: "c. 4'",
    text: "TODO: text source",
    note: "Placeholder entry. This is where a short note about the piece goes, in my own words: what it is, why I wrote it, anything a performer should know before they start.\n\nA second paragraph works too.",
    files: [
      { label: "Score", path: "works/placeholder-one/placeholder-one-score.pdf" }
    ],
    listen: []
  },
  {
    id: "placeholder-two",
    placeholder: true,
    title: "Placeholder Work Two",
    year: 2025,
    category: "Chamber",
    instrumentation: "Violin, cello and piano",
    duration: "c. 12'",
    note: "Placeholder entry with a full score and two parts, to show how a piece with several PDFs looks in the catalogue and the reader.",
    files: [
      { label: "Full score", path: "works/placeholder-two/placeholder-two-score.pdf" },
      { label: "Violin part", path: "works/placeholder-two/placeholder-two-violin.pdf" },
      { label: "Cello part", path: "works/placeholder-two/placeholder-two-cello.pdf" }
    ],
    listen: [
      { label: "Recording (example link)", url: "https://example.com/" }
    ]
  },
  {
    id: "placeholder-three",
    placeholder: true,
    title: "Placeholder Work Three",
    year: 2023,
    category: "Solo",
    instrumentation: "Piano",
    note: "Placeholder entry for a solo piece.",
    files: [
      { label: "Score", path: "works/placeholder-three/placeholder-three-score.pdf" }
    ]
  }
];
