// Practice landing: random session generator & random prompts.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function buildPool() {
    var pool = [];
    var data = window.ART_EXERCISES || {};
    Object.keys(data).forEach(function (catKey) {
      var cat = data[catKey];
      cat.items.forEach(function (item) {
        pool.push({
          id: item.id,
          name: item.name,
          minutes: item.minutes,
          category: catKey,
          categoryName: cat.title,
          page: cat.page
        });
      });
    });
    return pool;
  }

  // Greedy pick: shuffle, take exercises while total stays within target+tolerance.
  function buildSession(targetMinutes) {
    var pool = shuffle(buildPool());
    var chosen = [];
    var total = 0;
    var tolerance = 5;
    for (var i = 0; i < pool.length; i++) {
      if (total >= targetMinutes) break;
      var ex = pool[i];
      if (total + ex.minutes <= targetMinutes + tolerance) {
        chosen.push(ex);
        total += ex.minutes;
      }
    }
    return { exercises: chosen, total: total };
  }

  // TODO: replace these placeholder prompts with your own list per category.
  var PROMPTS = {
    environment: [
      'A foggy forest at dawn',
      'A bustling night market',
      'An underwater coral city',
      'A desert oasis after a sandstorm'
    ],
    character: [
      'A steampunk inventor with a mechanical pet',
      'A forest spirit guarding an ancient tree',
      'A wandering bard in a tavern'
    ],
    fantasy: [
      'A dragon librarian in a crystal cave',
      'A floating island kingdom at sunset',
      "A wizard's overgrown garden"
    ]
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pickPrompt(category) {
    var pool;
    if (category === 'all') {
      pool = [];
      Object.keys(PROMPTS).forEach(function (k) { pool = pool.concat(PROMPTS[k]); });
    } else {
      pool = PROMPTS[category] || [];
    }
    return pool.length ? pick(pool) : 'No prompts in that category yet.';
  }

  function renderSession(target, session) {
    if (!session.exercises.length) {
      target.innerHTML = '<p>No exercises available &mdash; add some to <code>assets/js/artpractice/exercises.js</code>.</p>';
      return;
    }
    var html = '<p class="session-total">Today’s session &mdash; <strong>' + session.total + ' min</strong></p><ul class="session-list">';
    session.exercises.forEach(function (ex) {
      html +=
        '<li class="session-item">' +
          '<span class="session-item__category">' + escapeHtml(ex.categoryName) + '</span>' +
          '<span class="session-item__name"><a href="' + ex.page + '#' + escapeHtml(ex.id) + '">' + escapeHtml(ex.name) + '</a></span>' +
          '<span class="session-item__time">' + ex.minutes + ' min</span>' +
        '</li>';
    });
    html += '</ul>';
    target.innerHTML = html;
  }

  window.initSessionGenerator = function () {
    var generateBtn    = document.querySelector('[data-practice-generate]');
    var modeSelect     = document.querySelector('[data-practice-mode]');
    var minutesInput   = document.querySelector('[data-practice-minutes]');
    var categorySelect = document.querySelector('[data-practice-category]');
    var sessionLabel   = document.querySelector('[data-session-only]');
    var promptLabel    = document.querySelector('[data-prompt-only]');
    var question       = document.querySelector('[data-practice-question]');

    function generate() {
      if (!question) return;
      var mode = modeSelect ? modeSelect.value : 'session';
      if (mode === 'session') {
        var minutes = minutesInput ? parseInt(minutesInput.value, 10) : 25;
        if (!minutes || minutes < 1) minutes = 25;
        renderSession(question, buildSession(minutes));
      } else {
        var cat = categorySelect ? categorySelect.value : 'all';
        question.innerHTML = '<p>' + escapeHtml(pickPrompt(cat)) + '</p>';
      }
    }

    function onModeChange() {
      var isPrompt = modeSelect && modeSelect.value === 'prompt';
      if (sessionLabel) sessionLabel.hidden = isPrompt;
      if (promptLabel)  promptLabel.hidden  = !isPrompt;
    }

    if (modeSelect)   modeSelect.addEventListener('change', onModeChange);
    if (generateBtn)  generateBtn.addEventListener('click', generate);
    onModeChange();
  };
})();
