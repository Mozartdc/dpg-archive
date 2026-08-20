const STEP_TO_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_NAMES = ['도', '도♯', '레', '미♭', '미', '파', '파♯', '솔', '라♭', '라', '시♭', '시'];
const LETTER_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const MAJOR_KEYS = {
  '-7': [11, 'C♭ 메이저'], '-6': [6, 'G♭ 메이저'], '-5': [1, 'D♭ 메이저'],
  '-4': [8, 'A♭ 메이저'], '-3': [3, 'E♭ 메이저'], '-2': [10, 'B♭ 메이저'],
  '-1': [5, 'F 메이저'], '0': [0, 'C 메이저'], '1': [7, 'G 메이저'], '2': [2, 'D 메이저'],
  '3': [9, 'A 메이저'], '4': [4, 'E 메이저'], '5': [11, 'B 메이저'],
  '6': [6, 'F♯ 메이저'], '7': [1, 'C♯ 메이저'],
};

const MINOR_KEYS = {
  '-7': [8, 'A♭ 마이너'], '-6': [3, 'E♭ 마이너'], '-5': [10, 'B♭ 마이너'],
  '-4': [5, 'F 마이너'], '-3': [0, 'C 마이너'], '-2': [7, 'G 마이너'], '-1': [2, 'D 마이너'],
  '0': [9, 'A 마이너'], '1': [4, 'E 마이너'], '2': [11, 'B 마이너'], '3': [6, 'F♯ 마이너'],
  '4': [1, 'C♯ 마이너'], '5': [8, 'G♯ 마이너'], '6': [3, 'D♯ 마이너'],
  '7': [10, 'A♯ 마이너'],
};

const CHORD_TYPES = [
  { quality: 'major', intervals: [0, 4, 7], label: '메이저 트라이어드', suffix: '' },
  { quality: 'minor', intervals: [0, 3, 7], label: '마이너 트라이어드', suffix: 'm' },
  { quality: 'diminished', intervals: [0, 3, 6], label: '디미니시드 트라이어드', suffix: '°' },
  { quality: 'augmented', intervals: [0, 4, 8], label: '어그먼티드 트라이어드', suffix: '+' },
  { quality: 'dominant7', intervals: [0, 4, 7, 10], label: '도미넌트 세븐스', suffix: '7' },
];

function textOf(parent, selector, fallback = '') {
  return parent?.querySelector(selector)?.textContent?.trim() || fallback;
}

function directChildren(parent, name) {
  return Array.from(parent?.children || []).filter((node) => node.localName === name);
}

function pitchFromNote(note) {
  const pitch = note.querySelector(':scope > pitch');
  if (!pitch) return null;
  const step = textOf(pitch, 'step');
  const alter = Number(textOf(pitch, 'alter', '0'));
  const octave = Number(textOf(pitch, 'octave', '4'));
  const pc = (STEP_TO_PC[step] + alter + 120) % 12;
  const midi = (octave + 1) * 12 + STEP_TO_PC[step] + alter;
  return { step, alter, octave, pc, midi, name: PC_NAMES[pc] };
}

function keyFromAttributes(fifths, mode) {
  const table = mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS;
  const [tonic, name] = table[String(fifths)] || table['0'];
  return { fifths, mode, tonic, name };
}

export function parseScoreDocument(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('MusicXML 내용을 읽지 못했음. 파일 형식을 확인해야 함.');
  const root = doc.documentElement;
  if (!['score-partwise', 'score-timewise'].includes(root.localName)) {
    throw new Error('MusicXML 악보가 아님. MXL 또는 MusicXML 파일을 넣어야 함.');
  }
  return doc;
}

