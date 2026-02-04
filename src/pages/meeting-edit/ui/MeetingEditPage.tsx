import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './MeetingEditPage.module.css'
import { navigate } from '@/shared/lib/navigation'
import { request } from '@/shared/lib/api'

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
  x: string
  y: string
}

type KakaoPlaces = {
  keywordSearch: (
    keyword: string,
    callback: (data: KakaoPlace[], status: string) => void,
  ) => void
}

type MeetingDetailResponse = {
  meetingId: number
  title: string
  scheduledAt: string
  voteDeadlineAt: string
  locationAddress: string
  locationLat: number
  locationLng: number
  targetHeadcount: number
  searchRadiusM: number
  swipeCount: number
  exceptMeat: boolean
  exceptBar: boolean
  quickMeeting: boolean
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

function fromApiDate(value: string) {
  if (!value) return ''
  if (value.length >= 16) return value.slice(0, 16)
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

export function MeetingEditPage() {
  const { meetingId } = useParams()
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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [modalResults, setModalResults] = useState<KakaoPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchAttempted, setIsSearchAttempted] = useState(false)
  const [isOutOfService, setIsOutOfService] = useState(false)
  const [timePicker, setTimePicker] = useState<{
    key: 'scheduledAt' | 'voteDeadlineAt'
    date: string
    hour: string
    minute: string
  } | null>(null)
  const [timeNotice, setTimeNotice] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(
    null,
  )

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<KakaoMap | null>(null)
  const markerRef = useRef<KakaoMarker | null>(null)
  const boundsRef = useRef<KakaoLatLngBounds | null>(null)
  const geocoderRef = useRef<KakaoGeocoder | null>(null)
  const placesRef = useRef<KakaoPlaces | null>(null)

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY as string | undefined

  const step1Errors = useMemo(() => {
    const nextErrors: Errors = {}
    if (!form.title.trim()) {
      nextErrors.title = '모임 제목을 입력해주세요.'
    } else if (!TITLE_REGEX.test(form.title.trim())) {
      nextErrors.title = '2~20자, 한글/영문/숫자/특수문자만 가능합니다.'
    }

    if (!form.scheduledAt) {
      nextErrors.scheduledAt = '모임 시간을 입력해주세요.'
    } else if (!isNotPast(form.scheduledAt)) {
      nextErrors.scheduledAt = '모임 시간은 현재 이후여야 합니다.'
    }

    if (!form.address) {
      nextErrors.address = '모임 장소를 선택해주세요.'
    }

    if (!form.voteDeadlineAt) {
      nextErrors.voteDeadlineAt = '투표 마감 시간을 입력해 주세요.'
    } else if (!isFuture(form.voteDeadlineAt)) {
      nextErrors.voteDeadlineAt = '과거 시간은 선택할 수 없습니다.'
    } else if (form.scheduledAt && new Date(form.voteDeadlineAt) > new Date(form.scheduledAt)) {
      nextErrors.voteDeadlineAt = '투표 마감은 모임 시간보다 이전이어야 합니다.'
    }

    return nextErrors
  }, [form.address, form.scheduledAt, form.title, form.voteDeadlineAt])

  const step2Errors = useMemo(() => {
    const nextErrors: Errors = {}
    const targetHeadcount = Number(form.targetHeadcount)
    if (!form.targetHeadcount) {
      nextErrors.targetHeadcount = '인원을 입력해 주세요.'
    } else if (!Number.isFinite(targetHeadcount) || targetHeadcount < 2) {
      nextErrors.targetHeadcount = '인원은 최소 2명입니다.'
    }

    const searchRadiusM = Number(form.searchRadiusM)
    if (!form.searchRadiusM) {
      nextErrors.searchRadiusM = '검색 반경을 입력해 주세요.'
    } else if (
      !Number.isFinite(searchRadiusM) ||
      searchRadiusM < 1 ||
      searchRadiusM > 3000
    ) {
      nextErrors.searchRadiusM = '검색 반경은 1~3000m 범위입니다.'
    }

    const swipeCount = Number(form.swipeCount)
    if (!form.swipeCount) {
      nextErrors.swipeCount = '음식점 후보 수를 입력해 주세요.'
    } else if (!Number.isFinite(swipeCount) || swipeCount < 1 || swipeCount > 15) {
      nextErrors.swipeCount = '음식점 후보 수는 1~15입니다.'
    }

    return nextErrors
  }, [form.searchRadiusM, form.swipeCount, form.targetHeadcount])

  const isStep1Valid = useMemo(() => Object.keys(step1Errors).length === 0, [step1Errors])
  const isStep2Valid = useMemo(() => Object.keys(step2Errors).length === 0, [step2Errors])

  useEffect(() => {
    if (step === 1) {
      setErrors(step1Errors)
    } else {
      setErrors({ ...step1Errors, ...step2Errors })
    }
  }, [step, step1Errors, step2Errors])

  useEffect(() => {
    if (!meetingId) return
    let active = true

    const fetchDetail = async () => {
      try {
        const detail = await request<MeetingDetailResponse>(`/api/v1/meetings/${meetingId}`)
        if (!active) return
        setForm((prev) => ({
          ...prev,
          title: detail.title ?? '',
          scheduledAt: fromApiDate(detail.scheduledAt),
          address: detail.locationAddress ?? '',
          lat: detail.locationLat?.toString() ?? '',
          lng: detail.locationLng?.toString() ?? '',
          targetHeadcount: detail.targetHeadcount?.toString() ?? '',
          searchRadiusM: detail.searchRadiusM?.toString() ?? '',
          voteDeadlineAt: fromApiDate(detail.voteDeadlineAt),
          exceptMeat: Boolean(detail.exceptMeat),
          exceptBar: Boolean(detail.exceptBar),
          swipeCount: detail.swipeCount?.toString() ?? '',
          quickMeeting: Boolean(detail.quickMeeting),
        }))
      } catch (error) {
        if (!active) return
        setErrors({ title: error instanceof Error ? error.message : '모임 정보를 불러오지 못했습니다.' })
      }
    }

    void fetchDetail()
    return () => {
      active = false
    }
  }, [meetingId])

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
    setModalSearch('')
    setModalResults([])
    setIsSearchAttempted(false)
    setIsOutOfService(false)
    setSelectedPoint(null)

    loadKakaoSdk(appKey)
      .then(() =>
        window.kakao?.maps?.load(() => {
          if (!mapRef.current) return

          const maps = window.kakao?.maps
          if (!maps) throw new Error('Kakao maps not loaded')

          const bounds = createBounds()
          boundsRef.current = bounds

          const initialLat = Number(form.lat)
          const initialLng = Number(form.lng)
          const hasInitial =
            Number.isFinite(initialLat) &&
            Number.isFinite(initialLng) &&
            bounds.contain(new maps.LatLng(initialLat, initialLng))

          const center = hasInitial
            ? new maps.LatLng(initialLat, initialLng)
            : (() => {
                const sw = bounds.getSouthWest()
                const ne = bounds.getNorthEast()
                return new maps.LatLng(
                  (sw.getLat() + ne.getLat()) / 2,
                  (sw.getLng() + ne.getLng()) / 2,
                )
              })()

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
          marker.setVisible(hasInitial)

          if (hasInitial) {
            setSelectedPoint({ lat: initialLat, lng: initialLng })
          }

          map.setBounds(bounds)
          map.relayout()
          requestAnimationFrame(() => map.relayout())

          maps.event.addListener(marker, 'dragend', () => {
            const position = marker.getPosition()
            if (!bounds.contain(position)) {
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
            setIsOutOfService(false)
          })

          const handleMapClick = (...args: unknown[]) => {
            const first = args[0] as { latLng?: KakaoLatLng } | undefined
            const latlng = first?.latLng
            if (!latlng) return
            if (!bounds.contain(latlng)) {
              setIsOutOfService(true)
              return
            }
            marker.setPosition(latlng)
            marker.setVisible(true)
            setSelectedPoint({ lat: latlng.getLat(), lng: latlng.getLng() })
            setIsOutOfService(false)
          }

          maps.event.addListener(map, 'click', handleMapClick)
          maps.event.addListener(map, 'mouseup', handleMapClick)

          maps.event.addListener(map, 'idle', () => {
            const centerPoint = map.getCenter()
            if (!bounds.contain(centerPoint)) {
              map.setBounds(bounds)
            }
          })
        }),
      )
      .catch(() => {
        setModalError('지도를 불러오지 못했습니다.')
      })
  }, [appKey, form.lat, form.lng, isModalOpen])

  const updateField = useCallback((key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const updateVoteDeadlineAuto = useCallback(
    (value: string) => {
      updateField('voteDeadlineAt', value)
      if (value && new Date(value) < new Date()) {
        setErrors((prev) => ({
          ...prev,
          voteDeadlineAt: '과거 시간은 선택할 수 없습니다.',
        }))
        return
      }
      setErrors((prev) => {
        if (!prev.voteDeadlineAt) return prev
        const next = { ...prev }
        delete next.voteDeadlineAt
        return next
      })
    },
    [updateField],
  )

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

  const applyVoteDeadlineOffset = (offsetMinutes: number) => {
    if (!form.scheduledAt) {
      setTimeNotice('모임 시간을 먼저 선택해 주세요')
      return
    }
    const base = new Date(form.scheduledAt)
    const next = new Date(base.getTime() - offsetMinutes * 60 * 1000)
    const pad = (num: number) => String(num).padStart(2, '0')
    const nextValue = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(
      next.getHours(),
    )}:${pad(next.getMinutes())}`
    updateField('voteDeadlineAt', nextValue)
  }

  const canUseOffset = (offsetMinutes: number) => {
    if (!form.scheduledAt) return false
    const scheduled = new Date(form.scheduledAt).getTime()
    const candidate = Date.now() + offsetMinutes * 60 * 1000
    return candidate <= scheduled
  }

  const confirmTimePicker = () => {
    if (!timePicker) return
    const nextValue = composeDateTime(
      timePicker.date,
      timePicker.hour || '00',
      timePicker.minute || '00',
    )
    if (timePicker.key === 'voteDeadlineAt') {
      if (
        form.scheduledAt &&
        nextValue &&
        new Date(nextValue) > new Date(form.scheduledAt)
      ) {
        updateField('voteDeadlineAt', form.scheduledAt)
        setTimeNotice('투표 마감 시간은 최대 모임 시간까지만 설정이 가능합니다')
      } else if (nextValue && new Date(nextValue) < new Date()) {
        updateField('voteDeadlineAt', form.scheduledAt)
        setTimeNotice('과거 시간은 선택할 수 없습니다.')
      } else {
        updateField('voteDeadlineAt', nextValue)
      }
    } else {
      updateField(timePicker.key, nextValue)
      if (
        timePicker.key === 'scheduledAt' &&
        form.voteDeadlineAt &&
        nextValue &&
        new Date(form.voteDeadlineAt) > new Date(nextValue)
      ) {
        updateVoteDeadlineAuto(nextValue)
      }
    }
    setTimePicker(null)
  }

  const handleNextStep = () => {
    if (!isStep1Valid) return
    setStep(2)
  }

  const handlePrevStep = () => {
    setStep(1)
  }

  const handleConfirmLocation = () => {
    if (!selectedPoint) {
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
      return
    }
    if (!placesRef.current) {
      setModalResults([])
      return
    }
    const maps = window.kakao?.maps
    if (!maps) {
      setModalResults([])
      return
    }

    setIsSearching(true)
    placesRef.current.keywordSearch(modalSearch.trim(), (data, status) => {
      setIsSearching(false)
      if (status !== maps.services.Status.OK || !data?.length) {
        setModalResults([])
        return
      }
      setModalResults(data)
    })
  }

  const handleSelectSearchResult = (place: KakaoPlace) => {
    if (!place?.y || !place?.x) return
    const lat = Number(place.y)
    const lng = Number(place.x)
    const bounds = boundsRef.current
    const maps = window.kakao?.maps
    if (maps && bounds && !bounds.contain(new maps.LatLng(lat, lng))) {
      setIsOutOfService(true)
      return
    }
    moveMapTo(lat, lng)
    setSelectedPoint({ lat, lng })
    setIsOutOfService(false)
  }

  const handleOpenMap = () => {
    setIsModalOpen(true)
    requestAnimationFrame(() => {
      mapInstanceRef.current?.relayout()
    })
  }

  const handleSubmit = async () => {
    const nextErrors = { ...errors }
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

    if (!meetingId) return

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
      await request(`/api/v1/meetings/${meetingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      navigate(`/meetings/${meetingId}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '모임 수정에 실패했습니다.')
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
            onClick={() => navigate(meetingId ? `/meetings/${meetingId}` : '/main')}
            aria-label="메인으로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={styles.title}>모임 수정</h1>
        </div>
        <p className={styles.subtitle}>필수 정보를 수정해 모임을 업데이트하세요.</p>
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
            {(canUseOffset(60) || canUseOffset(30) || canUseOffset(24 * 60)) && (
              <div className={styles.quickRow}>
                {canUseOffset(60) && (
                  <button
                    type="button"
                    className={styles.quickButton}
                    onClick={() => applyVoteDeadlineOffset(60)}
                  >
                    모임 시간 1시간 전
                  </button>
                )}
                {canUseOffset(30) && (
                  <button
                    type="button"
                    className={styles.quickButton}
                    onClick={() => applyVoteDeadlineOffset(30)}
                  >
                    모임 시간 30분 전
                  </button>
                )}
                {canUseOffset(24 * 60) && (
                  <button
                    type="button"
                    className={styles.quickButton}
                    onClick={() => applyVoteDeadlineOffset(24 * 60)}
                  >
                    모임 시간 하루 전
                  </button>
                )}
              </div>
            )}
            {shouldShowError('voteDeadlineAt', form.voteDeadlineAt) && (
              <span className={styles.error}>{errors.voteDeadlineAt}</span>
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
                onClick={handleOpenMap}
                onBlur={() => markTouched('address')}
              />
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
            <span className={styles.label}>음식점 후보 수</span>
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
              이전으로
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleSubmit}
              disabled={!isStep2Valid || isSubmitting}
            >
              {isSubmitting ? '수정 중...' : '모임 수정하기'}
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
                <p className={styles.serviceNote}>서비스 지역은 삼평동, 백현동, 수내 1동입니다</p>
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
                    검색
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
                            <span className={styles.searchName}>{place.place_name}</span>
                            <span className={styles.searchAddress}>
                              {place.road_address_name || place.address_name}
                            </span>
                            {!allowed && (
                              <span className={styles.searchDisabled}>서비스 지역 아님</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

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
