// 월간 달력. 그릴 때마다 통째로 다시 만든다 (부분 갱신 없음).
// 날짜 칸은 <button>이라 탭 이동과 엔터가 그냥 된다 — div로 만들면 직접 붙여야 한다.
var Calendar = (function () {
  var root = null;
  var state = { year: 0, month: 0, selected: '', onSelect: null };

  function init(el, opts) {
    root = el;
    state.onSelect = opts.onSelect;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-date]');
      if (btn && state.onSelect) state.onSelect(btn.dataset.date);
    });
  }

  function show(date) {
    state.selected = date;
    state.year = Dates.yearOf(date);
    state.month = Dates.monthOf(date);
    render();
  }

  // 날짜를 고르지 않고 달만 넘길 때. 선택은 그대로 둔다
  function shiftMonth(n) {
    var anchor = state.year + '-' + String(state.month + 1).padStart(2, '0') + '-01';
    var moved = Dates.addMonths(anchor, n);
    state.year = Dates.yearOf(moved);
    state.month = Dates.monthOf(moved);
    render();
  }

  function render() {
    if (!root) return;
    root.textContent = '';
    var today = Dates.today();

    var head = document.createElement('div');
    head.className = 'cal-head';
    // '오늘' 버튼은 상세 패널의 날짜 이동 줄에 있다. 같은 일을 하는 버튼이
    // 두 군데 있으면 헷갈리므로 여기서는 달 이동만 맡는다
    head.append(
      navButton('‹', '이전 달', -1),
      title(),
      navButton('›', '다음 달', 1)
    );
    root.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'cal-grid';
    Dates.WEEKDAYS.forEach(function (w, i) {
      var cell = document.createElement('div');
      cell.className = 'cal-dow';
      if (i === 0) cell.classList.add('sun');
      if (i === 6) cell.classList.add('sat');
      cell.textContent = w;
      grid.appendChild(cell);
    });

    Dates.monthGrid(state.year, state.month).forEach(function (date) {
      grid.appendChild(date ? dayCell(date, today) : blankCell());
    });
    root.appendChild(grid);
    root.appendChild(summary());
  }

  function title() {
    var h = document.createElement('h2');
    h.className = 'cal-title';
    h.textContent = Dates.formatMonth(state.year, state.month);
    return h;
  }

  function navButton(label, aria, delta) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-nav';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', function () { shiftMonth(delta); });
    return b;
  }

  function blankCell() {
    var d = document.createElement('div');
    d.className = 'cal-cell empty';
    return d;
  }

  function dayCell(date, today) {
    var day = Store.getDay(date);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-cell';
    btn.dataset.date = date;

    var dow = Dates.weekday(date);
    if (dow === 0) btn.classList.add('sun');
    if (dow === 6) btn.classList.add('sat');
    if (date === today) btn.classList.add('today');
    if (date === state.selected) {
      btn.classList.add('selected');
      btn.setAttribute('aria-current', 'date');
    }

    // 기분이 있으면 셀 배경을 그 색의 옅은 톤으로. 색은 CSS가 --cell-mood로 받는다
    if (day && day.mood !== undefined) {
      btn.classList.add('has-mood');
      btn.style.setProperty('--cell-mood', 'var(--mood-' + day.mood + ')');
    }

    var num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = Dates.dayOf(date);
    btn.appendChild(num);

    var marks = document.createElement('span');
    marks.className = 'cal-marks';
    // 기분 없이 내용만 있는 날은 점으로만 알린다. 전부 색칠하면 달력이 시끄러워진다
    if (day && day.note) marks.appendChild(mark('note', '기록 있음'));
    if (day && day.todos && day.todos.length) {
      var left = day.todos.filter(function (t) { return !t.done; }).length;
      marks.appendChild(mark(left ? 'todo' : 'todo done', left ? left + '개 남음' : '할 일 모두 완료'));
    }
    btn.appendChild(marks);

    btn.setAttribute('aria-label', Dates.formatLong(date) + describe(day));
    return btn;
  }

  function mark(cls, label) {
    var s = document.createElement('span');
    s.className = 'mark ' + cls;
    s.title = label;
    return s;
  }

  function describe(day) {
    if (!day) return '';
    var parts = [];
    if (day.mood !== undefined) parts.push('기분 ' + day.mood);
    if (day.note) parts.push('기록 있음');
    if (day.todos && day.todos.length) {
      parts.push('할 일 ' + day.todos.filter(function (t) { return t.done; }).length + '/' + day.todos.length);
    }
    return parts.length ? ', ' + parts.join(', ') : '';
  }

  function summary() {
    var s = Store.monthSummary(state.year, state.month);
    var p = document.createElement('p');
    p.className = 'cal-summary';
    if (!s.count) {
      p.textContent = '이번 달 기록 없음';
      return p;
    }
    var text = '이번 달 ' + s.count + '일 기록';
    if (s.avgMood) text += ' · 평균 ' + Mood.emoji(s.avgMood);
    p.textContent = text;
    return p;
  }

  return { init: init, show: show, render: render, shiftMonth: shiftMonth };
})();
