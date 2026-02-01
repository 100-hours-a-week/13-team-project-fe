import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './MeetingCreatePage.module.css'
import { request } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'

declare global {
  interface Window {
    kakao?: {
      maps?: {
        load: (callback: () => void) => void
        Map: new (
          container: HTMLElement,
          options: { center: KakaoLatLng; level: number },
        ) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        LatLngBounds: new (sw: KakaoLatLng, ne: KakaoLatLng) => KakaoLatLngBounds
        Marker: new (options: {
          position: KakaoLatLng
          draggable?: boolean
        }) => KakaoMarker
        event: {
          addListener: (
            target: unknown,
            type: string,
            handler: (...args: unknown[]) => void,
          ) => void
        }
        services: {
          Status: { OK: string }
          Geocoder: new () => KakaoGeocoder
          Places: new () => KakaoPlaces
        }
      }
    }
  }
}

type Step = 1 | 2

type FormState = {
  title: string
  scheduledAt: string
  address: string
  lat: string
  lng: string
  targetHeadcount: string
  searchRadiusM: string
  voteDeadlineAt: string
  exceptMeat: boolean
  exceptBar: boolean
  swipeCount: string
  quickMeeting: boolean
}

type Errors = Partial<Record<keyof FormState, string>>

// eslint-disable-next-line no-useless-escape
const TITLE_REGEX = /^[가-힣A-Za-z0-9\s\-_.!,?()\[\]]{2,20}$/

const ALLOWED_BOUNDS = {
  sw: { lat: 37.371637, lng: 127.094743 },
  ne: { lat: 37.411228, lng: 127.121829 },
}

type KakaoLatLng = {
  getLat: () => number
  getLng: () => number
}

type KakaoLatLngBounds = {
  contain: (latlng: KakaoLatLng) => boolean
  getSouthWest: () => KakaoLatLng
  getNorthEast: () => KakaoLatLng
}

type KakaoMap = {
  panTo: (latlng: KakaoLatLng) => void
  setBounds: (bounds: KakaoLatLngBounds) => void
  getCenter: () => KakaoLatLng
  relayout: () => void
}

type KakaoMarker = {
  setMap: (map: KakaoMap) => void
  setVisible: (visible: boolean) => void
  setPosition: (latlng: KakaoLatLng) => void
  getPosition: () => KakaoLatLng
}

type KakaoGeocoderResultItem = {
  road_address?: { address_name?: string }
  address?: { address_name?: string }
}

type KakaoGeocoder = {
  coord2Address: (
    lng: number,
    lat: number,
    callback: (result: KakaoGeocoderResultItem[], status: string) => void,
  ) => void
}

type KakaoPlace = {
  id: string
  place_name: string
  road_address_name?: string
  address_name?: string
  x: string // lng
  y: string // lat
}

type KakaoPlaces = {
  keywordSearch: (
    keyword: string,
    callback: (data: KakaoPlace[], status: string) => void,
  ) => void
}

let kakaoSdkPromise: Promise<void> | null = null

function loadKakaoSdk(appKey: string) {
  if (window.kakao?.maps) {
    return Promise.resolve()
  }
  if (!kakaoSdkPromise) {
    kakaoSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-kakao-sdk="true"]',
      )
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () =>
          reject(new Error('Kakao SDK load failed')),
        )
        return
      }

      const script = document.createElement('script')
      script.async = true
      script.dataset.kakaoSdk = 'true'
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Kakao SDK load failed'))
      document.head.appendChild(script)
    })
  }
  return kakaoSdkPromise
}

function toPayloadDate(value: string) {
  if (!value) return ''
  if (value.length === 16) {
    return `${value}:00`
  }
  return value
}

function isFuture(value: string) {
  if (!value) return false
  const date = new Date(value)
  return date.getTime() > Date.now()
}

function isNotPast(value: string) {
  if (!value) return false
  const date = new Date(value)
  return date.getTime() >= Date.now()
}

function toFixedNumber(value: string, fractionDigits: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Number(num.toFixed(fractionDigits))
}

