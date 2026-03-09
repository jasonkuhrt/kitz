// E2E: verifies #alpha and #beta resolve through tsconfig paths + package.json imports
import { Alpha } from '#alpha'
import { Beta } from '#beta'

export const sum = Alpha.value + Beta.value
