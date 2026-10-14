(() => {
  document.documentElement.classList.add('has-project-dialogs');
  const projects = {
    mefense: {
      number: '01', title: 'MeFense', type: '개인 프로젝트 · 3개월',
      line: '수학 자체가 전략이 되는 3D FPS 타워 디펜스',
      summary: '플레이어가 직접 싸우고 포탑을 건설합니다. 포탑의 수학적 항과 연산 카드를 조합해 시간에 따라 달라지는 성능을 설계합니다.',
      sections: [
        ['01 / 기획 의도', '단순한 수치 업그레이드 대신 수식 구성, 배치, 전력망이 서로 다른 전략으로 이어지는 게임을 만들었습니다.'],
        ['02 / 직접 구현', '게임 규칙, 수식 계산, 포탑 AI, 전력망, 절차적 맵, 웨이브, 1인칭 전투와 UI를 혼자 설계하고 구현했습니다. Unity C#과 AI Navigation, Input System을 활용했습니다.'],
        ['03 / 설계의 균형', '수학은 쉽게 이해되면서도 전략적이어야 했습니다. 특정 함수만으로 전투가 무너지지 않게 조정하고, 직접 전투와 포탑 방어가 각각 필요하도록 역할을 나눴습니다.'],
        ['04 / 어려웠던 점', 'Unity 에디터에서는 정상적이었지만 WebGL 배포에서는 한글·수학 기호가 사라지고 발광 효과와 UI 아이콘이 다르게 보였습니다. 단순히 문구를 바꾸는 것으로는 해결되지 않았습니다.'],
        ['05 / 원인과 해결', '브라우저 콘솔과 Unity 로그를 확인해 폰트 대체와 빌드 중 셰이더 제거를 원인으로 분리했습니다. 한글·기호 폰트를 프로젝트에 포함하고 UI에 공통 적용했으며, 런타임 셰이더를 빌드에 명시했습니다. 이모지는 AI로 제작한 텍스처 아이콘으로 교체하고 16:9 화면과 임베드 영역을 맞췄습니다.'],
        ['06 / 검증 결과', '실제 itch.io에서 10회 넘게 재배포하며 에디터와 웹 화면이 일치하는지 확인했습니다. 반복되는 WebGL 설정은 전용 빌드 메뉴로 자동화해 재발 가능성을 줄였습니다.']
      ],
      links: [['PLAY', 'https://shinseonguk.itch.io/mefense'], ['GITHUB', 'https://github.com/shin-seong-yuk/MeFense'], ['VIDEO', 'assets/video/mefense-intro-ko.mp4']]
    },
    'exit-from': {
      number: '02', title: 'EXIT_FROM', type: '개인 프로젝트 · 6개월',
      line: '자신의 행동을 재현하는 고스트와 탈출하는 퍼즐 액션',
      summary: '실험실을 배경으로 압력판, 레이저, 움직이는 발판과 고스트 전용 문을 조합해 탈출합니다. 퍼즐 시스템은 점차 타인을 도구로 바라보는 시선에 대한 질문으로 이어집니다.',
      sections: [
        ['01 / 핵심 시스템', '플레이어의 움직임을 기록하고 재생하는 고스트를 구현했습니다. 고스트는 다른 경로를 이동하며 장치를 작동시키고, 플레이어와 협력해 퍼즐을 풉니다.'],
        ['02 / 레벨 디자인', '장애물을 계속 추가하기보다 기존 장치와 맵 구조를 새롭게 조합했습니다. 구현과 테스트를 거치며 난이도와 공간의 흐름을 다듬었습니다.'],
        ['03 / 어려웠던 점', '처음에는 모든 기믹을 미리 만든 뒤 스테이지만 조합하려 했습니다. 하지만 구현해 보니 예상보다 재미없는 기믹도 있었고, 테스트에 따라 좋은 조합이 달라져 초기 계획을 고정하기 어려웠습니다.'],
        ['04 / 해결과 결과', '새 기능을 무조건 늘리기보다 수정·확장이 쉬운 구조로 기존 장치를 정리했습니다. 압력판·레이저·움직이는 발판·고스트 전용 문과 맵의 동선을 새롭게 조합해 퍼즐의 난도를 높였습니다.'],
        ['05 / 디자인 제약을 푼 방식', '디자인 경험이 부족해 복잡한 캐릭터를 만드는 대신 캡슐 형태를 선택했습니다. 이를 실험체 설정과 ‘타인을 도구처럼 보는 시선’이라는 이야기로 연결했습니다. 첫 배포에서 튜토리얼이 없어 플레이어가 시작을 어려워한다는 점도 직접 관찰했습니다.']
      ],
      links: [['PLAY', 'https://shinseonguk.itch.io/exit-from']]
    },
    'not-a-cat': {
      number: '03', title: 'Not A Cat', type: '6인 팀 프로젝트 · 2026.07~',
      line: '고양이 조직에 숨은 첩자 ‘삵’을 찾는 직업 기반 추리 게임',
      summary: '직업 능력, 미션, 대화에서 얻은 단서를 엮어 서로의 정체를 추리하는 팀 프로젝트입니다.',
      sections: [
        ['01 / 나의 역할', '기획과 개발을 담당했습니다. 맵·직업 구성, 게임 규칙과 흐름 설정, 맵 구현, 미션 구성과 구현, 텍스트·보이스 채팅 구현이 제 작업입니다.'],
        ['02 / 기획과 구현의 연결', '맵 동선, 직업 능력과 미션이 실제 한 판의 플레이 흐름에서 맞물리도록 게임 로직을 구성하고 구현했습니다.'],
        ['03 / 기술 활용', 'Unity와 C#으로 맵과 게임 로직, 미션 시스템을 구성했습니다. 채팅 시스템은 플레이어 사이의 정보 교환이 게임의 추리 경험으로 이어지도록 구현했습니다.'],
        ['04 / 어려웠던 점', '팀 안에서 차별화 요소를 정하는 시점에 대한 생각이 달랐습니다. 저는 검증된 게임의 기본 구조를 먼저 만들어 개발 속도를 확보하고 싶었지만, 동료는 고유한 아이디어를 먼저 정해야 기능이 게임 전체에 자연스럽게 녹아든다고 보았습니다.'],
        ['05 / 조율과 결과', '동료가 걱정한 게임의 완성도와 제가 우려한 일정 지연을 함께 고려했습니다. 기본 구조 개발은 이어가되 아이디어 논의도 꾸준히 병행하는 방안을 제안했고, 팀이 이에 합의했습니다. 현재 두 작업을 함께 진행하며 출시를 향해 개발하고 있습니다.']
      ],
      links: [['GITHUB', 'https://github.com/Apptive-Game-Team/mafia'], ['VIDEO', 'assets/video/not-a-cat-intro-ko.mp4']]
    },
    elevator: {
      number: '04', title: 'Elevator', type: '개인 프로젝트',
      line: '매 층의 방해를 버티며 최후의 1인을 가리는 물리 파티 게임',
      summary: '좁은 엘리베이터에서 무기로 싸우고 층마다 달라지는 방해 요소에 대응합니다. 싱글 AI 전투와 Steam 기반 멀티플레이를 목표로 구성했습니다.',
      sections: [
        ['01 / 직접 구현', '기획부터 전투, 층별 방해 요소, AI 상대와 멀티플레이 흐름을 혼자 구현했습니다. 좁은 공간과 환경 변화가 매번 다른 전투를 만들도록 설계했습니다.'],
        ['02 / 멀티플레이 기술', 'Unity C#, Netcode for GameObjects, Steamworks.NET을 활용했습니다. Steam 로그인 후 방을 생성·참가하고 준비 상태를 맞춰 게임을 시작하는 흐름을 구현했습니다.'],
        ['03 / 플레이 방식', '싱글에서는 AI와 전투하고 멀티에서는 다른 플레이어와 대결합니다. Input System으로 조작을, AI Navigation으로 AI 이동을 구성했습니다. Steam 출시 여부와는 별개로 현재 구현된 기능을 소개합니다.'],
        ['04 / 제작의 어려움', '게임에 필요한 모델을 직접 만들어야 했습니다. 이미 정해진 디자인을 구현하는 일이 아니라, 상상한 형태를 실제 게임 안의 모델로 구체화하는 과정 자체가 도전이었습니다. 모델 제작에는 AI도 보조 도구로 활용했습니다.'],
        ['05 / 조작에서 발견한 문제', '상대를 붙잡아 끌고 가는 동작에서 상대가 반대 방향으로 입력하면 끌기가 성립하지 않았습니다. 액션의 핵심 상호작용이 플레이어의 기대와 다르게 작동하는 문제였습니다.'],
        ['06 / 조정과 확인', '카메라 움직임과 캐릭터 동작 시간을 직접 조정했습니다. 3초의 동작 구간 중 2.8초는 입력을 반영하고 0.2초는 입력을 받지 않도록 해 끌기 동작이 성립하게 했습니다. 수정 후에는 직접 플레이하며 조작과 상호작용을 확인했습니다.'],
        ['07 / 설계에서 얻은 관점', '조작감은 입력을 무조건 즉시 반영하는 것만으로 완성되지 않는다고 생각합니다. 플레이어가 의도한 행동이 게임 안에서 실제로 성립하도록, 입력 반응과 캐릭터 간 상호작용의 균형을 함께 설계해야 합니다.']
      ],
      links: [['GITHUB', 'https://github.com/shin-seong-yuk/Elevator']]
    }
  };

  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dialogs = new Map();
  for (const [key, project] of Object.entries(projects)) {
    const dialog = document.createElement('dialog');
    dialog.className = 'project-dialog';
    dialog.id = key + '-detail';
    dialog.setAttribute('aria-labelledby', key + '-dialog-title');
    dialog.innerHTML = `<div class="dialog-shell">
      <div class="dialog-top"><span>PROJECT ${project.number} / CASE STUDY</span><button type="button" class="dialog-close" aria-label="${escapeHTML(project.title)} 상세 닫기">닫기 <span aria-hidden="true">×</span></button></div>
      <div class="dialog-content">
        <p class="eyebrow">${escapeHTML(project.type)}</p>
        <h2 id="${key}-dialog-title">${escapeHTML(project.title)}</h2>
        <p class="dialog-line">${escapeHTML(project.line)}</p>
        <p class="dialog-summary">${escapeHTML(project.summary)}</p>
        <nav class="dialog-project-switcher" aria-label="다른 프로젝트 선택"><span>SELECT PROJECT</span>${Object.entries(projects).map(([projectKey, item]) => `<button type="button" data-project="${projectKey}"${projectKey === key ? ' aria-current="true"' : ''}>${escapeHTML(item.number)} ${escapeHTML(item.title)}</button>`).join('')}</nav>
        <div class="dialog-sections">${project.sections.map(([title, body]) => `<section><h3>${escapeHTML(title)}</h3><p>${escapeHTML(body)}</p></section>`).join('')}</div>
        <nav class="dialog-links" aria-label="${escapeHTML(project.title)} 관련 링크">${project.links.map(([label, url]) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`).join('')}</nav>
      </div>
      <div class="dialog-bottom"><span>SHIN SEONG UK / GAME DEVELOPMENT</span><button type="button" class="dialog-close">프로젝트로 돌아가기 ↑</button></div>
    </div>`;
    document.body.append(dialog);
    dialog.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.querySelectorAll('.dialog-project-switcher button').forEach(button => button.addEventListener('click', () => { if (button.dataset.project !== key) openProject(button.dataset.project); }));
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.querySelectorAll('video').forEach(video => video.pause()); document.body.classList.remove('modal-open'); });
    dialogs.set(key, dialog);
  }

  function openProject(key) {
    const dialog = dialogs.get(key);
    if (!dialog) return false;
    document.querySelectorAll('video').forEach(video => video.pause());
    document.querySelectorAll('.project-dialog[open]').forEach(open => open.close());
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('modal-open');
    return true;
  }
  window.openPortfolioProject = openProject;
  document.querySelectorAll('.project-title-link').forEach(link => {
    const key = link.closest('.project')?.id;
    if (!dialogs.has(key)) return;
    link.setAttribute('href', '#' + key + '-detail');
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-label', projects[key].title + ' 상세 팝업 열기');
    link.addEventListener('click', event => { event.preventDefault(); openProject(key); });
  });
  document.querySelectorAll('.hero-featured a').forEach(link => {
    const key = link.getAttribute('href')?.slice(1);
    if (!dialogs.has(key)) return;
    link.setAttribute('href', '#' + key + '-detail');
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => { event.preventDefault(); openProject(key); });
  });
})();
