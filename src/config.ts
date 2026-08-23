// Configuración central del front.
//
// Las API calls de blackjack apuntaban a https://api-gateway-z0qe.onrender.com
// (servidor externo caído). Ahora apuntan al gateway local levantado con
// docker compose en el host en el puerto 8000 (container 5000).
//
// Podés sobreescribirlo en build/run con la env VITE_API_BASE_URL:
//   VITE_API_BASE_URL=http://localhost:8000 npm run dev
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';