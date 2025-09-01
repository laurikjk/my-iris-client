export interface StorageAdapter {
  get<T = any>(key: string): Promise<T | undefined>
  put<T = any>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  list(prefix: string): Promise<string[]>
}