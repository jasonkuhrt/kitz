import { describe, expect, it } from 'vitest'
import {
  CmxCapabilityExecutionFailure,
  CmxDuplicateNamespace,
  CmxDuplicateSlot,
  CmxInvalidAppMap,
  CmxInvalidPath,
  CmxMissingLayer,
  CmxSlotValidationFailure,
} from './errors.js'

describe('CmxDuplicateNamespace', () => {
  it('constructs with context and message', () => {
    const err = new CmxDuplicateNamespace({
      context: { namespace: 'Config', nodeA: 'app', nodeB: 'workspace' },
    })
    expect(err._tag).toBe('CmxDuplicateNamespace')
    expect(err.message).toContain('Config')
    expect(err.message).toContain('app')
    expect(err.message).toContain('workspace')
  })
})

describe('CmxDuplicateSlot', () => {
  it('constructs with context and message', () => {
    const err = new CmxDuplicateSlot({
      context: { slot: 'format', capabilityA: 'export', capabilityB: 'convert' },
    })
    expect(err._tag).toBe('CmxDuplicateSlot')
    expect(err.message).toContain('format')
    expect(err.message).toContain('export')
    expect(err.message).toContain('convert')
  })
})

describe('CmxInvalidAppMap', () => {
  it('constructs with context and message', () => {
    const err = new CmxInvalidAppMap({ context: { detail: 'cycle detected' } })
    expect(err._tag).toBe('CmxInvalidAppMap')
    expect(err.message).toContain('cycle detected')
  })
})

describe('CmxInvalidPath', () => {
  it('constructs with context and message', () => {
    const err = new CmxInvalidPath({ context: { path: ['workspace', 'nonexistent'] } })
    expect(err._tag).toBe('CmxInvalidPath')
    expect(err.message).toContain('workspace/nonexistent')
  })
})

describe('CmxMissingLayer', () => {
  it('constructs with context and message', () => {
    const err = new CmxMissingLayer({ context: { nodeId: 'thread', service: 'ThreadContext' } })
    expect(err._tag).toBe('CmxMissingLayer')
    expect(err.message).toContain('thread')
    expect(err.message).toContain('ThreadContext')
  })
})

describe('CmxSlotValidationFailure', () => {
  it('constructs with context and message', () => {
    const err = new CmxSlotValidationFailure({
      context: { slot: 'name', command: 'create', value: '' },
    })
    expect(err._tag).toBe('CmxSlotValidationFailure')
    expect(err.message).toContain('name')
    expect(err.message).toContain('create')
  })
})

describe('CmxCapabilityExecutionFailure', () => {
  it('constructs with context and message', () => {
    const err = new CmxCapabilityExecutionFailure({
      context: { capability: 'reload', cause: new Error('network') },
    })
    expect(err._tag).toBe('CmxCapabilityExecutionFailure')
    expect(err.message).toContain('reload')
  })
})
