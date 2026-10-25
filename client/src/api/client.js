import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
api.interceptors.response.use((response) => response.data, (error) => Promise.reject(new Error(error.response?.data?.error?.message || 'The server could not be reached.')));
export const casesApi = {
  list: async () => (await api.get('/cases')).data,
  create: async (body) => (await api.post('/cases', body)).data,
  get: async (id) => (await api.get(`/cases/${id}`)).data,
  status: async (id) => (await api.get(`/cases/${id}/status`)).data,
  saveNotes: async (id, text) => api.put(`/cases/${id}/notes`, { text }),
  savePins: async (id, evidenceIds) => api.put(`/cases/${id}/pins`, { evidenceIds }),
  hint: async (id) => (await api.post(`/cases/${id}/hint`)).data,
  accuse: async (id, payload) => (await api.post(`/cases/${id}/accuse`, payload)).data,
  result: async (id) => (await api.get(`/cases/${id}/result`)).data,
  retry: async (id) => (await api.post(`/cases/${id}/retry`)).data,
  remove: async (id) => api.delete(`/cases/${id}`)
};
