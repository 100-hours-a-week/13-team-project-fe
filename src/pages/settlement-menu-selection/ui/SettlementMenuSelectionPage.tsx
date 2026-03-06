import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementMenuSelectionPage.module.css'
import {
  confirmSettlementSelection,
  getSettlementSelection,
  type SettlementItem,
} from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementMenuSelectionPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const [items, setItems] = useState<SettlementItem[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [confirmNoMeal, setConfirmNoMeal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      setLoading(false)
      return
    }

    let active = true
    const fetchSelection = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getSettlementSelection(parsedMeetingId)
        if (!active) return
        setItems(response.items ?? [])
        setSelectedIds(response.mySelectedItemIds ?? [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '메뉴 목록을 불러올 수 없어요.')
        void routeBySettlementState(parsedMeetingId, { replace: true })
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchSelection()
    return () => {
      active = false
    }
  }, [parsedMeetingId])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggleSelect = (itemId: number) => {
    if (confirmNoMeal) {
      setConfirmNoMeal(false)
    }
    setError(null)
    setSelectedIds((prev) => {
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId)
      return [...prev, itemId]
    })
  }

  const handleConfirm = async () => {
    if (!Number.isFinite(parsedMeetingId) || submitting) return
    if (selectedIds.length === 0 && !confirmNoMeal) {
      setError("메뉴를 선택하거나 '아무것도 안 먹었어요'를 체크해 주세요.")
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await confirmSettlementSelection(parsedMeetingId, { selectedItemIds: selectedIds })
      navigate(`/meetings/${parsedMeetingId}/settlement/wait`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 계산 요청에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page} data-page-id="settlement-menu-selection">
      <header className={styles.header}>
        <h1 className={styles.title}>메뉴 배정</h1>
      </header>

      {loading && <p className={styles.note}>메뉴를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && (
        <>
          <section className={styles.list}>
            {items.map((item) => {
              const selected = selectedSet.has(item.itemId)
              return (
                <button
                  type="button"
                  key={item.itemId}
                  className={selected ? styles.itemSelected : styles.item}
                  onClick={() => toggleSelect(item.itemId)}
                >
                  <div className={styles.name}>{item.name}</div>
                  <div className={styles.meta}>
                    {item.quantity}개 · {item.totalPrice.toLocaleString('ko-KR')}원
                  </div>
                </button>
              )
            })}
          </section>

          <label className={styles.noMealOption}>
            <input
              type="checkbox"
              checked={confirmNoMeal}
              disabled={selectedIds.length > 0}
              onChange={(event) => {
                setConfirmNoMeal(event.target.checked)
                setError(null)
              }}
            />
            <span>아무것도 안 먹었어요</span>
          </label>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? '요청 중...' : '정산 계산 요청'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
            disabled={submitting}
          >
            모임 상세로 이동
          </button>
        </>
      )}
    </div>
  )
}
