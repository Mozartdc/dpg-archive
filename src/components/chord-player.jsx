import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';

export default function ChordPlayer() {
  const [chords, setChords] = useState([]);
  const [input, setInput] = useState('');
  const [selectedChords, setSelectedChords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  useEffect(() => {
    fetch('/data/chords.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          setLoading(false);
          return;
        }
        
        // 제대로 된 CSV 파싱 (따옴표 처리)
        const parseCsvLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCsvLine(lines[0]);
        console.log('헤더:', headers);
        
        const data = lines.slice(1).map(line => {
          const values = parseCsvLine(line);
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = values[i] || '';
          });
          
          // fullName = Code_name + Code-S + Code-sub_name
          obj.fullName = obj['Code_name'] + obj['Code-S'] + obj['Code-sub_name'];
          
          return obj;
        });
        
        console.log('CSV 로드 완료. 예시:', data.slice(0, 5).map(c => ({
          name: c.fullName,
          key: c.key
        })));
        setChords(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('CSV 로딩 실패:', err);
        setLoading(false);
      });
  }, []);

  // fullName → SVG 파일명
  const nameToSvg = (fullName) => {
    if (!fullName) return null;
    
    // 1. 루트음 추출 (A-G)
    const root = fullName[0];
    let rest = fullName.slice(1);
    
    let result = root;
    
    // 2. 첫 번째 b 또는 # 처리
    if (rest[0] === 'b') {
      result += '_flat_flat';
      rest = rest.slice(1);
    } else if (rest[0] === '#') {
      result += '_sharp_sharp';
      rest = rest.slice(1);
    }
    
    // 3. 나머지 처리
    if (rest) {
      // 띄어쓰기 → _
      rest = rest.replace(/ /g, '_');
      
      // 7b5, 7#9 등 (숫자 뒤 b/# → flat/sharp)
      rest = rest.replace(/(\d+)b(\d+)/g, '$1flat$2');
      rest = rest.replace(/(\d+)#(\d+)/g, '$1sharp$2');
      
      // m, 7, 9 등 앞에 _ 추가
      result += '_' + rest;
    }
    
    return `/chords/${result}.svg`;
  };

  const parseInput = (text) => {
    const separator = text.includes('-') ? '-' : ' ';
    return text.split(separator).map(c => c.trim()).filter(Boolean);
  };

  const findChord = (codeName) => {
    // 대소문자 무시 검색
    const found = chords.find(c => c.fullName.toLowerCase() === codeName.toLowerCase());
    if (!found) {
      console.warn(`코드 못 찾음: "${codeName}" (대소문자 확인 필요)`);
    }
    return found;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const names = parseInput(input);
    const found = names.map(name => {
      const chord = findChord(name);
      if (chord) {
        const svgPath = nameToSvg(chord.fullName);
        console.log(`${name} → ${svgPath}`);
        return { ...chord, svgPath };
      }
      return null;
    }).filter(Boolean);
    
    setSelectedChords(found);
    
    // 검색 결과가 없으면 경고
    if (found.length === 0 && names.length > 0) {
      console.warn('입력한 코드:', names, '/ 사용 가능한 코드 예시:', chords.slice(0, 5).map(c => c.fullName));
    }
  };

  const noteToFreq = (noteName) => {
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
      'Cb': 11, 'Bbb': 9, 'Dbb': 0, 'Ebb': 3
    };
    
    const octave = 4;
    const semitone = noteMap[noteName];
    if (semitone === undefined) return null;
    
    const midiNote = 12 * (octave + 1) + semitone;
    return Tone.Frequency(midiNote, "midi").toFrequency();
  };

  const playChord = async (chord) => {
    if (isPlaying) return;
    setIsPlaying(true);
    
    try {
      // iOS Safari 호환성
      await Tone.start();
      
      const piano = new Tone.Sampler({
        urls: {
          A0: "A0.mp3",
          C1: "C1.mp3",
          "D#1": "Ds1.mp3",
          "F#1": "Fs1.mp3",
          A1: "A1.mp3",
          C2: "C2.mp3",
          "D#2": "Ds2.mp3",
          "F#2": "Fs2.mp3",
          A2: "A2.mp3",
          C3: "C3.mp3",
          "D#3": "Ds3.mp3",
          "F#3": "Fs3.mp3",
          A3: "A3.mp3",
          C4: "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          A4: "A4.mp3",
          C5: "C5.mp3",
          "D#5": "Ds5.mp3",
          "F#5": "Fs5.mp3",
          A5: "A5.mp3",
          C6: "C6.mp3",
          "D#6": "Ds6.mp3",
          "F#6": "Fs6.mp3",
          A6: "A6.mp3",
          C7: "C7.mp3",
          "D#7": "Ds7.mp3",
          "F#7": "Fs7.mp3",
          A7: "A7.mp3",
          C8: "C8.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/"
      }).toDestination();
      
      await Tone.loaded();
      
      const notes = chord.key.split(',').map(n => {
        const freq = noteToFreq(n.trim());
        if (!freq) return null;
        return Tone.Frequency(freq, "hz").toNote();
      }).filter(Boolean);
      
      piano.triggerAttackRelease(notes, "2n");
      
      setTimeout(() => {
        piano.dispose();
        setIsPlaying(false);
      }, 2500);
    } catch (error) {
      console.error('재생 오류:', error);
      setIsPlaying(false);
    }
  };

  // 연속 재생
  const playSequence = async () => {
    if (isPlayingSequence || selectedChords.length === 0) return;
    setIsPlayingSequence(true);
    
    try {
      await Tone.start();
      
      const piano = new Tone.Sampler({
        urls: {
          A0: "A0.mp3",
          C1: "C1.mp3",
          "D#1": "Ds1.mp3",
          "F#1": "Fs1.mp3",
          A1: "A1.mp3",
          C2: "C2.mp3",
          "D#2": "Ds2.mp3",
          "F#2": "Fs2.mp3",
          A2: "A2.mp3",
          C3: "C3.mp3",
          "D#3": "Ds3.mp3",
          "F#3": "Fs3.mp3",
          A3: "A3.mp3",
          C4: "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          A4: "A4.mp3",
          C5: "C5.mp3",
          "D#5": "Ds5.mp3",
          "F#5": "Fs5.mp3",
          A5: "A5.mp3",
          C6: "C6.mp3",
          "D#6": "Ds6.mp3",
          "F#6": "Fs6.mp3",
          A6: "A6.mp3",
          C7: "C7.mp3",
          "D#7": "Ds7.mp3",
          "F#7": "Fs7.mp3",
          A7: "A7.mp3",
          C8: "C8.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/"
      }).toDestination();
      
      await Tone.loaded();
      
      const now = Tone.now();
      
      selectedChords.forEach((chord, index) => {
        const notes = chord.key.split(',').map(n => {
          const freq = noteToFreq(n.trim());
          if (!freq) return null;
          return Tone.Frequency(freq, "hz").toNote();
        }).filter(Boolean);
        
        piano.triggerAttackRelease(notes, "1n", now + index * 1.2);
      });
      
      setTimeout(() => {
        piano.dispose();
        setIsPlayingSequence(false);
      }, selectedChords.length * 1200 + 2000);
    } catch (error) {
      console.error('연속 재생 오류:', error);
      setIsPlayingSequence(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sl-color-gray-3)' }}>
        코드 데이터 로딩 중...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', color: 'var(--sl-color-text)' }}>
      <div style={{ marginBottom: '30px', borderBottom: '1px solid rgba(128, 128, 128, 0.3)', paddingBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          marginBottom: '10px', 
          color: '#86cecb',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
            <path fill="#86cecb" d="M13.5 2h-12C.673 2 0 2.673 0 3.5v9c0 .827.673 1.5 1.5 1.5h12c.827 0 1.5-.673 1.5-1.5v-9c0-.827-.673-1.5-1.5-1.5M11 13H8V9a1 1 0 0 0 1-1V3h1v5a1 1 0 0 0 1 1zM5 8V3h1v5a1 1 0 0 0 1 1v4H4V9a1 1 0 0 0 1-1m-4 4.5v-9c0-.275.225-.5.5-.5H2v5a1 1 0 0 0 1 1v4H1.5a.5.5 0 0 1-.5-.5m13 0c0 .275-.225.5-.5.5H12V9a1 1 0 0 0 1-1V3h.5c.275 0 .5.225.5.5z"/>
          </svg>
          피아노 코드 플레이어 사용 방법
        </h1>
        <p style={{ color: 'var(--sl-color-gray-3)', fontSize: '14px', marginBottom: '12px' }}>
          코드를 입력하면 건반 이미지와 함께 소리를 들을 수 있습니다 (총 {chords.length}개)
        </p>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '8px',
          fontSize: '13px',
          color: '#FF6F61',
          lineHeight: '1.5'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path fill="#FF6F61" d="M10 8a6 6 0 0 1 12 0c0 3.523-1.986 8.536-3.16 11.19C18.346 20.31 17.227 21 16 21s-2.345-.69-2.84-1.81C11.985 16.536 10 11.522 10 8m6 22a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7"/>
          </svg>
          <span>Tip: 코드를 입력할 때 반드시 하이픈(-)이나 공백으로 구분하세요. ex. C-G-Am-F / C G Am F</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ex. C-G-Am-F 또는 C G Am F"
            style={{
              flex: 1,
              minWidth: '300px',
              padding: '12px 16px',
              fontSize: '16px',
              border: '1px solid var(--sl-color-gray-5)',
              borderRadius: '8px',
              backgroundColor: 'var(--sl-color-bg-nav)',
              color: 'var(--sl-color-text)'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              background: '#86cecb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            코드 확인
          </button>
        </div>
      </form>

      {selectedChords.length > 0 && (
        <div>
          {/* 연속 재생 버튼 */}
          {selectedChords.length > 1 && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <button
                onClick={playSequence}
                disabled={isPlayingSequence}
                style={{
                  padding: '12px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: isPlayingSequence ? 'var(--sl-color-gray-5)' : '#86cecb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isPlayingSequence ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m-2 14.5v-9l6 4.5z"/>
                </svg>
                {isPlayingSequence ? `재생 중... (${selectedChords.length}개)` : `전체 연속 재생 (${selectedChords.length}개)`}
              </button>
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--sl-color-gray-3)' }}>
                각 코드가 1.2초 간격으로 순서대로 재생됩니다
              </div>
            </div>
          )}
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '20px'
          }}>
            {selectedChords.map((chord, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--sl-color-gray-5)',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: 'var(--sl-color-bg-nav)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', color: 'var(--sl-color-white)' }}>
                    {chord.fullName}
                  </h3>
                  <div style={{ fontSize: '14px', color: 'var(--sl-color-gray-3)' }}>
                    구성음: {chord.key}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--sl-color-gray-3)' }}>
                    핑거링: {chord.finger}
                  </div>
                </div>

                {chord.svgPath && (
                  <>
                    <img
                      src={chord.svgPath}
                      alt={chord.fullName}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        display: 'block'
                      }}
                      onError={(e) => {
                        console.error('SVG 로드 실패:', chord.svgPath);
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none', padding: '20px', textAlign: 'center', color: 'var(--sl-color-gray-3)', fontSize: '12px' }}>
                      이미지 없음: {chord.svgPath}
                    </div>
                  </>
                )}

                <button
                  onClick={() => playChord(chord)}
                  disabled={isPlaying}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: isPlaying ? 'var(--sl-color-gray-5)' : '#86cecb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isPlaying ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m-2 14.5v-9l6 4.5z"/>
                  </svg>
                  {isPlaying ? '재생 중...' : '소리 듣기'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedChords.length === 0 && input && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sl-color-gray-3)' }}>
          코드를 찾을 수 없습니다. F12 콘솔을 확인하세요.
        </div>
      )}
    </div>
  );
}