export function getScoreMovements(doc) {
  const part = directChildren(doc.documentElement, 'part')[0];
  const measures = directChildren(part, 'measure');
  if (!measures.length) return [];
  const starts = [0];
  measures.forEach((measure, index) => {
    if (index > 0 && measure.getAttribute('number') === '1') starts.push(index);
  });
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? measures.length;
    const first = measures[start];
    const tempoText = Array.from(first.querySelectorAll('direction words'))
      .map((node) => node.textContent.trim()).filter(Boolean).join(' ');
    return {
      index,
      start,
      end,
      measureCount: end - start,
      label: starts.length > 1 ? `${index + 1}번 연습곡` : '업로드한 악보',
      detail: tempoText || `${end - start}마디`,
    };
  });
}

export function sliceMovementXml(sourceDoc, movement) {
  const doc = sourceDoc.cloneNode(true);
  directChildren(doc.documentElement, 'part').forEach((part) => {
    directChildren(part, 'measure').forEach((measure, index) => {
      if (index < movement.start || index >= movement.end) measure.remove();
    });
  });
  const title = doc.querySelector('work-title');
  if (title) title.textContent = `${title.textContent.replace(/\s*[-–—]?\s*No\.?\s*\d+.*$/i, '').trim()} No.${movement.index + 1}`;
  return new XMLSerializer().serializeToString(doc);
}

function parseMeasure(measure, index, state) {
  const divisionsNode = measure.querySelector('attributes divisions');
  if (divisionsNode) state.divisions = Number(divisionsNode.textContent) || state.divisions;
  const fifthsNode = measure.querySelector('attributes key fifths');
  if (fifthsNode) {
    state.fifths = Number(fifthsNode.textContent);
    state.mode = textOf(measure, 'attributes key mode', state.mode);
  }
  const beatsNode = measure.querySelector('attributes time beats');
  if (beatsNode) {
    state.beats = Number(beatsNode.textContent) || state.beats;
    state.beatType = Number(textOf(measure, 'attributes time beat-type', String(state.beatType))) || state.beatType;
  }

  let cursor = 0;
  let lastOnset = 0;
  const events = [];
  let chordCount = 0;
  let tupletCount = 0;
  const staffVoices = new Map();
  const directions = [];

  Array.from(measure.children).forEach((child) => {
    if (child.localName === 'backup') {
      cursor -= Number(textOf(child, 'duration', '0'));
      return;
    }
    if (child.localName === 'forward') {
      cursor += Number(textOf(child, 'duration', '0'));
      return;
    }
    if (child.localName === 'direction') {
      const words = Array.from(child.querySelectorAll('words')).map((node) => node.textContent.trim()).filter(Boolean);
      const dynamics = Array.from(child.querySelectorAll('dynamics > *')).map((node) => node.localName);
      directions.push(...words, ...dynamics);
      return;
    }
    if (child.localName !== 'note') return;
    const duration = Number(textOf(child, ':scope > duration', '0'));
    const isChord = Boolean(child.querySelector(':scope > chord'));
    const isGrace = Boolean(child.querySelector(':scope > grace'));
    const onset = isChord ? lastOnset : cursor;
    if (!isChord) lastOnset = cursor;
    if (isChord) chordCount += 1;
    if (child.querySelector(':scope > time-modification')) tupletCount += 1;
    const pitch = pitchFromNote(child);
    const staff = Number(textOf(child, ':scope > staff', '1'));
    const voice = textOf(child, ':scope > voice', '1');
    if (!staffVoices.has(staff)) staffVoices.set(staff, new Set());
    staffVoices.get(staff).add(voice);
    if (pitch) {
      events.push({
        ...pitch,
        onset,
        duration,
        staff,
        voice,
        chord: isChord,
        fingering: textOf(child, 'notations fingering'),
      });
    }
    if (!isChord && !isGrace) cursor += duration;
  });

  const key = keyFromAttributes(state.fifths, state.mode);
  const harmony = detectHarmony(events, key);
  const texture = detectTexture(events, staffVoices, chordCount, tupletCount, state.divisions);
  const difficulty = detectDifficulty(events, texture, state.divisions);
  const firstRight = events.filter((event) => event.staff === 1).sort((a, b) => a.onset - b.onset || b.midi - a.midi)[0];
  const firstLeft = events.filter((event) => event.staff === 2).sort((a, b) => a.onset - b.onset || a.midi - b.midi)[0];
  const number = measure.getAttribute('number') || String(index + 1);

  return {
    index,
    number,
    key,
    beats: state.beats,
    beatType: state.beatType,
    divisions: state.divisions,
    events,
    directions: [...new Set(directions)],
    harmony,
    texture,
    difficulty,
    firstRight: firstRight?.name || '쉼표',
    firstLeft: firstLeft?.name || '쉼표',
    fingerings: [...new Set(events.map((event) => event.fingering).filter(Boolean))],
  };
}

