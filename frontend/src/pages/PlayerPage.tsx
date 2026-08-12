// src/pages/PlayerPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { catalogApi, checkpointApi, ratingsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface Recording {
  recording_id: number
  title: string
  description: string
  course_name: string
  teacher_id: number
  duration_seconds: number
  video_url: string
  recommendation_pct: number
}

interface VideoStats {
  total_ratings: number
  average_stars: number
  recommendation_percent: number
}

export default function PlayerPage() {
  const { videoId }     = useParams<{ videoId: string }>()
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const videoRef        = useRef<HTMLVideoElement>(null)
const checkpointTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [recording,   setRecording]   = useState<Recording | null>(null)
  const [stats,       setStats]       = useState<VideoStats | null>(null)
  const [startPos,    setStartPos]    = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // Rating state
  const [stars,       setStars]       = useState(0)
  const [hoverStar,   setHoverStar]   = useState(0)
  const [comment,     setComment]     = useState('')
  const [ratingDone,  setRatingDone]  = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)

  const userId = parseInt(localStorage.getItem('userId') || '1')

  useEffect(() => {
    if (!videoId) return

    const load = async () => {
      try {
        // Cargar datos del video
        const recRes = await catalogApi.getById(parseInt(videoId))
        setRecording(recRes.data)

        // Cargar último checkpoint (RF-021)
        const cpRes = await checkpointApi.get(parseInt(videoId), userId)
        setStartPos(cpRes.data.position_seconds || 0)

        // Cargar estadísticas
        const statsRes = await ratingsApi.getStats(parseInt(videoId))
        setStats(statsRes.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error al cargar el video')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => { if (checkpointTimer.current) clearInterval(checkpointTimer.current) }
  }, [videoId])

  // Cuando el video carga, ir al checkpoint
  const handleVideoLoad = () => {
    if (videoRef.current && startPos > 0) {
      videoRef.current.currentTime = startPos
    }
  }

  // Iniciar guardado de checkpoints cada 30 segundos (RF-020)
  const handlePlay = () => {
    checkpointTimer.current = setInterval(async () => {
      if (!videoRef.current || !videoId) return
      try {
        await checkpointApi.save(
          userId,
          parseInt(videoId),
          Math.floor(videoRef.current.currentTime),
          Math.floor(videoRef.current.duration || 0),
        )
      } catch (e) {
        console.error('Error guardando checkpoint:', e)
      }
    }, 30000)
  }

  // Guardar checkpoint al pausar (RF-020)
  const handlePause = async () => {
    if (checkpointTimer.current) clearInterval(checkpointTimer.current)
    if (!videoRef.current || !videoId) return
    try {
      await checkpointApi.save(
        userId,
        parseInt(videoId),
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar calificación')
    } finally {
      setRatingLoading(false)
    }
  }

  if (loading) return <div style={styles.center}>Cargando video...</div>
  if (error)   return (
    <div style={styles.center}>
      <div className="error-msg">{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate('/catalog')} style={{ marginTop: 16 }}>
        ← Volver al catálogo
      </button>
    </div>
  )
  if (!recording) return null

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <button className="btn btn-secondary" onClick={() => navigate('/catalog')} style={{ padding: '6px 14px' }}>
          ← Catálogo
        </button>
        <span style={styles.navTitle}>🎓 YoUSAC</span>
        <span style={{ color: '#64748b', fontSize: 13 }}>{user?.email}</span>
      </nav>

      <div style={styles.layout}>
        {/* Player */}
        <div style={styles.playerSection}>
          <video
            ref={videoRef}
            style={styles.video}
            controls
            src={recording.video_url}
            onLoadedMetadata={handleVideoLoad}
            onPlay={handlePlay}
            onPause={handlePause}
          >
            Tu navegador no soporta reproducción de video.
          </video>

          {/* Info del video */}
          <div style={styles.videoInfo}>
            <h1 style={styles.videoTitle}>{recording.title}</h1>
            <div style={styles.videoMeta}>
              <span style={styles.courseName}>{recording.course_name}</span>
              <span style={styles.recPct}>⭐ {stats?.recommendation_percent?.toFixed(0) || 0}% lo recomiendan</span>
            </div>
            {recording.description && (
              <p style={styles.description}>{recording.description}</p>
            )}
          </div>

          {/* Sección de calificación (RF-023) */}
          <div className="card" style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 16, color: '#f1f5f9' }}>Calificar esta clase</h3>

            {ratingDone ? (
              <div style={{ color: '#86efac', fontSize: 14 }}>
                ✅ ¡Gracias por tu calificación! El porcentaje de recomendación se actualizó.
              </div>
            ) : (
              <>
                {/* Estrellas */}
                <div style={styles.stars}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <span
                      key={s}
                      style={{
                        ...styles.star,
                        color: s <= (hoverStar || stars) ? '#fbbf24' : '#334155',
                      }}
                      onClick={() => setStars(s)}
                      onMouseEnter={() => setHoverStar(s)}
                      onMouseLeave={() => setHoverStar(0)}
                    >
                      ★
                    </span>
                  ))}
                  {stars > 0 && <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 8 }}>{stars} de 5</span>}
                </div>

                {/* Comentario opcional */}
                <textarea
                  placeholder="Comentario opcional..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  style={{ marginTop: 12, height: 80, resize: 'vertical' }}
                />

                <button
                  className="btn btn-primary"
                  onClick={handleRating}
                  disabled={!stars || ratingLoading}
                  style={{ marginTop: 12 }}
                >
                  {ratingLoading ? 'Guardando...' : 'Enviar calificación'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar con stats */}
        <div style={styles.sidebar}>
          <div className="card">
            <h3 style={{ marginBottom: 16, color: '#f1f5f9' }}>Estadísticas</h3>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Calificaciones</span>
              <span style={styles.statValue}>{stats?.total_ratings || 0}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Promedio estrellas</span>
              <span style={styles.statValue}>{'⭐'.repeat(Math.round(stats?.average_stars || 0))} ({stats?.average_stars?.toFixed(1) || '0.0'})</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Recomendación</span>
              <span style={{ ...styles.statValue, color: '#3b82f6' }}>
                {stats?.recommendation_percent?.toFixed(0) || 0}%
              </span>
            </div>
          </div>

          {startPos > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                ▶ Continuando desde {Math.floor(startPos / 60)}m {startPos % 60}s
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0f172a' },
  center: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
  },
  navbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
  },
  navTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  layout: {
    display: 'flex', gap: 24, padding: 24,
    maxWidth: 1280, margin: '0 auto',
    flexWrap: 'wrap',
  },
  playerSection: { flex: '1 1 640px' },
  sidebar: { flex: '0 0 280px' },
  video: {
    width: '100%', borderRadius: 12,
    background: '#000', aspectRatio: '16/9',
  },
  videoInfo: { marginTop: 16 },
  videoTitle: { fontSize: 20, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 },
  videoMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  courseName: { fontSize: 14, color: '#3b82f6', fontWeight: 500 },
  recPct: { fontSize: 14, color: '#fbbf24', fontWeight: 600 },
  description: { fontSize: 14, color: '#94a3b8', lineHeight: 1.6 },
  stars: { display: 'flex', alignItems: 'center', gap: 4 },
  star: { fontSize: 32, cursor: 'pointer', transition: 'color 0.1s', userSelect: 'none' },
  statItem: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
    paddingBottom: 12, borderBottom: '1px solid #334155',
  },
  statLabel: { fontSize: 13, color: '#64748b' },
  statValue: { fontSize: 14, color: '#f1f5f9', fontWeight: 600 },
}
