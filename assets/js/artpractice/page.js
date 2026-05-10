// Per-category page: renders the exercise list and runs a shared timer.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function format(seconds) {
    seconds = Math.max(0, seconds | 0);
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  window.initExercisePage = function (categoryKey) {
    var data = (window.ART_EXERCISES || {})[categoryKey];
    var listEl = document.querySelector('[data-exercise-list]');
    if (!data || !listEl) return;

    listEl.innerHTML = '';
    data.items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'exercise';
      li.id = item.id;
      li.dataset.minutes = item.minutes;
      li.innerHTML =
        '<div class="exercise__name">' + escapeHtml(item.name) + '</div>' +
        '<div class="exercise__time">' + item.minutes + ' min</div>' +
        '<button class="exercise__start" type="button" data-start="' + escapeHtml(item.id) + '" data-minutes="' + item.minutes + '">Start</button>';
      listEl.appendChild(li);
    });

    var timerEl   = document.querySelector('[data-timer]');
    var nameEl    = document.querySelector('[data-timer-name]');
    var timeEl    = document.querySelector('[data-timer-time]');
    var toggleBtn = document.querySelector('[data-timer-toggle]');
    var resetBtn  = document.querySelector('[data-timer-reset]');

    var seconds = 0;
    var running = false;
    var intervalId = null;

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

    function start(exerciseId, minutes, name) {
      if (!timerEl) return;
      if (intervalId) clearInterval(intervalId);
      seconds = minutes * 60;
      running = true;
      timerEl.hidden = false;
      timerEl.classList.remove('is-done');
      if (nameEl) nameEl.textContent = name;
      document.querySelectorAll('.exercise').forEach(function (el) { el.classList.remove('is-active'); });
      var active = document.getElementById(exerciseId);
      if (active) active.classList.add('is-active');
      render();
      intervalId = setInterval(tick, 1000);
    }

    function toggle() {
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

    function reset() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      running = false;
      seconds = 0;
      if (timerEl) {
        timerEl.hidden = true;
        timerEl.classList.remove('is-done');
      }
      document.querySelectorAll('.exercise').forEach(function (el) { el.classList.remove('is-active'); });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-start]');
      if (!btn) return;
      var id = btn.getAttribute('data-start');
      var minutes = parseInt(btn.getAttribute('data-minutes'), 10);
      var nameNode = btn.parentElement && btn.parentElement.querySelector('.exercise__name');
      var name = nameNode ? nameNode.textContent : id;
      start(id, minutes, name);
    });

    if (toggleBtn) toggleBtn.addEventListener('click', toggle);
    if (resetBtn)  resetBtn.addEventListener('click', reset);

    // If we arrived via /…/#exercise-id, scroll to and highlight that exercise.
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target && target.classList.contains('exercise')) {
        target.classList.add('is-active');
      }
    }
  };
})();
