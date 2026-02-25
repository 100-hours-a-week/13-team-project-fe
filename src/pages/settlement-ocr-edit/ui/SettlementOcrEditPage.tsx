import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementOcrEditPage.module.css'
import {
  getSettlementItems,
  openSettlementSelection,
  type SettlementItem,
} from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementOcrEditPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [items, setItems] = useState<SettlementItem[]>([])
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
    const fetchItems = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getSettlementItems(parsedMeetingId)
        if (!active) return
        setReceiptImageUrl(response.receiptImageUrl)
        setTotalAmount(response.totalAmount)
        setDiscountAmount(response.discountAmount)
        setItems(response.items ?? [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'OCR 결과를 불러올 수 없어요.')
        void routeBySettlementState(parsedMeetingId, { replace: true })
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchItems()
    return () => {
      active = false
    }
  }, [parsedMeetingId])

  const handleItemChange = (
    itemId: number,
    key: keyof SettlementItem,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item
        if (key === 'name') return { ...item, name: value }
        const parsed = Number(value)
        return { ...item, [key]: Number.isNaN(parsed) ? 0 : parsed }
      }),
    )
  }

  const handleOpenSelection = async () => {
    if (!Number.isFinite(parsedMeetingId) || submitting) return
    try {
      setSubmitting(true)
      setError(null)
      await openSettlementSelection(parsedMeetingId, {
        totalAmount,
        discountAmount,
        items,
      })
      navigate(`/meetings/${parsedMeetingId}/settlement/selection`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '항목 확정에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page} data-page-id="settlement-ocr-edit">
      <header className={styles.header}>
        <h1 className={styles.title}>OCR 결과 확인</h1>
      </header>

      {loading && <p className={styles.note}>OCR 결과를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && (
        <>
          {receiptImageUrl && (
            <section className={styles.card}>
              <img src={receiptImageUrl} alt="영수증" className={styles.receiptImage} />
            </section>
          )}

          <section className={styles.summary}>
            <label className={styles.row}>
              <span>총 금액</span>
              <input
                value={totalAmount}
                onChange={(event) => setTotalAmount(Number(event.target.value) || 0)}
                type="number"
              />
            </label>
            <label className={styles.row}>
              <span>할인 금액</span>
              <input
                value={discountAmount}
                onChange={(event) => setDiscountAmount(Number(event.target.value) || 0)}
                type="number"
              />
            </label>
          </section>

          <section className={styles.list}>
            {items.map((item) => (
              <article key={item.itemId} className={styles.itemCard}>
                <label className={styles.row}>
                  <span>메뉴명</span>
                  <input
                    value={item.name}
                    onChange={(event) => handleItemChange(item.itemId, 'name', event.target.value)}
                  />
                </label>
                <label className={styles.row}>
                  <span>단가</span>
                  <input
                    value={item.unitPrice}
                    onChange={(event) =>
                      handleItemChange(item.itemId, 'unitPrice', event.target.value)
                    }
                    type="number"
                  />
                </label>
                <label className={styles.row}>
                  <span>수량</span>
                  <input
                    value={item.quantity}
                    onChange={(event) =>
                      handleItemChange(item.itemId, 'quantity', event.target.value)
                    }
                    type="number"
                  />
                </label>
                <label className={styles.row}>
                  <span>합계</span>
                  <input
                    value={item.totalPrice}
                    onChange={(event) =>
                      handleItemChange(item.itemId, 'totalPrice', event.target.value)
                    }
                    type="number"
                  />
                </label>
              </article>
            ))}
          </section>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleOpenSelection}
            disabled={submitting}
          >
            영수증 항목 확정 및 메뉴 확인 요청
          </button>
        </>
      )}
    </div>
  )
}
