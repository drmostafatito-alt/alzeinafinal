import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  mobileMenuOpen: false,
  searchOpen: false,
  cartDrawerOpen: false,
  filtersOpen: false,
  quickViewProduct: null,
  isDemoMode: false,

  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),

  openCartDrawer: () => set({ cartDrawerOpen: true }),
  closeCartDrawer: () => set({ cartDrawerOpen: false }),

  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  closeFilters: () => set({ filtersOpen: false }),

  openQuickView: (product) => set({ quickViewProduct: product }),
  closeQuickView: () => set({ quickViewProduct: null }),

  setDemoMode: (v) => {
    if (get().isDemoMode !== v) set({ isDemoMode: v });
  },

  closeAll: () =>
    set({
      mobileMenuOpen: false,
      searchOpen: false,
      cartDrawerOpen: false,
      filtersOpen: false,
      quickViewProduct: null,
    }),
}));

