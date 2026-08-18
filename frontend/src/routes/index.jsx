import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
/**
 * التخطيطات تُستورد مباشرة (ليست كسولة) حتى لا يفكّ تركيبها أثناء التنقل.
 * فكّ تركيب التخطيط كان يترك طبقات الدروَر/المودال المنقولة عبر Portal
 * عالقة في <body> ويشلّ الصفحة بالكامل.
 */
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';
import AdminLayout from '@/layouts/AdminLayout';
import { PageSpinner } from '@/components/ui/Spinner';
import { AdminGuestRoute, AdminRoute, GuestRoute, ProtectedRoute } from './ProtectedRoute';

/* Store pages */
import Home from '@/pages/Home';
const Shop = lazy(() => import('@/pages/Shop'));
const ProductPage = lazy(() => import('@/pages/Product'));
const Categories = lazy(() => import('@/pages/Categories'));
const Search = lazy(() => import('@/pages/Search'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderSuccess = lazy(() => import('@/pages/Checkout/OrderSuccess'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Compare = lazy(() => import('@/pages/Compare'));
const Orders = lazy(() => import('@/pages/Orders'));
const MyReturns = lazy(() => import('@/pages/Returns'));
const RequestReturn = lazy(() => import('@/pages/Returns/RequestReturn'));
const SupportCenter = lazy(() => import('@/pages/Support'));
const OrderDetails = lazy(() => import('@/pages/Orders/OrderDetails'));
const Profile = lazy(() => import('@/pages/Profile'));
const ProfileInfo = lazy(() => import('@/pages/Profile/ProfileInfo'));
const Addresses = lazy(() => import('@/pages/Profile/Addresses'));
const Security = lazy(() => import('@/pages/Profile/Security'));
const About = lazy(() => import('@/pages/Static/About'));
const Contact = lazy(() => import('@/pages/Static/Contact'));
const Policy = lazy(() => import('@/pages/Static/Policy'));
const DynamicPage = lazy(() => import('@/pages/Static/DynamicPage'));
const OAuthCallback = lazy(() => import('@/pages/Login/OAuthCallback'));
const ResetPassword = lazy(() => import('@/pages/Login/ResetPassword'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/* Auth */
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/Login/ForgotPassword'));

/* Admin */
const Dashboard = lazy(() => import('@/pages/Admin/Dashboard'));
const AdminProducts = lazy(() => import('@/pages/Admin/Products'));
const AdminCategories = lazy(() => import('@/pages/Admin/Categories'));
const AdminBrands = lazy(() => import('@/pages/Admin/Brands'));
const AdminOrders = lazy(() => import('@/pages/Admin/Orders'));
const AdminCustomers = lazy(() => import('@/pages/Admin/Customers'));
const AdminCoupons = lazy(() => import('@/pages/Admin/Coupons'));
const AdminBanners = lazy(() => import('@/pages/Admin/Banners'));
const AdminReviews = lazy(() => import('@/pages/Admin/Reviews'));
const AdminMessages = lazy(() => import('@/pages/Admin/Messages'));
const AdminSettings = lazy(() => import('@/pages/Admin/Settings'));
const AdminStatistics = lazy(() => import('@/pages/Admin/Statistics'));
const AdminPayments = lazy(() => import('@/pages/Admin/Payments'));
const AdminShipping = lazy(() => import('@/pages/Admin/Shipping'));
const AdminPages = lazy(() => import('@/pages/Admin/Pages'));
const AdminContent = lazy(() => import('@/pages/Admin/Content'));
const AdminReturns = lazy(() => import('@/pages/Admin/Returns'));
const AdminSupport = lazy(() => import('@/pages/Admin/Support'));
const AdminTemplates = lazy(() => import('@/pages/Admin/Templates'));
const AdminMedia = lazy(() => import('@/pages/Admin/Media'));
const AdminLogin = lazy(() => import('@/pages/Admin/AdminLogin'));
const AdminPaymentVerification = lazy(() => import('@/pages/Admin/PaymentVerification'));
/* المرحلة 3 — شاشات لوحة الإدارة الجديدة */
const AdminInventory = lazy(() => import('@/pages/Admin/Inventory'));
const AdminActivity = lazy(() => import('@/pages/Admin/Activity'));
const AdminNotifications = lazy(() => import('@/pages/Admin/Notifications'));
const AdminPageBuilder = lazy(() => import('@/pages/Admin/PageBuilder'));
/* المرحلة 4 — النظام والمنصّة */
const AdminSystem = lazy(() => import('@/pages/Admin/System'));
const AdminPlatform = lazy(() => import('@/pages/Admin/Platform'));
const AdminDesignStudio = lazy(() => import('@/pages/Admin/DesignStudio'));
const AdminStaff = lazy(() => import('@/pages/Admin/Staff'));
/* مركز إعادة ضبط المتجر — المدير الأعلى فقط */
const AdminResetCenter = lazy(() => import('@/pages/Admin/ResetCenter'));

export default function AppRoutes() {
  return (
    <Routes>
        {/* Store */}
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="categories" element={<Categories />} />
          <Route path="search" element={<Search />} />
          <Route path="cart" element={<Cart />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="compare" element={<Compare />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-success" element={<OrderSuccess />} />

          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="returns"
            element={
              <ProtectedRoute>
                <MyReturns />
              </ProtectedRoute>
            }
          />
          <Route
            path="returns/new/:orderId"
            element={
              <ProtectedRoute>
                <RequestReturn />
              </ProtectedRoute>
            }
          />
          <Route
            path="support"
            element={
              <ProtectedRoute>
                <SupportCenter />
              </ProtectedRoute>
            }
          />

          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProfileInfo />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="security" element={<Security />} />
          </Route>

          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="faq" element={<Policy type="faq" />} />
          <Route path="shipping-policy" element={<Policy type="shipping" />} />
          <Route path="returns-policy" element={<Policy type="returns" />} />
          <Route path="privacy-policy" element={<Policy type="privacy" />} />
          <Route path="terms" element={<Policy type="terms" />} />

          {/* صفحات المحتوى التي ينشئها المدير */}
          <Route path="page/:slug" element={<DynamicPage />} />
          <Route path="oauth/callback" element={<OAuthCallback />} />

          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Auth */}
        <Route element={<AuthLayout />}>
          <Route
            path="login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        {/* Admin login — خارج تخطيط لوحة الإدارة وبلا حماية AdminRoute */}
        <Route
          path="admin/login"
          element={
            <AdminGuestRoute>
              <Suspense fallback={<PageSpinner />}>
                <AdminLogin />
              </Suspense>
            </AdminGuestRoute>
          }
        />

        {/* Admin */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="statistics" element={<AdminStatistics />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="payment-verification" element={<AdminPaymentVerification />} />
          {/* توافق خلفي: إشعارات قديمة كانت تشير لمسار بصيغة الجمع */}
          <Route path="payment-verifications" element={<Navigate to="/admin/payment-verification" replace />} />
          <Route path="media" element={<AdminMedia />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="returns" element={<AdminReturns />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="templates" element={<AdminTemplates />} />
          {/* المرحلة 3 — مسارات جديدة داخل نفس لوحة الإدارة */}
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="page-builder" element={<AdminPageBuilder />} />
          <Route path="system" element={<AdminSystem />} />
          <Route path="design" element={<AdminDesignStudio />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="platform" element={<AdminPlatform />} />
          <Route path="reset" element={<AdminResetCenter />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
    </Routes>
  );
}
