const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  console.warn('[env] VITE_API_BASE_URL is not defined.')
}

export { API_BASE_URL }
