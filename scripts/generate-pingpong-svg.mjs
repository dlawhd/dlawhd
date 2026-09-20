/**
 * GitHub의 실제 기여 달력을 민트색 탁구대 SVG로 만드는 프로그램입니다.
 * 3단계: 공이 일곱 줄의 잔디를 차례로 지나갈 때, 닿은 칸이 사라집니다.
 *
 * 기존 GitHub Actions는 이 파일을 실행하여 dist/pingpong.svg를 게시합니다.
 * 실행 예: GITHUB_USER=dlawhd GITHUB_TOKEN=... node scripts/generate-pingpong-svg.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// GitHub의 기여 단계(5단계)를 README의 민트색 팔레트에 대응시킵니다.
const COLORS = {
  NONE: '#EAF7F0',
  FIRST_QUARTILE: '#BFEAD5',
  SECOND_QUARTILE: '#83D3AE',
  THIRD_QUARTILE: '#42AB82',
  FOURTH_QUARTILE: '#176B54',
};

// 애니메이션 길이와 탁구대 위치는 여기에서 한 번만 설정합니다.
const GAME = {
  width: 960,
  height: 280,
  firstBallX: 68,        // 왼쪽 탁구채 바로 앞의 공 중심입니다.
  lastBallX: 892,        // 오른쪽 탁구채 바로 앞의 공 중심입니다.
  cellSize: 10,          // 잔디 한 칸의 크기입니다.
  cellGap: 4,            // 잔디 사이의 간격입니다.
  gridTop: 104,         // 첫 번째 잔디 줄의 위쪽 위치입니다.
  sweepSeconds: 2.1,    // 탁구공이 잔디 한 줄을 왕복 없이 횡단하는 시간입니다.
  turnSeconds: 0.22,    // 탁구채에 닿은 후 다음 잔디 줄로 이동하는 시간입니다.
  pauseSeconds: 1.5,    // 모든 잔디가 없어진 모습을 보여주는 시간입니다.
};

/** GitHub GraphQL API에서 실제 날짜별 기여 기록을 가져옵니다. */
export async function fetchCalendar(username, token) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || !token) {
    throw new Error('GITHUB_USER 또는 GITHUB_TOKEN 설정을 확인해 주세요.');
  }

  // 실제 GitHub 잔디의 날짜, 요일, 기여 횟수와 색상 단계를 요청합니다.
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { date weekday contributionCount contributionLevel }
          }
        }
      }
    }
  }`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { login: username } }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`GitHub API 응답 오류: HTTP ${response.status}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(`GitHub GraphQL 오류: ${json.errors[0].message}`);

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length === 0) {
    throw new Error('GitHub 기여 달력을 가져오지 못했습니다.');
  }
  return calendar;
}

/** 같은 시간표를 공과 탁구채가 함께 사용하도록 이동 경로를 만듭니다. */
function makeTimeline() {
  const step = GAME.cellSize + GAME.cellGap;
  const points = [{ time: 0, x: GAME.firstBallX, y: GAME.gridTop + GAME.cellSize / 2 }];
  const rowStartTimes = [];
  let time = 0;

  // 실제 잔디의 7개 요일 줄을 지그재그로 전부 지나갑니다.
  for (let row = 0; row < 7; row += 1) {
    const x = row % 2 === 0 ? GAME.lastBallX : GAME.firstBallX;
    const y = GAME.gridTop + row * step + GAME.cellSize / 2;
    rowStartTimes.push(time);
    time += GAME.sweepSeconds;
    points.push({ time, x, y });

    // 한쪽 패들에 닿으면 방향을 바꾸면서 아래쪽 다음 줄로 이동합니다.
    if (row < 6) {
      time += GAME.turnSeconds;
      points.push({ time, x, y: y + step });
    }
  }

  // 전부 지워진 탁구대를 잠깐 보여준 뒤 처음부터 반복합니다.
  time += GAME.pauseSeconds;
  points.push({ time, x: points.at(-1).x, y: points.at(-1).y });

  return { points, rowStartTimes, duration: time };
}

/** SVG가 공의 이동과 같은 시간에 잔디를 지우도록 시간 값을 계산합니다. */
function getHitTime(columnX, row, timeline) {
  const x = columnX + GAME.cellSize / 2;
  const startX = row % 2 === 0 ? GAME.firstBallX : GAME.lastBallX;
  const distance = Math.abs(x - startX);
  const fullDistance = GAME.lastBallX - GAME.firstBallX;
  return timeline.rowStartTimes[row] + (distance / fullDistance) * GAME.sweepSeconds;
}

