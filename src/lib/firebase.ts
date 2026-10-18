import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// This config identifies the Firebase project; it is not a secret.
// Access is protected by Firebase Auth and the rules in firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAf3Pj2yjobN26-a5ZFuRtssbsZ18IyTgQ',
  authDomain: 'eatme-d825b.firebaseapp.com',
  projectId: 'eatme-d825b',
  storageBucket: 'eatme-d825b.firebasestorage.app',
  messagingSenderId: '858244229543',
  appId: '1:858244229543:web:bffe5d5b4dc434bc922e82',
}

export const app = initializeApp(firebaseConfig)

// Stay signed in across launches of the Home Screen app.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })

// The local cache keeps the app working offline; changes sync when the phone is back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})

// For local development against the Firebase emulators: VITE_EMULATORS=1 npm run dev
if (import.meta.env.DEV && import.meta.env.VITE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
