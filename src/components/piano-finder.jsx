import React, { useState, useEffect } from 'react';

export default function PianoFinder() {
  const [pianos, setPianos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({
    brand: '',
    type: '',
    action: '',
    audioIF: '',
    search: ''
  });
  const [mode, setMode] = useState('list');

  // CSV 로드
 // CSV 로드
  useEffect(() => {
    fetch('/data/pianos.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        // 헤더 처리
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        // 데이터 파싱 (빈 값도 정확히 잡는 로직으로 변경)
        const data = lines.slice(1).map(line => {
          const values = [];
          let current = '';
          let inQuote = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
              values.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
              current = '';
            } else {
              current += char;
            }
          }
          // 마지막 항목 추가
          values.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

          const obj = {};
          headers.forEach((h, i) => {
            // 값이 없으면 빈 문자열 할당
            obj[h] = values[i] || '';
          });
          return obj;
        });
        
        setPianos(data);
        setLoading(false);
      });
  }, []);

  // 필터링된 피아노 목록
  const filtered = pianos.filter(p => {
    if (filters.brand && p['브랜드'] !== filters.brand) return false;
    if (filters.type && p['형태'] !== filters.type) return false;
    if (filters.action && p['건반 액션'] !== filters.action) return false;
    if (filters.audioIF && (filters.audioIF === '✅' ? p['오디오 I/F'] !== '✅' : p['오디오 I/F'] === '✅')) return false;
    if (filters.search && !p['모델명'].toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // 고유 값 추출
  const brands = [...new Set(pianos.map(p => p['브랜드']))].filter(Boolean).sort();
  const types = [...new Set(pianos.map(p => p['형태']))].filter(Boolean).sort();
  const actions = [...new Set(pianos.map(p => p['건반 액션']))].filter(Boolean).sort();

  // 선택 토글
  const toggle = (model) => {
    setSelected(prev =>
      prev.includes(model)
        ? prev.filter(m => m !== model)
        : prev.length < 5 ? [...prev, model] : prev
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px', color: '#1a1a1a' }}>
          🎹 디지털 피아노 파인더
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          총 {pianos.length}개 모델 | 필터링 결과: {filtered.length}개
          {selected.length > 0 && ` | 선택: ${selected.length}개`}
        </p>
      </div>

      {/* 필터 & 모드 전환 */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="모델명 검색..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            minWidth: '200px'
          }}
        />
        
        <select
          value={filters.brand}
          onChange={e => setFilters({ ...filters, brand: e.target.value })}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">모든 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select
          value={filters.type}
          onChange={e => setFilters({ ...filters, type: e.target.value })}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">모든 형태</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.action}
          onChange={e => setFilters({ ...filters, action: e.target.value })}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">모든 건반 액션</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={filters.audioIF}
          onChange={e => setFilters({ ...filters, audioIF: e.target.value })}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">오디오 I/F</option>
          <option value="✅">있음</option>
          <option value="❌">없음</option>
        </select>

        <button
          onClick={() => setFilters({ brand: '', type: '', action: '', audioIF: '', search: '' })}
          style={{
            padding: '8px 16px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          필터 초기화
        </button>

        {selected.length >= 2 && (
          <button
            onClick={() => setMode(mode === 'list' ? 'compare' : 'list')}
            style={{
              padding: '8px 16px',
              background: '#6667AB',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {mode === 'list' ? `비교하기 (${selected.length})` : '목록으로'}
          </button>
        )}
      </div>

      {/* 비교 모드 */}
      {mode === 'compare' && selected.length >= 2 && (
        <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>
                  항목
                </th>
                {selected.map(modelName => {
                  const piano = pianos.find(p => p['모델명'] === modelName);
                  return (
                    <th key={modelName} style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>
                      {modelName}
                      <button
                        onClick={() => toggle(modelName)}
                        style={{
                          marginLeft: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        ×
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {['브랜드', '형태', '건반 액션', '건반 재질', '음원', '동시 발음수', '미디 통신', '오디오 I/F', '페달 사양', '스피커'].map(field => (
                <tr key={field}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f3f4f6', fontWeight: '500', background: '#fafafa' }}>
                    {field}
                  </td>
                  {selected.map(modelName => {
                    const piano = pianos.find(p => p['모델명'] === modelName);
                    return (
                      <td key={`${modelName}-${field}`} style={{ padding: '10px', borderBottom: '1px solid #f3f4f6' }}>
                        {piano?.[field] || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ padding: '10px', fontWeight: '500', background: '#fafafa' }}>링크</td>
                {selected.map(modelName => {
                  const piano = pianos.find(p => p['모델명'] === modelName);
                  return (
                    <td key={`${modelName}-link`} style={{ padding: '10px' }}>
                      {piano?.['다나와 링크'] && (
                        <a
                          href={piano['다나와 링크']}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#6667AB', textDecoration: 'none', fontWeight: '500' }}
                        >
                          다나와 →
                        </a>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 목록 모드 */}
      {mode === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map(piano => {
            const isSelected = selected.includes(piano['모델명']);
            return (
              <div
                key={piano['모델명']}
                onClick={() => toggle(piano['모델명'])}
                style={{
                  border: isSelected ? '2px solid #6667AB' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  background: isSelected ? '#f9fafb' : 'white',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0', color: '#1a1a1a' }}>
                      {piano['모델명']}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {piano['브랜드']} · {piano['형태']}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                  <div><strong>건반:</strong> {piano['건반 액션']}</div>
                  <div><strong>재질:</strong> {piano['건반 재질']}</div>
                  <div><strong>음원:</strong> {piano['음원']}</div>
                  <div><strong>오디오 I/F:</strong> {piano['오디오 I/F']}</div>
                </div>

                {piano['다나와 링크'] && (
                  <a
                    href={piano['다나와 링크']}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-block',
                      marginTop: '12px',
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#6667AB',
                      textDecoration: 'none',
                      fontWeight: '500'
                    }}
                  >
                    다나와 보기 →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
