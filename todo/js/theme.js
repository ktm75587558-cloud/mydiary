// 라이트/다크 토글. 두 페이지가 같은 파일을 쓰므로 한쪽을 고치면 양쪽이 같이 바뀐다.
// (예전에는 페이지마다 복사돼 있어서 서로 갈라져 있었다)
//
// 화면 번쩍임을 막는 <head>의 인라인 스크립트는 이 파일로 옮기지 않는다.
// 외부 파일은 로드가 한 박자 늦어 흰 화면이 먼저 그려지기 때문.
var Theme = (function () {
  var KEY = 'theme';
  var toggle = null;

  function current() {
    return document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    if (toggle) toggle.textContent = theme === 'dark' ? '☀️ 라이트' : '🌙 다크';
  }

  // 토글 버튼을 넘기면 글자까지 관리해 준다. 버튼이 없는 페이지에서도 동작해야 함
  function init(toggleEl) {
    toggle = toggleEl || null;
    apply(current());
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      // 저장은 직접 눌렀을 때만. 값이 없으면 OS 설정을 계속 따라간다
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  return { init: init, current: current };
})();
