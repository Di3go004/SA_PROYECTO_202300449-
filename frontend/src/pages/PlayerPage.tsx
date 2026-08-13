// src/pages/PlayerPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { catalogApi, checkpointApi, ratingsApi } from '../services/api'
import { useToast } from '../components/Toast'

interface Recording {
  recording_id: number
  title: string
  description: string
  course_name: string
  school_name: string
  semester: string
  year: number
  teacher_id: number
  duration_seconds: number
  video_url: string
  recommendation_pct: number
  tags: string[]
}

interface VideoStats {
  total_ratings: number
  average_stars: number
  recommendation_percent: number
}

export default function PlayerPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate    = useNavigate()
  const toast       = useToast()
  const videoRef    = useRef<HTMLVideoElement>(null)
  const checkpointTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [recording, setRecording] = useState<Recording | null>(null)
  const [stats, setStats]         = useState<VideoStats | null>(null)
  const [startPos, setStartPos]   = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // Un <video> con una fuente inalcanzable no lanza nada visible: se queda en
  // negro sin mensaje. Se captura onError para poder explicar qué pasó.
  const [videoError, setVideoError] = useState(false)

  const [stars, setStars]         = useState(0)
  const [hoverStar, setHoverStar] = useState(0)
  const [comment, setComment]     = useState('')
  const [ratingDone, setRatingDone] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)

  const userId = parseInt(localStorage.getItem('userId') || '1')

  useEffect(() => {
    if (!videoId) return

    const load = async () => {
      try {
        const recRes = await catalogApi.getById(parseInt(videoId))
        setRecording(recRes.data)

        // Checkpoint previo (RF-021): reanuda donde se quedó.
        const cpRes = await checkpointApi.get(parseInt(videoId), userId)
        setStartPos(cpRes.data.position_seconds || 0)

        const statsRes = await ratingsApi.getStats(parseInt(videoId))
        setStats(statsRes.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'No se pudo cargar el video')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => { if (checkpointTimer.current) clearInterval(checkpointTimer.current) }
  }, [videoId])

  const handleVideoLoad = () => {
    if (videoRef.current && startPos > 0) videoRef.current.currentTime = startPos
  }

  // Checkpoint cada 30 s mientras reproduce (RF-020).
  const handlePlay = () => {
    checkpointTimer.current = setInterval(async () => {
      if (!videoRef.current || !videoId) return
      try {
        await checkpointApi.save(
          userId, parseInt(videoId),
          Math.floor(videoRef.current.currentTime),
          Math.floor(videoRef.current.duration || 0),
        )
      } catch (e) {
        console.error('Error guardando checkpoint:', e)
      }
    }, 30000)
  }

  const handlePause = async () => {
    if (checkpointTimer.current) clearInterval(checkpointTimer.current)
    if (!videoRef.current || !videoId) return
    try {
      await checkpointApi.save(
        userId, parseInt(videoId),
        Math.floor(videoRef.current.currentTime),
        Math.floor(videoRef.current.duration || 0),
      )
    } catch (e) {
      console.error('Error guardando checkpoint en pausa:', e)
    }
  }

  const handleRating = async () => {
    if (!stars || !videoId) return
    setRatingLoading(true)
    try {
      const res = await ratingsApi.save(userId, parseInt(videoId), stars, comment)
      setStats(res.data)
      setRatingDone(true)
      toast.success('¡Gracias por calificar!')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la calificación')
    } finally {
      setRatingLoading(false)
    }
  }

  const timeLabel = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m} min`
  }

  if (loading) {
    return (
      <div className="public-shell">
        <div className="loading-block"><span className="spinner" /> Cargando video…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-shell">
        <div className="page-wrap" style={{ maxWidth: 520 }}>
          <div className="alert alert-error">{error}</div>
          <button className="btn btn-primary" onClick={() => navigate('/catalog')}>
            Volver al catálogo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="sidebar-logo">Yo</span>
          <span>YoUSAC</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/catalog')}>
          ← Volver al catálogo
        </button>
      </nav>

      <div className="page-wrap">
        {/* Reproductor */}
        <div style={{ background: '#000', borderRadius: 'var(--radius-container)', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src={recording?.video_url}
            controls
            style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', background: '#000' }}
            onLoadedMetadata={() => { setVideoError(false); handleVideoLoad() }}
            onError={() => setVideoError(true)}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handlePause}
          />
        </div>

        {videoError && (
          <div className="alert alert-error">
            <strong>No se pudo cargar el archivo de video.</strong>{' '}
            La grabación existe en el catálogo, pero su archivo no está disponible en{' '}
            <code>{recording?.video_url}</code>. Verificá que el servidor de medios esté
            levantado (<code>media-server</code> en el compose) o que la URL registrada sea correcta.
          </div>
        )}

        {startPos > 0 && !videoError && (
          <div className="alert alert-info">
            Se reanudó la reproducción desde el minuto {Math.floor(startPos / 60)}:
            {String(Math.floor(startPos % 60)).padStart(2, '0')}.
          </div>
        )}

        {/* Datos de la clase */}
        <div className="card">
          <h1 style={{ marginBottom: 6 }}>{recording?.title}</h1>
          <div className="row wrap" style={{ marginBottom: 12 }}>
            <span className="badge badge-primary">{recording?.course_name}</span>
            {recording?.school_name && <span className="badge badge-info">{recording.school_name}</span>}
            {recording?.semester && (
              <span className="badge badge-neutral">{recording.semester} {recording.year}</span>
            )}
            <span className="muted">{timeLabel(recording?.duration_seconds || 0)}</span>
          </div>
          {recording?.description && <p className="subtitle">{recording.description}</p>}
          {recording?.tags?.length > 0 && (
            <div className="tag-row" style={{ marginTop: 12 }}>
              {recording.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>

        <div className="grid-2">
          {/* Estadísticas */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Valoración de la clase</h2></div>
            <div className="stat-grid">
              <div className="stat-card" style={{ border: 'none', padding: 0 }}>
                <span className="stat-value">{Number(stats?.average_stars ?? 0).toFixed(1)}</span>
                <span className="stat-label">Promedio de estrellas</span>
              </div>
              <div className="stat-card" style={{ border: 'none', padding: 0 }}>
                <span className="stat-value">{stats?.total_ratings ?? 0}</span>
                <span className="stat-label">Calificaciones</span>
              </div>
              <div className="stat-card" style={{ border: 'none', padding: 0 }}>
                <span className="stat-value">
                  {Number(stats?.recommendation_percent ?? recording?.recommendation_pct ?? 0).toFixed(0)}%
                </span>
                <span className="stat-label">Recomendación</span>
              </div>
            </div>
          </div>

          {/* Calificar */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Calificar esta clase</h2></div>
            {ratingDone ? (
              <div className="alert alert-success">Tu calificación quedó registrada.</div>
            ) : (
              <>
                <div className="row" style={{ marginBottom: 12, fontSize: 26, gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setStars(n)}
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      aria-label={`${n} estrellas`}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, lineHeight: 1,
                        color: n <= (hoverStar || stars) ? '#e8a317' : 'var(--outline-variant)',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label className="field-label">Comentario (opcional)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="¿Qué te pareció la explicación?"
                  />
                </div>
                <button className="btn btn-primary" onClick={handleRating}
                  disabled={!stars || ratingLoading}>
                  {ratingLoading ? 'Enviando…' : 'Enviar calificación'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
