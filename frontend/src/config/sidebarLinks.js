// Centralized sidebar link config used by all dashboards and feature pages
// Import: import { SIDEBAR_LINKS } from '../../config/sidebarLinks';

export const SIDEBAR_LINKS = {
  seller: [
    { to: '/seller',              end: true, icon: '📊', label: 'Dashboard' },
    { to: '/seller/products',               icon: '📦', label: 'My Products' },
    { to: '/seller/products/add',           icon: '➕', label: 'Add Product' },
    { to: '/seller/orders',                 icon: '🛒', label: 'Orders' },
    { to: '/seller/profile',               icon: '👤', label: 'Profile' },
    // ─── Features ─────────────────────────────
    { to: '/features/crop-disease',  icon: '🔬', label: 'Crop Disease AI' },
    { to: '/features/market-prices', icon: '📈', label: 'Market Prices' },
    { to: '/features/planner',       icon: '🌱', label: 'AI Crop Planner' },
    { to: '/features/news',          icon: '📰', label: 'Agri News' },
    { to: '/features/loan',          icon: '🏦', label: 'Agri Loan' },
    { to: '/features/chatbot',       icon: '🤖', label: 'AI Chat' },
    { to: '/weather',                icon: '🌤️', label: 'Weather' },
    { to: '/features/community',     icon: '🌾', label: 'About' },
  ],

  buyer: [
    { to: '/dashboard',         end: true, icon: '🛒', label: 'Marketplace' },
    { to: '/profile',            icon: '👤', label: 'My Profile' },
    // ─── Features ─────────────────────────────
    { to: '/features/crop-disease',  icon: '🔬', label: 'Crop Disease AI' },
    { to: '/features/market-prices', icon: '📈', label: 'Market Prices' },
    { to: '/features/planner',       icon: '🌱', label: 'AI Crop Planner' },
    { to: '/features/news',          icon: '📰', label: 'Agri News' },
    { to: '/features/loan',          icon: '🏦', label: 'Agri Loan' },
    { to: '/features/chatbot',       icon: '🤖', label: 'AI Chat' },
    { to: '/weather',                icon: '🌤️', label: 'Weather' },
    { to: '/features/community',     icon: '🌾', label: 'About' },
    { to: '/become-seller',          icon: '🏪', label: 'Become a Seller' },
  ],

  admin: [
    { to: '/admin',           end: true, icon: '📊', label: 'Dashboard' },
    { to: '/admin/users',              icon: '👥', label: 'User Management' },
    { to: '/admin/sellers',            icon: '🏪', label: 'Sellers' },
    { to: '/admin/products',           icon: '📦', label: 'Products' },
    { to: '/admin/orders',             icon: '🛒', label: 'Orders' },
    { to: '/admin/delivery',           icon: '🚚', label: 'Delivery' },
    { to: '/admin/analytics',          icon: '📈', label: 'Analytics' },
    // ─── Features ─────────────────────────────
    { to: '/features/crop-disease',  icon: '🔬', label: 'Crop Disease AI' },
    { to: '/features/market-prices', icon: '💹', label: 'Market Prices' },
    { to: '/features/news',          icon: '📰', label: 'Agri News' },
    { to: '/features/chatbot',       icon: '🤖', label: 'AI Chat' },
    { to: '/weather',                icon: '🌤️', label: 'Weather' },
    { to: '/features/community',     icon: '🌾', label: 'About' },
  ],

  delivery: [
    { to: '/delivery', end: true, icon: '🚚', label: 'My Deliveries' },
    // ─── Features ─────────────────────────────
    { to: '/features/news',      icon: '📰', label: 'Agri News' },
    { to: '/features/chatbot',   icon: '🤖', label: 'AI Chat' },
    { to: '/weather',            icon: '🌤️', label: 'Weather' },
    { to: '/features/community', icon: '🌾', label: 'About' },
  ],
};
