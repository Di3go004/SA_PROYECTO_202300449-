-- ============================================================
-- YoUSAC - Script de inicialización de PostgreSQL
-- Crea las bases de datos del ecosistema en el mismo servidor.
--
-- Patrón Database per Microservice: cada servicio tiene su propia base y ninguno
-- consulta las tablas de otro. Comparten motor por economía de recursos en el
-- entorno de desarrollo, no por acoplamiento.
-- Se ejecuta automáticamente al levantar el contenedor.
-- ============================================================

CREATE DATABASE yousac_auth_db;
CREATE DATABASE yousac_catalog_db;
CREATE DATABASE yousac_notifications_db;
