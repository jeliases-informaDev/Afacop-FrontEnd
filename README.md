# MiRadar 360 - Web (panel de administración)

Panel web de MiRadar 360 (antes AFACOP): React 19 + Vite. Se conecta a la API del repositorio
[Afacop-Backend](https://github.com/jeliases-informaDev/Afacop-Backend).
Producción corre en el servidor de Sulotec (`miradar360.sulotec.com`); este repositorio es solo el código.

## Levantar en tu PC

La guía completa (base de datos, backend, web y app móvil, con los comandos listos) está en
**https://github.com/Sulotec/Sulotec-infra/blob/main/apps/miradar/DESARROLLO-LOCAL.md**

Resumen (necesitas Node.js 24 y el backend corriendo en http://localhost:4001):

```bash
node -e "require('fs').writeFileSync('.env','VITE_API_URL=http://localhost:4001\n')"
npm ci
npm run dev
```

Abre http://localhost:5173 y entra con el usuario `admin` que creó el backend.
El `.env` apunta la web a tu API local y git lo ignora; no pongas ahí la dirección de producción.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Genera `dist/` (lo que se publica) |
| `npm run preview` | Sirve `dist/` para revisarlo |
| `npm run lint` | Revisa el código con ESLint |

## Cómo entregar cambios

- Una rama por tarea y un Pull Request a `main`; nadie empuja directo a `main`.
- Nunca subas `.env` ni claves. Las variables `VITE_*` terminan dentro del paquete público: solo direcciones, nunca secretos.
- Cuando el PR se une, Sulotec publica en producción desde el kit del servidor.