/** 실제 달력 자료로 탁구대와 잔디 제거 애니메이션 SVG를 생성합니다. */
export function renderSvg(calendar) {
  const weeks = calendar?.weeks;
  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 54) {
    throw new Error('GitHub 기여 달력의 주차 데이터가 올바르지 않습니다.');
  }
  if (!Number.isInteger(calendar.totalContributions) || calendar.totalContributions < 0) {
    throw new Error('총 기여 횟수가 올바르지 않습니다.');
  }

  const timeline = makeTimeline();
  const pitch = GAME.cellSize + GAME.cellGap;
  const gridWidth = weeks.length * pitch - GAME.cellGap;
  const gridLeft = (GAME.width - gridWidth) / 2;
  const cells = [];
  const seenDates = new Set();
  let activeDays = 0;

  weeks.forEach((week, column) => {
    if (!Array.isArray(week.contributionDays)) throw new Error('요일 목록이 올바르지 않습니다.');

    week.contributionDays.forEach((day) => {
      const { date, weekday, contributionCount, contributionLevel } = day;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seenDates.has(date) ||
          !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
          !Number.isInteger(contributionCount) || contributionCount < 0 ||
          !Object.hasOwn(COLORS, contributionLevel)) {
        throw new Error(`기여 데이터 검증 실패: ${date}`);
      }
      seenDates.add(date);
      if (contributionCount > 0) activeDays += 1;

      // 날짜가 원래 놓이던 주차·요일 위치를 그대로 사용합니다.
      const x = gridLeft + column * pitch;
      const y = GAME.gridTop + weekday * pitch;

      // 공의 중심이 이 칸 중앙을 지나가는 순간에 맞춰 칸을 숨깁니다.
      const hitFraction = (getHitTime(x, weekday, timeline) / timeline.duration).toFixed(6);
      cells.push(`<rect x="${x}" y="${y}" width="${GAME.cellSize}" height="${GAME.cellSize}" rx="2" fill="${COLORS[contributionLevel]}">
      <animate attributeName="opacity" calcMode="discrete" values="1;0;0" keyTimes="0;${hitFraction};1" dur="${timeline.duration.toFixed(2)}s" repeatCount="indefinite"/>
    </rect>`);
    });
  });

  // 공과 탁구채가 동일한 시간표를 쓰므로 줄이 바뀔 때 서로 어긋나지 않습니다.
  const keyTimes = timeline.points.map((point) => (point.time / timeline.duration).toFixed(6)).join(';');
  const ballXs = timeline.points.map((point) => point.x).join(';');
  const ballYs = timeline.points.map((point) => point.y).join(';');
  const paddleYs = timeline.points.map((point) => point.y - 26).join(';');
  const duration = `${timeline.duration.toFixed(2)}s`;
  const animated = (attributeName, values) =>
    `<animate attributeName="${attributeName}" values="${values}" keyTimes="${keyTimes}" calcMode="linear" dur="${duration}" repeatCount="indefinite"/>`;

  // SVG만 사용하므로 README에 JavaScript를 삽입하지 않습니다.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="280" viewBox="0 0 960 280" role="img" aria-labelledby="title desc">
  <title id="title">PING PONG × GITHUB GRASS</title>
  <desc id="desc">GitHub의 실제 공개 기여 ${calendar.totalContributions}회, 활동한 날짜 ${activeDays}일. 공이 지나간 잔디 칸이 사라지는 탁구 애니메이션입니다.</desc>
  <rect width="960" height="280" rx="18" fill="#102D27"/>
  <text x="36" y="37" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="17" font-weight="bold">PING PONG × GITHUB GRASS</text>
  <text x="922" y="36" text-anchor="end" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">${calendar.totalContributions} contributions</text>
  <!-- 탁구대와 가운데 선 -->
  <rect x="31" y="56" width="898" height="171" rx="14" fill="#193F35" stroke="#6DC9A2" stroke-width="3"/>
  <path d="M480 60 V223" fill="none" stroke="#8EC9AC" stroke-width="2" stroke-dasharray="6 7" opacity="0.5"/>
  <!-- 실제 GitHub의 날짜별 잔디: 공이 지나간 칸만 순서대로 사라집니다. -->
  ${cells.join('\n  ')}
  <!-- 양쪽 탁구채: 공이 있는 줄을 함께 따라갑니다. -->
  <rect x="49" y="83" width="10" height="52" rx="5" fill="#9BE8C3">${animated('y', paddleYs)}</rect>
  <rect x="901" y="83" width="10" height="52" rx="5" fill="#9BE8C3">${animated('y', paddleYs)}</rect>
  <!-- 탁구공: 일곱 줄을 지그재그로 훑고 다시 처음으로 돌아갑니다. -->
  <circle cx="${GAME.firstBallX}" cy="109" r="7" fill="#FFFFFF">
    ${animated('cx', ballXs)}
    ${animated('cy', ballYs)}
  </circle>
  <text x="480" y="257" text-anchor="middle" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">REAL GITHUB CONTRIBUTIONS · PING PONG CLEAR</text>
</svg>\n`;
}

/** 직접 실행했을 때만 GitHub API 조회와 SVG 파일 저장을 진행합니다. */
async function main() {
  const calendar = await fetchCalendar(process.env.GITHUB_USER ?? 'dlawhd', process.env.GITHUB_TOKEN);
  const svg = renderSvg(calendar);
  await mkdir('dist', { recursive: true });
  await writeFile('dist/pingpong.svg', svg, 'utf8');
  console.log(`완료: dist/pingpong.svg / ${calendar.totalContributions} contributions / ${calendar.weeks.length} weeks`);
}

// npm이나 테스트에서 import할 때는 API를 호출하지 않도록 진입점을 구분합니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
