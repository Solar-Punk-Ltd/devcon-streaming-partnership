/**
 * Which model the page is showing.
 *
 * Two independent models live in this tree and in the one built file: the
 * Devcon 8 streaming architecture, which is the default and the reason the
 * explorer exists, and the September MVP of the multi-brand platform. A model
 * is its three literals plus its overlay definitions, and nothing outside
 * this file has to know there is more than one.
 *
 * The choice is made once, synchronously, at module evaluation, from
 * `?model=` on the URL. It has to be synchronous because every derived index
 * downstream is a module-level constant, and it has to survive there being no
 * DOM at all, because the tests and the bundler evaluate this in Node.
 */

import { OBJECTS } from './objects.js';
import { DIAGRAMS } from './diagrams.js';
import { TOUR } from './tour.js';
import { DEVCON_GROUP_DEFS, DEVCON_PLACE_MEMBERS, DEVCON_PLACE_COLOUR } from './tags.js';
import { MVP_OBJECTS } from './mvp/objects.js';
import { MVP_DIAGRAMS } from './mvp/diagrams.js';
import { MVP_TOUR } from './mvp/tour.js';
import { MVP_GROUP_DEFS, MVP_PLACE_MEMBERS, MVP_PLACE_COLOUR } from './mvp/tags.js';

/** The model asked for by a link, when it is not the default. */
export const MVP_MODEL = 'mvp';

export const DEFAULT_MODEL = 'devcon8';

/**
 * Every model, keyed by what a link calls it.
 *
 * `mark` is the two or three characters in the rail, and `open` is what is
 * open on arrival, which for both models is the one system worth being inside
 * rather than looking at.
 */
export const MODELS = {
  [DEFAULT_MODEL]: {
    id: DEFAULT_MODEL,
    mark: 'D8',
    objects: OBJECTS,
    diagrams: DIAGRAMS,
    tour: TOUR,
    groups: DEVCON_GROUP_DEFS,
    places: DEVCON_PLACE_MEMBERS,
    placeColour: DEVCON_PLACE_COLOUR,
    open: ['sys'],
  },
  [MVP_MODEL]: {
    id: MVP_MODEL,
    mark: 'MVP',
    objects: MVP_OBJECTS,
    diagrams: MVP_DIAGRAMS,
    tour: MVP_TOUR,
    groups: MVP_GROUP_DEFS,
    places: MVP_PLACE_MEMBERS,
    placeColour: MVP_PLACE_COLOUR,
    open: ['platform'],
  },
};

/**
 * The model a query string asks for. Anything unknown is the default rather
 * than an error, the same way the store ignores query keys it does not know:
 * a mistyped link should show the usual thing, not a blank page.
 */
export function modelFrom(search) {
  const asked = new URLSearchParams(search || '').get('model');
  return asked && MODELS[asked] ? asked : DEFAULT_MODEL;
}

export const MODEL_ID = modelFrom(typeof location === 'undefined' ? '' : location.search);

export const MODEL = MODELS[MODEL_ID];
