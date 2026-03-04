// PASS: peer import within the same walled scope (same directory)
import { barImpl } from './impl.js'

export const barPeer = barImpl
