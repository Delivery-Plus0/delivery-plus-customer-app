import { apiGet } from '@/services/api';

export type RestaurantStatus = 'OPEN' | 'CLOSED' | 'BUSY' | 'SUSPENDED';

export type Restaurant = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  address: string;
  status: RestaurantStatus;
  latitude?: number | null;
  longitude?: number | null;
  /** The effective delivery radius, in kilometres. */
  deliveryRadiusKm?: number;
  /** Only on a list filtered by a delivery location: how far the restaurant is from it. */
  distanceKm?: number;
  cuisineTags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type RestaurantListResponse = {
  items: Restaurant[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Mirrors restaurant-service `ListRestaurantsQueryDto`. */
export type RestaurantListQuery = {
  page?: number;
  limit?: number;
  status?: RestaurantStatus;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  /** #54: only restaurants that deliver to this point, nearest first (backend #209). */
  lat?: number;
  lng?: number;
};

export function buildRestaurantQuery({ page = 1, limit = 20, status, search, sortBy, sortOrder, lat, lng }: RestaurantListQuery = {}): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (lat !== undefined && lng !== undefined) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
  }
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());
  if (sortBy) params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);
  return params.toString();
}

export async function fetchRestaurants(query: RestaurantListQuery = {}): Promise<RestaurantListResponse> {
  return apiGet<RestaurantListResponse>(`/api/restaurants?${buildRestaurantQuery(query)}`);
}

export async function fetchRestaurantById(id: string): Promise<Restaurant> {
  return apiGet<Restaurant>(`/api/restaurants/${id}`);
}
