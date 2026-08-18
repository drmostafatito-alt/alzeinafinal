import { useQuery } from '@tanstack/react-query';
import { brandService, categoryService, bannerService, contentService, productService } from '@/services';
import { useUIStore } from '@/store/uiStore';
import { useEffect } from 'react';

/** يعلّم واجهة المستخدم أننا في وضع البيانات التجريبية */
function useDemoFlag(result) {
  const setDemoMode = useUIStore((s) => s.setDemoMode);
  useEffect(() => {
    if (result?.isMock) setDemoMode(true);
  }, [result?.isMock, setDemoMode]);
}

const opts = { staleTime: 5 * 60 * 1000, retry: 1 };

export function useProducts(params = {}) {
  const query = useQuery({
    queryKey: ['products', params],
    queryFn: () => productService.list(params),
    ...opts,
    placeholderData: (prev) => prev,
  });
  useDemoFlag(query.data);
  return {
    ...query,
    products: query.data?.data?.products || [],
    pagination: query.data?.data?.pagination || { page: 1, pages: 1, total: 0, limit: params.limit || 12 },
  };
}

const collection = (key, fn) =>
  function useCollection(limit = 8) {
    const query = useQuery({ queryKey: [key, limit], queryFn: () => fn(limit), ...opts });
    useDemoFlag(query.data);
    return { ...query, products: query.data?.data?.products || [] };
  };

export const useFeaturedProducts = collection('featured', productService.featured);
export const useBestSellers = collection('bestSellers', productService.bestSellers);
export const useNewArrivals = collection('newArrivals', productService.newArrivals);
export const useOnSaleProducts = collection('onSale', productService.onSale);

export function useProduct(slugOrId) {
  const query = useQuery({
    queryKey: ['product', slugOrId],
    queryFn: () => productService.bySlug(slugOrId),
    enabled: Boolean(slugOrId),
    ...opts,
  });
  useDemoFlag(query.data);
  return { ...query, product: query.data?.data?.product || null };
}

export function useRelatedProducts(productId, limit = 8) {
  const query = useQuery({
    queryKey: ['related', productId, limit],
    queryFn: () => productService.related(productId, limit),
    enabled: Boolean(productId),
    ...opts,
  });
  return { ...query, products: query.data?.data?.products || [] };
}

/** منتجات محددة يدوياً من بانى الصفحة (مصدر manual) */
export function useProductsByIds(ids = []) {
  const key = Array.isArray(ids) ? ids.join(',') : '';
  const query = useQuery({
    queryKey: ['products-ids', key],
    queryFn: () => productService.byIds(ids),
    enabled: Boolean(key),
    ...opts,
  });
  return { ...query, products: query.data?.data?.products || [] };
}

export function useCategories() {
  const query = useQuery({ queryKey: ['categories'], queryFn: categoryService.list, ...opts });
  useDemoFlag(query.data);
  return { ...query, categories: query.data?.data?.categories || [] };
}

export function useBrands() {
  const query = useQuery({ queryKey: ['brands'], queryFn: brandService.list, ...opts });
  useDemoFlag(query.data);
  return { ...query, brands: query.data?.data?.brands || [] };
}

export function useBanners(position = 'hero') {
  const query = useQuery({
    queryKey: ['banners', position],
    queryFn: () => bannerService.list(position),
    ...opts,
  });
  useDemoFlag(query.data);
  return { ...query, banners: query.data?.data?.banners || [] };
}

export function useTestimonials() {
  const query = useQuery({ queryKey: ['testimonials'], queryFn: contentService.testimonials, ...opts });
  return { ...query, testimonials: query.data?.data?.testimonials || [] };
}

export function useInstagramFeed() {
  const query = useQuery({ queryKey: ['instagram'], queryFn: contentService.instagram, ...opts });
  return { ...query, posts: query.data?.data?.posts || [] };
}

export function useSearchSuggestions(term) {
  const query = useQuery({
    queryKey: ['suggestions', term],
    queryFn: () => productService.suggestions(term),
    enabled: Boolean(term && term.trim().length >= 2),
    staleTime: 60 * 1000,
  });
  return {
    ...query,
    suggestions: query.data?.data || { products: [], categories: [], brands: [] },
  };
}
