/**
 * GitHub 공개 기여 기록을 읽어 민트색 탁구대 SVG로 만드는 프로그램입니다.
 * 4차 완성 버전: 실제 잔디의 활동 칸을 랜덤 순서로 지우고,
 * 모든 활동 칸이 사라지면 탁구 화면 전체를 숨긴 뒤 가운데 성공 문구를 표시합니다.
 * 기존 snake.yml / pingpong.yml / README.md는 건드리지 않습니다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const COLORS = {
  NONE: '#EAF7F0',
  FIRST_QUARTILE: '#BFEAD5',
  SECOND_QUARTILE: '#83D3AE',
  THIRD_QUARTILE: '#42AB82',
  FOURTH_QUARTILE: '#176B54',
};

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

function shuffleArray(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

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

function buildRandomPath(targets) {
  const leftPaddleX = 54;
  const rightPaddleX = 906;
  const topLimit = SVG.tableY + 18;
  const bottomLimit = SVG.tableY + SVG.tableHeight - 18;
  // 기존 0.22초보다 약 23% 천천히 움직이도록 0.27초로 조정합니다.
  const travelDuration = 0.27;
  // 마지막 칸이 사라진 뒤 패들에 닿고, 화면을 천천히 숨깁니다.
  const sceneWait = 0.22;
  const sceneFade = 0.38;
  // 어두운 빈 화면에서 성공 문구를 나타낸 뒤 3초 동안 유지합니다.
  const successFade = 0.42;
  const successHold = 3.0;

  const points = [];
  const targetHitTimes = new Map();
  let currentTime = 0;

  const firstTarget = targets[0];
  const firstY = firstTarget ? clamp(firstTarget.cy, topLimit, bottomLimit) : 140;
  points.push({ x: leftPaddleX, y: firstY, time: currentTime });

  targets.forEach((target, index) => {
    currentTime += travelDuration;
    points.push({ x: target.cx, y: target.cy, time: currentTime });
    targetHitTimes.set(target.id, currentTime);

    currentTime += travelDuration;
    const nextIsRight = index % 2 === 0;
    const paddleX = nextIsRight ? rightPaddleX : leftPaddleX;
    const paddleY = clamp(target.cy, topLimit, bottomLimit);
    points.push({ x: paddleX, y: paddleY, time: currentTime });
  });

  // 오늘 활동한 칸이 0개라면 1.2초 동안 빈 탁구대를 보여 준 뒤 성공 화면으로 넘어갑니다.
  if (targets.length === 0) currentTime = 1.2;

  // 마지막 공 움직임이 끝난 시각을 기준으로 모든 화면 전환을 맞춥니다.
  const sceneFadeStart = currentTime + sceneWait;
  const sceneFadeEnd = sceneFadeStart + sceneFade;
  const successFadeEnd = sceneFadeEnd + successFade;
  const totalDuration = successFadeEnd + successHold;

  // 성공 문구를 보여 주는 동안 공은 마지막 위치에서 멈추도록 시간표 끝점을 추가합니다.
  const lastPoint = points.at(-1);
  points.push({ x: lastPoint.x, y: lastPoint.y, time: totalDuration });

  return {
    points,
    targetHitTimes,
    totalDuration,
    sceneFadeStart,
    sceneFadeEnd,
    successFadeEnd,
    leftPaddleX,
    rightPaddleX,
  };
}

function buildAnimatedCell(cell, hitTime, totalDuration) {
  // 공의 중심이 잔디 칸에 닿는 바로 그 시점에 불투명도 1 → 0으로 바꿉니다.
  // calcMode="discrete"를 쓰면 서서히 지워지지 않고 정확한 시점에 사라집니다.
  const hitRatio = hitTime / totalDuration;

  return `<rect id="${cell.id}" x="${cell.x}" y="${cell.y}" width="${SVG.cell}" height="${SVG.cell}" rx="2" fill="${cell.fill}">
    <animate attributeName="opacity" values="1;0;0" keyTimes="0;${hitRatio.toFixed(6)};1" calcMode="discrete" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>`;
}

function buildStaticCell(cell) {
  return `<rect x="${cell.x}" y="${cell.y}" width="${SVG.cell}" height="${SVG.cell}" rx="2" fill="${cell.fill}"/>`;
}

function buildPaddleAnimateValues(points, paddleX, initialY) {
  const yValues = points.map((point) => {
    if (Math.abs(point.x - paddleX) <= 2) {
      return clamp(point.y - 26, SVG.tableY + 8, SVG.tableY + SVG.tableHeight - 60);
    }
    return null;
  });

  let lastKnown = initialY;
  return yValues.map((value) => {
    if (value == null) return Number(lastKnown.toFixed(1));
    lastKnown = value;
    return Number(value.toFixed(1));
  }).join(';');
}

export function renderSvg(calendar) {
  const weeks = calendar?.weeks;
  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 54) {
    throw new Error('GitHub 기여 달력의 주차 데이터가 올바르지 않습니다.');
  }

  const cells = buildCells(weeks);
  const activeCells = cells.filter((cell) => cell.contributionCount > 0);
  const passiveCells = cells.filter((cell) => cell.contributionCount === 0);
  const randomizedTargets = shuffleArray(activeCells);

  const {
    points, targetHitTimes, totalDuration, sceneFadeStart, sceneFadeEnd,
    successFadeEnd, leftPaddleX, rightPaddleX,
  } = buildRandomPath(randomizedTargets);

  const ballXValues = points.map((point) => Number(point.x.toFixed(1))).join(';');
  const ballYValues = points.map((point) => Number(point.y.toFixed(1))).join(';');
  // 공·패들·잔디·화면 전환을 반드시 같은 전체 길이로 반복합니다.
  const keyTimes = points.map((point) => (point.time / totalDuration).toFixed(6)).join(';');
  const sceneFadeStartRatio = (sceneFadeStart / totalDuration).toFixed(6);
  const sceneFadeEndRatio = (sceneFadeEnd / totalDuration).toFixed(6);
  const successFadeEndRatio = (successFadeEnd / totalDuration).toFixed(6);

  const leftPaddleYValues = buildPaddleAnimateValues(points, leftPaddleX, 119);
  const rightPaddleYValues = buildPaddleAnimateValues(points, rightPaddleX, 119);

  const total = calendar.totalContributions;
  if (!Number.isInteger(total) || total < 0) {
    throw new Error('총 기여 횟수가 올바르지 않습니다.');
  }

  const visibleCount = activeCells.length;
  const staticRects = passiveCells.map(buildStaticCell);
  const animatedRects = activeCells.map((cell) => buildAnimatedCell(cell, targetHitTimes.get(cell.id) ?? 0, totalDuration));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG.width}" height="${SVG.height}" viewBox="0 0 ${SVG.width} ${SVG.height}" role="img" aria-labelledby="title desc">
  <title id="title">PING PONG × GITHUB GRASS</title>
  <desc id="desc">GitHub의 실제 공개 기여 기록 ${total}회 중 활동이 있는 ${visibleCount}칸을 랜덤 순서로 지운 뒤 COMMIT SUCCESS!를 표시합니다.</desc>

  <!-- 마지막에는 배경만 남겨 성공 문구가 선명하게 보이도록 합니다. -->
  <rect width="${SVG.width}" height="${SVG.height}" rx="18" fill="#102D27"/>

  <!-- 제목·잔디·탁구대·패들·공·하단 글씨를 하나의 화면으로 묶어 함께 숨깁니다. -->
  <g id="pingpong-scene">
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${sceneFadeStartRatio};${sceneFadeEndRatio};1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  <text x="36" y="37" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="17" font-weight="bold">PING PONG × GITHUB GRASS</text>
  <text x="922" y="36" text-anchor="end" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">${total} contributions</text>

  <rect x="${SVG.tableX}" y="${SVG.tableY}" width="${SVG.tableWidth}" height="${SVG.tableHeight}" rx="14" fill="#193F35" stroke="#6DC9A2" stroke-width="3"/>
  <path d="M480 60 V223" fill="none" stroke="#8EC9AC" stroke-width="2" stroke-dasharray="6 7" opacity="0.5"/>
  <text x="480" y="92" text-anchor="middle" fill="#D4F6E5" font-family="Arial, sans-serif" font-size="14" font-weight="bold" opacity="0.9">RANDOM GRASS CLEAR</text>

  <!-- 기여가 없는 칸은 그대로 둡니다. -->
  ${staticRects.join('\n  ')}

  <!-- 실제 기여가 있는 칸만 랜덤 순서로 사라집니다. -->
  ${animatedRects.join('\n  ')}

  <rect x="49" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate attributeName="y" values="${leftPaddleYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>

  <rect x="901" y="119" width="10" height="52" rx="5" fill="#9BE8C3">
    <animate attributeName="y" values="${rightPaddleYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </rect>

  <ellipse cx="${points[0]?.x ?? 140}" cy="${(points[0]?.y ?? 188) + 14}" rx="7" ry="3" fill="#0A1B17" opacity="0.35">
    <animate attributeName="cx" values="${ballXValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${points.map((point) => Number((point.y + 14).toFixed(1))).join(';')}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </ellipse>

  <circle cx="${points[0]?.x ?? 140}" cy="${points[0]?.y ?? 188}" r="7" fill="#FFFFFF">
    <animate attributeName="cx" values="${ballXValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${ballYValues}" keyTimes="${keyTimes}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </circle>

  <text x="480" y="257" text-anchor="middle" fill="#BDEBD6" font-family="Arial, sans-serif" font-size="13">RANDOM ACTIVE CELLS · ${escapeXml(String(visibleCount))} HITS · LOOP</text>
  </g>

  <!-- 탁구 화면이 모두 사라진 다음, 배경 중앙에 성공 문구 하나만 표시합니다. -->
  <text id="commit-success" x="480" y="144" text-anchor="middle" dominant-baseline="middle" fill="#A8F0CC" font-family="Arial, sans-serif" font-size="42" font-weight="bold" letter-spacing="2" opacity="0">COMMIT SUCCESS!
    <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${sceneFadeEndRatio};${successFadeEndRatio};1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite"/>
  </text>
</svg>\n`;
}

async function main() {
  const calendar = await fetchCalendar(process.env.GITHUB_USER ?? 'dlawhd', process.env.GITHUB_TOKEN);
  const svg = renderSvg(calendar);
  await mkdir('dist', { recursive: true });
  await writeFile('dist/pingpong.svg', svg, 'utf8');
  console.log(`완료: dist/pingpong.svg / ${calendar.totalContributions} contributions / ${calendar.weeks.length} weeks`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
