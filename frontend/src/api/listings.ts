import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export type ListingStatus = 'active' | 'sold' | 'closed'
export interface Listing {
  id: string; region_code: string; commodity: string; variety: string; grade: string; place: string; description: string
  unit: string; quantity: number; price: number; currency: string; status: ListingStatus; created_at: string; farmer_name: string
}
export interface MyListing extends Listing { inquiry_count: number }
export interface Inquiry { id: string; listing_id: string; commodity: string; message: string; created_at: string; buyer_name: string }
export interface NewListing {
  region_code: string; commodity: string; variety: string; grade: string; place: string; description: string
  unit: string; quantity: string; price: string; currency: string
}

// Every key starts with the country code so switching country can never show another region's data.
export function useListings(region: string, commodity: string, q: string) {
  const params = new URLSearchParams({ region })
  if (commodity) params.set('commodity', commodity)
  if (q.trim()) params.set('q', q.trim())
  return useQuery({ queryKey: [region, 'listings', commodity, q.trim()], retry: false,
    queryFn: () => api<{ total: number; items: Listing[] }>(`/api/listings?${params}`) })
}

export function useMyListings(region: string, enabled: boolean) {
  return useQuery({ queryKey: [region, 'my-listings'], enabled, retry: false,
    queryFn: () => api<{ items: MyListing[] }>('/api/farmer/listings') })
}
export function useFarmerInquiries(region: string, enabled: boolean) {
  return useQuery({ queryKey: [region, 'farmer-inquiries'], enabled, retry: false,
    queryFn: () => api<{ items: Inquiry[] }>('/api/farmer/inquiries') })
}
export function useBuyerInquiries(region: string, enabled: boolean) {
  return useQuery({ queryKey: [region, 'buyer-inquiries'], enabled, retry: false,
    queryFn: () => api<{ items: Inquiry[] }>('/api/buyer/inquiries') })
}

export function useCreateListing(region: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewListing) => api<Listing>('/api/listings', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [region] }) },
  })
}
export function useSetListingStatus(region: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ListingStatus }) =>
      api<Listing>(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [region] }) },
  })
}
export function useSendInquiry(region: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api<Inquiry>(`/api/listings/${id}/inquiries`, { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [region, 'buyer-inquiries'] }) },
  })
}
