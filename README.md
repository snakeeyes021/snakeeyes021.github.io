# matthewsamson.com

Plain HTML, CSS and JavaScript. No build step. GitHub Pages serves this repo as-is
from `main` (`.nojekyll` turns off Jekyll; `CNAME` points the domain here).

## Adding a piece

1. Put the PDF(s) in `works/<id>/`.
2. Add an entry to the top of `works/catalogue.js`. The fields are explained at the top
   of that file. The music page, the home page's "Newest" list and the reader all read
   from it.
3. Commit and push.

## Setting the license

Set `license` in `assets/js/site.js` (name and URL). Every mention of the license on
the site fills in from there. A single piece can override it with its own `license`
field in the catalogue.

## Files

| Page | File |
| --- | --- |
| Home | `index.html` |
| The music (catalogue) | `music.html` |
| Score reader | `read.html` (`read.html?work=<id>&file=<n>&page=<p>`) |
| Using the music | `use.html` |
| About | `about.html` |
| Contact | `contact.html` |
| Not found | `404.html` |

Styles are in `assets/css/` (`site.css` for everything, `reader.css` for the reader),
scripts in `assets/js/`. The reader uses PDF.js, vendored in `assets/vendor/pdfjs/`
(see `VERSION` there).

The header and footer are repeated in each page. If you add a page, add it to the nav
in every file.

Yellow highlighted boxes on the site are things still to decide or fill in.

## Previewing locally

Any static server from the repo root works, e.g. `python3 -m http.server`. Opening the
files directly from disk won't work for the reader, because browsers block PDF.js
from loading files over `file://`.
