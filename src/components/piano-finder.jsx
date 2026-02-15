import React, { useState, useEffect } from 'react';

export default function PianoFinder() {
  const [pianos, setPianos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({
    search: ''
  });
  const [mode, setMode] = useState('list');
  const [headers, setHeaders] = useState([]);

  // CSV 로드
  useEffect(() => {
    fetch('/data/pianos.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          setLoading(false);
          return;
        }

        const csvHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        setHeaders(csvHeaders);
        
        const data = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
          const obj = {};
          csvHeaders.forEach((h, i) => {
            obj[h] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
          });
          return obj;
        });
        
        setPianos(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('CSV 로딩 실패:', err);
        setLoading(false);
      });
  }, []);

  // 필터링된 피아노 목록
  const filtered = pianos.filter(p => {
    // 검색어 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchFound = Object.values(p).some(val => 
        String(val).toLowerCase().includes(searchLower)
      );
      if (!matchFound) return false;
    }

    // 동적 필터 적용
    for (const [key, value] of Object.entries(filters)) {
      if (key !== 'search' && value && p[key] !== value) {
        return false;
      }
    }
    
    return true;
  });

  // 고유 값 추출 (select 옵션용)
  const getUniqueValues = (columnName) => {
    return [...new Set(pianos.map(p => p[columnName]))].filter(Boolean).sort();
  };

  // 선택 토글
  const toggle = (modelName) => {
    setSelected(prev =>
      prev.includes(modelName)
        ? prev.filter(m => m !== modelName)
        : prev.length < 5 ? [...prev, modelName] : prev
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sl-color-gray-3)' }}>
        데이터 로딩 중...
      </div>
    );
  }

  // 주요 필터 컬럼 (존재하는 것만)
  const filterColumns = ['브랜드', '형태', '건반 액션', '오디오 I/F'].filter(col => headers.includes(col));
  const modelColumnName = headers.includes('모델명') ? '모델명' : headers[0];

  // 스타일 객체 (다크모드 대응 변수 사용)
  const containerStyle = {
    padding: '20px',
    color: 'var(--sl-color-text)',
  };

  const headerStyle = {
    marginBottom: '30px',
    borderBottom: '1px solid var(--sl-color-hairline)',
    paddingBottom: '20px'
  };

  const titleStyle = {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '10px',
    color: 'var(--sl-color-white)', // 다크모드 대응
  };

  const subTextStyle = {
    color: 'var(--sl-color-gray-3)',
    fontSize: '14px',
  };

  const controlBarStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: 'var(--sl-color-gray-6)', // 배경색 살짝 줌
    borderRadius: '8px',
    border: '1px solid var(--sl-color-gray-5)'
  };

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid var(--sl-color-gray-5)',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '200px',
    backgroundColor: 'var(--sl-color-bg-nav)', // 입력창 배경
    color: 'var(--sl-color-text)',
  };

  const buttonStyle = {
    padding: '8px 16px',
    background: 'var(--sl-color-gray-5)',
    color: 'var(--sl-color-text)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const actionButtonStyle = {
    ...buttonStyle,
    background: 'var(--sl-color-accent-high)', // 강조색
    color: 'var(--sl-color-text-invert)',
  };

  const cardStyle = (isSelected) => ({
    border: isSelected ? '2px solid var(--sl-color-accent)' : '1px solid var(--sl-color-gray-5)',
    borderRadius: '8px',
    padding: '16px',
    cursor: 'pointer',
    backgroundColor: isSelected ? 'var(--sl-color-gray-6)' : 'var(--sl-color-bg-nav)', // 카드 배경
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  });

  return (
    <div style={containerStyle}>
      {/* 헤더 */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>
          🎹 디지털 피아노 파인더
        </h1>
        <p style={subTextStyle}>
          총 {pianos.length}개 모델 | 필터링 결과: {filtered.length}개
          {selected.length > 0 && ` | 선택: ${selected.length}개`}
        </p>
      </div>

      {/* 필터 및 컨트롤 */}
      <div style={controlBarStyle}>
        <input
          type="text"
          placeholder="모델명 검색..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          style={inputStyle}
        />
        
        {filterColumns.map(col => (
          <select
            key={col}
            value={filters[col] || ''}
            onChange={e => setFilters({ ...filters, [col]: e.target.value })}
            style={inputStyle}
          >
            <option value="">{col} (전체)</option>
            {getUniqueValues(col).map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        ))}

        <button
          onClick={() => setFilters({ search: '' })}
          style={buttonStyle}
        >
          필터 초기화
        </button>

        {selected.length >= 2 && (
          <button
            onClick={() => setMode(mode === 'list' ? 'compare' : 'list')}
            style={actionButtonStyle}
          >
            {mode === 'list' ? `비교하기 (${selected.length})` : '목록으로 돌아가기'}
          </button>
        )}
      </div>

      {/* 비교 모드 테이블 */}
      {mode === 'compare' && selected.length >= 2 && (
        <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--sl-color-gray-6)' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--sl-color-gray-5)', color: 'var(--sl-color-text-accent)' }}>
                  항목
                </th>
                {selected.map(modelName => (
                  <th key={modelName} style={{ padding: '12px', borderBottom: '2px solid var(--sl-color-gray-5)', minWidth: '150px' }}>
                    {modelName}
                    <button
                      onClick={() => toggle(modelName)}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: 'var(--sl-color-gray-3)'
                      }}
                    >
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {headers.filter(h => h !== modelColumnName).map(field => (
                <tr key={field}>
                  <td style={{ padding: '12px', borderBottom: '1px solid var(--sl-color-hairline)', fontWeight: '600', backgroundColor: 'var(--sl-color-gray-6)', width: '120px' }}>
                    {field}
                  </td>
                  {selected.map(modelName => {
                    const piano = pianos.find(p => p[modelColumnName] === modelName);
                    return (
                      <td key={`${modelName}-${field}`} style={{ padding: '12px', borderBottom: '1px solid var(--sl-color-hairline)' }}>
                        {piano?.[field] || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 목록 모드 (카드 리스트) */}
      {mode === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filtered.map((piano, idx) => {
            const isSelected = selected.includes(piano[modelColumnName]);
            return (
              <div
                key={idx}
                onClick={() => toggle(piano[modelColumnName])}
                style={cardStyle(isSelected)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--sl-color-white)' }}>
                      {piano[modelColumnName]}
                    </h3>
                    <div style={{ fontSize: '14px', color: 'var(--sl-color-text-accent)', fontWeight: '500' }}>
                      {piano['브랜드']} · {piano['형태']}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--sl-color-accent)' }}
                  />
                </div>

                <div style={{ fontSize: '14px', color: 'var(--sl-color-gray-2)', lineHeight: '1.6' }}>
                  {headers.slice(0, 6).map(h => (
                    piano[h] && h !== modelColumnName && (
                      <div key={h} style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ color: 'var(--sl-color-gray-3)', minWidth: '60px' }}>{h}:</span>
                        <span>{piano[h]}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--sl-color-gray-3)' }}>
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}