function detectHarmony(events, key) {
  const weights = Array(12).fill(0);
  events.forEach((event) => { weights[event.pc] += Math.max(event.duration, 1); });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  const unique = weights.map((value, pc) => value > 0 ? pc : -1).filter((pc) => pc >= 0);
  const bassEvent = [...events].sort((a, b) => a.midi - b.midi)[0];
  let best = null;

  for (let root = 0; root < 12; root += 1) {
    CHORD_TYPES.forEach((type) => {
      const tones = type.intervals.map((interval) => (root + interval) % 12);
      const inside = tones.reduce((sum, pc) => sum + weights[pc], 0);
      const present = tones.filter((pc) => weights[pc] > 0).length;
      const outside = total - inside;
      let score = inside * 1.8 - outside * 0.75 + present * total * 0.08;
      if (bassEvent && tones.includes(bassEvent.pc)) score += total * 0.08;
      if (!best || score > best.score) best = { root, type, tones, score, inside, present };
    });
  }

  if (!best || unique.length < 2) {
    return { roman: '—', chord: '한 코드으로 묶기 어려움', inversion: '', nonChord: [], confidence: 0 };
  }
  const inversion = inversionName(best, bassEvent?.pc);
  const roman = romanForChord(best.root, best.type.quality, key);
  const nonChord = unique.filter((pc) => !best.tones.includes(pc)).map((pc) => PC_NAMES[pc]);
  const confidence = Math.min(1, Math.max(0, best.inside / total));
  const chord = `${LETTER_NAMES[best.root]}${best.type.suffix} ${best.type.label}`;
  return { roman, chord, inversion, nonChord, confidence, root: best.root, tones: best.tones };
}

function inversionName(chord, bassPc) {
  if (bassPc == null) return '';
  const interval = (bassPc - chord.root + 12) % 12;
  if (interval === 0) return '루트 포지션';
  if (interval === chord.type.intervals[1]) return '퍼스트 인버전';
  if (interval === chord.type.intervals[2]) return '세컨드 인버전';
  if (chord.type.intervals[3] != null && interval === chord.type.intervals[3]) return '서드 인버전';
  return '베이스에 논코드톤이 있음';
}

