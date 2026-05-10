// Basics page: section picker, procedural SVG generators, description, timer.
// Lines section is timer + description only.
// Ellipses section has procedural generators for table / curved / funnel.
(function () {
  var SECTIONS = {
    lines:    { title: 'Lines',    items: ['superimposed-lines', 'ghost-lines', 'planes'] },
    ellipses: { title: 'Ellipses', items: ['ellipses-table', 'ellipses-curved', 'ellipses-in-planes', 'funnels'] }
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function svgWrap(inner) {
    return '<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img">' + inner + '</svg>';
  }

  // ── Generators ────────────────────────────────────────────────

  // 3×3 table. Each cell holds one ellipse whose larger axis is clamped to
  // min(cellW/2, cellH/2) − padding so the rotated AABB always fits the cell.
  function genTableOfEllipses() {
    var W = 600, H = 400;
    var cols = 3, rows = 3;
    var cellW = W / cols, cellH = H / rows;
    var padding = 10;
    var maxR = Math.min(cellW / 2 - padding, cellH / 2 - padding);
    var out = [];

    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" stroke="#704415" stroke-width="1.5" fill="none"/>');
    for (var c = 1; c < cols; c++) {
      out.push('<line x1="' + (c * cellW) + '" y1="0" x2="' + (c * cellW) + '" y2="' + H + '" stroke="#704415" stroke-width="1.5"/>');
    }
    for (var r = 1; r < rows; r++) {
      out.push('<line x1="0" y1="' + (r * cellH) + '" x2="' + W + '" y2="' + (r * cellH) + '" stroke="#704415" stroke-width="1.5"/>');
    }

    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        var cx = cc * cellW + cellW / 2;
        var cy = rr * cellH + cellH / 2;
        var rx = rand(maxR * 0.5, maxR * 0.95);
        var ry = rand(maxR * 0.2, rx * 0.8);
        var rot = rand(0, 180);
        out.push(
          '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
          '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) +
          '" transform="rotate(' + rot.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')' +
          '" stroke="#2a2620" stroke-width="2" fill="none"/>'
        );
      }
    }
    return svgWrap(out.join(''));
  }

  // 3×3 table where each cell either has a single ellipse, or a curve that
  // crosses the cell from left edge to right edge with one ellipse in the
  // upper region and one in the lower region. Ellipses sized to fit strictly
  // inside the rectangle bounded by the cell edges and the curve's extreme y.
  function genCurvedEllipses() {
    var W = 600, H = 400;
    var cols = 3, rows = 3;
    var cellW = W / cols, cellH = H / rows;
    var padding = 10;
    var maxR = Math.min(cellW / 2 - padding, cellH / 2 - padding);
    var out = [];

    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" stroke="#704415" stroke-width="1.5" fill="none"/>');
    for (var c = 1; c < cols; c++) {
      out.push('<line x1="' + (c * cellW) + '" y1="0" x2="' + (c * cellW) + '" y2="' + H + '" stroke="#704415" stroke-width="1.5"/>');
    }
    for (var r = 1; r < rows; r++) {
      out.push('<line x1="0" y1="' + (r * cellH) + '" x2="' + W + '" y2="' + (r * cellH) + '" stroke="#704415" stroke-width="1.5"/>');
    }

    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        var x0 = cc * cellW + padding;
        var x1 = cc * cellW + cellW - padding;
        var y0 = rr * cellH + padding;
        var y1 = rr * cellH + cellH - padding;
        var cx = (x0 + x1) / 2;
        var cy = (y0 + y1) / 2;

        if (Math.random() < 0.45) {
          // Curve crosses from left edge to right edge through the middle band.
          var startY = rand(y0 + (y1 - y0) * 0.40, y0 + (y1 - y0) * 0.60);
          var endY   = rand(y0 + (y1 - y0) * 0.40, y0 + (y1 - y0) * 0.60);
          var ctrlY  = rand(y0 + (y1 - y0) * 0.25, y0 + (y1 - y0) * 0.75);
          out.push(
            '<path d="M ' + x0.toFixed(1) + ' ' + startY.toFixed(1) +
            ' Q ' + cx.toFixed(1) + ' ' + ctrlY.toFixed(1) +
            ' ' + x1.toFixed(1) + ' ' + endY.toFixed(1) +
            '" stroke="#2a2620" stroke-width="2" fill="none" stroke-linecap="round"/>'
          );

          // Bezier convex hull: curve y stays within [min, max] of the 3 ys.
          var minCurveY = Math.min(startY, ctrlY, endY);
          var maxCurveY = Math.max(startY, ctrlY, endY);

          // Upper half — fits between y0 and minCurveY.
          var upperH = minCurveY - y0;
          if (upperH > 26) {
            var upperR = Math.min(cellW / 2 - padding, upperH / 2 - 4);
            var rx1 = rand(upperR * 0.5, upperR);
            var ry1 = rand(upperR * 0.2, rx1 * 0.85);
            var rot1 = rand(0, 180);
            var ucy = y0 + upperH / 2;
            out.push(
              '<ellipse cx="' + cx.toFixed(1) + '" cy="' + ucy.toFixed(1) +
              '" rx="' + rx1.toFixed(1) + '" ry="' + ry1.toFixed(1) +
              '" transform="rotate(' + rot1.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + ucy.toFixed(1) + ')' +
              '" stroke="#2a2620" stroke-width="2" fill="none"/>'
            );
          }

          // Lower half — fits between maxCurveY and y1.
          var lowerH = y1 - maxCurveY;
          if (lowerH > 26) {
            var lowerR = Math.min(cellW / 2 - padding, lowerH / 2 - 4);
            var rx2 = rand(lowerR * 0.5, lowerR);
            var ry2 = rand(lowerR * 0.2, rx2 * 0.85);
            var rot2 = rand(0, 180);
            var lcy = maxCurveY + lowerH / 2;
            out.push(
              '<ellipse cx="' + cx.toFixed(1) + '" cy="' + lcy.toFixed(1) +
              '" rx="' + rx2.toFixed(1) + '" ry="' + ry2.toFixed(1) +
              '" transform="rotate(' + rot2.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + lcy.toFixed(1) + ')' +
              '" stroke="#2a2620" stroke-width="2" fill="none"/>'
            );
          }
        } else {
          // Single ellipse, full cell.
          var rx = rand(maxR * 0.5, maxR * 0.95);
          var ry = rand(maxR * 0.2, rx * 0.8);
          var rot = rand(0, 180);
          out.push(
            '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
            '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) +
            '" transform="rotate(' + rot.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')' +
            '" stroke="#2a2620" stroke-width="2" fill="none"/>'
          );
        }
      }
    }
    return svgWrap(out.join(''));
  }

  // Real-3D funnel: a cone in 3D space projected through a tilted perspective
  // camera. Each cross-section is an actual 3D circle, projected as a polyline
  // of 48 points (mathematically an ellipse). Walls are silhouette generatrices.
  function genFunnel() {
    var W = 600, H = 400;

    // 3D cone along the world Z axis, narrow at z = -L/2, wide at z = +L/2.
    var L  = rand(180, 240);
    var r0 = rand(8, 14);   // narrow radius
    var r1 = rand(55, 80);  // wide radius

    // Camera tilt — bias yaw away from zero so the cone is always clearly tilted.
    var yaw   = (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.85);
    var pitch = rand(-0.25, 0.25);

    // Perspective camera looking down +z, scene pushed forward by cameraZ.
    var cameraZ = rand(330, 380);
    var f       = 350; // focal length
    var screenCx = W / 2 + rand(-30, 30);
    var screenCy = H / 2 + rand(-20, 20);

    function project(x, y, z) {
      // Yaw (around Y axis)
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var x1 =  x * cy + z * sy;
      var z1 = -x * sy + z * cy;
      // Pitch (around X axis)
      var cp = Math.cos(pitch), sp = Math.sin(pitch);
      var y2 = y * cp - z1 * sp;
      var z2 = y * sp + z1 * cp;
      var x2 = x1;
      // Translate scene in front of camera
      z2 += cameraZ;
      if (z2 < 1) return null;
      return { x: screenCx + x2 * f / z2, y: screenCy + y2 * f / z2, z: z2 };
    }

    function radiusAt(z) { return r0 + ((z + L / 2) / L) * (r1 - r0); }

    function projectedCirclePath(r, z) {
      var n = 48;
      var first = project(r, 0, z);
      if (!first) return null;
      var d = 'M ' + first.x.toFixed(1) + ' ' + first.y.toFixed(1);
      for (var i = 1; i < n; i++) {
        var th = i * 2 * Math.PI / n;
        var p = project(r * Math.cos(th), r * Math.sin(th), z);
        if (!p) return null;
        d += ' L ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      }
      return d + ' Z';
    }

    var out = [];

    // Centre axis (projected)
    var axA = project(0, 0, -L / 2);
    var axB = project(0, 0,  L / 2);
    if (axA && axB) {
      out.push('<line x1="' + axA.x.toFixed(1) + '" y1="' + axA.y.toFixed(1) +
               '" x2="' + axB.x.toFixed(1) + '" y2="' + axB.y.toFixed(1) +
               '" stroke="#704415" stroke-width="1.5"/>');
    }

    // Silhouette walls — find the two generatrix angles whose projected wide-edge
    // points are extreme along the perpendicular to the projected axis.
    if (axA && axB) {
      var axDx = axB.x - axA.x, axDy = axB.y - axA.y;
      var axL  = Math.sqrt(axDx * axDx + axDy * axDy) || 1;
      var perpX2D = -axDy / axL, perpY2D = axDx / axL;
      function signedDist(p) { return (p.x - axA.x) * perpX2D + (p.y - axA.y) * perpY2D; }
      var thetaPlus = 0, thetaMinus = 0;
      var maxPos = -Infinity, maxNeg = Infinity;
      for (var i = 0; i < 144; i++) {
        var th = i * 2 * Math.PI / 144;
        var pw = project(r1 * Math.cos(th), r1 * Math.sin(th),  L / 2);
        if (!pw) continue;
        var sd = signedDist(pw);
        if (sd > maxPos) { maxPos = sd; thetaPlus  = th; }
        if (sd < maxNeg) { maxNeg = sd; thetaMinus = th; }
      }
      var nP = project(r0 * Math.cos(thetaPlus),  r0 * Math.sin(thetaPlus),  -L / 2);
      var wP = project(r1 * Math.cos(thetaPlus),  r1 * Math.sin(thetaPlus),   L / 2);
      var nM = project(r0 * Math.cos(thetaMinus), r0 * Math.sin(thetaMinus), -L / 2);
      var wM = project(r1 * Math.cos(thetaMinus), r1 * Math.sin(thetaMinus),  L / 2);
      if (nP && wP) {
        out.push('<line x1="' + nP.x.toFixed(1) + '" y1="' + nP.y.toFixed(1) +
                 '" x2="' + wP.x.toFixed(1) + '" y2="' + wP.y.toFixed(1) +
                 '" stroke="#704415" stroke-width="1.5"/>');
      }
      if (nM && wM) {
        out.push('<line x1="' + nM.x.toFixed(1) + '" y1="' + nM.y.toFixed(1) +
                 '" x2="' + wM.x.toFixed(1) + '" y2="' + wM.y.toFixed(1) +
                 '" stroke="#704415" stroke-width="1.5"/>');
      }
    }

    // Cross-sections placed so consecutive ellipses just touch along the axis.
    // For a circle of radius r at z, the projected minor axis (along the cone
    // axis direction) is r·cos(yaw)·f/z2; in 3D z, that's a step of 2r — so
    // touching ellipses come from stepping z by r_i + r_{i+1}.
    var circles = [];
    var z = -L / 2;
    var safety = 40;
    while (z <= L / 2 + 1 && safety-- > 0) {
      var r = radiusAt(z);
      var d = projectedCirclePath(r, z);
      if (d) {
        var c = project(0, 0, z);
        circles.push({ d: d, depth: c ? c.z : 0 });
      }
      var rNext = radiusAt(Math.min(L / 2, z + 2 * r));
      var nextZ = z + r + rNext;
      if (nextZ > L / 2 + 0.1) break;
      z = nextZ;
    }
    // Far-to-near so closer cross-sections overlay farther ones.
    circles.sort(function (a, b) { return b.depth - a.depth; });
    circles.forEach(function (c) {
      out.push('<path d="' + c.d + '" stroke="#2a2620" stroke-width="2" fill="none"/>');
    });

    return svgWrap(out.join(''));
  }

  var GENERATORS = {
    'ellipses-table':  genTableOfEllipses,
    'ellipses-curved': genCurvedEllipses,
    'funnels':         genFunnel
  };

  function findExerciseById(id) {
    var data = (window.ART_EXERCISES || {}).basics;
    if (!data) return null;
    for (var i = 0; i < data.items.length; i++) {
      if (data.items[i].id === id) return data.items[i];
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Page init ────────────────────────────────────────────────

  window.initBasicsPage = function () {
    var sectionSelect = document.querySelector('[data-section-pick]');
    var generateBtn   = document.querySelector('[data-generate]');
    var canvas        = document.querySelector('[data-canvas]');
    var timerEl       = document.querySelector('[data-timer]');
    var nameEl        = document.querySelector('[data-timer-name]');
    var timeEl        = document.querySelector('[data-timer-time]');
    var toggleBtn     = document.querySelector('[data-timer-toggle]');
    var resetBtn      = document.querySelector('[data-timer-reset]');

    var seconds = 0, running = false, intervalId = null;

    function format(s) {
      s = Math.max(0, s | 0);
      var m = Math.floor(s / 60), sec = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }
    function render() {
      if (timeEl)   timeEl.textContent = format(seconds);
      if (toggleBtn) toggleBtn.textContent = running ? 'Pause' : 'Resume';
    }
    function tick() {
      seconds -= 1;
      if (seconds <= 0) {
        seconds = 0;
        running = false;
        clearInterval(intervalId);
        intervalId = null;
        if (timerEl) timerEl.classList.add('is-done');
      }
      render();
    }
    function startTimer(minutes, name) {
      if (!timerEl) return;
      if (intervalId) clearInterval(intervalId);
      seconds = minutes * 60;
      running = true;
      timerEl.hidden = false;
      timerEl.classList.remove('is-done');
      if (nameEl) nameEl.textContent = name;
      render();
      intervalId = setInterval(tick, 1000);
    }
    function toggleTimer() {
      if (seconds <= 0) return;
      if (running) {
        clearInterval(intervalId);
        intervalId = null;
        running = false;
      } else {
        running = true;
        intervalId = setInterval(tick, 1000);
      }
      render();
    }
    function resetTimer() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      running = false;
      seconds = 0;
      if (timerEl) {
        timerEl.hidden = true;
        timerEl.classList.remove('is-done');
      }
    }

    function showExercise(id) {
      var exercise = findExerciseById(id);
      if (!exercise || !canvas) return;
      var gen = GENERATORS[id];
      var description = exercise.description
        ? '<p class="practice-canvas__desc">' + exercise.description + '</p>'
        : '';
      var inner = gen ? gen() : '';
      canvas.innerHTML =
        '<h3 class="practice-canvas__title">' + escapeHtml(exercise.name) + '</h3>' +
        description + inner;
      startTimer(exercise.minutes, exercise.name);
    }

    function generate() {
      var sectionKey = sectionSelect ? sectionSelect.value : 'any';
      var poolIds;
      if (sectionKey === 'any' || !SECTIONS[sectionKey]) {
        poolIds = [];
        Object.keys(SECTIONS).forEach(function (k) { poolIds = poolIds.concat(SECTIONS[k].items); });
      } else {
        poolIds = SECTIONS[sectionKey].items.slice();
      }
      if (!poolIds.length) return;
      showExercise(pick(poolIds));
    }

    if (generateBtn) generateBtn.addEventListener('click', generate);
    if (toggleBtn)   toggleBtn.addEventListener('click', toggleTimer);
    if (resetBtn)    resetBtn.addEventListener('click', resetTimer);

    // Hash deep link from the Practice landing's session generator.
    if (location.hash) {
      var id = location.hash.slice(1);
      if (findExerciseById(id)) {
        for (var s in SECTIONS) {
          if (SECTIONS[s].items.indexOf(id) > -1) {
            if (sectionSelect) sectionSelect.value = s;
            break;
          }
        }
        showExercise(id);
      }
    }
  };
})();
