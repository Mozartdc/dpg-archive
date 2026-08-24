const STEP = { c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B' };
const PITCH_CLASS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const FIFTHS = {
  c: 0, g: 1, d: 2, a: 3, e: 4, b: 5, fis: 6, cis: 7,
  f: -1, bes: -2, ees: -3, aes: -4, des: -5, ges: -6, ces: -7,
};

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function matchingBrace(source, start) {
  let depth = 0;
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && source[index - 1] !== '\\') quoted = !quoted;
    if (quoted) continue;
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) return index;
  }
  return -1;
}

function cleanSource(source) {
  return source
    .replace(/%\{[\s\S]*?%\}/g, ' ')
    .replace(/%[^\n\r]*/g, ' ')
    .replace(/#\([^)]*\)|#'[^\s{}]+/g, ' ');
}

function collectVariables(source) {
  const variables = new Map();
  const pattern = /(?:^|\n)\s*([A-Za-z][\w-]*)\s*=\s*(?:\\relative\s+([a-g](?:isis|eses|is|es)?[',]*))?\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    const open = source.indexOf('{', match.index + match[0].length - 1);
    const close = matchingBrace(source, open);
    if (close < 0) continue;
    variables.set(match[1], { base: match[2] || 'c\'', body: source.slice(open + 1, close) });
    pattern.lastIndex = close + 1;
  }
  return variables;
}

function expandVariables(body, variables, active = new Set()) {
  return body.replace(/\\([A-Za-z][\w-]*)/g, (whole, name) => {
    const variable = variables.get(name);
    if (!variable || active.has(name)) return whole;
    const next = new Set(active);
    next.add(name);
    return ` { ${expandVariables(variable.body, variables, next)} } `;
  });
}

function findMusicBlocks(source, variables) {
  const global = variables.get('global')?.body || '';
  const named = [...variables.entries()].filter(([name, value]) => {
    if (/^(global|layout|paper|header|midi)$/i.test(name)) return false;
    return /(?:^|[\s<{])(?:[a-g](?:isis|eses|is|es)?|r|s|R)[',]*\d*/.test(value.body);
  });
  const preferred = named.filter(([name]) => /right|upper|treble|melody|left|lower|bass/i.test(name));
  const chosen = (preferred.length ? preferred : named).slice(0, 2);
  if (chosen.length) {
    return chosen.map(([name, value]) => ({
      name,
      base: value.base,
      body: `${global} ${expandVariables(value.body, variables, new Set([name]))}`,
    }));
  }
  const scoreAt = source.search(/\\score\s*\{/);
  if (scoreAt >= 0) {
    const open = source.indexOf('{', scoreAt);
    const close = matchingBrace(source, open);
    if (close > open) return [{ name: 'music', base: 'c\'', body: `${global} ${source.slice(open + 1, close)}` }];
  }
  return [{ name: 'music', base: 'c\'', body: source }];
}

function alteration(name) {
  if (name.includes('isis')) return 2;
  if (name.includes('eses')) return -2;
  if (name.includes('is')) return 1;
  if (name.includes('es')) return -1;
  return 0;
}

function parsePitch(token, previousMidi) {
  const match = token.match(/^([a-g])((?:isis|eses|is|es)?)([',]*)/);
  if (!match) return null;
  const [, letter, accidental, octaveMarks] = match;
  const pitchClass = (PITCH_CLASS[letter] + alteration(accidental) + 12) % 12;
  let midi = 60 + pitchClass;
  while (midi - previousMidi > 6) midi -= 12;
  while (previousMidi - midi > 6) midi += 12;
  for (const mark of octaveMarks) midi += mark === "'" ? 12 : -12;
  return { step: STEP[letter], alter: alteration(accidental), octave: Math.floor(midi / 12) - 1, midi };
}

function durationFromToken(token, fallback, divisions) {
  const match = token.match(/(1|2|4|8|16|32|64)(\.*)$/);
  if (!match) return fallback;
  const denominator = Number(match[1]);
  let value = divisions * 4 / denominator;
  let addition = value / 2;
  for (const dot of match[2]) {
    value += addition;
    addition /= 2;
  }
  return Math.round(value);
}

function durationType(duration, divisions) {
  const ratio = duration / divisions;
  if (ratio >= 4) return 'whole';
  if (ratio >= 2) return 'half';
  if (ratio >= 1) return 'quarter';
  if (ratio >= 0.5) return 'eighth';
  if (ratio >= 0.25) return '16th';
  if (ratio >= 0.125) return '32nd';
  return '64th';
}

function baseMidi(token) {
  const parsed = token.match(/^([a-g])(?:isis|eses|is|es)?([',]*)/);
  if (!parsed) return 60;
  let midi = 48 + PITCH_CLASS[parsed[1]] + alteration(token);
  for (const mark of parsed[2]) midi += mark === "'" ? 12 : -12;
  return midi;
}

function tokenize(body) {
  const withoutText = body.replace(/"(?:\\.|[^"\\])*"/g, ' ');
  return withoutText.match(/<[^>]+>(?:1|2|4|8|16|32|64)?\.*|\\[A-Za-z][\w-]*|\d+\/\d+|(?:[a-g](?:isis|eses|is|es)?|r|s|R)[',]*(?:1|2|4|8|16|32|64)?\.*|[|{}]/g) || [];
}

function parseBlock(block, shared) {
  const divisions = 480;
  let previousMidi = baseMidi(block.base);
  let currentDuration = divisions;
  let beats = shared.beats;
  let beatType = shared.beatType;
  let measureSize = divisions * beats * 4 / beatType;
  let elapsed = 0;
  let events = [];
  const measures = [];
  const tokens = tokenize(block.body);

  const finishMeasure = () => {
    if (!events.length) return;
    measures.push(events);
    events = [];
    elapsed = 0;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '\\time' && /^\d+\/\d+$/.test(tokens[index + 1] || '')) {
      [beats, beatType] = tokens[++index].split('/').map(Number);
      shared.beats = beats;
      shared.beatType = beatType;
      measureSize = divisions * beats * 4 / beatType;
      continue;
    }
    if (token === '\\key') {
      const tonic = tokens[index + 1];
      const mode = tokens[index + 2];
      if (tonic && /^[a-g]/.test(tonic)) {
        shared.tonic = tonic.replace(/[',\d.]/g, '');
        index += 1;
      }
      if (mode === '\\major' || mode === '\\minor') {
        shared.mode = mode.slice(1);
        index += 1;
      }
      continue;
    }
    if (token === '|') {
      finishMeasure();
      continue;
    }
    const isChord = token.startsWith('<');
    const isRest = /^[rRs]/.test(token);
    const isNote = /^[a-g]/.test(token);
    if (!isChord && !isRest && !isNote) continue;
    const duration = durationFromToken(token, currentDuration, divisions);
    currentDuration = duration;
    if (elapsed && elapsed + duration > measureSize + 1) finishMeasure();
    if (isChord) {
      const inside = token.slice(1, token.indexOf('>'));
      const pitches = inside.match(/[a-g](?:isis|eses|is|es)?[',]*/g) || [];
      pitches.forEach((pitchToken, chordIndex) => {
        const pitch = parsePitch(pitchToken, chordIndex ? previousMidi : previousMidi);
        if (!pitch) return;
        if (chordIndex === 0) previousMidi = pitch.midi;
        events.push({ duration, pitch, chord: chordIndex > 0 });
      });
    } else if (isRest) {
      events.push({ duration, rest: true });
    } else {
      const pitch = parsePitch(token, previousMidi);
      if (pitch) {
        previousMidi = pitch.midi;
        events.push({ duration, pitch });
      }
    }
    elapsed += duration;
    if (elapsed >= measureSize - 1) finishMeasure();
  }
  finishMeasure();
  return measures;
}

function noteXml(event, staff, divisions) {
  const pitch = event.rest
    ? '<rest/>'
    : `<pitch><step>${event.pitch.step}</step>${event.pitch.alter ? `<alter>${event.pitch.alter}</alter>` : ''}<octave>${event.pitch.octave}</octave></pitch>`;
  return `<note>${event.chord ? '<chord/>' : ''}${pitch}<duration>${event.duration}</duration><voice>1</voice><type>${durationType(event.duration, divisions)}</type><staff>${staff}</staff></note>`;
}

export function lilyPondToMusicXml(input, fileName = 'score.ly') {
  const source = cleanSource(input);
  const variables = collectVariables(source);
  const blocks = findMusicBlocks(source, variables);
  const title = source.match(/\\header\s*\{[\s\S]*?title\s*=\s*"([^"]+)"/)?.[1]
    || fileName.replace(/\.ly$/i, '');
  const time = source.match(/\\time\s+(\d+)\/(\d+)/);
  const key = source.match(/\\key\s+([a-g](?:isis|eses|is|es)?)\s+\\(major|minor)/);
  const shared = {
    beats: Number(time?.[1] || 4),
    beatType: Number(time?.[2] || 4),
    tonic: key?.[1] || 'c',
    mode: key?.[2] || 'major',
  };
  const staves = blocks.map((block) => parseBlock(block, shared));
  const measureCount = Math.max(0, ...staves.map((staff) => staff.length));
  if (!measureCount) throw new Error('선택한 악보에서 분석할 음표를 찾지 못했음.');
  const divisions = 480;
  const fifths = FIFTHS[shared.tonic] ?? 0;
  const measureDuration = Math.round(divisions * shared.beats * 4 / shared.beatType);
  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const attributes = measureIndex === 0
      ? `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths><mode>${shared.mode}</mode></key><time><beats>${shared.beats}</beats><beat-type>${shared.beatType}</beat-type></time><staves>${staves.length}</staves><clef number="1"><sign>G</sign><line>2</line></clef>${staves.length > 1 ? '<clef number="2"><sign>F</sign><line>4</line></clef>' : ''}</attributes>`
      : '';
    const staffXml = staves.map((staff, staffIndex) => {
      const notes = (staff[measureIndex] || []).map((event) => noteXml(event, staffIndex + 1, divisions)).join('');
      const backup = staffIndex > 0 ? `<backup><duration>${measureDuration}</duration></backup>` : '';
      return `${backup}${notes}`;
    }).join('');
    return `<measure number="${measureIndex + 1}">${attributes}${staffXml}</measure>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(title)}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}
