import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppRouter } from '@/app/router'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MeetingCreatePage } from '@/pages/meeting-create'
import { MeetingCreatedPage } from '@/pages/meeting-created'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/meetings/new" element={<MeetingCreatePage />} />
          <Route path="/meetings/:meetingId/created" element={<MeetingCreatedPage />} />
          <Route path="/*" element={<AppRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
