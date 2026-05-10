// ─── Art practice exercises ──────────────────────────────────────────
// Edit this file to add/change exercises per category.
// Each exercise needs: id (slug used in URLs), name (display text), minutes.
// `page` is the absolute URL of the category page on this site.

window.ART_EXERCISES = {
  basics: {
    title: 'Basics',
    page: '/artpractice/basics/',
    items: [
      {
        id: 'superimposed-lines', name: 'Superimposed lines', minutes: 5, section: 'lines',
        description: 'Draw a line with a ruler, then superimpose on it freehand 8 times.'
      },
      {
        id: 'ghost-lines', name: 'Ghost lines', minutes: 5, section: 'lines',
        description: 'Draw two points and connect them with straight lines.'
      },
      {
        id: 'planes', name: 'Planes', minutes: 8, section: 'lines',
        description: 'Draw 4 points and connect them into a plane. Fill the page with non-intersecting planes, then add 8 diagonals and cross-sections.'
      },
      {
        id: 'ellipses-table', name: 'Table of ellipses', minutes: 10, section: 'ellipses',
        description: 'Draw a table and fill the cells with ellipses of these shapes.'
      },
      {
        id: 'ellipses-curved', name: 'Ellipses with curves', minutes: 10, section: 'ellipses',
        description: 'In cells with a curved line, draw the curve and place ellipses in the two parts it creates.'
      },
      {
        id: 'ellipses-in-planes', name: 'Ellipses in planes', minutes: 12, section: 'ellipses',
        description: 'Draw 4 points and connect them into a plane; fill the page with non-intersecting planes. Then draw an ellipse inside each plane so it touches all four sides.'
      },
      {
        id: 'funnels', name: 'Funnels', minutes: 10, section: 'ellipses',
        description: 'Draw a centre line and two arcs forming a funnel. Place rotating ellipses along it &mdash; narrow near the centre, widening toward the side.'
      }
    ]
  },
  lighting: {
    title: 'Lighting',
    page: '/artpractice/lighting/',
    items: [
      { id: 'value-scale',     name: 'Five-step value scale',         minutes: 5 },
      { id: 'sphere-shading',  name: 'Sphere with one light source',  minutes: 10 },
      { id: 'cast-shadow',     name: 'Cube with cast shadow',         minutes: 12 }
    ]
  },
  perspective: {
    title: 'Perspective',
    page: '/artpractice/perspective/',
    items: [
      { id: 'one-point-cubes',    name: 'One-point cubes',          minutes: 8 },
      { id: 'two-point-room',     name: 'Two-point room interior',  minutes: 15 },
      { id: 'three-point-tower',  name: 'Three-point tower',        minutes: 12 }
    ]
  },
  'colour-theory': {
    title: 'Colour Theory',
    page: '/artpractice/colour-theory/',
    items: [
      { id: 'hue-wheel',           name: 'Hue wheel from primaries',     minutes: 10 },
      { id: 'values-of-one-hue',   name: 'Values of a single hue',       minutes: 8 },
      { id: 'palette-from-photo',  name: 'Palette from reference photo', minutes: 15 }
    ]
  }
};
