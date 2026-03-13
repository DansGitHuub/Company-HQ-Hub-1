import { MemoryRouter, Routes, Route, Outlet } from 'react-router';
import { AssessmentProvider } from './context/AssessmentContext';
import Dashboard from './screens/Dashboard';
import PropertySetup from './screens/PropertySetup';
import CategoryList from './screens/CategoryList';
import CategoryDetail from './screens/CategoryDetail';
import Review from './screens/Review';
import Report from './screens/Report';
import { Toaster } from '@/components/ui/sonner';

function Layout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export default function PropertyReportCard() {
  return (
    <AssessmentProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="property-setup" element={<PropertySetup />} />
            <Route path="assessment/:id" element={<CategoryList />} />
            <Route path="assessment/:id/category/:categoryId" element={<CategoryDetail />} />
            <Route path="assessment/:id/review" element={<Review />} />
            <Route path="report/:id" element={<Report />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AssessmentProvider>
  );
}
