// 화면 조립과 연결. 맨 마지막에 로드되며 앞선 파일들(Dates/Mood/Store/Calendar/Search)을 쓴다.
(function () {
  var el = {};
  var selected = Dates.today();
  var noteShownFor = null;   // textarea에 어느 날짜 글이 들어 있는지
  var saveTimer = null;
  var searching = false;

  function $(id) { return document.getElementById(id); }

  function init() {
    ['banner', 'calendar', 'searchResults', 'detail', 'q', 'qClear',
      'exportBtn', 'importBtn', 'importFile', 'themeToggle'].forEach(function (id) {
      el[id] = $(id);
    });

    Store.onError(showBanner);
    Store.load();
    // 재설계 전 키가 남아 있으면 한 번만 옮겨 온다. 조용히 데이터가 늘면
    // 혼란스러우므로 옮긴 결과를 알려 준다
    var moved = Store.migrateLegacy();
    if (moved.todos || moved.notes) {
      showBanner('예전 기록을 불러왔습니다 — 할 일 ' + moved.todos + '개, 메모 ' + moved.notes + '일치', 'ok');
    }
    Theme.init(el.themeToggle);

    Calendar.init(el.calendar, { onSelect: select });
    buildDetail();

    el.q.addEventListener('input', onSearchInput);
    el.qClear.addEventListener('click', clearSearch);
    el.exportBtn.addEventListener('click', doExport);
    el.importBtn.addEventListener('click', function () { el.importFile.click(); });
    el.importFile.addEventListener('change', doImport);
    document.addEventListener('keydown', onKeydown);

    // 페이지를 열어둔 채 자정을 넘기면 "오늘" 표시가 어제에 머문다.
    // 창으로 돌아올 때마다 날짜가 바뀌었는지 확인해 다시 그린다
    var openedOn = Dates.today();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (Dates.today() !== openedOn) {
        openedOn = Dates.today();
        refresh();
      }
    });

    select(selected);
  }

  // ───────── 날짜 선택 ─────────

  function select(date) {
    selected = date;
    if (searching) clearSearch();
    Calendar.show(date);
    renderDetail();
  }

  function refresh() {
    Calendar.show(selected);
    renderDetail();
  }

  // ───────── 오른쪽 상세 패널 ─────────
  // 할 일 목록과 머리글만 다시 그리고, textarea는 날짜가 바뀔 때만 값을 갈아 끼운다.
  // 입력 중인 textarea를 다시 만들면 커서와 포커스가 날아가기 때문.

  function buildDetail() {
    el.detail.textContent = '';

    var head = document.createElement('header');
    head.className = 'detail-head';
    el.title = document.createElement('h2');
    el.streak = document.createElement('span');
    el.streak.className = 'streak';
    head.append(el.title, el.streak);

    // 어제 / 오늘 / 내일. 키보드 ← → T 와 같은 동작이라 서로 어긋날 일이 없다
    el.dateNav = document.createElement('div');
    el.dateNav.className = 'date-nav';
    el.prevDay = navBtn('‹ 어제', function () { select(Dates.addDays(selected, -1)); });
    el.todayBtn = navBtn('오늘', function () { select(Dates.today()); });
    el.nextDay = navBtn('내일 ›', function () { select(Dates.addDays(selected, 1)); });
    el.dateNav.append(el.prevDay, el.todayBtn, el.nextDay);

    var moodSec = document.createElement('section');
    moodSec.className = 'block';
    moodSec.appendChild(heading('기분'));
    el.moodRow = document.createElement('div');
    el.moodRow.className = 'mood-row';
    Mood.LEVELS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mood-btn';
      b.dataset.mood = m.value;
      b.title = m.label + ' (' + m.value + ')';
      b.setAttribute('aria-label', m.label);
      var face = document.createElement('span');
      face.className = 'mood-face';
      face.textContent = m.emoji;
      b.appendChild(face);
      b.addEventListener('click', function () { setMood(m.value); });
      el.moodRow.appendChild(b);
    });
    moodSec.appendChild(el.moodRow);

    var todoSec = document.createElement('section');
    todoSec.className = 'block';
    var todoHead = heading('할 일');
    el.todoCount = document.createElement('span');
    el.todoCount.className = 'count';
    todoHead.appendChild(el.todoCount);
    todoSec.appendChild(todoHead);

    el.list = document.createElement('ul');
    el.list.className = 'todo-list';
    todoSec.appendChild(el.list);

    el.empty = document.createElement('p');
    el.empty.className = 'empty';
    el.empty.textContent = '이 날 할 일이 없습니다';
    todoSec.appendChild(el.empty);

    el.todoForm = document.createElement('form');
    el.todoForm.className = 'todo-form';
    el.todoInput = document.createElement('input');
    el.todoInput.type = 'text';
    el.todoInput.placeholder = '할 일을 입력하세요';
    el.todoInput.autocomplete = 'off';
    el.todoInput.setAttribute('aria-label', '할 일');
    var addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'add';
    addBtn.textContent = '추가';
    el.todoForm.append(el.todoInput, addBtn);
    el.todoForm.addEventListener('submit', onAddTodo);
    todoSec.appendChild(el.todoForm);

    el.pull = document.createElement('button');
    el.pull.type = 'button';
    el.pull.className = 'pull';
    el.pull.addEventListener('click', onPull);
    todoSec.appendChild(el.pull);

    var noteSec = document.createElement('section');
    noteSec.className = 'block';
    noteSec.appendChild(heading('기록'));
    el.note = document.createElement('textarea');
    el.note.placeholder = '이 날 있었던 일을 적어보세요';
    el.note.setAttribute('aria-label', '그날의 기록');
    el.note.addEventListener('input', onNoteInput);
    noteSec.appendChild(el.note);
    el.saveState = document.createElement('span');
    el.saveState.className = 'save-state';
    noteSec.appendChild(el.saveState);

    el.detail.append(head, el.dateNav, moodSec, todoSec, noteSec);
  }

  function navBtn(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function heading(text) {
    var h = document.createElement('h3');
    h.textContent = text;
    return h;
  }

  function renderDetail() {
    var day = Store.getDay(selected) || {};
    var isToday = selected === Dates.today();

    el.title.textContent = Dates.formatLong(selected) + (isToday ? ' · 오늘' : '');

    // 이미 오늘이면 눌러도 소용없다. 숨기지 않고 비활성만 해서 자리가 흔들리지 않게 한다
    el.todayBtn.disabled = isToday;

    var days = Store.streak();
    el.streak.textContent = days ? '🔥 ' + days + '일째' : '';

    // 기분 버튼 상태. aria-pressed를 그대로 CSS 선택자로 써서 상태를 한 곳에만 둔다
    Array.prototype.forEach.call(el.moodRow.children, function (b) {
      var on = Number(b.dataset.mood) === day.mood;
      b.setAttribute('aria-pressed', on);
      b.style.setProperty('--btn-mood', 'var(--mood-' + b.dataset.mood + ')');
    });

    renderTodos(day.todos || []);

    // 날짜가 바뀐 경우에만 글을 갈아 끼운다
    if (noteShownFor !== selected) {
      el.note.value = day.note || '';
      noteShownFor = selected;
      el.saveState.textContent = '';
    }
  }

  function renderTodos(todos) {
    el.list.textContent = '';
    todos.forEach(function (todo) {
      var li = document.createElement('li');
      if (todo.done) li.classList.add('done');

      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = todo.done;
      box.setAttribute('aria-label', todo.text);
      box.addEventListener('change', function () {
        Store.toggleTodo(selected, todo.id);
        refresh();
      });

      var text = document.createElement('span');
      text.className = 'text';
      text.textContent = todo.text;
      text.addEventListener('click', function () {
        Store.toggleTodo(selected, todo.id);
        refresh();
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.textContent = '×';
      del.title = '삭제';
      del.setAttribute('aria-label', todo.text + ' 삭제');
      del.addEventListener('click', function () {
        Store.removeTodo(selected, todo.id);
        refresh();
      });

      li.append(box, text, del);
      el.list.appendChild(li);
    });

    var done = todos.filter(function (t) { return t.done; }).length;
    el.todoCount.textContent = todos.length ? done + ' / ' + todos.length : '';
    el.empty.style.display = todos.length ? 'none' : 'block';

    var yesterday = Dates.addDays(selected, -1);
    var pending = Store.pendingOn(yesterday).length;
    el.pull.textContent = '↩ 어제 미완료 ' + pending + '개 가져오기';
    el.pull.style.display = pending ? 'block' : 'none';
  }

  // ───────── 변경 ─────────

  function setMood(value) {
    var day = Store.getDay(selected);
    // 같은 걸 다시 누르면 해제. 잘못 눌렀을 때 되돌릴 길이 있어야 한다
    Store.setMood(selected, day && day.mood === value ? null : value);
    refresh();
  }

  function onAddTodo(e) {
    e.preventDefault();
    var text = el.todoInput.value.trim();
    if (!text) return;
    Store.addTodo(selected, text);
    el.todoInput.value = '';
    refresh();
    el.todoInput.focus();   // 연달아 적을 수 있게 칸을 비우고 그대로 둔다
  }

  function onPull() {
    var moved = Store.pullFrom(Dates.addDays(selected, -1), selected);
    if (moved) refresh();
  }

  // 글은 칠 때마다 저장한다. 다만 '저장됨' 표시는 잠깐 멈췄을 때만 띄워
  // 글자마다 깜빡이지 않게 한다
  function onNoteInput() {
    Store.setNote(selected, el.note.value);
    el.saveState.textContent = '';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      el.saveState.textContent = '자동 저장됨';
    }, 600);
  }

  // ───────── 검색 ─────────

  function onSearchInput() {
    var q = el.q.value;
    if (!q.trim()) { clearSearch(); return; }
    searching = true;
    el.calendar.hidden = true;
    el.searchResults.hidden = false;
    el.qClear.hidden = false;
    Search.render(el.searchResults, q, function (date) {
      el.q.value = '';
      select(date);
    });
  }

  function clearSearch() {
    searching = false;
    el.q.value = '';
    el.searchResults.hidden = true;
    el.searchResults.textContent = '';
    el.calendar.hidden = false;
    el.qClear.hidden = true;
  }

  // ───────── 내보내기 / 가져오기 ─────────

  function download(text, name) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function backupName() {
    return '일기장-' + Dates.today() + '.json';
  }

  function doExport() {
    download(Store.exportJSON(), backupName());
    showBanner('내보냈습니다: ' + backupName(), 'ok');
  }

  function doImport(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';   // 같은 파일을 다시 골라도 change가 걸리도록
    if (!file) return;

    var hasData = Object.keys(Store.all()).length > 0;
    var msg = hasData
      ? '지금 기록을 모두 덮어씁니다. 덮어쓰기 전에 현재 기록을 백업 파일로 내려받습니다. 계속할까요?'
      : '이 파일의 기록을 불러올까요?';
    if (!confirm(msg)) return;
    if (hasData) download(Store.exportJSON(), '일기장-백업-' + Dates.today() + '.json');

    var reader = new FileReader();
    reader.onload = function () {
      var res = Store.importJSON(String(reader.result));
      if (res.ok) {
        noteShownFor = null;
        select(Dates.today());
        showBanner(res.count + '일치 기록을 불러왔습니다.', 'ok');
      } else {
        showBanner('가져오지 못했습니다 — ' + res.message);
      }
    };
    reader.onerror = function () { showBanner('파일을 읽지 못했습니다.'); };
    reader.readAsText(file);
  }

  // ───────── 알림 띠 ─────────

  var bannerTimer = null;
  function showBanner(message, kind) {
    el.banner.textContent = message;
    el.banner.className = 'banner' + (kind === 'ok' ? ' ok' : '');
    el.banner.hidden = false;
    clearTimeout(bannerTimer);
    // 오류는 스스로 사라지지 않게 둔다. 저장 실패를 놓치면 안 되므로
    if (kind === 'ok') {
      bannerTimer = setTimeout(function () { el.banner.hidden = true; }, 3000);
    }
  }

  // ───────── 키보드 ─────────

  function typing() {
    var t = document.activeElement;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (typing()) document.activeElement.blur();
      else if (searching) clearSearch();
      return;
    }
    // 입력 중에는 단축키를 끈다. 글에 'T'를 못 쓰면 안 되니까
    if (typing() || e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === 'ArrowLeft') { select(Dates.addDays(selected, -1)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { select(Dates.addDays(selected, 1)); e.preventDefault(); }
    else if (e.key === 'PageUp') { select(Dates.addMonths(selected, -1)); e.preventDefault(); }
    else if (e.key === 'PageDown') { select(Dates.addMonths(selected, 1)); e.preventDefault(); }
    else if (e.key === 't' || e.key === 'T') { select(Dates.today()); }
    else if (e.key === 'n' || e.key === 'N') { el.note.focus(); e.preventDefault(); }
    else if (e.key === '/') { el.q.focus(); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= '5') { setMood(Number(e.key)); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
