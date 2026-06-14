export interface Wedding {
  id: string
  name: string
  couple_names: string
  date: string | null
  slug: string
  owner_id: string
  created_at: string
}

export interface Photo {
  id: string
  wedding_id: string
  uploader_name: string
  message: string | null
  storage_path: string
  created_at: string
}
