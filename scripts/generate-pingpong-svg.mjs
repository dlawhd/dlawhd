/**
 * GitHub 공개 기여 기록을 읽어 민트색 탁구대 SVG로 만드는 프로그램입니다.
 * 1차 버전은 실제 잔디만 그리며, 공의 이동과 잔디 지우기는 다음 단계에서 추가합니다.
 * 실행: GITHUB_TOKEN=... GITHUB_USER=dlawhd node scripts/generate-pingpong-svg.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';

// GitHub 공식 기여 단계와 민트색 팔레트를 1:1로 연결합니다.
const COLORS = {
  NONE: '#EAF7F0',
  FIRST_QUARTILE: '#BFEAD5',
  SECOND_QUARTILE: '#83D3AE',
  THIRD_QUARTILE: '#42AB82',
  FOURTH_QUARTILE: '#176B54',
};

/** GitHub GraphQL에서 사용자의 실제 기여 달력을 가져옵니다. */
export async function fetchCalendar(username, token) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || !token) {
    throw new Error('GITHUB_USER 또는 GITHUB_TOKEN 설정을 확인해 주세요.');
  }

  // contributionCalendar는 날짜, 요일, 기여 횟수 및 기여 단계를 제공합니다.
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

/** 실제 기여 단계로 탁구대 SVG를 만듭니다. 제공되지 않은 날짜는 그리지 않습니다. */
export function renderSvg(calendar) {
  const weeks = calendar?.weeks;
  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 54) {
    throw new Error('GitHub 기여 달력의 주차 데이터가 올바르지 않습니다.');
  }

  const cell = 10; // 잔디 한 칸의 가로·세로 길이입니다.
  const gap = 4; // 잔디 사이 여백입니다.
  const pitch = cell + gap;
  const startX = (960 - (weeks.length * pitch - gap)) / 2;
  const startY = 104;
  const squares = [];
  const seenDates = new Set();
  let visibleCount = 0;

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
      if (contributionCount > 0) visibleCount += 1;
      // 주차는 가로, 요일(일요일=0)은 세로로 두어 실제 잔디 배치를 유지합니다.
      const x = startX + column * pitch;
      const y = startY + weekday * pitch;
      squares.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${COLORS[contributionLevel]}"/>`);
    });
  });

  const total = calendar.totalContributions;
  if (!Number.isInteger(total) || total < 0) throw new Error('총 기여 횟수가 올바르지 않습니다.');

  // SVG는 자바스크립트 없이 GitHub README의 이미지로 표시할 수 있습니다.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="280" viewBox="0 0 960 280" role="img" aria-labelledby="title desc">
  <title id="title">PING PONG × GITHUB GRASS</title>
  <desc id="desc">GitHub의 실제 공개 기여 기록: ${total}회, 기여한 날짜 ${visibleCount}일</desc>
  <rect width="960" height="280" rx="18" fill="#102D27"/>
  <text x="36" y="37" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="17" font-weight="bold">PING PONG × GITHUB GRASS</text>
  <text x="922" y="36" text-anchor="end" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">${total} contributions</text>
  <rect x="31" y="56" width="898" height="171" rx="14" fill="#193F35" stroke="#6DC9A2" stroke-width="3"/>
  <path d="M480 60 V223" fill="none" stroke="#8EC9AC" stroke-width="2" stroke-dasharray="6 7" opacity="0.5"/>
  <!-- 왼쪽과 오른쪽 막대는 탁구채를 나타냅니다. -->
  <rect x="49" y="119" width="9" height="49" rx="4" fill="#9BE8C3"/>
  <rect x="902" y="119" width="9" height="49" rx="4" fill="#9BE8C3"/>
  <!-- 아래 잔디 칸은 실제 API 응답을 기반으로 만들어집니다. -->
  ${squares.join('\n  ')}
  <circle cx="480" cy="215" r="6" fill="#FFFFFF"/>
  <text x="480" y="257" text-anchor="middle" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">REAL GITHUB CONTRIBUTIONS · MINT EDITION</text>
</svg>\n`;
}

/** Actions에서 직접 실행한 경우에만 API 조회와 파일 저장을 수행합니다. */
async function main() {
  const calendar = await fetchCalendar(process.env.GITHUB_USER ?? 'dlawhd', process.env.GITHUB_TOKEN);
  const svg = renderSvg(calendar);
  await mkdir('dist', { recursive: true });
  await writeFile('dist/pingpong.svg', svg, 'utf8');
  console.log(`완료: dist/pingpong.svg / ${calendar.totalContributions} contributions / ${calendar.weeks.length} weeks`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
