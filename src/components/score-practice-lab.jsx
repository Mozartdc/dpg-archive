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
    ? '한 마디 안에서 코드이 바뀌거나 논코드톤이 많아 가장 가까운 코드으로 표시함.'
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
        <p>{measure.number}마디를 암보 시작 마디로 삼음. 오른손 첫 음 {measure.firstRight}, 왼손 첫 음 {measure.firstLeft}, {measure.harmony.roman} 코드을 말한 뒤 악보 없이 시작함.</p>
      </section>
    </aside>
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
  const [screen, setScreen] = useState('measure');
  const [status, setStatus] = useState('체르니 30번 1번 예제를 여는 중임.');
  const [dragging, setDragging] = useState(false);
  const scoreRef = useRef(null);

  const currentMeasure = analysis?.measures[selectedIndex];

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
    });
  }, [selectedIndex, svgs]);

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

  const measureButtons = useMemo(() => analysis?.measures || [], [analysis]);

  return (
    <div className="score-lab">
      <header className="score-lab__hero">
        <div>
          <span className="score-lab__eyebrow">DPINSIDE 악보 연습실</span>
          <h1>악보를 불러오면 연습 루트가 바로 보임</h1>
          <p>MXL과 MusicXML을 내 기기에서 바로 조판함. 마디를 누르면 코드, 멜로디, 반주 텍스처, 핑거링, 연습 순서, 암보 요령이 한 화면에 붙어 나옴.</p>
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
        <div className="score-lab__view-tabs" aria-label="결과 보기">
          <button type="button" className={screen === 'measure' ? 'is-active' : ''} onClick={() => setScreen('measure')}>악보 + 마디 코칭</button>
          <button type="button" className={screen === 'plan' ? 'is-active' : ''} onClick={() => setScreen('plan')}>1일차부터 완성까지</button>
        </div>
      </div>

      {analysis && (
        <>
          <section className="score-lab__overview">
            <div><span>키</span><strong>{analysis.key.name}</strong></div>
            <div><span>박자</span><strong>{analysis.time}</strong></div>
            <div><span>길이</span><strong>{analysis.measureCount}마디</strong></div>
            <div className="score-lab__form"><span>프레이즈 맵</span><strong>{analysis.form.map((section) => section.label).join(' · ')}</strong></div>
          </section>

          {screen === 'measure' ? (
            <>
              <section className="score-lab__priority">
                <span className="score-lab__eyebrow">우선 공략 마디</span>
                <div>
                  {analysis.priority.map((measure, index) => (
                    <button key={measure.index} type="button" onClick={() => setSelectedIndex(measure.index)} className={selectedIndex === measure.index ? 'is-active' : ''}>
                      {index + 1}번 · {measure.number}마디
                    </button>
                  ))}
                </div>
              </section>

              <div className="score-lab__workspace">
                <main className="score-lab__score-column">
                  <div className="score-lab__measure-strip" aria-label="마디 선택">
                    {measureButtons.map((measure) => (
                      <button key={measure.index} type="button" className={selectedIndex === measure.index ? 'is-active' : ''} onClick={() => setSelectedIndex(measure.index)}>{measure.number}</button>
                    ))}
                  </div>
                  <div className="score-lab__score" ref={scoreRef}>
                    {svgs.map((svg, index) => <div className="score-lab__page" key={index} dangerouslySetInnerHTML={{ __html: svg }} />)}
                  </div>
                </main>
                <MeasureAnalysis measure={currentMeasure} onMove={moveMeasure} />
              </div>
            </>
          ) : (
            <section className="score-lab__plan">
              <div className="score-lab__form-map">
                {analysis.form.map((section) => (
                  <button key={section.name} type="button" onClick={() => { setSelectedIndex(section.start); setScreen('measure'); }}>
                    <strong>{section.label}</strong>
                    <span>{section.cadence}</span>
                  </button>
                ))}
              </div>
              <div className="score-lab__days">
                {analysis.dayPlan.map((day) => (
                  <article key={day.day}>
                    <span>{String(day.day).padStart(2, '0')}</span>
                    <div><h2>{day.day}일차 · {day.title}</h2><p>{day.body}</p></div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

