/**
 * GitHub 공개 기여 기록을 읽어 민트색 탁구대 SVG로 만드는 프로그램입니다.
 * 2차 버전은 실제 잔디 + 좌우 패들 + 공 애니메이션을 추가합니다.
 * 실행: GITHUB_TOKEN=... GITHUB_USER=dlawhd node scripts/generate-pingpong-svg.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';

// GitHub 기여 단계별 색상을 민트 팔레트로 매핑합니다.
const COLORS = {
  NONE: '#EAF7F0',
  FIRST_QUARTILE: '#BFEAD5',
  SECOND_QUARTILE: '#83D3AE',
  THIRD_QUARTILE: '#42AB82',
  FOURTH_QUARTILE: '#176B54',
};

/**
 * GitHub GraphQL API에서 실제 contribution calendar를 가져옵니다.
 */
export async function fetchCalendar(username, token) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || !token) {
    throw new Error('GITHUB_USER 또는 GITHUB_TOKEN 설정을 확인해 주세요.');
  }

  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              weekday
              contributionCount
              contributionLevel
            }
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
    body: JSON.stringify({
      query,
      variables: { login: username },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API 응답 오류: HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL 오류: ${json.errors[0].message}`);
  }

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;

  if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length === 0) {
    throw new Error('GitHub 기여 달력을 가져오지 못했습니다.');
  }

  return calendar;
}

/**
 * 실제 GitHub 기여 데이터를 이용해서
 * "탁구대 + 실제 잔디 + 공 + 좌우 패들 애니메이션" SVG를 생성합니다.
 */
export function renderSvg(calendar) {
  const weeks = calendar?.weeks;

  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 54) {
    throw new Error('GitHub 기여 달력의 주차 데이터가 올바르지 않습니다.');
  }

  // ===== SVG 기본 크기 =====
  const svgWidth = 960;
  const svgHeight = 280;

  // ===== 탁구대 위치 =====
  const tableX = 31;
  const tableY = 56;
  const tableWidth = 898;
  const tableHeight = 171;

  // ===== 잔디 칸 크기 =====
  const cell = 10;
  const gap = 4;
  const pitch = cell + gap;

  // 실제 잔디 전체 폭을 계산해서 중앙 정렬합니다.
  const gridWidth = weeks.length * pitch - gap;
  const startX = (svgWidth - gridWidth) / 2;
  const startY = 104;

  const squares = [];
  const seenDates = new Set();
  let visibleCount = 0;

  weeks.forEach((week, column) => {
    if (!Array.isArray(week.contributionDays)) {
      throw new Error('요일 목록이 올바르지 않습니다.');
    }

    week.contributionDays.forEach((day) => {
      const { date, weekday, contributionCount, contributionLevel } = day;

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        seenDates.has(date) ||
        !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
        !Number.isInteger(contributionCount) || contributionCount < 0 ||
        !Object.hasOwn(COLORS, contributionLevel)
      ) {
        throw new Error(`기여 데이터 검증 실패: ${date}`);
      }

      seenDates.add(date);

      if (contributionCount > 0) {
        visibleCount += 1;
      }

      // GitHub 잔디 배치를 그대로 유지합니다.
      const x = startX + column * pitch;
      const y = startY + weekday * pitch;

      squares.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${COLORS[contributionLevel]}"/>`
      );
    });
  });

  const total = calendar.totalContributions;

  if (!Number.isInteger(total) || total < 0) {
    throw new Error('총 기여 횟수가 올바르지 않습니다.');
  }

  /**
   * 공 이동 경로입니다.
   * x값과 y값을 시간 순서대로 나열해서
   * 공이 좌우로 튕기는 것처럼 보이게 합니다.
   */
  const ballXValues = [
    140, 220, 300, 380, 460, 540, 620, 700, 780, 840,
    760, 680, 600, 520, 440, 360, 280, 200, 140
  ].join(';');

  const ballYValues = [
    188, 164, 140, 118, 102, 120, 146, 172, 190, 166,
    142, 118, 98, 122, 148, 174, 194, 166, 188
  ].join(';');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${svgWidth}"
  height="${svgHeight}"
  viewBox="0 0 ${svgWidth} ${svgHeight}"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">PING PONG × GITHUB GRASS</title>
  <desc id="desc">
    GitHub의 실제 공개 기여 기록: ${total}회, 기여한 날짜 ${visibleCount}일.
    공이 좌우 패들에 튕기는 애니메이션이 포함되어 있습니다.
  </desc>

  <!-- 바깥 배경 -->
  <rect width="${svgWidth}" height="${svgHeight}" rx="18" fill="#102D27"/>

  <!-- 제목 -->
  <text
    x="36"
    y="37"
    fill="#BDEBD6"
    font-family="Arial, sans-serif"
    font-size="17"
    font-weight="bold"
  >
    PING PONG × GITHUB GRASS
  </text>

  <text
    x="922"
    y="36"
    text-anchor="end"
    fill="#BDEBD6"
    font-family="Arial, sans-serif"
    font-size="13"
  >
    ${total} contributions
  </text>

  <!-- 탁구대 -->
  <rect
    x="${tableX}"
    y="${tableY}"
    width="${tableWidth}"
    height="${tableHeight}"
    rx="14"
    fill="#193F35"
    stroke="#6DC9A2"
    stroke-width="3"
  />

  <!-- 중앙 점선 -->
  <path
    d="M480 60 V223"
    fill="none"
    stroke="#8EC9AC"
    stroke-width="2"
    stroke-dasharray="6 7"
    opacity="0.5"
  />

  <!-- 중앙 텍스트 -->
  <text
    x="480"
    y="92"
    text-anchor="middle"
    fill="#D4F6E5"
    font-family="Arial, sans-serif"
    font-size="14"
    font-weight="bold"
    opacity="0.9"
  >
    PING! PONG!
  </text>

  <!-- 실제 GitHub 잔디 칸 -->
  ${squares.join('\n  ')}

  <!-- 왼쪽 패들 -->
  <rect x="49" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate
      attributeName="y"
      values="119;95;135;110;119"
      dur="3s"
      repeatCount="indefinite"
    />
  </rect>

  <!-- 오른쪽 패들 -->
  <rect x="901" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate
      attributeName="y"
      values="119;140;100;128;119"
      dur="3s"
      repeatCount="indefinite"
    />
  </rect>

  <!-- 공 그림자 -->
  <ellipse cx="140" cy="202" rx="7" ry="3" fill="#0A1B17" opacity="0.35">
    <animate
      attributeName="cx"
      values="${ballXValues}"
      dur="6s"
      repeatCount="indefinite"
    />
    <animate
      attributeName="cy"
      values="198;190;182;174;166;178;188;198;202;194;184;174;166;178;188;198;202;194;198"
      dur="6s"
      repeatCount="indefinite"
    />
  </ellipse>

  <!-- 탁구공 -->
  <circle cx="140" cy="188" r="7" fill="#FFFFFF">
    <animate
      attributeName="cx"
      values="${ballXValues}"
      dur="6s"
      repeatCount="indefinite"
    />
    <animate
      attributeName="cy"
      values="${ballYValues}"
      dur="6s"
      repeatCount="indefinite"
    />
  </circle>

  <!-- 하단 설명 -->
  <text
    x="480"
    y="257"
    text-anchor="middle"
    fill="#BDEBD6"
    font-family="Arial, sans-serif"
    font-size="13"
  >
    REAL GITHUB CONTRIBUTIONS · ANIMATED PING PONG
  </text>
</svg>
`;
}

/**
 * Actions에서 직접 실행할 때만
 * 실제 GitHub 데이터를 가져와 파일로 저장합니다.
 */
async function main() {
  const calendar = await fetchCalendar(
    process.env.GITHUB_USER ?? 'dlawhd',
    process.env.GITHUB_TOKEN
  );

  const svg = renderSvg(calendar);

  await mkdir('dist', { recursive: true });
  await writeFile('dist/pingpong.svg', svg, 'utf8');

  console.log(
    `완료: dist/pingpong.svg / ${calendar.totalContributions} contributions / ${calendar.weeks.length} weeks`
  );
}

if (process.argv[1] && import.meta.url === new URL(\`file://\${process.argv[1]}\`).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
