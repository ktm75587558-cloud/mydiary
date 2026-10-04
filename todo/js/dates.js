// 날짜 계산. 저장 형식은 어디서나 'YYYY-MM-DD' 문자열 하나로 통일한다.
//
// 이 형식을 고집하는 이유:
//  - <input type="date">가 주는 값 그대로라 변환이 없다 (시간대 영향 없음)
//  - 문자열 비교만으로 날짜 순서가 맞는다
//  - JSON으로 내보내고 들여올 때 그대로 오간다
//
// 절대 쓰지 말 것:
//  - toISOString().slice(0,10) → UTC라서 한국 시간 오전 9시 전엔 어제가 나온다
//  - new Date('2026-09-30')    → UTC 자정으로 읽혀 음수 시간대에선 하루 밀린다
var Dates = (function () {
  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  function pad(n) { return String(n).padStart(2, '0'); }

  // Date 객체 → 'YYYY-MM-DD' (현지 기준)
  function toStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 'YYYY-MM-DD' → Date (현지 자정). 'T00:00:00'이 빠지면 UTC로 읽히므로 꼭 붙인다
  function parse(s) {
    return new Date(s + 'T00:00:00');
  }

  function today() {
    return toStr(new Date());
  }

  function isValid(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = parse(s);
    // 2026-02-31 같은 값은 3월로 굴러가므로, 되돌려 찍어 원래 문자열과 같은지 본다
    return !isNaN(d) && toStr(d) === s;
  }

  function addDays(s, n) {
    var d = parse(s);
    d.setDate(d.getDate() + n);
    return toStr(d);
  }

  // 달을 옮길 때 일(日)이 그 달에 없으면 말일로 당긴다 (1/31 → 2/28)
  function addMonths(s, n) {
    var d = parse(s);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
    return toStr(d);
  }

  function daysInMonth(year, month) {
    // 다음 달 0일 = 이번 달 말일
    return new Date(year, month + 1, 0).getDate();
  }

  // 달력에 깔 칸 목록. 앞뒤 빈칸을 null로 채워 항상 7의 배수로 맞춘다
  function monthGrid(year, month) {
    var first = new Date(year, month, 1);
    var lead = first.getDay();
    var total = daysInMonth(year, month);
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= total; i++) cells.push(year + '-' + pad(month + 1) + '-' + pad(i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function yearOf(s) { return Number(s.slice(0, 4)); }
  function monthOf(s) { return Number(s.slice(5, 7)) - 1; }   // 0-based
  function dayOf(s) { return Number(s.slice(8, 10)); }
  function weekday(s) { return parse(s).getDay(); }

  function formatLong(s) {
    return (monthOf(s) + 1) + '월 ' + dayOf(s) + '일 (' + WEEKDAYS[weekday(s)] + ')';
  }

  function formatMonth(year, month) {
    return year + '년 ' + (month + 1) + '월';
  }

  function sameMonth(s, year, month) {
    return yearOf(s) === year && monthOf(s) === month;
  }

  return {
    toStr: toStr, parse: parse, today: today, isValid: isValid,
    addDays: addDays, addMonths: addMonths, daysInMonth: daysInMonth,
    monthGrid: monthGrid, yearOf: yearOf, monthOf: monthOf, dayOf: dayOf,
    weekday: weekday, formatLong: formatLong, formatMonth: formatMonth,
    sameMonth: sameMonth, WEEKDAYS: WEEKDAYS
  };
})();
