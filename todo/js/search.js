// 일기 검색. 기록이 쌓일수록 달력만으로는 몇 달 전 일을 못 찾기 때문에 넣는다.
//
// 인덱스를 따로 두지 않는다 — 데이터가 전부 메모리에 있고 수백 일이어야 수백 건이라
// 입력할 때마다 훑어도 체감되지 않는다. 느려지면 그때 인덱스를 고민한다.
var Search = (function () {
  var MAX = 50;

  function run(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var days = Store.all();
    var results = [];

    Object.keys(days).sort().reverse().forEach(function (date) {
      if (results.length >= MAX) return;
      var day = days[date];
      var hits = [];

      if (day.note && day.note.toLowerCase().indexOf(q) !== -1) {
        hits.push({ kind: 'note', text: day.note });
      }
      (day.todos || []).forEach(function (t) {
        if (t.text.toLowerCase().indexOf(q) !== -1) {
          hits.push({ kind: 'todo', text: t.text, done: t.done });
        }
      });

      if (hits.length) results.push({ date: date, hits: hits });
    });

    return results;
  }

  // 일치한 부분만 <mark>로 감싼다. innerHTML을 쓰지 않는 규칙을 지키려고
  // 문자열을 잘라 createTextNode와 createElement를 번갈아 붙인다
  function highlight(text, query, maxLen) {
    var frag = document.createDocumentFragment();
    var q = query.trim().toLowerCase();
    var lower = text.toLowerCase();
    var at = lower.indexOf(q);

    // 일치 지점이 뒤쪽이면 그 앞을 잘라내 발췌한다
    var start = 0;
    if (at > 30) {
      start = at - 30;
      text = '…' + text.slice(start);
      lower = text.toLowerCase();
      at = lower.indexOf(q);
    }
    if (maxLen && text.length > maxLen) text = text.slice(0, maxLen) + '…';
    lower = text.toLowerCase();

    var cursor = 0;
    while (q) {
      var i = lower.indexOf(q, cursor);
      if (i === -1) break;
      if (i > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, i)));
      var m = document.createElement('mark');
      m.textContent = text.slice(i, i + q.length);
      frag.appendChild(m);
      cursor = i + q.length;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    return frag;
  }

  function render(root, query, onPick) {
    root.textContent = '';
    var results = run(query);

    var head = document.createElement('p');
    head.className = 'search-count';
    head.textContent = results.length
      ? '검색 결과 ' + results.length + '일' + (results.length >= MAX ? ' (상위 ' + MAX + '일)' : '')
      : '찾는 내용이 없습니다';
    root.appendChild(head);

    results.forEach(function (r) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-item';
      item.dataset.date = r.date;

      var d = document.createElement('span');
      d.className = 'search-date';
      d.textContent = Dates.formatLong(r.date);
      item.appendChild(d);

      r.hits.forEach(function (hit) {
        var line = document.createElement('span');
        line.className = 'search-hit ' + hit.kind;
        if (hit.kind === 'todo') {
          var box = document.createElement('span');
          box.className = 'search-check';
          box.textContent = hit.done ? '☑' : '☐';
          line.appendChild(box);
        }
        line.appendChild(highlight(hit.text, query, 120));
        item.appendChild(line);
      });

      item.addEventListener('click', function () { onPick(r.date); });
      root.appendChild(item);
    });
  }

  return { run: run, render: render, highlight: highlight };
})();
