import { useEffect, useState } from 'react'

// [DevOps 테스트용] 백엔드 연결 테스트 - git checkout으로 복원

const API_URL = 'https://api.moyeobab.com/actuator/health'

type Status = 'loading' | 'up' | 'down'

export function HomePage() {
  const [status, setStatus] = useState<Status>('loading')

  const checkHealth = async () => {
    setStatus('loading')
    try {
      const res = await fetch(API_URL)
      const data = await res.json()
      setStatus(data.status === 'UP' ? 'up' : 'down')
    } catch {
      setStatus('down')
    }
  }

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(API_URL)
        const data = await res.json()
        setStatus(data.status === 'UP' ? 'up' : 'down')
      } catch {
        setStatus('down')
      }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const color = { loading: '#888', up: '#3b82f6', down: '#ef4444' }
  const text = { loading: '확인 중...', up: '연결됨', down: '연결 실패' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, margin: 0 }}>모여밥</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color[status] }} />
        <span style={{ fontSize: '1.1rem', color: color[status], fontWeight: 500 }}>{text[status]}</span>
      </div>
      <button onClick={checkHealth} style={{ marginTop: '8px', padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>
        다시 확인
      </button>
    </div>
  )
}
