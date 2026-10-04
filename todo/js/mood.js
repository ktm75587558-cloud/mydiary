// 기분 5단계. 숫자(1~5)만 저장하고 보이는 모양은 전부 여기서 정한다.
// 글을 쓰지 않아도 한 번 눌러 기록이 남게 하는 게 목적 — 빈 일기장 앞에서 막히지 않도록.
var Mood = (function () {
  var LEVELS = [
    { value: 1, emoji: '😖', label: '아주 나쁨' },
    { value: 2, emoji: '😕', label: '나쁨' },
    { value: 3, emoji: '😐', label: '보통' },
    { value: 4, emoji: '🙂', label: '좋음' },
    { value: 5, emoji: '😄', label: '아주 좋음' }
  ];

  function get(value) {
    return LEVELS[value - 1] || null;
  }

  function emoji(value) {
    var m = get(value);
    return m ? m.emoji : '';
  }

  function label(value) {
    var m = get(value);
    return m ? m.label : '';
  }

  return { LEVELS: LEVELS, get: get, emoji: emoji, label: label };
})();
