# What IcePanel does, and what is borrowed

Notes from working through the live IcePanel app on 2026-08-03, using their
public demo landscape. Recorded so the reasoning behind this tool's shape does
not have to be reconstructed later.

## Their shape

The app is not one diagramming canvas. It is a model with several views over
it, reached from a permanent left rail:

| Their view | What it answers | Here |
| --- | --- | --- |
| Diagrams | How does this talk to that, at one level of detail | **Diagrams** |
| Model viewer | What is inside what, as nested boxes | **Whole system** |
| Dependencies | What feeds this, what does it feed | **Blast radius** |
| Flows | Step through data moving over an existing diagram | **Scenarios** |
| Model objects, Connections, Technologies | Catalogues of the same model | not built |
| Decision records | ADRs attached to the model | not built |

The point they make well: **one model, many views, no duplicated diagrams.**
Their own copy for the tag feature is "apply visual filters on diagrams to show
different views. No extra diagram required." That is the idea worth stealing,
more than any particular pixel.

## Borrowed, on purpose

**Card anatomy.** Every box is the same four things in the same order: icon
plus name, one line of description, then a monospace technology line prefixed
by the object's type (`App: Cloud Run, Node, REST`). A corner badge shows the
child count and doubles as the drill affordance. That mono line is what makes a
box read as an engineering artifact rather than a shape on a slide, and it is
the single cheapest thing to copy.

**Flows dim everything else.** During a flow step, objects not taking part drop
to a low opacity rather than disappearing, so the shape of the whole system
stays readable behind the part being explained. This tool had highlighting
already; it did not have the dimming, and the dimming is most of the effect.

**Tags as a painted overlay.** A chip bar along the bottom, one chip per tag
with a count, and coloured stripes on every card carrying that tag. Hovering a
chip offers focus and hide. Here the same mechanism carries blast radius, which
is the question EF actually asked.

**Dependencies as a focus and context fan.** Incoming on the left, the focus
object in the middle, outgoing on the right, with counts in the column
headings. For an architecture whose organising principle is blast radius, this
turned out to be the most useful single view, so it got hop counts on top.

**Everything is in the URL.** Their viewer round-trips the diagram, the model,
the overlay tab, the selected tag group, and even the viewport rectangle as
`x1,y1,x2,y2`. Sharing a view is sharing a link. Copied, minus the viewport
rectangle, which pins a camera rather than an idea.

**Drill in zooms into the box.** Opening a container animates the box scaling up
to fill the frame rather than cutting to a new diagram, which keeps the reader
oriented.

## Not borrowed, on purpose

**Colour from vendor logos.** Their canvas is near monochrome and every scrap of
colour comes from technology brand marks: Firebase orange, GitLab orange, Azure
blue. It looks good, and it is the right call for a tool whose users are mapping
SaaS estates. It is wrong here: half this architecture is Swarm, ffmpeg and
SRT, which have no logos anyone recognises, and the other half is generic. So
the icon set is shape-led instead, a store reads as a cylinder and a network as
a hexagon, and colour is reserved for meaning.

**Moving boxes.** Their *editor* moves boxes. Their *viewer* does not. This is a
viewer.

**The catalogue views.** Model objects, connections and technologies are three
sortable tables over the same data. Useful at their scale, which is hundreds of
objects across many teams. This model has 38 objects and a tree that already
shows all of them, so a table would be a second way to look at a short list.

**Decision records.** The right idea, but the decisions for this project already
live in the plan document, and a second home for them would go stale.

**Status.** They have a Live and Deprecated status overlay. A similar idea was
tried here and cut by the person who has to read this, so it is not coming back.

## One thing they do that is still missing here

Their flow step labels stack on the connection itself: a single edge used by
steps 1 and 4 shows both numbers, in order, on the line. It makes a whole flow
legible at a glance without playing it. Worth adding.
