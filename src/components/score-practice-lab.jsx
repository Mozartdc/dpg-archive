import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import {
  analyzeMovementXml,
  getScoreMovements,
  parseScoreDocument,
  sliceMovementXml,
} from '../lib/musicxml-analysis.js';
import './score-practice-lab.css';
import './score-practice-lab-refined.css';

let verovioPromise;

async function getVerovioToolkit() {
  if (!verovioPromise) {
    verovioPromise = createVerovioModule().then((module) => new VerovioToolkit(module));
  }
  return verovioPromise;
}

async function readScoreFile(file) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.mxl')) return file.text();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let scorePath = '';
  const container = zip.file('META-INF/container.xml');
  if (container) {
    const containerDoc = new DOMParser().parseFromString(await container.async('text'), 'application/xml');
    scorePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || '';
  }
  const scoreFile = (scorePath && zip.file(scorePath)) || Object.values(zip.files).find((entry) => !entry.dir && /\.(musicxml|xml)$/i.test(entry.name) && !entry.name.includes('META-INF'));
  if (!scoreFile) throw new Error('MXL 안에서 MusicXML 악보를 찾지 못했음.');
  return scoreFile.async('text');
}

function MeasureAnalysis({ measure, onMove }) {
  if (!measure) return null;
  const harmonyNote = measure.harmony.confidence < 0.6
    ? '한 마디 안에서 코드가 바뀌거나 논코드톤이 많아 가장 가까운 코드로 표시함.'
    : '베이스와 오래 유지되는 코드톤을 함께 보고 가장 가까운 코드를 잡음.';
  return (
    <aside className="score-lab__analysis">
      <div className="score-lab__measure-head">
        <div>
          <span className="score-lab__eyebrow">현재 코칭</span>
          <h2>{measure.number}마디</h2>
        </div>
        <div className="score-lab__measure-nav">
          <button type="button" onClick={() => onMove(-1)} aria-label="앞 마디">이전</button>
          <button type="button" onClick={() => onMove(1)} aria-label="다음 마디">다음</button>
        </div>
      </div>

      <section className="score-lab__block score-lab__block--harmony">
        <span className="score-lab__eyebrow">코드 분석</span>
        <div className="score-lab__roman">{measure.harmony.roman}</div>
        <p><strong>{measure.harmony.chord}</strong>{measure.harmony.inversion && ` · ${measure.harmony.inversion}`}</p>
        {measure.harmony.nonChord.length > 0 && <p>논코드톤: {measure.harmony.nonChord.join('·')}</p>}
        <p className="score-lab__muted">{harmonyNote}</p>
      </section>

      <section className="score-lab__block">
        <span className="score-lab__eyebrow">멜로디와 반주 텍스처</span>
        <p>오른손: {measure.texture.rightLabel}</p>
        <p>왼손: {measure.texture.leftLabel}</p>
        {measure.directions.length > 0 && <p>악보 메모: {measure.directions.join(' · ')}</p>}
        {measure.fingerings.length > 0 && <p>적힌 핑거링: {measure.fingerings.join('-')}</p>}
      </section>

      <section className="score-lab__block score-lab__block--practice">
        <span className="score-lab__eyebrow">어려운 점</span>
        <ul>{measure.difficulty.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <span className="score-lab__eyebrow score-lab__eyebrow--spaced">연습 루틴</span>
        <ol>{measure.difficulty.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>

      <section className="score-lab__memory">
        <span className="score-lab__eyebrow">암보 요령</span>
        <p>{measure.number}마디를 암보 시작 마디로 삼음. 오른손 첫 음 {measure.firstRight}, 왼손 첫 음 {measure.firstLeft}, {measure.harmony.roman} 코드를 말한 뒤 악보 없이 시작함.</p>
      </section>
    </aside>
  );
}

function getDayMeasureIndices(day, analysis) {
  if (!analysis?.measures.length) return [];
  const range = (section) => section
    ? Array.from({ length: section.end - section.start + 1 }, (_, index) => section.start + index)
    : [];
  const all = analysis.measures.map((measure) => measure.index);
  const priority = analysis.priority.slice(0, 2).map((measure) => measure.index);

  if (day === 1 || day === 2) return priority;
  if (day === 3) return range(analysis.form[0]);
  if (day === 4) return range(analysis.form.at(-1));
  if (day === 5) {
    const middle = analysis.form.slice(1, -1).flatMap(range);
    return middle.length ? middle : all;
  }
  if (day === 6) return [...new Set([...priority, ...analysis.form.map((section) => section.start)])].sort((a, b) => a - b);
  return all;
}

function formatMeasureRange(indices, analysis) {
  if (!indices.length || indices.length === analysis.measures.length) return '곡 전체';
  const numbers = indices.map((index) => analysis.measures[index]?.number).filter(Boolean);
  if (numbers.length === 1) return `${numbers[0]}마디`;
  const sequential = indices.every((value, index) => index === 0 || value === indices[index - 1] + 1);
  return sequential ? `${numbers[0]}~${numbers.at(-1)}마디` : `${numbers.join('·')}마디`;
}

function getDayDetails(indices, analysis) {
  const measures = indices.map((index) => analysis.measures[index]).filter(Boolean);
  const parts = analysis.form.filter((section) => indices.some((index) => index >= section.start && index <= section.end));
  const reasons = [...new Set(measures.flatMap((measure) => measure.difficulty.reasons))].slice(0, 3);
  const steps = [...new Set(measures.flatMap((measure) => measure.difficulty.steps))].slice(0, 4);
  return { parts, reasons, steps };
}

function PracticePlan({ analysis, selectedDay, onSelectDay }) {
  return (
    <section className="score-lab__plan score-lab__plan-panel">
      <div className="score-lab__plan-head">
        <span className="score-lab__step-number">3</span>
        <div>
          <span className="score-lab__eyebrow">완성까지 연습 순서</span>
          <h2>Day 1부터 차례대로 진행함</h2>
          <p>각 Day에서 연습할 파트와 마디를 먼저 확인한 뒤 아래 순서대로 연습함.</p>
        </div>
      </div>
      <div className="score-lab__days" role="list">
        {analysis.dayPlan.map((day) => {
          const indices = getDayMeasureIndices(day.day, analysis);
          const details = getDayDetails(indices, analysis);
          return (
            <article
              className={`score-lab__day-card ${selectedDay === day.day ? 'is-active' : ''}`}
              key={day.day}
              role="listitem"
            >
              <div className="score-lab__day-index">
                <span>DAY</span>
                <strong>{String(day.day).padStart(2, '0')}</strong>
              </div>
              <div className="score-lab__day-content">
                <header>
                  <div>
                    <span className="score-lab__day-range">연습 범위 · {formatMeasureRange(indices, analysis)}</span>
                    <h3>{day.title}</h3>
                  </div>
                  <button type="button" onClick={() => onSelectDay(day.day)}>악보에서 보기</button>
                </header>
                <div className="score-lab__day-parts">
                  <strong>연습 파트</strong>
                  <span>{details.parts.map((part) => part.label).join(' · ') || '곡 전체'}</span>
                </div>
                <div className="score-lab__day-method">
                  <div>
                    <h4>오늘의 목표</h4>
                    <p>{day.body}</p>
                    {details.reasons.length > 0 && (
                      <>
                        <h4>먼저 풀어야 할 점</h4>
                        <ul>{details.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                      </>
                    )}
                  </div>
                  <div>
                    <h4>연습 순서</h4>
                    {details.steps.length > 0
                      ? <ol>{details.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                      : <p>느린 템포로 한 손씩 확인한 뒤, 같은 구간을 양손으로 이어서 연주함.</p>}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function ScorePracticeLab() {
  const [sourceXml, setSourceXml] = useState('');
  const [sourceDoc, setSourceDoc] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementIndex, setMovementIndex] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [svgs, setSvgs] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);
  const [screen, setScreen] = useState('measure');
  const [status, setStatus] = useState('체르니 30번 1번 예제를 여는 중임.');
  const [dragging, setDragging] = useState(false);
  const scoreRef = useRef(null);

  const currentMeasure = analysis?.measures[selectedIndex];
  const planMeasureIndices = useMemo(
    () => getDayMeasureIndices(selectedDay, analysis),
    [analysis, selectedDay],
  );

  const loadXml = async (xml, label) => {
    const doc = parseScoreDocument(xml);
    const pieces = getScoreMovements(doc);
    setSourceXml(xml);
    setSourceDoc(doc);
    setMovements(pieces);
    setMovementIndex(0);
    setStatus(`${label}에서 ${pieces.length > 1 ? `${pieces.length}곡을 찾았음.` : '악보를 찾았음.'}`);
  };

  const loadDemo = async () => {
    setStatus('체르니 30번 1번 예제를 여는 중임.');
    const response = await fetch('/samples/czerny-op849-no1.musicxml');
    if (!response.ok) throw new Error('체르니 예제 악보를 열지 못했음.');
    await loadXml(await response.text(), '체르니 30번 1번');
  };

  useEffect(() => {
    loadDemo().catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!sourceDoc || !movements[movementIndex]) return;
    let cancelled = false;
    const prepare = async () => {
      setStatus('악보를 조판하고 화성을 살펴보는 중임.');
      const xml = sliceMovementXml(sourceDoc, movements[movementIndex]);
      const nextAnalysis = analyzeMovementXml(xml);
      const toolkit = await getVerovioToolkit();
      toolkit.setOptions({
        pageWidth: 1160,
        pageHeight: 1550,
        scale: 34,
        adjustPageHeight: true,
        breaks: 'auto',
        footer: 'none',
        header: 'none',
        spacingStaff: 7,
        spacingSystem: 10,
      });
      toolkit.loadData(xml);
      const pages = Array.from({ length: toolkit.getPageCount() }, (_, index) => toolkit.renderToSVG(index + 1));
      if (cancelled) return;
      setAnalysis(nextAnalysis);
      setSvgs(pages);
      setSelectedIndex(nextAnalysis.priority[0]?.index || 0);
      setStatus(`${nextAnalysis.title} · ${nextAnalysis.measureCount}마디 분석 완료`);
    };
    prepare().catch((error) => setStatus(error.message || '악보를 읽는 중 문제가 생겼음.'));
    return () => { cancelled = true; };
  }, [sourceDoc, sourceXml, movements, movementIndex]);

  useEffect(() => {
    if (!scoreRef.current || !analysis) return undefined;
    const groups = Array.from(scoreRef.current.querySelectorAll('g.measure'));
    const cleanups = groups.map((group, index) => {
      group.dataset.measureIndex = String(index);
      const click = () => {
        setSelectedIndex(index);
        setScreen('measure');
      };
      group.addEventListener('click', click);
      return () => group.removeEventListener('click', click);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [svgs, analysis]);

  useEffect(() => {
    if (!scoreRef.current) return;
    scoreRef.current.querySelectorAll('g.measure').forEach((group, index) => {
      group.classList.toggle('score-lab__selected-measure', index === selectedIndex);
      group.classList.toggle('is-plan-measure', screen === 'plan' && planMeasureIndices.includes(index));
    });
  }, [selectedIndex, svgs, screen, planMeasureIndices]);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      setStatus(`${file.name}을 읽는 중임.`);
      await loadXml(await readScoreFile(file), file.name);
    } catch (error) {
      setStatus(error.message || '악보 파일을 읽지 못했음.');
    }
  };

  const moveMeasure = (delta) => {
    if (!analysis) return;
    const next = Math.min(analysis.measures.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedIndex(next);
    scoreRef.current?.querySelector(`g.measure[data-measure-index="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const focusMeasure = (index, nextScreen = screen) => {
    setSelectedIndex(index);
    setScreen(nextScreen);
    requestAnimationFrame(() => {
      scoreRef.current?.querySelector(`g.measure[data-measure-index="${index}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const selectPracticeDay = (day) => {
    const indices = getDayMeasureIndices(day, analysis);
    setSelectedDay(day);
    if (indices.length) focusMeasure(indices[0], 'plan');
  };

  const measureButtons = useMemo(() => analysis?.measures || [], [analysis]);

  return (
    <div className="score-lab">
      <header className="score-lab__hero">
        <div>
          <span className="score-lab__eyebrow">DPINSIDE 악보 연습실</span>
          <h1>악보를 보면서 연습할 마디를 바로 찾음</h1>
          <p>MXL이나 MusicXML 악보를 불러오면 곡의 조성과 프레이즈, 어려운 마디를 먼저 살핌. 악보 옆에서 마디별 연습 순서와 암보 요령을 함께 확인할 수 있음.</p>
        </div>
        <div className="score-lab__privacy">내 기기에서만 분석함</div>
      </header>

      <section
        className={`score-lab__drop ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <div>
          <strong>MXL·MusicXML 불러오기</strong>
          <p>파일을 끌어다 놓거나 직접 고르면 바로 시작됨.</p>
        </div>
        <div className="score-lab__drop-actions">
          <label className="score-lab__file-button">
            악보 선택
            <input type="file" accept=".mxl,.xml,.musicxml,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml" onChange={(event) => handleFile(event.target.files[0])} />
          </label>
          <button type="button" className="score-lab__secondary-button" onClick={() => loadDemo().catch((error) => setStatus(error.message))}>체르니 30-1 예제</button>
        </div>
      </section>

      <div className="score-lab__toolbar">
        {movements.length > 1 && (
          <label>
            곡 번호
            <select value={movementIndex} onChange={(event) => setMovementIndex(Number(event.target.value))}>
              {movements.map((movement) => <option key={movement.index} value={movement.index}>{movement.label} · {movement.measureCount}마디</option>)}
            </select>
          </label>
        )}
        <div className="score-lab__status" role="status">{status}</div>
      </div>

      {analysis && (
        <>
          <section className="score-lab__orientation">
            <div className="score-lab__section-head">
              <span className="score-lab__step-number">1</span>
              <div>
                <span className="score-lab__eyebrow">곡 전체 읽기</span>
                <h2>조성과 프레이즈 구조를 먼저 확인함</h2>
              </div>
            </div>
            <div className="score-lab__orientation-grid">
              <div className="score-lab__key-card">
                <span>전체 조성</span>
                <strong>{analysis.key.name}</strong>
                <p>{analysis.key.name}을 중심으로 {analysis.time}박자, 전체 {analysis.measureCount}마디의 흐름을 먼저 익힘. 마디별 코드는 아래 악보에서 따로 확인함.</p>
              </div>
              <div className="score-lab__structure-card">
                <span>프레이즈 구조</span>
                <div className="score-lab__form-map">
                  {analysis.form.map((section) => (
                    <button key={section.name} type="button" onClick={() => focusMeasure(section.start, 'plan')}>
                      <strong>{section.label}</strong>
                      <span>{section.cadence}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="score-lab__score-stage">
            <div className="score-lab__section-head">
              <span className="score-lab__step-number">2</span>
              <div>
                <span className="score-lab__eyebrow">악보에서 확인하기</span>
                <h2>어려운 마디부터 위치와 음형을 익힘</h2>
              </div>
            </div>
            <section className="score-lab__priority">
              <span className="score-lab__eyebrow">우선 공략 마디</span>
              <div>
                {analysis.priority.map((measure, index) => (
                  <button key={measure.index} type="button" onClick={() => focusMeasure(measure.index, 'measure')} className={selectedIndex === measure.index ? 'is-active' : ''}>
                    {index + 1}번 · {measure.number}마디
                  </button>
                ))}
              </div>
            </section>

            <div className="score-lab__workspace">
              <main className="score-lab__score-column">
                <div className="score-lab__measure-strip" aria-label="마디 선택">
                  {measureButtons.map((measure) => (
                    <button key={measure.index} type="button" className={selectedIndex === measure.index ? 'is-active' : ''} onClick={() => focusMeasure(measure.index, 'measure')}>{measure.number}</button>
                  ))}
                </div>
                <div className="score-lab__score" ref={scoreRef}>
                  {svgs.map((svg, index) => <div className="score-lab__page" key={index} dangerouslySetInnerHTML={{ __html: svg }} />)}
                </div>
              </main>
              <MeasureAnalysis measure={currentMeasure} onMove={moveMeasure} />
            </div>
          </section>

          <PracticePlan analysis={analysis} selectedDay={selectedDay} onSelectDay={selectPracticeDay} />
        </>
      )}
    </div>
  );
}
