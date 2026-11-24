/* Smooth ampoule outline (V3). The GLB's frosted shell and tapered head are low-poly, so the shoulder and head read as facets.
   This file rebuilds both as lathes from the outline traced off the product photo (小鹿精华1支-正反面.png, alpha-channel half-width
   per row, 63.65 mm tall, 11 mm body). The neck — the narrowest point, where the head snaps off — is at 40.4 mm.
   Units are ampoule millimetres, the same space as the GLB meshes before A_SCALE. */
(function () {
  const THREE = window.THREE;
  const NECK = 40.4;
  // [r, y] control points, bottom → top
  const SHELL = [[5.5, 14.0], [5.5, 30.0], [5.5, 36.6], [5.47, 37.25], [5.3, 37.8], [4.78, 38.5], [4.26, 39.0], [3.76, 39.5], [3.3, 40.0], [3.0, NECK]];
  const HEAD = [[3.0, NECK], [3.04, 41.0], [3.23, 42.0], [3.44, 43.0], [3.64, 44.0], [3.78, 45.0], [3.8, 45.6], [3.74, 46.6], [3.65, 48.0],
    [3.51, 50.0], [3.36, 52.0], [3.22, 54.0], [3.07, 56.0], [2.94, 58.0], [2.79, 60.0], [2.64, 61.0], [2.43, 62.0], [2.1, 62.7], [1.62, 63.2], [0.9, 63.52], [0.0, 63.65]];

  function curve(ctrl, n) {
    const c = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
    return c.getSpacedPoints(n).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
  }
  const shellPts = curve(SHELL, 120), headPts = curve(HEAD, 140);
  // radius of the outer wall at height y (for contents and section rims)
  function radiusAt(y) {
    const pts = y <= NECK ? shellPts : headPts;
    if (y <= pts[0].y) return pts[0].x;
    for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) { const a = pts[i - 1], b = pts[i]; return a.x + (b.x - a.x) * (y - a.y) / Math.max(b.y - a.y, 1e-6); }
    return pts[pts.length - 1].x;
  }

  // replace the shell and head geometry of a loaded ampoule GLB scene (keeps materials, names and transforms)
  function apply(model) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (/reservoir_shell/i.test(o.name)) { o.geometry.dispose(); o.geometry = new THREE.LatheGeometry(shellPts, 128); }
      else if (/tapered_head/i.test(o.name)) {
        o.geometry.dispose();
        // closed at the neck so the snapped head shows a clean disc
        const g = new THREE.LatheGeometry([new THREE.Vector2(0, NECK), ...headPts], 128);
        o.geometry = g;
      }
    });
  }

  // flat ribbon along the outer wall (x = ±r(y)) for the cut-away section, y0 → y1, in the z = zOff plane
  function rimGeometry(y0, y1, width, side, step) {
    const pos = [], idx = [];
    const n = Math.max(2, Math.ceil((y1 - y0) / (step || 0.25)));
    for (let i = 0; i <= n; i++) {
      const y = y0 + (y1 - y0) * i / n, r = radiusAt(y) * side, dy = 0.05;
      const dr = (radiusAt(Math.min(y + dy, y1)) - radiusAt(Math.max(y - dy, y0))) * side, len = Math.hypot(dr, 2 * dy) || 1;
      const nx = (2 * dy) / len * width / 2, ny = -dr / len * width / 2;   // normal to the outline in the plane
      pos.push(r - nx, y - ny, 0, r + nx, y + ny, 0);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  }

  // flat cross-section of the inside (inner wall = outer − wall) from y0 to y1, for section caps
  function sectionGeometry(y0, y1, wall) {
    const s = new THREE.Shape(), n = Math.max(4, Math.ceil((y1 - y0) / 0.25));
    s.moveTo(-(radiusAt(y0) - wall), y0);
    for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; s.lineTo(radiusAt(y) - wall, y); }
    for (let i = n; i >= 0; i--) { const y = y0 + (y1 - y0) * i / n; s.lineTo(-(radiusAt(y) - wall), y); }
    return new THREE.ShapeGeometry(s);
  }

  // solid of revolution of the inside, for the solvent
  function innerLathe(y0, y1, wall, segs) {
    const pts = [new THREE.Vector2(0, y0)], n = Math.max(4, Math.ceil((y1 - y0) / 0.25));
    for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; pts.push(new THREE.Vector2(Math.max(radiusAt(y) - wall, 0.01), y)); }
    pts.push(new THREE.Vector2(0, y1));
    return new THREE.LatheGeometry(pts, segs || 64);
  }

  window.FILM_AMP = { NECK, radiusAt, apply, rimGeometry, sectionGeometry, innerLathe };
})();
