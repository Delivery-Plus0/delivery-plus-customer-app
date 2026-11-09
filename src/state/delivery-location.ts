import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { parseStoredLocation, roundPoint, type DeliveryLocation } from '@/utils/delivery-location';

const STORAGE_KEY = 'delivery-plus-delivery-location';

/**
 * The delivery location (#54), chosen before the restaurant list and kept on this device: `localStorage`
 * on the web, `expo-secure-store` on native. `undefined` until the stored value has been read.
 */
let current: DeliveryLocation | null | undefined;
/** Set when another screen (checkout after a 409 OutOfDeliveryArea) asks Home to open the picker. */
let pickerRequested = false;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? (window.localStorage ?? null) : null;
  } catch {
    return null;
  }
}

function load(): Promise<void> {
  loading ??= (async () => {
    const storage = webStorage();
    let raw: string | null = null;
    try {
      raw = storage ? storage.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (current === undefined) current = parseStoredLocation(raw);
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

type Snapshot = { location: DeliveryLocation | null; loaded: boolean; pickerRequested: boolean };
let snapshot: Snapshot = { location: null, loaded: false, pickerRequested: false };
function getSnapshot(): Snapshot {
  const next = { location: current ?? null, loaded: current !== undefined, pickerRequested };
  if (next.location !== snapshot.location || next.loaded !== snapshot.loaded || next.pickerRequested !== snapshot.pickerRequested) snapshot = next;
  return snapshot;
}

/** The chosen delivery location, whether it has been read from storage yet, and a pending picker request. */
export function useDeliveryLocation(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Saves the delivery location on this device; the restaurant list follows it. */
export async function setDeliveryLocation(location: DeliveryLocation): Promise<void> {
  current = roundPoint(location);
  pickerRequested = false;
  emit();
  const value = JSON.stringify(current);
  try {
    const storage = webStorage();
    if (storage) storage.setItem(STORAGE_KEY, value);
    else await SecureStore.setItemAsync(STORAGE_KEY, value);
  } catch {
    // Kept for this session only: the customer is asked again next time.
  }
}

/** Asks Home to show the location picker (e.g. checkout found the restaurant doesn't deliver there). */
export function requestLocationPicker(): void {
  pickerRequested = true;
  emit();
}

export function dismissLocationPicker(): void {
  pickerRequested = false;
  emit();
}
