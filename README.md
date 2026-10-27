# Soundscape

Plataforma de música web y móvil con recomendaciones personalizadas. Conecta tus servicios de música (Spotify, Last.fm, YouTube Music, Apple Music), importa tu historial y descubre canciones con un motor de recomendaciones híbrido.

## Funcionalidades

- Registro e inicio de sesión con JWT y conexión OAuth a proveedores de música (tokens cifrados con AES-256).
- Importación de historial de escucha y exportación de playlists mediante workers en segundo plano.
- Recomendaciones personalizadas: filtrado colaborativo (`implicit`) + búsqueda vectorial (FAISS), con reentrenamiento programado.
- Búsqueda de canciones con Elasticsearch.
- Playlists compartibles, calificaciones y comentarios.
- Panel de analítica para administradores.
- Clientes web (Next.js) y móvil (Expo / React Native) sobre la misma API tipada (tRPC).

## Arquitectura

```
apps/
  api/          API Node.js — Express + tRPC, workers BullMQ
  web/          Cliente web — Next.js + Tailwind
  mobile/       App móvil — Expo Router + React Native
  ml-service/   Servicio de recomendaciones — FastAPI + scikit-learn + FAISS
packages/
  db/               Esquema y cliente Prisma (PostgreSQL)
  auth/             Utilidades JWT / sesiones
  music-providers/  Integraciones Spotify, Last.fm, YouTube, Apple Music
  api-client/       Cliente tRPC compartido
  types/ ui/ config/
infra/
  docker-compose.yml  PostgreSQL, Redis, Elasticsearch
  docker/             Dockerfiles de api, web y ml-service
```

## Stack

TypeScript · Node.js · Express · tRPC · Prisma · PostgreSQL · Redis · BullMQ · Elasticsearch · Next.js · Tailwind · Zustand · TanStack Query · Expo / React Native · Python · FastAPI · SQLAlchemy · scikit-learn · implicit · FAISS · Docker · Turborepo · pnpm · GitHub Actions

## Puesta en marcha

Requisitos: Node.js 22+, pnpm, Python 3.11+, Docker.

```bash
pnpm install
cp .env.example .env          # completa las credenciales de los proveedores
pnpm services:up              # PostgreSQL, Redis y Elasticsearch
pnpm db:migrate init
pnpm db:seed
pnpm dev                      # api, web y mobile vía Turborepo
```

Servicio de ML:

```bash
cd apps/ml-service
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000
```