function romanForChord(root, quality, key) {
  const interval = (root - key.tonic + 12) % 12;
  const major = { 0: 'I', 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi', 11: 'vii°' };
  const minor = { 0: 'i', 2: 'ii°', 3: 'III', 5: 'iv', 7: quality === 'major' || quality === 'dominant7' ? 'V' : 'v', 8: 'VI', 10: 'VII', 11: 'vii°' };
  return (key.mode === 'minor' ? minor : major)[interval] || `변화코드(${LETTER_NAMES[root]})`;
}

function detectTexture(events, staffVoices, chordCount, tupletCount, divisions) {
  const right = events.filter((event) => event.staff === 1);
  const left = events.filter((event) => event.staff === 2);
  const rightLong = right.some((event) => event.duration >= divisions * 2);
  const rightShort = right.filter((event) => event.duration > 0 && event.duration <= divisions / 2).length;
  const rightPoly = (staffVoices.get(1)?.size || 0) > 1;
  const leftLow = left.length && Math.min(...left.map((event) => event.midi)) < 55;
  let rightLabel = '싱글 멜로디';
  if (rightPoly && rightLong && rightShort >= 3) rightLabel = '탑 노트를 길게 누르고 이너 보이스를 연주함';
  else if (tupletCount >= 3) rightLabel = '셋잇단음이 이어짐';
  else if (rightPoly) rightLabel = '오른손의 탑 보이스와 이너 보이스가 함께 움직임';
  let leftLabel = '왼손 멜로디';
  if (leftLow && chordCount >= 2) leftLabel = '베이스와 코드를 번갈아 치는 반주 패턴';
  else if (chordCount >= 2) leftLabel = '코드 반주';
  else if (leftLow) leftLabel = '낮은 베이스를 길게 유지함';
  return { rightLabel, leftLabel, rightPoly, rightLong, tupletCount, chordCount };
}

function detectDifficulty(events, texture, divisions) {
  const reasons = [];
  const steps = [];
  const byStaff = [1, 2].map((staff) => events.filter((event) => event.staff === staff && !event.chord).sort((a, b) => a.onset - b.onset));
  const maxLeap = Math.max(0, ...byStaff.flatMap((staffEvents) => staffEvents.slice(1).map((event, index) => Math.abs(event.midi - staffEvents[index].midi))));
  if (texture.rightPoly && texture.rightLong) {
    reasons.push('길게 누르는 음 때문에 손에 힘이 들어가기 쉬움');
    steps.push('탑 노트를 빼고 이너 보이스만 연주함', '탑 노트를 누른 채 이너 보이스 핑거링만 움직여 봄', '탑 보이스와 이너 보이스를 합침');
  }
  if (texture.tupletCount >= 3) {
    reasons.push('셋잇단음의 간격과 소리 크기가 흔들리기 쉬움');
    steps.push('셋잇단음 세 음을 한꺼번에 잡아 손자리를 확인함', '같은 손자리에서 악보대로 다시 침');
  }
  if (maxLeap >= 9) {
    reasons.push('손을 옮길 자리를 늦게 찾으면 흐름이 끊기기 쉬움');
    steps.push('도약하기 전 도착할 건반을 먼저 봄', '앞 박과 도착음만 이어 침');
  }
  if (texture.chordCount >= 2) {
    steps.push('왼손 베이스와 코드를 따로 익힌 뒤 양손을 합침');
  }
  if (!reasons.length) reasons.push('앞뒤 마디를 붙일 때 핑거링과 박자가 바뀌지 않는지 살펴야 함');
  steps.push('다음 마디 첫 음까지 붙여 침');
  const score = texture.tupletCount + (texture.rightPoly ? 5 : 0) + (texture.rightLong ? 5 : 0) + Math.max(0, maxLeap - 5) + texture.chordCount;
  return { reasons: [...new Set(reasons)], steps: [...new Set(steps)], score, maxLeap };
}

function sectionSimilarity(a, b) {
  const setA = new Set(a.map((measure) => measure.harmony.roman));
  const setB = new Set(b.map((measure) => measure.harmony.roman));
  const common = [...setA].filter((item) => setB.has(item)).length;
  return common / Math.max(1, new Set([...setA, ...setB]).size);
}

function findCadence(measures, endIndex) {
  const current = measures[endIndex]?.harmony.roman;
  const previous = measures[endIndex - 1]?.harmony.roman;
  if (previous?.startsWith('V') && current?.startsWith('I')) return '오센틱 케이던스로 들림';
  if (previous?.startsWith('IV') && current?.startsWith('I')) return '플라갈 케이던스로 들림';
  if (previous?.startsWith('V') && current?.startsWith('vi')) return '디셉티브 케이던스로 들림';
  if (current?.startsWith('V')) return '하프 케이던스로 들림';
  return `${current || '코드'}에서 숨을 고름`;
}

function buildForm(measures) {
  const count = measures.length;
  const size = count >= 24 ? 8 : count >= 12 ? 4 : Math.max(1, Math.ceil(count / 2));
  const sections = [];
  for (let start = 0; start < count; start += size) {
    const slice = measures.slice(start, Math.min(start + size, count));
    sections.push({ start, end: start + slice.length - 1, measures: slice });
  }
  const names = sections.map((section, index) => {
    if (index > 0 && sectionSimilarity(sections[0].measures, section.measures) >= 0.6) return 'A′';
    return String.fromCharCode(65 + index);
  });
  return sections.map((section, index) => ({
    name: names[index],
    start: section.start,
    end: section.end,
    label: `${names[index]} · ${measures[section.start].number}~${measures[section.end].number}마디`,
    cadence: findCadence(measures, section.end),
  }));
}

function buildDayPlan(measures, form, priority) {
  const hard = priority[0]?.number || measures[0]?.number;
  const second = priority[1]?.number || hard;
  const lastSection = form[form.length - 1];
  const lastRange = `${measures[lastSection.start].number}~${measures[lastSection.end].number}`;
  const firstRange = `${measures[form[0].start].number}~${measures[form[0].end].number}`;
  return [
    { day: 1, title: '어려운 점부터 연습함', body: `${hard}마디와 ${second}마디를 한 손씩 나누어 익힘. 각 마디의 다음 첫 음까지 붙여 침.` },
    { day: 2, title: '보이스와 반주를 분리함', body: '탑 노트, 이너 보이스, 왼손 반주를 따로 익힌 뒤 양손을 합침.' },
    { day: 3, title: '첫 부분을 정리함', body: `${firstRange}마디의 음형과 핑거링을 고정함. 첫 마디와 중간 마디에서 암보로 시작함.` },
    { day: 4, title: '곡 끝을 먼저 완성함', body: `${lastRange}마디를 뒤에서부터 나누어 익힘. 마지막 마디에서 한 마디씩 앞으로 붙임.` },
    { day: 5, title: '부분 사이를 연결함', body: '각 부분의 마지막 박과 다음 부분의 첫 박을 따로 연습함. 전곡을 한 번 끊기지 않고 연주함.' },
    { day: 6, title: '코드 진행과 멜로디를 들음', body: '로마 숫자 코드와 케이던스를 확인함. 오른손 멜로디와 왼손 반주의 밸런스를 맞춤.' },
    { day: 7, title: '속도를 올림', body: '손과 팔이 릴렉스된 속도에서 시작함. 긴장되기 직전까지만 메트로놈을 올림.' },
    { day: 8, title: '완성 여부를 확인함', body: '악보 없이 여러 마디에서 시작함. 녹음을 시작한 뒤 끝까지 끊기지 않고 연주함. 건반 없이도 끝까지 머릿속으로만 연주함.' },
  ];
}

export function analyzeMovementXml(xml) {
  const doc = parseScoreDocument(xml);
  const part = directChildren(doc.documentElement, 'part')[0];
  const state = { divisions: 1, fifths: 0, mode: 'major', beats: 4, beatType: 4 };
  const measures = directChildren(part, 'measure').map((measure, index) => parseMeasure(measure, index, state));
  const key = measures[0]?.key || keyFromAttributes(0, 'major');
  const priority = [...measures].sort((a, b) => b.difficulty.score - a.difficulty.score).slice(0, Math.min(8, measures.length));
  const form = buildForm(measures);
  const title = textOf(doc, 'work-title', textOf(doc, 'movement-title', '업로드한 악보'));
  return {
    title,
    key,
    time: `${measures[0]?.beats || 4}/${measures[0]?.beatType || 4}`,
    measureCount: measures.length,
    measures,
    priority,
    form,
    dayPlan: buildDayPlan(measures, form, priority),
  };
}

