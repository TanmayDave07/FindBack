# Frontend checks

GATE: OPEN 11 (rounds used up)

The requested application screens are implemented in plain HTML, CSS, and
JavaScript and use the existing API. Claim submission is labelled **Coming
soon**; no claims, verification, or other backend business features were added.

## Functional checks

- Existing backend suite: 32 tests passed after adding static file serving.
- Browser flows against the real API: 25 checks passed (15 student, 3 admin,
  7 mobile).
- Checked registration, login, reporting, ranked scores, private-detail
  visibility, searching, filtering, editing, closing, signing out, bookmarked
  page reloads, admin controls, mobile navigation, and field errors.
- Performance at 1440 and 390 pixels: PASS, zero failures or warnings. Transfer
  was approximately 149.2 KiB and 125.7 KiB respectively; no broken requests,
  layout shifts, long tasks, or WebGL contexts were observed.
- Potential Matches was visually reviewed at 1440, 1024, 820, 768, and 390
  pixels, with no observed horizontal overflow or overlapping controls.
- JavaScript syntax and Git whitespace checks passed.

The QA server uses an isolated local database and test fixtures. Production
starts with `npm start` and has no QA session injection or test routes.
Browser results and screenshots are local files under the ignored
`.taste-skill/` directory.

## Design checker findings

The design checker completed all three rounds and remains OPEN. This is not
a claim that its design gate passed. The eleven unwaived findings are:

| Check | Findings | Reason retained |
| --- | --- | --- |
| `links` | Five authentication/brand links | They navigate to actual hash-router pages (`#/login`, `#/register`, `#/dashboard`), which the checker interprets as missing section anchors. Browser navigation was tested. |
| `container-edges` | Skip link, application mount, two-column auth section, right-pane copy, right-pane heading | The application uses a responsive auth layout and an accessible skip link rather than the checker's marketing-section structure. |
| `container` | Missing marketing `.wrap` | The compact app has its own content containers. |

Three explicit waivers are recorded locally:

- `no-visual`: the real authentication form is the requested application UI;
  adding a marketing image or effect would expand the scope.
- `copy-headline`: “Sign in to FindBack” names the authentication action and
  existing product; adjacent copy identifies campus lost and found.
- `moment-none`: a full-screen scroll scene would add unrelated content to
  the compact login flow and exceed the user's frontend time constraints.

The remaining warnings concern authentication tabs and buttons having
different styles (`same-action`, `link-styles`), and the mobile brand link
being 36 pixels tall (`tap-size`). The adjacent inline footer account link
also received a narrow-screen tap-size warning. Core form controls and mobile
navigation were exercised in the browser.

## Presentation and assets

Kind: software. Dealt palette: card-pastels, with paper neutrals and a restrained
pink action accent. Typography: local Geist and Geist Mono, with their font
licenses included. Soft radii and the provided hover/press motion layer are
used. The auth screen shows the actual form; extra effects, scenes, and
marketing moments were omitted under the compact-app scope.

Voice: short, practical campus-report labels. No invented business facts,
activity counts, testimonials, or production reports are displayed. FindBack
is the existing name, so no coined-name search was needed. There are no stock
photos, client asset slots, or simulated contact forms. Item photographs come
from the optional report photo URL; reports without photos show a category
glyph. A deployment domain/canonical URL has not been selected.
