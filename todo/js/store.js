// localStorage 접근은 전부 여기를 거친다. 다른 파일은 localStorage를 직접 만지지 않는다.
//
// 저장 구조 (localStorage['diary']):
//   { version: 1, days: { 'YYYY-MM-DD': { mood: 1~5, note: '글', todos: [{id, text, done}] } } }
//
// - 날짜 키는 'YYYY-MM-DD' 문자열 그대로 (Dates 주석 참고)
// - 내용이 하나도 없는 날은 키 자체를 지운다. 빈 껍데기가 쌓이면 내보낸 파일만 커진다
// - 예전 키(todos/sortBy/notes)는 읽지 않는다. 다만 혹시 모르니 지우지도 않는다
var Store = (function () {
  var KEY = 'diary';
  var VERSION = 1;
  var data = { version: VERSION, days: {} };
  var onError = null;   // 저장 실패를 화면에 알리기 위한 통로

  function emptyData() {
    return { version: VERSION, days: {} };
  }

  function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  // 들어온 값이 무엇이든 쓸 수 있는 모양으로 깎아낸다.
  // 직접 고친 파일이나 깨진 저장값이 들어와도 앱이 죽지 않아야 한다
  function sanitize(raw) {
    if (!isPlainObject(raw) || !isPlainObject(raw.days)) return null;
    var out = emptyData();
    Object.keys(raw.days).forEach(function (date) {
      if (!Dates.isValid(date)) return;
      var src = raw.days[date];
      if (!isPlainObject(src)) return;
      var day = {};
      if (typeof src.mood === 'number' && src.mood >= 1 && src.mood <= 5) {
        day.mood = Math.round(src.mood);
      }
      if (typeof src.note === 'string' && src.note) day.note = src.note;
      if (Array.isArray(src.todos)) {
        var todos = src.todos.filter(function (t) {
          return isPlainObject(t) && typeof t.text === 'string' && t.text;
        }).map(function (t) {
          return { id: typeof t.id === 'string' && t.id ? t.id : newId(), text: t.text, done: !!t.done };
        });
        if (todos.length) day.todos = todos;
      }
      if (Object.keys(day).length) out.days[date] = day;
    });
    return out;
  }

  function newId() {
    // Date.now()는 같은 밀리초에 추가하면 겹친다. 겹친 id는 엉뚱한 항목을 지우게 만든다
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    return Math.random().toString(36).slice(2, 10);
  }

  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY));
      var clean = sanitize(parsed);
      data = clean || emptyData();
    } catch (e) {
      data = emptyData();
    }
    return data;
  }

  // 저장 실패를 조용히 삼키지 않는다. 할 일이면 몰라도 일기가 안 써진 걸 모르면 안 된다
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      var full = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      if (onError) {
        onError(full
          ? '저장 공간이 가득 찼습니다. 내보내기로 백업한 뒤 오래된 기록을 정리해 주세요.'
          : '저장하지 못했습니다. 브라우저가 저장을 막고 있는지 확인해 주세요.');
      }
      return false;
    }
  }

  function getDay(date) {
    return data.days[date] || null;
  }

  function ensureDay(date) {
    if (!data.days[date]) data.days[date] = {};
    return data.days[date];
  }

  // 내용이 비면 날짜 키째 치운다. 모든 변경 끝에 한 번 불러준다
  function prune(date) {
    var day = data.days[date];
    if (!day) return;
    if (day.todos && !day.todos.length) delete day.todos;
    if (!day.note) delete day.note;
    if (day.mood === undefined && !day.note && !day.todos) delete data.days[date];
  }

  function setMood(date, mood) {
    var day = ensureDay(date);
    if (mood === null) delete day.mood;
    else day.mood = mood;
    prune(date);
    return save();
  }

  function setNote(date, text) {
    var day = ensureDay(date);
    if (text) day.note = text;
    else delete day.note;
    prune(date);
    return save();
  }

  function todosOf(date) {
    var day = data.days[date];
    return (day && day.todos) || [];
  }

  function addTodo(date, text) {
    var day = ensureDay(date);
    if (!day.todos) day.todos = [];
    day.todos.push({ id: newId(), text: text, done: false });
    save();
  }

  function toggleTodo(date, id) {
    todosOf(date).forEach(function (t) {
      if (t.id === id) t.done = !t.done;
    });
    save();
  }

  function removeTodo(date, id) {
    var day = data.days[date];
    if (!day || !day.todos) return;
    day.todos = day.todos.filter(function (t) { return t.id !== id; });
    prune(date);
    save();
  }

  // 손으로 하는 이월. 자동으로 끌고 오지 않는 이유는 "이걸 진짜 할 건가"를
  // 한 번 묻게 하기 위해서다 (불릿 저널의 마이그레이션과 같은 뜻)
  function pendingOn(date) {
    return todosOf(date).filter(function (t) { return !t.done; });
  }

  function pullFrom(fromDate, toDate) {
    var moving = pendingOn(fromDate);
    if (!moving.length) return 0;
    var target = ensureDay(toDate);
    if (!target.todos) target.todos = [];
    moving.forEach(function (t) {
      target.todos.push({ id: newId(), text: t.text, done: false });
    });
    var src = data.days[fromDate];
    src.todos = src.todos.filter(function (t) { return t.done; });
    prune(fromDate);
    save();
    return moving.length;
  }

  // 연속 기록: 오늘(또는 어제)부터 거꾸로, 내용이 있는 날이 몇 번 이어지는지.
  // 오늘 아직 안 썼으면 어제부터 세서 하루 쉬었다고 0이 되지 않게 한다
  function streak() {
    var cursor = Dates.today();
    if (!hasContent(cursor)) {
      cursor = Dates.addDays(cursor, -1);
      if (!hasContent(cursor)) return 0;
    }
    var n = 0;
    while (hasContent(cursor)) {
      n++;
      cursor = Dates.addDays(cursor, -1);
    }
    return n;
  }

  function hasContent(date) {
    var day = data.days[date];
    return !!(day && (day.mood !== undefined || day.note || (day.todos && day.todos.length)));
  }

  function monthSummary(year, month) {
    var dates = Object.keys(data.days).filter(function (d) {
      return Dates.sameMonth(d, year, month);
    });
    var moods = dates.map(function (d) { return data.days[d].mood; })
      .filter(function (m) { return m !== undefined; });
    var avg = moods.length
      ? Math.round(moods.reduce(function (a, b) { return a + b; }, 0) / moods.length)
      : null;
    return { count: dates.length, avgMood: avg };
  }

  // ───────── 예전 데이터 복구 ─────────
  // 재설계 전에 쓰던 키(todos / notes)가 브라우저에 남아 있으면 새 구조로 옮긴다.
  // 옛 키는 지우지 않는다 — 복구가 잘못돼도 되돌릴 수 있어야 하므로.
  //
  // 마감일(due)은 되살리지 않는다. 할 일이 그날에 속하는 지금 모델에서는
  // 마감일 개념이 없기 때문. 다만 '어느 날짜에 붙일지' 정하는 근거로는 쓴다.
  var MIGRATED_KEY = 'diaryMigratedV1';

  function readLegacy(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function migrateLegacy() {
    var done = { todos: 0, notes: 0 };
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return done;
    } catch (e) {
      return done;   // 저장소를 못 읽으면 아예 건드리지 않는다
    }

    var oldNotes = readLegacy('notes');
    if (isPlainObject(oldNotes)) {
      Object.keys(oldNotes).forEach(function (date) {
        if (!Dates.isValid(date) || typeof oldNotes[date] !== 'string' || !oldNotes[date]) return;
        var day = ensureDay(date);
        // 새 앱에서 이미 쓴 글이 있으면 건너뛴다. 옛 글에 밀려 사라지면 안 된다
        if (day.note) return;
        day.note = oldNotes[date];
        done.notes++;
      });
    }

    var oldTodos = readLegacy('todos');
    if (Array.isArray(oldTodos)) {
      var today = Dates.today();
      oldTodos.forEach(function (t) {
        if (!isPlainObject(t) || typeof t.text !== 'string' || !t.text) return;
        // 마감일이 있으면 그 날짜로, 없거나 망가졌으면 오늘로 붙인다
        var date = (typeof t.due === 'string' && Dates.isValid(t.due)) ? t.due : today;
        var day = ensureDay(date);
        if (!day.todos) day.todos = [];
        // 기존 목록 뒤에 붙인다. id는 새로 매긴다 — 옛 id는 Date.now()라 서로 겹칠 수 있고,
        // 겹친 id는 엉뚱한 항목을 지운다
        day.todos.push({ id: newId(), text: t.text, done: !!t.done });
        done.todos++;
      });
    }

    // 옮길 게 없었어도 플래그는 세운다. 매번 옛 키를 훑지 않도록.
    // diary 안이 아니라 별도 키에 두는 이유: 가져오기로 diary를 통째로 바꿔도
    // 마이그레이션이 다시 살아나면 안 되기 때문
    try { localStorage.setItem(MIGRATED_KEY, '1'); } catch (e) {}
    if (done.todos || done.notes) {
      Object.keys(data.days).forEach(prune);
      save();
    }
    return done;
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  // 가져오기는 받아들이기 전에 반드시 검사한다. 통과하지 못하면 기존 데이터를 건드리지 않는다
  function importJSON(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, message: 'JSON 형식이 아닙니다.' };
    }
    if (!isPlainObject(parsed) || !isPlainObject(parsed.days)) {
      return { ok: false, message: '일기장 파일이 아닙니다.' };
    }
    if (parsed.version !== VERSION) {
      return { ok: false, message: '버전이 다릅니다 (파일 ' + parsed.version + ' / 앱 ' + VERSION + ').' };
    }
    var clean = sanitize(parsed);
    if (!clean) return { ok: false, message: '내용을 읽을 수 없습니다.' };
    var previous = data;
    data = clean;
    if (!save()) {
      data = previous;   // 저장에 실패하면 되돌린다
      return { ok: false, message: '저장하지 못해 가져오기를 취소했습니다.' };
    }
    return { ok: true, count: Object.keys(clean.days).length };
  }

  return {
    load: load, save: save, all: function () { return data.days; },
    getDay: getDay, todosOf: todosOf, hasContent: hasContent,
    setMood: setMood, setNote: setNote,
    addTodo: addTodo, toggleTodo: toggleTodo, removeTodo: removeTodo,
    pendingOn: pendingOn, pullFrom: pullFrom,
    streak: streak, monthSummary: monthSummary,
    migrateLegacy: migrateLegacy,
    exportJSON: exportJSON, importJSON: importJSON,
    onError: function (fn) { onError = fn; }
  };
})();
