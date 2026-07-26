import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout'
import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'
import MerchantsPage from '@/pages/merchants'
import PackagesPage from '@/pages/packages'
import PrizesPage from '@/pages/prizes'
import OrdersPage from '@/pages/orders'
import LotteryPage from '@/pages/lottery'
import UsersPage from '@/pages/users'
import SettingsPage from '@/pages/settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="merchants" element={<MerchantsPage />} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="prizes" element={<PrizesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="lottery" element={<LotteryPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
