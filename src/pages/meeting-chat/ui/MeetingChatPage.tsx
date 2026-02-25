import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { useAuth } from '@/app/providers/auth-context'
import { request } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './MeetingChatPage.module.css'

type ChatMessageType = 'TEXT' | 'IMAGE' | 'SYSTEM'

type ChatSender = {
  user_id: number
  name: string
  profile_image_url: string | null
}

type ChatMessageItem = {
  message_id: number
  unread_count?: number | null
  type: ChatMessageType
  content: string
  sender: ChatSender | null
  created_at: string
}

type ChatMessagePage = {
  size: number
  next_cursor: number | null
  has_next: boolean
}

type ChatMessagesLoadedData = {
  items: ChatMessageItem[]
  page: ChatMessagePage
}

type ChatTopicMessageCreatedEvent = {
  event: 'message_created'
  data: {
    meeting_id: number
    message_id: number
    type: ChatMessageType
    content: string
    sender: ChatSender | null
    created_at: string
  }
}

type ChatSendAckEvent = {
  event: 'message_send_ack'
  data: {
    meeting_id: number
    client_message_id: string | null
    message_id: number
    status: 'ACCEPTED'
    created_at: string
  }
}

type ChatErrorPayload = {
  message: string
}

type ChatHeartbeatAck = {
  type: 'HEARTBEAT_ACK'
  server_time: string
}

type ChatUnreadCountsUpdatedEvent = {
  event: 'unread_counts_updated'
  data: {
    meeting_id: number
    basis: {
      window_size: number
      from_message_id: number | null
      to_message_id: number | null
    }
    items: Array<{
      message_id: number
      unread_count: number
    }>
    server_version: number
    generated_at: string
  }
}

