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

function ensureLocalId(item: SettlementItem & { localId?: string }, index: number) {
  if (item.localId) return item.localId
  if (typeof item.itemId === 'number' && item.itemId > 0) return `existing-${item.itemId}`
  return `fallback-${index}-${Date.now()}`
}

export function SettlementOcrEditPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [items, setItems] = useState<Array<SettlementItem & { localId: string }>>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

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
        setItems(
          (response.items ?? []).map((item, index) => ({
            ...item,
            localId: ensureLocalId(item, index),
          })),
        )
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
    localId: string,
    key: keyof SettlementItem,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item
        if (key === 'name') return { ...item, name: value }
        const parsed = Number(value)
        const nextValue = Number.isNaN(parsed) ? 0 : parsed
        if (key === 'quantity') {
          return {
            ...item,
            quantity: nextValue,
            unitPrice: nextValue > 0 ? Math.floor(item.totalPrice / nextValue) : 0,
          }
        }
        if (key === 'totalPrice') {
          return {
            ...item,
            totalPrice: nextValue,
            unitPrice: item.quantity > 0 ? Math.floor(nextValue / item.quantity) : 0,
          }
        }
        return { ...item, [key]: nextValue }
      }),
    )
  }

  const handleAddItem = () => {
    const now = Date.now()
    const random = Math.floor(Math.random() * 100000)
    setItems((prev) => [
      ...prev,
      {
        itemId: -(now + random),
        localId: `new-${now}-${random}`,
        name: '',
        unitPrice: 0,
        quantity: 1,
        totalPrice: 0,
      },
    ])
  }

  const handleRemoveItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId))
  }

  const handleOpenSelection = async () => {
    if (!Number.isFinite(parsedMeetingId) || submitting) return
    const hasInvalidItem = items.some((item) => {
      const name = item.name?.trim() ?? ''
      if (!name) return true
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return true
      if (!Number.isFinite(item.totalPrice) || item.totalPrice <= 0) return true
      return false
    })
    if (hasInvalidItem) {
      setAlertMessage('메뉴명, 수량, 메뉴 합계를 모두 입력해 주세요.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await openSettlementSelection(parsedMeetingId, {
        totalAmount,
        discountAmount,
        items: items.map((item, index) => {
          const localId = ensureLocalId(item, index)
          return {
            ...(localId.startsWith('existing-') ? { itemId: item.itemId } : {}),
          name: item.name,
          unitPrice: item.quantity > 0 ? Math.floor(item.totalPrice / item.quantity) : 0,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          }
        }),
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
              <article key={item.localId} className={styles.itemCard}>
                <label className={`${styles.row} ${styles.rowWithAction}`}>
                  <span>메뉴명</span>
                  <div className={styles.rowActionField}>
                    <input
                      value={item.name}
                      onChange={(event) => handleItemChange(item.localId, 'name', event.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.deleteCircleButton}
                      onClick={() => handleRemoveItem(item.localId)}
                      disabled={submitting}
                      aria-label="메뉴 삭제"
                    >
                      -
                    </button>
                  </div>
                </label>
                <label className={styles.row}>
                  <span>수량</span>
                  <input
                    value={item.quantity}
                    onChange={(event) =>
                      handleItemChange(item.localId, 'quantity', event.target.value)
                    }
                    type="number"
                  />
                </label>
                <label className={styles.row}>
                  <span>메뉴 합계</span>
                  <input
                    value={item.totalPrice}
                    onChange={(event) =>
                      handleItemChange(item.localId, 'totalPrice', event.target.value)
                    }
                    type="number"
                  />
                </label>
              </article>
            ))}
          </section>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleAddItem}
            disabled={submitting}
          >
            메뉴 추가
          </button>

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

      {alertMessage && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setAlertMessage(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.modalText}>{alertMessage}</p>
            <button type="button" className={styles.modalButton} onClick={() => setAlertMessage(null)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