function getDateParts(value: string) {
  if (!value) return { date: '', hour: '', minute: '' }
  const [datePart, timePart = ''] = value.split('T')
  const [hour = '', minute = ''] = timePart.split(':')
  return { date: datePart, hour, minute }
}

function pad2(value: string) {
  return value.padStart(2, '0')
}

function composeDateTime(date: string, hour: string, minute: string) {
  if (!date) return ''
  const safeHour = pad2(hour || '00')
  const safeMinute = pad2(minute || '00')
  return `${date}T${safeHour}:${safeMinute}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getIdField(obj: Record<string, unknown>): string | number | null {
  const meetingId = obj['meetingId']
  const id = obj['id']

  if (typeof meetingId === 'string' || typeof meetingId === 'number') return meetingId
  if (typeof id === 'string' || typeof id === 'number') return id
  return null
}

export function MeetingCreatePage() {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>({
    title: '',
    scheduledAt: '',
    address: '',
    lat: '',
    lng: '',
    targetHeadcount: '',
    searchRadiusM: '',
    voteDeadlineAt: '',
    exceptMeat: false,
    exceptBar: false,
    swipeCount: '',
    quickMeeting: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState({
    title: false,
    scheduledAt: false,
    address: false,
    targetHeadcount: false,
    searchRadiusM: false,
    voteDeadlineAt: false,
    swipeCount: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalStatus, setModalStatus] = useState<string | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [modalResults, setModalResults] = useState<KakaoPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchAttempted, setIsSearchAttempted] = useState(false)
  const [isOutOfService, setIsOutOfService] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [timeNotice, setTimeNotice] = useState<string | null>(null)
  const [timePicker, setTimePicker] = useState<{
    key: 'scheduledAt' | 'voteDeadlineAt'
    date: string
    hour: string
    minute: string
  } | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<KakaoMap | null>(null)
  const markerRef = useRef<KakaoMarker | null>(null)
  const boundsRef = useRef<KakaoLatLngBounds | null>(null)
  const geocoderRef = useRef<KakaoGeocoder | null>(null)
  const placesRef = useRef<KakaoPlaces | null>(null)

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY as string | undefined

  const step1Errors = useMemo(() => {
    const next: Errors = {}
    if (!form.title.trim()) {
      next.title = '제목을 입력해 주세요.'
    } else if (!TITLE_REGEX.test(form.title.trim())) {
      next.title = '2~20자, 허용된 문자만 입력해 주세요.'
    }

    if (!form.scheduledAt) {
      next.scheduledAt = '모임 날짜/시간을 입력해 주세요.'
    } else if (!isNotPast(form.scheduledAt)) {
      next.scheduledAt = '과거 시간은 선택할 수 없습니다.'
    }

    if (!form.address || !form.lat || !form.lng) {
      next.address = '서비스 지역에서 장소를 선택해 주세요.'
    }

    return next
  }, [form.address, form.lat, form.lng, form.scheduledAt, form.title])

  const step2Errors = useMemo(() => {
    const next: Errors = {}

    const targetHeadcount = Number(form.targetHeadcount)
    if (!form.targetHeadcount) {
      next.targetHeadcount = '인원을 입력해 주세요.'
    } else if (!Number.isFinite(targetHeadcount) || targetHeadcount < 2) {
      next.targetHeadcount = '인원은 최소 2명입니다.'
    }

    const searchRadiusM = Number(form.searchRadiusM)
    if (!form.searchRadiusM) {
      next.searchRadiusM = '검색 반경을 입력해 주세요.'
    } else if (
      !Number.isFinite(searchRadiusM) ||
      searchRadiusM < 1 ||
      searchRadiusM > 3000
    ) {
      next.searchRadiusM = '검색 반경은 1~3000m 범위입니다.'
    }

    if (!form.voteDeadlineAt) {
      next.voteDeadlineAt = '투표 마감 시간을 입력해 주세요.'
    } else if (!isFuture(form.voteDeadlineAt)) {
      next.voteDeadlineAt = '현재보다 미래 시간이어야 합니다.'
    } else if (form.scheduledAt && new Date(form.voteDeadlineAt) > new Date(form.scheduledAt)) {
      next.voteDeadlineAt = '투표 마감은 모임 시간보다 이전이어야 합니다.'
    }

    const swipeCount = Number(form.swipeCount)
    if (!form.swipeCount) {
      next.swipeCount = '스와이프 수를 입력해 주세요.'
    } else if (!Number.isFinite(swipeCount) || swipeCount < 1 || swipeCount > 15) {
      next.swipeCount = '스와이프 수는 1~15입니다.'
    }

    return next
  }, [form.searchRadiusM, form.scheduledAt, form.swipeCount, form.targetHeadcount, form.voteDeadlineAt])

  const isStep1Valid = useMemo(() => Object.keys(step1Errors).length === 0, [step1Errors])
  const isStep2Valid = useMemo(() => Object.keys(step2Errors).length === 0, [step2Errors])

  useEffect(() => {
    if (step === 1) {
      setErrors(step1Errors)
    } else {
      setErrors({ ...step1Errors, ...step2Errors })
    }
  }, [step, step1Errors, step2Errors])

  const createBounds = () => {
    const maps = window.kakao?.maps
    if (!maps) throw new Error('Kakao maps not loaded')
    return new maps.LatLngBounds(
      new maps.LatLng(ALLOWED_BOUNDS.sw.lat, ALLOWED_BOUNDS.sw.lng),
      new maps.LatLng(ALLOWED_BOUNDS.ne.lat, ALLOWED_BOUNDS.ne.lng),
    )
  }

  const resolveAddress = (lat: number, lng: number) => {
    const maps = window.kakao?.maps
    if (!maps?.services) return Promise.reject(new Error('Kakao services not loaded'))

    return new Promise<string>((resolve, reject) => {
      const geocoder = new maps.services.Geocoder()
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status !== maps.services.Status.OK || !result?.length) {
          reject(new Error('주소를 불러오지 못했습니다.'))
          return
        }
        const info = result[0]
        const address =
          info.road_address?.address_name ?? info.address?.address_name ?? ''
        if (!address) {
          reject(new Error('주소를 불러오지 못했습니다.'))
          return
        }
        resolve(address)
      })
    })
  }

  const moveMapTo = (lat: number, lng: number) => {
    const maps = window.kakao?.maps
    const map = mapInstanceRef.current
    if (!maps || !map) return

    const latlng = new maps.LatLng(lat, lng)
    map.panTo(latlng)
    if (markerRef.current) {
      markerRef.current.setPosition(latlng)
      markerRef.current.setVisible(true)
    }
  }

  useEffect(() => {
    if (!isModalOpen) return
    if (!appKey) {
      setModalError('지도 사용을 위해 환경 변수 설정이 필요합니다.')
      return
    }

    setModalError(null)
    setModalStatus('지도에서 위치를 선택하거나 검색해 주세요.')
    setModalSearch('')
    setModalResults([])
    setIsSearchAttempted(false)
    setIsOutOfService(false)
    setSelectedPoint(null)

    loadKakaoSdk(appKey)
      .then(() => {
        if (!mapRef.current) return

        const maps = window.kakao?.maps
        if (!maps) throw new Error('Kakao maps not loaded')

        maps.load(() => {
          const bounds = createBounds()
          boundsRef.current = bounds

          const sw = bounds.getSouthWest()
          const ne = bounds.getNorthEast()
          const center = new maps.LatLng(
            (sw.getLat() + ne.getLat()) / 2,
            (sw.getLng() + ne.getLng()) / 2,
          )

          const map = new maps.Map(mapRef.current as HTMLElement, {
            center,
            level: 4,
          })
          mapInstanceRef.current = map

          geocoderRef.current = new maps.services.Geocoder()
          placesRef.current = new maps.services.Places()

          const marker = new maps.Marker({
            position: center,
            draggable: true,
          })
          markerRef.current = marker
          marker.setMap(map)
          marker.setVisible(false)

          map.setBounds(bounds)
          map.relayout()
          requestAnimationFrame(() => map.relayout())

          maps.event.addListener(marker, 'dragend', () => {
            const position = marker.getPosition()
            if (!bounds.contain(position)) {
              setModalStatus('서비스 지역이 아닙니다.')
              setIsOutOfService(true)
              map.setBounds(bounds)
              const fallback = map.getCenter()
              marker.setPosition(fallback)
              marker.setVisible(true)
              setSelectedPoint({
                lat: fallback.getLat(),
                lng: fallback.getLng(),
              })
              return
            }
            setSelectedPoint({ lat: position.getLat(), lng: position.getLng() })
            setModalStatus('선택된 위치입니다. 확정 버튼을 눌러 주세요.')
            setIsOutOfService(false)
          })

          maps.event.addListener(map, 'click', (...args: unknown[]) => {
            const first = args[0]
            if (!isRecord(first)) return
            const latLng = first['latLng'] as unknown
            if (!latLng || typeof (latLng as KakaoLatLng).getLat !== 'function') return

            const latlng = latLng as KakaoLatLng
            if (!bounds.contain(latlng)) {
              setModalStatus('서비스 지역이 아닙니다.')
              setIsOutOfService(true)
              return
            }
            marker.setPosition(latlng)
            marker.setVisible(true)
            setSelectedPoint({ lat: latlng.getLat(), lng: latlng.getLng() })
            setModalStatus('선택된 위치입니다. 확정 버튼을 눌러 주세요.')
            setIsOutOfService(false)
          })

          maps.event.addListener(map, 'idle', () => {
            const centerPoint = map.getCenter()
            if (!bounds.contain(centerPoint)) {
              map.setBounds(bounds)
            }
          })
        })
      })
      .catch(() => {
        setModalError('지도를 불러오지 못했습니다.')
      })
  }, [appKey, isModalOpen])

  const updateField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const markTouched = (key: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const shouldShowError = (key: keyof typeof touched, value: string) => {
    const message = errors[key]
    if (!message) return false
    if (value.trim()) return true
    return touched[key]
  }

  const getDefaultDateTime = (offsetMinutes: number) => {
    const date = new Date(Date.now() + offsetMinutes * 60 * 1000)
    const minutes = date.getMinutes()
    const roundedMinutes = Math.ceil(minutes / 10) * 10
    if (roundedMinutes === 60) {
      date.setHours(date.getHours() + 1)
      date.setMinutes(0, 0, 0)
    } else {
      date.setMinutes(roundedMinutes, 0, 0)
    }
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`
  }

  const formatDateTimeLabel = (value: string) => {
    if (!value) return ''
    return value.replace('T', ' ')
  }

  const ensureDateTime = (key: 'scheduledAt' | 'voteDeadlineAt', offset: number) => {
    const current = key === 'scheduledAt' ? form.scheduledAt : form.voteDeadlineAt
    if (current) return current
    const next = getDefaultDateTime(offset)
    updateField(key, next)
    return next
  }

  const handleDateChange = (
    key: 'scheduledAt' | 'voteDeadlineAt',
    date: string,
    offset: number,
  ) => {
    const base = ensureDateTime(key, offset)
    const parts = getDateParts(base)
    const nextValue = composeDateTime(date, parts.hour, parts.minute)
    updateField(key, nextValue)
  }

  const handleTimeChange = (
    key: 'scheduledAt' | 'voteDeadlineAt',
    field: 'hour' | 'minute',
    value: string,
    offset: number,
  ) => {
    const base = ensureDateTime(key, offset)
    const parts = getDateParts(base)
    const nextParts = { ...parts, [field]: value }
    const nextValue = composeDateTime(nextParts.date, nextParts.hour, nextParts.minute)
    updateField(key, nextValue)
  }

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, '0')),
    [],
  )
  const minuteOptions = useMemo(() => ['00', '10', '20', '30', '40', '50'], [])

  const openTimePicker = (key: 'scheduledAt' | 'voteDeadlineAt', offset: number) => {
    const base = ensureDateTime(key, offset)
    const parts = getDateParts(base)
    setTimePicker({ key, date: parts.date, hour: parts.hour, minute: parts.minute })
  }

  const confirmTimePicker = () => {
    if (!timePicker) return
    const nextValue = composeDateTime(
      timePicker.date,
      timePicker.hour || '00',
      timePicker.minute || '00',
    )
    if (
      timePicker.key === 'voteDeadlineAt' &&
      form.scheduledAt &&
      nextValue &&
      new Date(nextValue) > new Date(form.scheduledAt)
    ) {
      updateField('voteDeadlineAt', form.scheduledAt)
      setTimeNotice('투표 마감 시간은 최대 모임 시간까지만 설정이 가능합니다')
    } else {
      updateField(timePicker.key, nextValue)
    }
    setTimePicker(null)
  }

  const handleNextStep = () => {
    if (!isStep1Valid) {
      setErrors(step1Errors)
      return
    }
    setStep(2)
  }

  const handlePrevStep = () => setStep(1)

  const handleConfirmLocation = () => {
    if (!selectedPoint) {
      setModalStatus('위치를 먼저 선택해 주세요.')
      return
    }
    resolveAddress(selectedPoint.lat, selectedPoint.lng)
      .then((address) => {
        updateField('address', address)
        updateField('lat', String(selectedPoint.lat))
        updateField('lng', String(selectedPoint.lng))
        setIsModalOpen(false)
      })
      .catch(() => {
        setModalError('주소를 불러오지 못했습니다.')
      })
  }

  const handleSearch = () => {
    setIsSearchAttempted(true)
    if (!modalSearch.trim()) {
      setModalResults([])
      setModalStatus('검색어를 입력해 주세요.')
      return
    }
    if (!placesRef.current) {
      setModalResults([])
      setModalStatus('지도를 불러오는 중입니다. 잠시만 기다려 주세요.')
      return
    }
    const maps = window.kakao?.maps
    if (!maps) {
      setModalResults([])
      setModalStatus('지도를 불러오는 중입니다. 잠시만 기다려 주세요.')
      return
    }

    setIsSearching(true)
    placesRef.current.keywordSearch(modalSearch.trim(), (data, status) => {
      setIsSearching(false)
      if (status !== maps.services.Status.OK || !data?.length) {
        setModalResults([])
        setModalStatus('검색 결과가 없습니다.')
        return
      }
      setModalStatus('검색 결과에서 장소를 선택해 주세요.')
      setModalResults(data)
    })
  }

  const handleSelectSearchResult = (place: KakaoPlace) => {
    if (!place?.y || !place?.x) return
    const lat = Number(place.y)
    const lng = Number(place.x)
    const bounds = boundsRef.current
    const maps = window.kakao?.maps
    if (!maps) return

    if (bounds && !bounds.contain(new maps.LatLng(lat, lng))) {
      setModalStatus('서비스 지역이 아닙니다.')
      setIsOutOfService(true)
      return
    }
    moveMapTo(lat, lng)
    setSelectedPoint({ lat, lng })
    setModalStatus('선택된 위치입니다. 확정 버튼을 눌러 주세요.')
    setIsOutOfService(false)
  }

  const handleSubmit = async () => {
    const nextErrors = { ...step1Errors, ...step2Errors }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const latFixed = toFixedNumber(form.lat, 7)
    const lngFixed = toFixedNumber(form.lng, 7)
    if (latFixed === null || lngFixed === null) {
      setErrors((prev) => ({
        ...prev,
        address: '좌표를 확인할 수 없습니다. 위치를 다시 선택해 주세요.',
      }))
      return
    }

    const payload = {
      title: form.title.trim(),
      scheduledAt: toPayloadDate(form.scheduledAt),
      locationAddress: form.address,
      locationLat: latFixed,
      locationLng: lngFixed,
      targetHeadcount: Number(form.targetHeadcount),
      searchRadiusM: Math.round(Number(form.searchRadiusM)),
      voteDeadlineAt: toPayloadDate(form.voteDeadlineAt),
      exceptMeat: false,
      exceptBar: false,
      swipeCount: Number(form.swipeCount),
      quickMeeting: false,
    }

    try {
      setIsSubmitting(true)
      const data: unknown = await request('/api/v1/meetings', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      let meetingId: string | number | null = null
      if (isRecord(data)) {
        meetingId = getIdField(data)
      }

      if (!meetingId) {
        throw new Error('모임 ID를 확인할 수 없습니다.')
      }

      window.location.assign(`/meetings/${meetingId}/created`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '모임 생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/main')}
            aria-label="메인으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={styles.title}>모임 만들기</h1>
        </div>
        <p className={styles.subtitle}>필수 정보를 입력해 모임을 시작하세요.</p>
      </header>

      <div className={styles.stepTabs}>
        <button
          type="button"
          className={step === 1 ? styles.activeStep : styles.step}
        >
          Step 1
        </button>
        <button
          type="button"
          className={step === 2 ? styles.activeStep : styles.step}
          disabled={!isStep1Valid}
        >
          Step 2
        </button>
      </div>

      {step === 1 && (
        <section className={styles.section}>
          <label className={styles.field}>
            <span className={styles.label}>모임 제목</span>
            <input
              className={styles.input}
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              onBlur={() => markTouched('title')}
              maxLength={20}
            />
            {shouldShowError('title', form.title) && (
              <span className={styles.error}>{errors.title}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>모임 시간</span>
            <input
              className={styles.input}
              type="text"
              readOnly
              value={formatDateTimeLabel(form.scheduledAt)}
              placeholder="날짜와 시간을 선택해 주세요."
              onClick={() => openTimePicker('scheduledAt', 60)}
              onBlur={() => markTouched('scheduledAt')}
            />
            {shouldShowError('scheduledAt', form.scheduledAt) && (
              <span className={styles.error}>{errors.scheduledAt}</span>
            )}
          </label>

          <div className={styles.field}>
            <span className={styles.label}>모임 장소</span>
            <div className={styles.row}>
              <input
                className={styles.input}
                type="text"
                value={form.address}
                readOnly
                placeholder="지도에서 위치를 선택해 주세요."
                onBlur={() => markTouched('address')}
              />
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setIsModalOpen(true)}
              >
                위치 선택
              </button>
            </div>
            {shouldShowError('address', form.address) && (
              <span className={styles.error}>{errors.address}</span>
            )}
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleNextStep}
              disabled={!isStep1Valid}
            >
              Step 2로
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={styles.section}>
          <label className={styles.field}>
            <span className={styles.label}>참여 인원</span>
            <input
              className={styles.input}
              type="number"
              min={2}
              value={form.targetHeadcount}
              onChange={(event) => updateField('targetHeadcount', event.target.value)}
              onBlur={() => markTouched('targetHeadcount')}
            />
            {shouldShowError('targetHeadcount', form.targetHeadcount) && (
              <span className={styles.error}>{errors.targetHeadcount}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>검색 반경(m)</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              step="10"
              value={form.searchRadiusM}
              onChange={(event) => updateField('searchRadiusM', event.target.value)}
              onBlur={() => markTouched('searchRadiusM')}
            />
            {shouldShowError('searchRadiusM', form.searchRadiusM) && (
              <span className={styles.error}>{errors.searchRadiusM}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>투표 마감 시간</span>
            <input
              className={styles.input}
              type="text"
              readOnly
              value={formatDateTimeLabel(form.voteDeadlineAt)}
              placeholder="날짜와 시간을 선택해 주세요."
              onClick={() => openTimePicker('voteDeadlineAt', 30)}
              onBlur={() => markTouched('voteDeadlineAt')}
            />
            {shouldShowError('voteDeadlineAt', form.voteDeadlineAt) && (
              <span className={styles.error}>{errors.voteDeadlineAt}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>스와이프 수</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={15}
              value={form.swipeCount}
              onChange={(event) => updateField('swipeCount', event.target.value)}
              onBlur={() => markTouched('swipeCount')}
            />
            {shouldShowError('swipeCount', form.swipeCount) && (
              <span className={styles.error}>{errors.swipeCount}</span>
            )}
          </label>

          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handlePrevStep}
            >
              Step 1로
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleSubmit}
              disabled={!isStep2Valid || isSubmitting}
            >
              {isSubmitting ? '생성 중...' : '모임 생성'}
            </button>
          </div>
        </section>
      )}

      {isModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal}>
              <header className={styles.modalHeader}>
                <h2>장소 선택</h2>
              </header>

            {!appKey && (
              <div className={styles.modalFallback}>
                <p>지도를 사용하려면 VITE_KAKAO_MAP_APP_KEY가 필요합니다.</p>
              </div>
            )}

            {appKey && (
              <div className={styles.modalBody}>
                <div className={styles.searchRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={modalSearch}
                    onChange={(event) => setModalSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSearch()
                      }
                    }}
                    placeholder="장소를 검색해 주세요."
                  />
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={handleSearch}
                    disabled={!modalSearch.trim() || isSearching}
                  >
                    {isSearching ? '검색 중...' : '검색'}
                  </button>
                </div>

                <div className={styles.map} ref={mapRef} />

                {isOutOfService && (
                  <p className={styles.outOfService}>서비스 지역이 아닙니다.</p>
                )}

                {isSearchAttempted && (
                  <ul className={styles.searchList}>
                    {modalResults.length === 0 && (
                      <li className={styles.searchEmpty}>검색 결과가 없습니다.</li>
                    )}
                    {modalResults.map((place) => {
                      const lat = Number(place.y)
                      const lng = Number(place.x)
                      const bounds = boundsRef.current
                      const maps = window.kakao?.maps
                      const allowed =
                        maps && bounds
                          ? bounds.contain(new maps.LatLng(lat, lng))
                          : true

                      return (
                        <li key={place.id}>
                          <button
                            type="button"
                            className={styles.searchItem}
                            onClick={() => handleSelectSearchResult(place)}
                            disabled={!allowed}
                          >
                            <span className={styles.searchName}>
                              {place.place_name}
                            </span>
                            <span className={styles.searchAddress}>
                              {place.road_address_name || place.address_name}
                            </span>
                            {!allowed && (
                              <span className={styles.searchDisabled}>
                                서비스 지역 아님
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {modalStatus && <p className={styles.modalStatus}>{modalStatus}</p>}
            {modalError && <p className={styles.modalError}>{modalError}</p>}

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleConfirmLocation}
                disabled={!selectedPoint}
              >
                위치 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className={styles.alertBackdrop} role="presentation">
          <div className={styles.alert}>
            <p>{submitError}</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setSubmitError(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {timeNotice && (
        <div className={styles.alertBackdrop} role="presentation">
          <div className={styles.alert}>
            <p>{timeNotice}</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setTimeNotice(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {timePicker && (
        <div className={styles.timePickerBackdrop} role="presentation">
          <div className={styles.timePicker}>
            <h3 className={styles.timePickerTitle}>시간 선택</h3>
            <div className={styles.timePickerRow}>
              <input
                className={styles.input}
                type="date"
                value={timePicker.date}
                onChange={(event) =>
                  setTimePicker((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                }
              />
              <select
                className={styles.timeSelect}
                value={timePicker.hour}
                onChange={(event) =>
                  setTimePicker((prev) => (prev ? { ...prev, hour: event.target.value } : prev))
                }
              >
                <option value="">시</option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <select
                className={styles.timeSelect}
                value={timePicker.minute}
                onChange={(event) =>
                  setTimePicker((prev) => (prev ? { ...prev, minute: event.target.value } : prev))
                }
              >
                <option value="">분</option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.timePickerActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setTimePicker(null)}
              >
                취소
              </button>
              <button type="button" className={styles.primaryButton} onClick={confirmTimePicker}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
