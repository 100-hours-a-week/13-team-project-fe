import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useParams } from 'react-router-dom'
import styles from './VotePage.module.css'
import { ApiError } from '@/shared/lib/api'
import {
  getVoteCandidates,
  submitVote,
  type VoteCandidate,
  type VoteChoice,
  type VoteSubmitItem,
} from '@/entities/vote'
import {
  askRagChat,
  clearRagChatHistory,
  getRagChatHistory,
  type RagHistoryMessage,
  type RagRole,
} from '@/entities/rag-chat'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'

type SwipeState = {
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  isDragging: boolean
}

type RagUiMessage = {
  key: string
  role: RagRole
  content: string
  createdAt: string
}

const swipeThreshold = 80
const chatFallbackError = '지금은 답변이 지연되고 있어요. 잠시 후 다시 시도해주세요.'

function nowIso() {
  return new Date().toISOString()
}

function toChatMessage(message: RagHistoryMessage): RagUiMessage {
  return {
    key: `history-${message.id}`,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }
}

function formatClock(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function createAssistantGreeting(): RagUiMessage {
  return {
    key: `greeting-${Date.now()}`,
    role: 'assistant',
    content: '챗봇에게 물어보세요! 주차, 룸, 분위기, 추천 메뉴를 바로 안내해드릴게요.',
    createdAt: nowIso(),
  }
}

export function VotePage() {
  const { meetingId, voteId } = useParams()
  const { member } = useAuth()

  const parsedMeetingId = Number(meetingId)
  const parsedVoteId = Number(voteId)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<VoteCandidate[]>([])
  const [availableCouponCount, setAvailableCouponCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [choices, setChoices] = useState<VoteSubmitItem[]>([])
  const [history, setHistory] = useState<VoteSubmitItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [useCouponForCurrent, setUseCouponForCurrent] = useState(false)
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    isDragging: false,
  })

  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<RagUiMessage[]>([])
  const [chatHydrated, setChatHydrated] = useState(false)

  const pointerIdRef = useRef<number | null>(null)
  const chatViewportRef = useRef<HTMLDivElement | null>(null)
  const chatSendGuardRef = useRef(false)

  const ragUserId = useMemo(() => {
    if (!member?.memberId) return null
    return `member:${member.memberId}`
  }, [member?.memberId])

  const currentCandidate = candidates[currentIndex]

  const images = useMemo(() => {
    if (!currentCandidate) return []
    const list = [
      currentCandidate.imageUrl1,
      currentCandidate.imageUrl2,
      currentCandidate.imageUrl3,
    ].filter(Boolean) as string[]
    return Array.from(new Set(list))
  }, [currentCandidate])

  const promptLabelBase = currentCandidate?.restaurantName ?? '이 식당'
  const quickPrompts = useMemo(
    () => [
      `${promptLabelBase} 주차 가능한가요?`,
      `${promptLabelBase} 6명 룸 가능한가요?`,
      `${promptLabelBase} 분위기 어떤가요?`,
    ],
    [promptLabelBase],
  )

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) {
      setError('투표 정보를 불러올 수 없어요.')
      return
    }

    let active = true

    const fetchCandidates = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getVoteCandidates(parsedMeetingId, parsedVoteId)
        if (!active) return
        setCandidates(response.candidates ?? [])
        setAvailableCouponCount(response.availableSuperLikeCouponCount ?? 0)
        setCurrentIndex(0)
        setImageIndex(0)
        setChoices([])
        setHistory([])
        setUseCouponForCurrent(false)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '투표 후보를 불러오지 못했어요.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchCandidates()
    return () => {
      active = false
    }
  }, [parsedMeetingId, parsedVoteId])

  useEffect(() => {
    setImageIndex(0)
    setUseCouponForCurrent(false)
  }, [currentIndex])

  useEffect(() => {
    setChatHydrated(false)
    setChatMessages([])
    setChatError(null)
  }, [ragUserId])

  useEffect(() => {
    if (!chatOpen) return
    const frame = requestAnimationFrame(() => {
      const viewport = chatViewportRef.current
      if (!viewport) return
      viewport.scrollTop = viewport.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [chatMessages, chatOpen])

  useEffect(() => {
    if (!chatOpen || chatHydrated) return

    if (!ragUserId) {
      setChatError('로그인 정보가 없어 챗봇을 사용할 수 없어요.')
      setChatMessages([createAssistantGreeting()])
      setChatHydrated(true)
      return
    }

    let active = true

    const loadHistory = async () => {
      try {
        setChatLoading(true)
        setChatError(null)
        const response = await getRagChatHistory(ragUserId, 20)
        if (!active) return

        const mapped = (response.messages ?? [])
          .filter((item) => item.role === 'user' || item.role === 'assistant')
          .map(toChatMessage)

        setChatMessages(mapped.length > 0 ? mapped : [createAssistantGreeting()])
        setChatHydrated(true)
      } catch (err) {
        if (!active) return
        setChatMessages([createAssistantGreeting()])
        setChatError(err instanceof Error ? err.message : '대화 기록을 불러오지 못했어요.')
        setChatHydrated(true)
      } finally {
        if (active) {
          setChatLoading(false)
        }
      }
    }

    void loadHistory()
    return () => {
      active = false
    }
  }, [chatHydrated, chatOpen, ragUserId])

  const totalCount = candidates.length
  const votedCount = choices.length
  const usedCouponCount = useMemo(
    () => choices.filter((item) => item.useCoupon).length,
    [choices],
  )

  const handleVote = useCallback(
    async (choice: VoteChoice) => {
      if (!currentCandidate || submitting) return
      const shouldUseCoupon = useCouponForCurrent && availableCouponCount > usedCouponCount

      if (useCouponForCurrent && !shouldUseCoupon) {
        setError('사용 가능한 쿠폰이 부족합니다.')
        return
      }

      const nextItem: VoteSubmitItem = {
        candidateId: currentCandidate.candidateId,
        choice,
        useCoupon: shouldUseCoupon,
      }

      const nextChoices = [...choices, nextItem]
      setChoices(nextChoices)
      setHistory((prev) => [...prev, nextItem])
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSwipeState((prev) => ({ ...prev, deltaX: 0, deltaY: 0, isDragging: false }))

      if (nextIndex >= candidates.length) {
        try {
          setSubmitting(true)
          await submitVote(parsedMeetingId, parsedVoteId, { items: nextChoices })
          navigate(`/meetings/${parsedMeetingId}/votes/${parsedVoteId}/wait`)
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.message === 'VOTE_COUPON_NOT_ENOUGH') {
              setError('사용 가능한 쿠폰이 부족합니다.')
              return
            }
            if (err.message === 'QUICK_MEETING_COUPON_NOT_ALLOWED') {
              setError('퀵모임에서는 쿠폰을 사용할 수 없습니다.')
              return
            }
          }
          setError(err instanceof Error ? err.message : '투표 저장에 실패했어요.')
        } finally {
          setSubmitting(false)
        }
      }
    },
    [
      candidates.length,
      choices,
      currentCandidate,
      currentIndex,
      parsedMeetingId,
      parsedVoteId,
      submitting,
      availableCouponCount,
      useCouponForCurrent,
      usedCouponCount,
    ],
  )

  const handleUndo = () => {
    if (history.length === 0 || submitting) return
    const nextHistory = history.slice(0, -1)
    const last = history[history.length - 1]
    setHistory(nextHistory)
    setChoices((prev) => prev.slice(0, -1))
    const targetIndex = Math.max(currentIndex - 1, 0)
    if (last && candidates[targetIndex]?.candidateId === last.candidateId) {
      setCurrentIndex(targetIndex)
    } else {
      setCurrentIndex(Math.max(currentIndex - 1, 0))
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentCandidate || submitting) return
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setSwipeState({
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      isDragging: true,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || pointerIdRef.current !== event.pointerId) return
    setSwipeState((prev) => ({
      ...prev,
      deltaX: event.clientX - prev.startX,
      deltaY: event.clientY - prev.startY,
    }))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || pointerIdRef.current !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    pointerIdRef.current = null

    const { deltaX, deltaY } = swipeState
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX > swipeThreshold && absX >= absY) {
      void handleVote(deltaX > 0 ? 'LIKE' : 'DISLIKE')
      return
    }

    if (absY > swipeThreshold && absY > absX && deltaY < 0) {
      void handleVote('NEUTRAL')
      return
    }

    setSwipeState((prev) => ({ ...prev, deltaX: 0, deltaY: 0, isDragging: false }))
  }

  const progressRatio = totalCount > 0 ? (votedCount / totalCount) * 100 : 0
  const canUseMoreCoupons = usedCouponCount < availableCouponCount
  const couponButtonCount = Math.max(
    availableCouponCount - usedCouponCount - (useCouponForCurrent ? 1 : 0),
    0,
  )
  const couponButtonLabel = `쿠폰 ${couponButtonCount}`

  const sendRagMessage = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? chatInput).trim()
      if (!content || chatSending) return
      if (!ragUserId) {
        setChatError('로그인 정보가 없어 챗봇을 사용할 수 없어요.')
        return
      }
      if (chatSendGuardRef.current) return

      chatSendGuardRef.current = true
      setChatSending(true)
      setChatError(null)

      const userMessage: RagUiMessage = {
        key: `user-${Date.now()}`,
        role: 'user',
        content,
        createdAt: nowIso(),
      }
      setChatMessages((prev) => [...prev, userMessage])
      setChatInput('')

      try {
        const response = await askRagChat({
          userId: ragUserId,
          message: content,
        })

        const assistantMessage: RagUiMessage = {
          key: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer?.trim() || chatFallbackError,
          createdAt: nowIso(),
        }
        setChatMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const detail = err instanceof Error ? err.message : chatFallbackError
        setChatError(detail)
        setChatMessages((prev) => [
          ...prev,
          {
            key: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: chatFallbackError,
            createdAt: nowIso(),
          },
        ])
      } finally {
        setChatSending(false)
        chatSendGuardRef.current = false
      }
    },
    [chatInput, chatSending, ragUserId],
  )

  const handleChatEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    void sendRagMessage()
  }

  const handleChatReset = async () => {
    if (!ragUserId || chatLoading) return
    try {
      setChatLoading(true)
      setChatError(null)
      await clearRagChatHistory(ragUserId)
      setChatMessages([createAssistantGreeting()])
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '대화 초기화에 실패했어요.')
    } finally {
      setChatLoading(false)
    }
  }

  const disableActions = !currentCandidate || submitting || loading

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
          aria-label="모임 상세로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.progressWrapper}>
          <div className={styles.progressText}>투표 진행 {votedCount}/{totalCount}</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressRatio}%` }} />
          </div>
        </div>
      </header>

      {loading && <p className={styles.note}>후보를 불러오는 중...</p>}
      {error && <p className={styles.noteError}>{error}</p>}

      {!loading && !error && currentCandidate && (
        <section className={styles.cardArea}>
          <div
            className={styles.card}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate(${swipeState.deltaX}px, ${swipeState.deltaY}px) rotate(${swipeState.deltaX * 0.05}deg)`,
            }}
          >
            <div className={styles.imageArea}>
              <div className={styles.couponOverlay}>
                <button
                  type="button"
                  className={`${styles.couponOverlayButton} ${
                    useCouponForCurrent ? styles.couponOverlayButtonActive : ''
                  }`}
                  disabled={!canUseMoreCoupons && !useCouponForCurrent}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!useCouponForCurrent && !canUseMoreCoupons) {
                      setError('사용 가능한 쿠폰이 부족합니다.')
                      return
                    }
                    setError(null)
                    setUseCouponForCurrent((prev) => !prev)
                  }}
                >
                  {couponButtonLabel}
                </button>
                <div className={styles.couponOverlayTooltip} role="note">
                  <p>쿠폰 사용 시 내 선택 영향력이 2배가 됩니다.</p>
                </div>
              </div>
              {images.length > 0 ? (
                <>
                  <img
                    src={images[imageIndex]}
                    alt={currentCandidate.restaurantName}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                  />
                  {images.length > 1 && (
                    <div className={styles.imageNav}>
                      <button
                        type="button"
                        className={styles.imageButton}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setImageIndex((prev) => (prev - 1 + images.length) % images.length)
                        }}
                        aria-label="이전 이미지"
                      >
                        ‹
                      </button>
                      <div className={styles.imageDots}>
                        {images.map((_, index) => (
                          <span
                            key={`dot-${index}`}
                            className={index === imageIndex ? styles.dotActive : styles.dot}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.imageButton}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setImageIndex((prev) => (prev + 1) % images.length)
                        }}
                        aria-label="다음 이미지"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.imagePlaceholder}>이미지가 없어요</div>
              )}
            </div>

            <div className={styles.infoArea}>
              <div className={styles.titleRow}>
                <h2 className={styles.restaurantName}>{currentCandidate.restaurantName}</h2>
                <span className={styles.category}>{currentCandidate.categoryName}</span>
              </div>
              <div className={styles.metaRow}>
                <span>거리 {currentCandidate.distanceM}m</span>
                <span>별점 {currentCandidate.rating}</span>
              </div>
              <div className={styles.address}>
                {currentCandidate.roadAddress || currentCandidate.jibunAddress}
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && !error && !currentCandidate && (
        <p className={styles.note}>모든 투표가 완료되었어요.</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('DISLIKE')}
          disabled={disableActions}
        >
          싫어요
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('NEUTRAL')}
          disabled={disableActions}
        >
          중립
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('LIKE')}
          disabled={disableActions}
        >
          좋아요
        </button>
        <button
          type="button"
          className={styles.undoButton}
          onClick={handleUndo}
          disabled={disableActions}
        >
          되돌리기
        </button>
      </div>

      <button
        type="button"
        className={styles.chatFab}
        aria-label="챗봇 열기"
        onClick={() => setChatOpen(true)}
      >
        <span className={styles.chatFabIcon}>AI</span>
        <span className={styles.chatFabLabel}>챗봇</span>
      </button>

      {chatOpen && (
        <button
          type="button"
          className={styles.chatBackdrop}
          aria-label="챗봇 닫기"
          onClick={() => setChatOpen(false)}
        />
      )}

      <aside className={`${styles.chatPanel} ${chatOpen ? styles.chatPanelOpen : ''}`}>
        <header className={styles.chatHeader}>
          <div>
            <p className={styles.chatTitle}>스와이프 챗봇</p>
            <p className={styles.chatSubtitle}>{promptLabelBase} 기준으로 바로 물어보세요.</p>
          </div>
          <div className={styles.chatHeaderActions}>
            <button
              type="button"
              className={styles.chatGhostButton}
              onClick={() => {
                void handleChatReset()
              }}
              disabled={chatLoading}
            >
              초기화
            </button>
            <button
              type="button"
              className={styles.chatCloseButton}
              onClick={() => setChatOpen(false)}
              aria-label="챗봇 닫기"
            >
              ×
            </button>
          </div>
        </header>

        <div className={styles.promptRow}>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className={styles.promptChip}
              onClick={() => {
                setChatInput(prompt)
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {chatError && <p className={styles.chatErrorBanner}>{chatError}</p>}

        <div className={styles.chatViewport} ref={chatViewportRef}>
          {chatLoading && <p className={styles.chatStateText}>대화 기록을 불러오는 중...</p>}
          {!chatLoading && chatMessages.length === 0 && (
            <p className={styles.chatStateText}>메시지를 입력하면 챗봇이 답변해요.</p>
          )}

          {!chatLoading &&
            chatMessages.map((message) => (
              <div
                key={message.key}
                className={`${styles.chatRow} ${message.role === 'user' ? styles.chatMine : styles.chatTheirs}`}
              >
                <div className={styles.chatBubbleWrap}>
                  <div
                    className={`${styles.chatBubble} ${
                      message.role === 'user' ? styles.chatMineBubble : styles.chatTheirBubble
                    }`}
                  >
                    {message.content}
                  </div>
                  <span className={styles.chatTime}>{formatClock(message.createdAt)}</span>
                </div>
              </div>
            ))}
        </div>

        <div className={styles.chatComposer}>
          <textarea
            className={styles.chatTextarea}
            placeholder="메시지를 입력하세요..."
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatEnter}
            rows={1}
            disabled={chatSending}
          />
          <button
            type="button"
            className={styles.chatSendButton}
            onClick={() => {
              void sendRagMessage()
            }}
            disabled={chatSending || chatInput.trim().length === 0}
          >
            {chatSending ? '전송중' : '전송'}
          </button>
        </div>
      </aside>
    </div>
  )
}
