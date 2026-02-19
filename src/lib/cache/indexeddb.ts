import localforage from 'localforage'

const DB_NAME = 'oms-database'
const STORES = {
  orders: 'orders',
  customers: 'customers',
  products: 'products',
  schema: 'schema',
  settings: 'settings',
} as const

localforage.config({
  name: DB_NAME,
  storeName: 'oms_store',
})

export async function getItem<T>(key: string, store: keyof typeof STORES): Promise<T | null> {
  try {
    const instance = localforage.createInstance({ storeName: STORES[store] })
    return await instance.getItem<T>(key)
  } catch (error) {
    console.error('IndexedDB get error:', error)
    return null
  }
}

export async function setItem<T>(key: string, value: T, store: keyof typeof STORES): Promise<void> {
  try {
    const instance = localforage.createInstance({ storeName: STORES[store] })
    await instance.setItem(key, value)
  } catch (error) {
    console.error('IndexedDB set error:', error)
  }
}

export async function removeItem(key: string, store: keyof typeof STORES): Promise<void> {
  try {
    const instance = localforage.createInstance({ storeName: STORES[store] })
    await instance.removeItem(key)
  } catch (error) {
    console.error('IndexedDB remove error:', error)
  }
}

export async function clearStore(store: keyof typeof STORES): Promise<void> {
  try {
    const instance = localforage.createInstance({ storeName: STORES[store] })
    await instance.clear()
  } catch (error) {
    console.error('IndexedDB clear error:', error)
  }
}

export async function getAllKeys(store: keyof typeof STORES): Promise<string[]> {
  try {
    const instance = localforage.createInstance({ storeName: STORES[store] })
    return await instance.keys()
  } catch (error) {
    console.error('IndexedDB keys error:', error)
    return []
  }
}

export const indexedDB = {
  get: getItem,
  set: setItem,
  remove: removeItem,
  clear: clearStore,
  keys: getAllKeys,
}
