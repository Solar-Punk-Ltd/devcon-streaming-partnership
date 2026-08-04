# Devcon 8 architecture explorer

An interactive explorer for the Devcon 8 streaming architecture. One expandable
canvas over one model, a guided walkthrough, and the count and blast radius of
every component.

Built after a close read of [IcePanel](https://icepanel.io), which is the best
thing in this category. What it gets right, and what is borrowed here, is
written down in [docs/icepanel-notes.md](docs/icepanel-notes.md).

## Run it

```bash
npm run dev
```

Then open http://127.0.0.1:4173. Native ES modules need a real origin, so
opening `index.html` off the filesystem will not work.

```bash
npm test      # no browser needed
npm run build # one self-contained file in dist/
```

There are no dependencies. Not "few", none: no lockfile, no `node_modules`, and
nothing to check the provenance of before it runs.

## The three views

**Diagrams** are the authored views, boxes where a person put them, one level of
detail at a time. Context, containers, then the inside of the stage pipeline,
the delivery tier, the control plane and the player.

**Whole system** is containment rather than communication: every object as a
nested box you open one at a time. It answers "what is inside what", which no
single authored diagram can.

**Blast radius** puts one object in the middle and fans out what feeds it and
what it feeds, with hop counts. EF asked for stability specifically, and the
useful question about any one piece is never "is it reliable" but "what else
stops when it stops".

## Scenarios

Two walkthroughs and six incidents. Each incident ends on a runbook step,
because "what do we actually do" is the part being asked about. Steps cross
diagrams deliberately: playing one carries the canvas with it, so nobody has to
navigate to follow a story.

## Overlays

Filters painted on whatever diagram is already open, instead of a separate
diagram per question. Click a tag to solo it, shift click to hide it. Three
groups: blast radius, where it runs, and technology.

## Keys

| Key | Does |
| --- | --- |
| `K` | Search objects, views and scenarios |
| `1` `2` `3` | Switch view |
| `F` | Fit to view |
| `T` / `I` | Tree / inspector |
| `←` `→` | Step a scenario |
| `Space` | Play or pause |
| `Esc` | Back out of whatever is open |

## Layout

```
src/
  model/     objects, diagrams, flows, tags, validation, derived indexes
  geom/      viewport, edge routing, containment layout   (pure, unit tested)
  render/    the canvas engine, the icon set, three stylesheets
  views/     diagram, systems, impact
  ui/        tree, inspector, overlays, scenarios, chrome
  state/     the store and the URL it serialises to
test/        node --test, no browser
tools/       dev server and the single-file bundler
```

Three things are worth knowing before changing anything.

**The model is three plain literals.** `objects.js`, `diagrams.js` and
`flows.js` have no rendering knowledge at all. Replacing them replaces the
content without touching a view.

**Cross references are validated, not trusted.** An edge naming a node the
diagram does not place, a drill target that no longer exists, a scenario step
pointing at a renamed connection: none of those throw, they just silently render
nothing. `src/model/schema.js` turns every one into a failing test and a refused
build.

**Everything shareable is in the URL.** View, diagram, selection, opened boxes,
focus, overlay, solo and hidden tags, scenario and step. Sending "look at this"
should mean sending a link.

## Deliberate omissions

**Boxes do not move.** This is a reader, not an editor. A layout anyone can drag
is a layout nobody can trust, and there is nowhere to save it back to. IcePanel
draws the same line: its viewer does not move boxes either, only its editor
does.

**No proven / designed / unproven status.** It was tried and cut. Amber does one
job here, which is selection and the drill affordance.

**No minimap.** Also tried and cut.

## Browser notes, learned the hard way

`requestAnimationFrame` never fires in a hidden document, and an embedded
preview pane is a hidden document. Camera glides use `setInterval` so they land
regardless, and nothing correctness bearing waits for a frame.

`clientWidth` reads zero before the grid resolves, so `fitRect` returns `null`
rather than a scale clamped to the minimum with the diagram stranded in a
corner. The caller retries.

Grid regions carry an explicit `grid-column`. Auto-placement shifts the canvas
and the inspector one column left the moment a side column collapses, which
looks exactly like a bug in the canvas.

A collapsed grid column will not reach zero width while it still carries
padding and a border, so both are zeroed with it.