type MeetingDetailSummary = {
  meetingId: number
  title: string
  participantCount: number
  targetHeadcount: number
  participants: Array<{
    memberId: number
    nickname: string
    profileImageUrl: string | null
  }>
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

const MESSAGE_PAGE_SIZE = 50

function toWsUrl() {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (apiBase) {
    const url = new URL(apiBase)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/api/v2/ws'
    url.search = ''
    url.hash = ''
    return url.toString()
  }

  const url = new URL(window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/api/v2/ws'
  return url.toString()
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

function formatDateDivider(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function dayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function parseFrameBody<T>(frame: IMessage): T | null {
  try {
    return JSON.parse(frame.body) as T
  } catch {
    return null
  }
}

function buildUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isLikelyImageUrl(value: string) {
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value)
}

export function MeetingChatPage() {
  const { meetingId } = useParams()
  const { member } = useAuth()

  const parsedMeetingId = useMemo(() => {
    const n = Number(meetingId)
    return Number.isFinite(n) ? n : null
  }, [meetingId])

  const [room, setRoom] = useState<MeetingDetailSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [composer, setComposer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [connectionMessage, setConnectionMessage] = useState<string>('연결 전')
  const [ephemeralNotice, setEphemeralNotice] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement | null>(null)
  const stompClientRef = useRef<Client | null>(null)
  const subscriptionsRef = useRef<StompSubscription[]>([])
  const messageIdSetRef = useRef<Set<number>>(new Set())
  const stickyBottomRef = useRef(true)
  const isComposingRef = useRef(false)
  const sendGuardRef = useRef(false)
  const lastSentRef = useRef<{ text: string; at: number } | null>(null)
  const readSyncTimerRef = useRef<number | null>(null)
  const readPointerRef = useRef<{ synced: number; pending: number; inFlight: boolean }>({
    synced: 0,
    pending: 0,
    inFlight: false,
  })
  const unreadServerVersionRef = useRef(0)

  const myMemberId = member?.memberId ?? null

  const resetMessages = useCallback((items: ChatMessageItem[]) => {
    messageIdSetRef.current = new Set(items.map((item) => item.message_id))
    setMessages(items)
  }, [])

  const appendIncomingMessage = useCallback((message: ChatMessageItem) => {
    if (messageIdSetRef.current.has(message.message_id)) {
      return
    }
    messageIdSetRef.current.add(message.message_id)
    setMessages((prev) => [...prev, message])
  }, [])

  const prependOlderMessages = useCallback((olderItems: ChatMessageItem[]) => {
    if (olderItems.length === 0) return
    const deduped: ChatMessageItem[] = []
    for (const item of olderItems) {
      if (messageIdSetRef.current.has(item.message_id)) continue
      messageIdSetRef.current.add(item.message_id)
      deduped.push(item)
    }
    if (deduped.length === 0) return
    setMessages((prev) => [...deduped, ...prev])
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = listRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
  }, [])

  const flushReadPointer = useCallback(async () => {
    if (!parsedMeetingId) return
    const state = readPointerRef.current
    if (state.inFlight) return
    if (state.pending <= state.synced) return

    const target = state.pending
    state.inFlight = true
    try {
      await request(`/api/v2/meetings/${parsedMeetingId}/read-pointer`, {
        method: 'POST',
        body: JSON.stringify({ last_read_message_id: target }),
      })
      state.synced = Math.max(state.synced, target)
    } catch {
      // 다음 이벤트/스크롤에서 재시도
    } finally {
      state.inFlight = false
      if (state.pending > state.synced) {
        if (readSyncTimerRef.current) {
          window.clearTimeout(readSyncTimerRef.current)
        }
        readSyncTimerRef.current = window.setTimeout(() => {
          void flushReadPointer()
        }, 250)
      }
    }
  }, [parsedMeetingId])

  const scheduleReadPointerSync = useCallback(
    (messageId: number | null | undefined) => {
      if (!messageId || messageId <= 0) return
      const state = readPointerRef.current
      if (messageId <= state.synced && messageId <= state.pending) return

      state.pending = Math.max(state.pending, messageId)
      if (readSyncTimerRef.current) {
        window.clearTimeout(readSyncTimerRef.current)
      }
      readSyncTimerRef.current = window.setTimeout(() => {
        void flushReadPointer()
      }, 120)
    },
    [flushReadPointer],
  )

  const loadMessagePage = useCallback(
    async (cursor: number | null, mode: 'initial' | 'older') => {
      if (!parsedMeetingId) return

      if (mode === 'initial') {
        setLoading(true)
      } else {
        setLoadingOlder(true)
      }

      const container = listRef.current
      const beforeHeight = container?.scrollHeight ?? 0
      const beforeTop = container?.scrollTop ?? 0

      try {
        const params = new URLSearchParams({ size: String(MESSAGE_PAGE_SIZE) })
        if (cursor) {
          params.set('cursor', String(cursor))
        }

        const data = await request<ChatMessagesLoadedData>(
          `/api/v2/meetings/${parsedMeetingId}/messages?${params.toString()}`,
        )

        const normalized = [...data.items].reverse()

        if (mode === 'initial') {
          resetMessages(normalized)
          setNextCursor(data.page.next_cursor)
          setHasNext(data.page.has_next)
          requestAnimationFrame(() => {
            scrollToBottom()
            const latest = normalized[normalized.length - 1]
            scheduleReadPointerSync(latest?.message_id)
          })
          return
        }

        prependOlderMessages(normalized)
        setNextCursor(data.page.next_cursor)
        setHasNext(data.page.has_next)

        requestAnimationFrame(() => {
          const target = listRef.current
          if (!target) return
          const diff = target.scrollHeight - beforeHeight
          target.scrollTop = beforeTop + diff
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '채팅 메시지를 불러오지 못했습니다.')
      } finally {
        if (mode === 'initial') {
          setLoading(false)
        } else {
          setLoadingOlder(false)
        }
      }
    },
    [parsedMeetingId, prependOlderMessages, resetMessages, scheduleReadPointerSync, scrollToBottom],
  )

  useEffect(() => {
    if (!parsedMeetingId) {
      setError('올바르지 않은 모임 ID입니다.')
      setLoading(false)
      return
    }

    let active = true
    setError(null)
    unreadServerVersionRef.current = 0
    readPointerRef.current = { synced: 0, pending: 0, inFlight: false }

    const bootstrap = async () => {
      try {
        setLoading(true)
        const [detail, messageData] = await Promise.all([
          request<MeetingDetailSummary>(`/api/v1/meetings/${parsedMeetingId}`),
          request<ChatMessagesLoadedData>(
            `/api/v2/meetings/${parsedMeetingId}/messages?size=${MESSAGE_PAGE_SIZE}`,
          ),
        ])

        if (!active) return
        setRoom(detail)
        const normalized = [...messageData.items].reverse()
        resetMessages(normalized)
        setNextCursor(messageData.page.next_cursor)
        setHasNext(messageData.page.has_next)
        requestAnimationFrame(() => {
          scrollToBottom()
          const latest = normalized[normalized.length - 1]
          scheduleReadPointerSync(latest?.message_id)
        })
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '채팅방을 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [parsedMeetingId, resetMessages, scheduleReadPointerSync, scrollToBottom])

  useEffect(() => {
    if (!parsedMeetingId) return

    const client = new Client({
      brokerURL: toWsUrl(),
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      onConnect: () => {
        setConnectionState('connected')
        setConnectionMessage('연결됨')

        subscriptionsRef.current.forEach((sub) => sub.unsubscribe())
        subscriptionsRef.current = []

        subscriptionsRef.current.push(
          client.subscribe(`/api/v2/topic/meetings/${parsedMeetingId}/messages`, (frame) => {
            const payload = parseFrameBody<ChatTopicMessageCreatedEvent>(frame)
            if (!payload || payload.event !== 'message_created') return

            const incoming: ChatMessageItem = {
              message_id: payload.data.message_id,
              type: payload.data.type,
              content: payload.data.content,
              sender: payload.data.sender,
              created_at: payload.data.created_at,
              unread_count: null,
            }

            const shouldStick = stickyBottomRef.current
            appendIncomingMessage(incoming)
            if (shouldStick) {
              requestAnimationFrame(() => scrollToBottom('smooth'))
              scheduleReadPointerSync(incoming.message_id)
            }
          }),
        )

        subscriptionsRef.current.push(
          client.subscribe(`/api/v2/topic/meetings/${parsedMeetingId}/unread-counts`, (frame) => {
            const payload = parseFrameBody<ChatUnreadCountsUpdatedEvent>(frame)
            if (!payload || payload.event !== 'unread_counts_updated') return
            if (payload.data.server_version < unreadServerVersionRef.current) return
            unreadServerVersionRef.current = payload.data.server_version

            const unreadMap = new Map(payload.data.items.map((item) => [item.message_id, item.unread_count]))
            setMessages((prev) =>
              prev.map((message) => {
                const nextUnread = unreadMap.get(message.message_id)
                if (nextUnread === undefined) return message
                if (message.unread_count === nextUnread) return message
                return { ...message, unread_count: nextUnread }
              }),
            )
          }),
        )

        subscriptionsRef.current.push(
          client.subscribe('/user/queue/messages/ack', (frame) => {
            const payload = parseFrameBody<ChatSendAckEvent>(frame)
            if (!payload) return
          }),
        )

        subscriptionsRef.current.push(
          client.subscribe('/user/queue/errors', (frame) => {
            const payload = parseFrameBody<ChatErrorPayload>(frame)
            const message = payload?.message ?? '채팅 처리 중 오류가 발생했습니다.'
            setConnectionState('error')
            setConnectionMessage(message)
            setEphemeralNotice(message)
          }),
        )

        subscriptionsRef.current.push(
          client.subscribe('/user/queue/heartbeat', (frame) => {
            const payload = parseFrameBody<ChatHeartbeatAck>(frame)
            if (!payload) return
            setConnectionState('connected')
            setConnectionMessage('연결됨')
          }),
        )
      },
      onWebSocketClose: () => {
        setConnectionState('disconnected')
        setConnectionMessage('연결이 종료되었습니다. 재연결 중...')
      },
      onWebSocketError: () => {
        setConnectionState('error')
        setConnectionMessage('웹소켓 연결 오류')
      },
      onStompError: (frame) => {
        setConnectionState('error')
        setConnectionMessage(frame.headers['message'] ?? 'STOMP 오류')
      },
    })

    stompClientRef.current = client
    setConnectionState('connecting')
    setConnectionMessage('실시간 연결 중...')
    client.activate()

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe())
      subscriptionsRef.current = []
      stompClientRef.current = null
      if (readSyncTimerRef.current) {
        window.clearTimeout(readSyncTimerRef.current)
        readSyncTimerRef.current = null
      }
      void client.deactivate()
    }
  }, [appendIncomingMessage, parsedMeetingId, scheduleReadPointerSync, scrollToBottom])

  useEffect(() => {
    if (!ephemeralNotice) return
    const timer = window.setTimeout(() => setEphemeralNotice(null), 1800)
    return () => window.clearTimeout(timer)
  }, [ephemeralNotice])

    const handleLoadOlder = async () => {
    if (!nextCursor || loadingOlder) return
    await loadMessagePage(nextCursor, 'older')
  }

  const handleSendMessage = async () => {
    if (!parsedMeetingId) return
    const text = composer.trim()
    if (!text) return

    if (sendGuardRef.current) {
      return
    }

    const now = Date.now()
    const lastSent = lastSentRef.current
    if (lastSent && lastSent.text === text && now - lastSent.at < 400) {
      setEphemeralNotice('중복 전송이 차단되었습니다.')
      return
    }

    const client = stompClientRef.current
    if (!client || !client.connected) {
      setEphemeralNotice('실시간 연결이 준비되지 않았습니다.')
      return
    }

    const payload = {
      client_message_id: buildUuid(),
      type: 'TEXT' as const,
      content: text,
    }

    try {
      sendGuardRef.current = true
      setSending(true)
      lastSentRef.current = { text, at: now }
      stickyBottomRef.current = true
      requestAnimationFrame(() => scrollToBottom('smooth'))
      client.publish({
        destination: `/api/v2/app/meetings/${parsedMeetingId}/messages`,
        body: JSON.stringify(payload),
      })
      setComposer('')
    } catch {
      setEphemeralNotice('메시지 전송에 실패했습니다.')
    } finally {
      setSending(false)
      window.setTimeout(() => {
        sendGuardRef.current = false
      }, 120)
    }
  }

  const connectionBadgeClass = useMemo(() => {
    if (connectionState === 'connected') return `${styles.connectionBadge} ${styles.ok}`
    if (connectionState === 'error') return `${styles.connectionBadge} ${styles.err}`
    return `${styles.connectionBadge} ${styles.pending}`
  }, [connectionState])

  if (!parsedMeetingId) {
    return (
      <div className={styles.page}>
        <p className={styles.stateText}>올바르지 않은 모임 ID입니다.</p>
      </div>
    )
  }

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

        <div className={styles.headerBody}>
          <p className={styles.headerTitle}>{room?.title ?? '단체 채팅방'}</p>
          <div className={styles.headerMetaRow}>
            <span className={styles.memberCount}>
              {room ? `${room.participantCount}/${room.targetHeadcount}명` : '모임 정보 확인 중'}
            </span>
            <span className={connectionBadgeClass}>{connectionMessage}</span>
          </div>
        </div>
      </header>

      {room && room.participants.length > 0 && (
        <section className={styles.participantStrip}>
          <div className={styles.participantAvatars}>
            {room.participants.slice(0, 5).map((participant) => (
              <div className={styles.participantAvatar} key={participant.memberId} title={participant.nickname}>
                {participant.profileImageUrl ? (
                  <img src={participant.profileImageUrl} alt={participant.nickname} />
                ) : (
                  <span>{participant.nickname.charAt(0)}</span>
                )}
              </div>
            ))}
          </div>
          <p className={styles.participantNames}>
            {room.participants.slice(0, 3).map((p) => p.nickname).join(', ')}
            {room.participants.length > 3 ? ` 외 ${room.participants.length - 3}명` : ''}
          </p>
        </section>
      )}

      {error && <p className={styles.errorBanner}>{error}</p>}
      {ephemeralNotice && <p className={styles.noticeBanner}>{ephemeralNotice}</p>}

      <section className={styles.chatShell}>
        <div
          className={styles.messagesViewport}
          ref={listRef}
          onScroll={(event) => {
            const target = event.currentTarget
            const distance = target.scrollHeight - target.scrollTop - target.clientHeight
            stickyBottomRef.current = distance < 80
            if (stickyBottomRef.current && messages.length > 0) {
              scheduleReadPointerSync(messages[messages.length - 1]?.message_id)
            }
          }}
        >
          {hasNext && (
            <div className={styles.loadOlderWrap}>
              <button
                type="button"
                className={styles.loadOlderButton}
                onClick={handleLoadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? '이전 대화 불러오는 중...' : '이전 대화 더 보기'}
              </button>
            </div>
          )}

          {loading && messages.length === 0 && <p className={styles.stateText}>대화를 불러오는 중...</p>}
          {!loading && messages.length === 0 && (
            <p className={styles.stateText}>첫 메시지를 보내보세요.</p>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const showDateDivider = !previous || dayKey(previous.created_at) !== dayKey(message.created_at)
            const isSystem = message.type === 'SYSTEM'
            const isMine = !isSystem && !!myMemberId && message.sender?.user_id === myMemberId

            return (
              <div key={message.message_id}>
                {showDateDivider && (
                  <div className={styles.dateDividerWrap}>
                    <span className={styles.dateDivider}>{formatDateDivider(message.created_at)}</span>
                  </div>
                )}

                {isSystem ? (
                  <div className={styles.systemRow}>
                    <span className={styles.systemChip}>{message.content}</span>
                  </div>
                ) : (
                  <div className={`${styles.messageRow} ${isMine ? styles.mine : styles.theirs}`}>
                    {!isMine && (
                      <div className={styles.avatarBox}>
                        {message.sender?.profile_image_url ? (
                          <img src={message.sender.profile_image_url} alt={message.sender.name} />
                        ) : (
                          <span>{message.sender?.name?.charAt(0) ?? '?'}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.messageColumn}>
                      {!isMine && <span className={styles.senderName}>{message.sender?.name}</span>}
                      <div className={styles.bubbleRow}>
                        {isMine && <span className={styles.timeText}>{formatClock(message.created_at)}</span>}
                        {isMine && (message.unread_count ?? 0) > 0 && (
                          <span className={styles.unreadText}>{message.unread_count}</span>
                        )}
                        <div className={`${styles.bubble} ${isMine ? styles.mineBubble : styles.theirBubble}`}>
                          {message.type === 'IMAGE' ? (
                            isLikelyImageUrl(message.content) ? (
                              <img className={styles.chatImage} src={message.content} alt="채팅 이미지" />
                            ) : (
                              <a href={message.content} target="_blank" rel="noreferrer" className={styles.imageLink}>
                                이미지 열기
                              </a>
                            )
                          ) : (
                            <span className={styles.messageText}>{message.content}</span>
                          )}
                        </div>
                        {!isMine && <span className={styles.timeText}>{formatClock(message.created_at)}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.composerPanel}>
          <textarea
            className={styles.textarea}
            placeholder="메시지를 입력하세요"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                const nativeEvent = event.nativeEvent as KeyboardEvent & { keyCode?: number }
                if (nativeEvent.isComposing || isComposingRef.current || nativeEvent.keyCode === 229) {
                  return
                }
                event.preventDefault()
                void handleSendMessage()
              }
            }}
          />
          <button
            type="button"
            className={styles.sendButton}
            onClick={() => void handleSendMessage()}
            disabled={sending || composer.trim().length === 0}
          >
            전송
          </button>
        </div>
      </section>
    </div>
  )
}
