/**
 * GitHub 공개 기여 기록을 읽어 민트색 탁구대 SVG로 만드는 프로그램입니다.
 * 3차 랜덤 버전:
 * 공이 실제 잔디가 있는 칸들만 랜덤 순서로 튕기며 지나가고,
 * 공이 닿은 칸은 점점 사라집니다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// GitHub 기여 단계별 민트 팔레트입니다.
const COLORS = {
  NONE: '#EAF7F0',
  FIRST_QUARTILE: '#BFEAD5',
  SECOND_QUARTILE: '#83D3AE',
  THIRD_QUARTILE: '#42AB82',
  FOURTH_QUARTILE: '#176B54',
};

// SVG 전체 레이아웃에 사용하는 공통 값입니다.
const SVG = {
  width: 960,
  height: 280,
  tableX: 31,
  tableY: 56,
  tableWidth: 898,
  tableHeight: 171,
  cell: 10,
  gap: 4,
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
    body: JSON.stringify({ query, variables: { login: username } }),
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
 * 배열을 무작위 순서로 섞습니다.
 * 공이 지울 잔디 칸 순서를 랜덤처럼 보이게 만드는 데 사용합니다.
 */
function shuffleArray(list) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

/**
 * 값이 최소/최대 범위를 벗어나지 않도록 제한합니다.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * XML/SVG 안에 넣는 텍스트를 안전하게 바꿔줍니다.
 */
function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * GitHub 잔디 데이터를 실제 SVG 좌표로 바꿔서 칸 목록을 만듭니다.
 */
function buildCells(weeks) {
  const pitch = SVG.cell + SVG.gap;
  const gridWidth = weeks.length * pitch - SVG.gap;
  const startX = (SVG.width - gridWidth) / 2;
  const startY = 104;

  const cells = [];
  const seenDates = new Set();

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

      const x = startX + column * pitch;
      const y = startY + weekday * pitch;

      cells.push({
        id: `cell-${column}-${weekday}`,
        date,
        weekday,
        contributionCount,
        contributionLevel,
        fill: COLORS[contributionLevel],
        x,
        y,
        cx: x + SVG.cell / 2,
        cy: y + SVG.cell / 2,
      });
    });
  });

  return cells;
}

/**
 * 랜덤으로 섞인 잔디 칸들을 기준으로
 * 공의 이동 경로와 각 칸이 사라질 시간을 계산합니다.
 */
function buildRandomPath(targets) {
  const leftPaddleX = 54;
  const rightPaddleX = 906;

  const topLimit = SVG.tableY + 18;
  const bottomLimit = SVG.tableY + SVG.tableHeight - 18;

  // 공이 한 지점에서 다음 지점으로 가는 시간
  const travelDuration = 0.22;

  // 모든 칸을 지운 뒤 잠깐 멈추는 시간
  const clearPause = 1.2;

  const points = [];
  const targetHitTimes = new Map();
  let currentTime = 0;

  const firstTarget = targets[0];
  const firstY = firstTarget ? clamp(firstTarget.cy, topLimit, bottomLimit) : 140;

  // 시작 위치는 왼쪽 패들 쪽입니다.
  points.push({
    x: leftPaddleX,
    y: firstY,
    time: currentTime,
  });

  targets.forEach((target, index) => {
    // 1) 공이 잔디 칸으로 이동
    currentTime += travelDuration;
    points.push({
      x: target.cx,
      y: target.cy,
      time: currentTime,
    });

    // 이 시점에 해당 칸이 사라집니다.
    targetHitTimes.set(target.id, currentTime);

    // 2) 반대쪽 패들로 이동
    currentTime += travelDuration;

    const nextIsRight = index % 2 === 0;
    const paddleX = nextIsRight ? rightPaddleX : leftPaddleX;
    const paddleY = clamp(target.cy, topLimit, bottomLimit);

    points.push({
      x: paddleX,
      y: paddleY,
      time: currentTime,
    });
  });

  // 마지막에 잠깐 멈췄다가 다시 처음부터 반복되게 합니다.
  const lastPoint = points.at(-1) ?? { x: leftPaddleX, y: firstY, time: 0 };
  currentTime += clearPause;

  points.push({
    x: lastPoint.x,
    y: lastPoint.y,
    time: currentTime,
  });

  return {
    points,
    targetHitTimes,
    totalDuration: currentTime || 1,
    leftPaddleX,
    rightPaddleX,
  };
}

/**
 * 잔디 칸 하나에 "공이 닿으면 사라지는" opacity 애니메이션을 붙입니다.
 */
function buildAnimatedCell(cell, hitTime, totalDuration) {
  const ratio = Math.min(hitTime / totalDuration, 0.9999);
  const vanishRatio = Math.min((hitTime + 0.02) / totalDuration, 0.99995);

  return `<rect id="${cell.id}" x="${cell.x}" y="${cell.y}" width="${SVG.cell}" height="${SVG.cell}" rx="2" fill="${cell.fill}">
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${ratio.toFixed(4)};${vanishRatio.toFixed(4)};1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>`;
}

/**
 * 기여가 없는 칸은 사라지지 않고 그대로 남아 있도록 합니다.
 */
function buildStaticCell(cell) {
  return `<rect x="${cell.x}" y="${cell.y}" width="${SVG.cell}" height="${SVG.cell}" rx="2" fill="${cell.fill}"/>`;
}

/**
 * 패들이 공을 따라가는 것처럼 보이도록 y값 목록을 만듭니다.
 */
