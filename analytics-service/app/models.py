# app/models.py
# Modelos SQLAlchemy mapeados a las tablas de analytics_mysql.sql
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum
from sqlalchemy.sql import func
from app.database import Base

class VideoMetrics(Base):
    __tablename__ = "video_metrics"

    id                     = Column(Integer, primary_key=True, index=True)
    video_id               = Column(Integer, unique=True, nullable=False)
    course_id              = Column(Integer, nullable=False)
    teacher_id             = Column(Integer, nullable=False)
    total_views            = Column(Integer, default=0)
    unique_viewers         = Column(Integer, default=0)
    total_ratings          = Column(Integer, default=0)
    average_stars          = Column(Float, default=0.00)
    recommendation_percent = Column(Float, default=0.00)
    average_progress       = Column(Float, default=0.00)
    completion_rate        = Column(Float, default=0.00)
    last_synced_at         = Column(DateTime, server_default=func.now())
    created_at             = Column(DateTime, server_default=func.now())
    updated_at             = Column(DateTime, server_default=func.now(), onupdate=func.now())

class CourseMetrics(Base):
    __tablename__ = "course_metrics"

    id                     = Column(Integer, primary_key=True, index=True)
    course_id              = Column(Integer, unique=True, nullable=False)
    total_students         = Column(Integer, default=0)
    total_recordings       = Column(Integer, default=0)
    average_progress       = Column(Float, default=0.00)
    average_recommendation = Column(Float, default=0.00)
    last_synced_at         = Column(DateTime, server_default=func.now())
    updated_at             = Column(DateTime, server_default=func.now(), onupdate=func.now())

class TeacherStats(Base):
    __tablename__ = "teacher_stats"

    id                     = Column(Integer, primary_key=True, index=True)
    teacher_id             = Column(Integer, unique=True, nullable=False)
    total_recordings       = Column(Integer, default=0)
    total_views            = Column(Integer, default=0)
    average_recommendation = Column(Float, default=0.00)
    average_stars          = Column(Float, default=0.00)
    last_synced_at         = Column(DateTime, server_default=func.now())
    updated_at             = Column(DateTime, server_default=func.now(), onupdate=func.now())

class StudentProgress(Base):
    __tablename__ = "student_progress"

    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, nullable=False)
    course_id        = Column(Integer, nullable=False)
    videos_watched   = Column(Integer, default=0)
    videos_completed = Column(Integer, default=0)
    overall_progress = Column(Float, default=0.00)
    last_synced_at   = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id          = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id   = Column(Integer, nullable=False)
    status      = Column(Enum("success", "error"), nullable=False)
    error_msg   = Column(Text, nullable=True)
    synced_at   = Column(DateTime, server_default=func.now())
