import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/home'
import { MeetingCreatePage } from '@/pages/meeting-create'
import { MeetingCreatedPage } from '@/pages/meeting-created'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/meetings/new" element={<MeetingCreatePage />} />
        <Route path="/meetings/:meetingId/created" element={<MeetingCreatedPage />} />
      </Routes>
    </BrowserRouter>
  )
}
