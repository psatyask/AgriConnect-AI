import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import NewsTicker from './components/NewsTicker'
import Home from './pages/Home'
import { Forecasting, Intelligence, Marketplace } from './pages/Market'
import { Assistant, Knowledge } from './pages/Assistant'
import { BuyerDashboard, FarmerDashboard, Login } from './pages/Account'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <NewsTicker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/forecasting" element={<Forecasting />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/farmer" element={<FarmerDashboard />} />
        <Route path="/dashboard/buyer" element={<BuyerDashboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
