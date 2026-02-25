import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementReceiptUploadPage.module.css'
import {
  confirmSettlementReceipt,
  createSettlementReceiptUploadUrl,
  startSettlementOcr,
} from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { hasSettlementErrorCode, routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementReceiptUploadPage() {
  const { meetingId } = useParams()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [objectKey, setObjectKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedMeetingId = Number(meetingId)
  const hasUploaded = Boolean(previewUrl && objectKey)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handlePickFile = () => {
    if (busy) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      const uploadInfo = await createSettlementReceiptUploadUrl(parsedMeetingId, file.type)
      const uploadResponse = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadResponse.ok) {
        throw new Error('영수증 파일 업로드에 실패했어요.')
      }
      await confirmSettlementReceipt(parsedMeetingId, { objectKey: uploadInfo.objectKey })

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(file))
      setObjectKey(uploadInfo.objectKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : '영수증 업로드에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const handleStartOcr = async () => {
    if (!Number.isFinite(parsedMeetingId) || !hasUploaded || busy) return
    try {
      setBusy(true)
      setError(null)
      await startSettlementOcr(parsedMeetingId)
      navigate(`/meetings/${parsedMeetingId}/settlement/ocr/loading`)
    } catch (err) {
      if (hasSettlementErrorCode(err, 'OCR_ALREADY_IN_PROGRESS')) {
        navigate(`/meetings/${parsedMeetingId}/settlement/ocr/loading`)
        return
      }
      setError(err instanceof Error ? err.message : '영수증 인식 요청에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page} data-page-id="settlement-receipt-upload">
      <header className={styles.header}>
        <h1 className={styles.title}>영수증 업로드</h1>
      </header>

      {error && <p className={styles.note}>{error}</p>}

      <section className={styles.card}>
        {previewUrl ? (
          <img src={previewUrl} alt="업로드한 영수증" className={styles.previewImage} />
        ) : (
          <div className={styles.placeholder}>영수증 이미지를 업로드해 주세요.</div>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={handlePickFile} disabled={busy}>
          {hasUploaded ? '다시 선택' : '업로드'}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleStartOcr}
          disabled={!hasUploaded || busy}
        >
          영수증 인식
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.fileInput}
        onChange={handleFileChange}
      />

      <button
        type="button"
        className={styles.linkButton}
        onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
      >
        모임 상세로 이동
      </button>
    </div>
  )
}
