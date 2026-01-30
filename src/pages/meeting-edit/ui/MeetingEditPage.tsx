import { useEffect, useMemo, useRef, useState } from 'react'
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
  searchRadiusKm: string
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
    searchRadiusKm: '',
    voteDeadlineAt: '',
    exceptMeat: false,
    exceptBar: false,
    swipeCount: '',
    quickMeeting: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStep1Valid, setIsStep1Valid] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalStatus, setModalStatus] = useState<string | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [modalResults, setModalResults] = useState<KakaoPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchAttempted, setIsSearchAttempted] = useState(false)
  const [isOutOfService, setIsOutOfService] = useState(false)
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

  const isStep2Valid = useMemo(() => {
    return (
      !!form.targetHeadcount &&
      Number(form.targetHeadcount) >= 2 &&
      !!form.searchRadiusKm &&
      Number(form.searchRadiusKm) > 0 &&
      !!form.voteDeadlineAt &&
      isFuture(form.voteDeadlineAt) &&
      !!form.swipeCount &&
      Number(form.swipeCount) > 0
    )
  }, [form])

  useEffect(() => {
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

    setErrors(nextErrors)
    setIsStep1Valid(Object.keys(nextErrors).length === 0)
  }, [form.address, form.scheduledAt, form.title])

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
          searchRadiusKm: detail.searchRadiusM
            ? (detail.searchRadiusM / 1000).toString()
            : '',
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
    setModalStatus('지도에서 위치를 선택하거나 검색해 주세요.')
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
            setModalStatus('선택된 위치입니다. 확정 버튼을 눌러 주세요.')
          }

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
        }),
      )
      .catch(() => {
        setModalError('지도를 불러오지 못했습니다.')
      })
  }, [appKey, form.lat, form.lng, isModalOpen])

  const updateField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
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
    if (maps && bounds && !bounds.contain(new maps.LatLng(lat, lng))) {
      setModalStatus('서비스 지역이 아닙니다.')
      setIsOutOfService(true)
      return
    }
    moveMapTo(lat, lng)
    setSelectedPoint({ lat, lng })
    setModalStatus('선택된 위치입니다. 확정 버튼을 눌러 주세요.')
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
      searchRadiusM: Math.round(Number(form.searchRadiusKm) * 1000),
      voteDeadlineAt: toPayloadDate(form.voteDeadlineAt),
      exceptMeat: form.exceptMeat,
      exceptBar: form.exceptBar,
      swipeCount: Number(form.swipeCount),
      quickMeeting: form.quickMeeting,
    }

    try {
      setIsSubmitting(true)
      await request(`/api/v1/meetings/${meetingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      navigate(`/meetings/${meetingId}`)
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        title: error instanceof Error ? error.message : '모임 수정에 실패했습니다.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>모임 수정</h1>
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
              maxLength={20}
            />
            {errors.title && <span className={styles.error}>{errors.title}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>모임 시간</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => updateField('scheduledAt', event.target.value)}
            />
            {errors.scheduledAt && (
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
              />
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={handleOpenMap}
              >
                위치 선택
              </button>
            </div>
            {errors.address && (
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
            />
            {errors.targetHeadcount && (
              <span className={styles.error}>{errors.targetHeadcount}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>검색 반경(km)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.1"
              value={form.searchRadiusKm}
              onChange={(event) => updateField('searchRadiusKm', event.target.value)}
            />
            {errors.searchRadiusKm && (
              <span className={styles.error}>{errors.searchRadiusKm}</span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>투표 마감</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={form.voteDeadlineAt}
              onChange={(event) => updateField('voteDeadlineAt', event.target.value)}
            />
            {errors.voteDeadlineAt && (
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
            />
            {errors.swipeCount && (
              <span className={styles.error}>{errors.swipeCount}</span>
            )}
          </label>

          <div className={styles.toggleRow}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={form.exceptMeat}
                onChange={(event) => updateField('exceptMeat', event.target.checked)}
              />
              <span>고깃집 제외</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={form.exceptBar}
                onChange={(event) => updateField('exceptBar', event.target.checked)}
              />
              <span>술집 제외</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={form.quickMeeting}
                onChange={(event) => updateField('quickMeeting', event.target.checked)}
              />
              <span>퀵 모임</span>
            </label>
          </div>

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
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsModalOpen(false)}
              >
                닫기
              </button>
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
    </div>
  )
}
