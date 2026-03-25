import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './views/HomePage';
import HostView from './views/HostView';
import GuestView from './views/GuestView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostView />} />
        <Route path="/room/:roomId" element={<GuestView />} />
      </Routes>
    </BrowserRouter>
  );
}