function buildPaddleAnimateValues(points, paddleX, initialY) {
  const yValues = points.map((point) => {
    if (Math.abs(point.x - paddleX) <= 2) {
      return clamp(point.y - 26, SVG.tableY + 8, SVG.tableY + SVG.tableHeight - 60);
    }

    return null;
  });

  let lastKnown = initialY;

  return yValues
    .map((value) => {
      if (value == null) {
        return Number(lastKnown.toFixed(1));
      }

      lastKnown = value;
      return Number(value.toFixed(1));
    })
    .join(';');
}

/**
 * 최종 SVG 문자열을 만듭니다.
 */
export function renderSvg(calendar) {
  const weeks = calendar?.weeks;

  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 54) {
    throw new Error('GitHub 기여 달력의 주차 데이터가 올바르지 않습니다.');
  }

  const cells = buildCells(weeks);

  // 실제로 색이 있는 잔디 칸만 제거 대상으로 삼습니다.
  const activeCells = cells.filter((cell) => cell.contributionCount > 0);

  // 기여가 0인 칸은 배경처럼 그대로 둡니다.
  const passiveCells = cells.filter((cell) => cell.contributionCount === 0);

  // 공이 맞출 순서를 랜덤처럼 섞습니다.
  const randomizedTargets = shuffleArray(activeCells);

  const {
    points,
    targetHitTimes,
    totalDuration,
    leftPaddleX,
    rightPaddleX,
  } = buildRandomPath(randomizedTargets);

  const ballXValues = points.map((point) => Number(point.x.toFixed(1))).join(';');
  const ballYValues = points.map((point) => Number(point.y.toFixed(1))).join(';');
  const keyTimes = points
    .map((point) => Number((point.time / totalDuration).toFixed(4)))
    .join(';');

  const leftPaddleYValues = buildPaddleAnimateValues(points, leftPaddleX, 119);
  const rightPaddleYValues = buildPaddleAnimateValues(points, rightPaddleX, 119);

  const total = calendar.totalContributions;

  if (!Number.isInteger(total) || total < 0) {
    throw new Error('총 기여 횟수가 올바르지 않습니다.');
  }

  const visibleCount = activeCells.length;

  const staticRects = passiveCells.map(buildStaticCell);
  const animatedRects = activeCells.map((cell) =>
    buildAnimatedCell(cell, targetHitTimes.get(cell.id) ?? 0, totalDuration)
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG.width}" height="${SVG.height}" viewBox="0 0 ${SVG.width} ${SVG.height}" role="img" aria-labelledby="title desc">
  <title id="title">PING PONG × GITHUB GRASS</title>
  <desc id="desc">GitHub의 실제 공개 기여 기록 ${total}회 중 활동이 있는 ${visibleCount}칸을 랜덤 순서로 지우는 탁구 애니메이션입니다.</desc>

  <!-- 바깥 배경 -->
  <rect width="${SVG.width}" height="${SVG.height}" rx="18" fill="#102D27"/>

  <!-- 제목 -->
  <text x="36" y="37" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="17" font-weight="bold">
    PING PONG × GITHUB GRASS
  </text>

  <text x="922" y="36" text-anchor="end" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">
    ${total} contributions
  </text>

  <!-- 탁구대 -->
  <rect x="${SVG.tableX}" y="${SVG.tableY}" width="${SVG.tableWidth}" height="${SVG.tableHeight}" rx="14" fill="#193F35" stroke="#6DC9A2" stroke-width="3"/>

  <!-- 중앙 점선 -->
  <path d="M480 60 V223" fill="none" stroke="#8EC9AC" stroke-width="2" stroke-dasharray="6 7" opacity="0.5"/>

  <!-- 안내 문구 -->
  <text x="480" y="92" text-anchor="middle" fill="#D4F6E5" font-family="Arial, sans-serif" font-size="14" font-weight="bold" opacity="0.9">
    RANDOM GRASS CLEAR
  </text>

  <!-- 기여가 없는 칸은 그대로 둡니다. -->
  ${staticRects.join('\n  ')}

  <!-- 실제 기여가 있는 칸만 랜덤 순서로 사라집니다. -->
  ${animatedRects.join('\n  ')}

  <!-- 왼쪽 패들 -->
  <rect x="49" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate attributeName="y" values="${leftPaddleYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>

  <!-- 오른쪽 패들 -->
  <rect x="901" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate attributeName="y" values="${rightPaddleYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>

  <!-- 공 그림자 -->
  <ellipse cx="${points[0]?.x ?? 140}" cy="${(points[0]?.y ?? 188) + 14}" rx="7" ry="3" fill="#0A1B17" opacity="0.35">
    <animate attributeName="cx" values="${ballXValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${points.map((point) => Number((point.y + 14).toFixed(1))).join(';')}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </ellipse>

  <!-- 탁구공 -->
  <circle cx="${points[0]?.x ?? 140}" cy="${points[0]?.y ?? 188}" r="7" fill="#FFFFFF">
    <animate attributeName="cx" values="${ballXValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${ballYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </circle>

  <!-- 하단 설명 -->
  <text x="480" y="257" text-anchor="middle" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">
    RANDOM ACTIVE CELLS · ${escapeXml(String(visibleCount))} HITS · LOOP
  </text>
</svg>
`;
}

/**
 * GitHub Actions에서 직접 실행될 때 SVG 파일을 만듭니다.
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

/**
 * 현재 파일을 직접 실행한 경우에만 main()을 실행합니다.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
