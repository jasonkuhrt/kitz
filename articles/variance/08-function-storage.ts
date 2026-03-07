/**
 * Function Storage Patterns
 *
 * Shows how to store collections of functions with different signatures.
 */

// ❌ Problem: Trying to store specific functions with unknown
interface BadFunctionStore {
  [key: string]: (arg: unknown) => unknown
}

const badStore: BadFunctionStore = {
  // @ts-expect-error - Type '(s: string) => number' is not assignable
  getLength: (s: string) => s.length, // Error!

  // @ts-expect-error - Type '(n: number) => string' is not assignable
  toString: (n: number) => n.toString(), // Error!

  // This works but loses type information
  identity: (x: unknown) => x, // OK, but not useful
}

// ✅ Solution 1: Use any for flexibility
interface GoodFunctionStore {
  [key: string]: (...args: any[]) => any
}

const goodStore: GoodFunctionStore = {
  getLength: (s: string) => s.length, // ✅ Works
  toString: (n: number) => n.toString(), // ✅ Works
  add: (a: number, b: number) => a + b, // ✅ Works
  greet: (name: string, formal: boolean) => (formal ? `Good day, ${name}` : `Hi ${name}`), // ✅ Works
  noArgs: () => 'constant', // ✅ Works
}

// Can call them (but lose type safety at retrieval)
console.log(goodStore.getLength('hello')) // 5
console.log(goodStore.add(3, 4)) // 7

// ✅ Solution 2: Generic function map with type preservation
class TypedFunctionMap {
  private functions = new Map<string, Function>()

  add<TArgs extends any[], TReturn>(name: string, fn: (...args: TArgs) => TReturn): void {
    this.functions.set(name, fn)
  }

  call<TArgs extends any[], TReturn>(name: string, ...args: TArgs): TReturn | undefined {
    const fn = this.functions.get(name)
    return fn ? fn(...args) : undefined
  }

  get<TFunc extends (...args: any[]) => any>(name: string): TFunc | undefined {
    return this.functions.get(name) as TFunc | undefined
  }
}

const typedMap = new TypedFunctionMap()
typedMap.add('double', (n: number) => n * 2)
typedMap.add('concat', (a: string, b: string) => a + b)

// Type-safe retrieval
const double = typedMap.get<(n: number) => number>('double')
if (double) {
  console.log(double(21)) // 42
}

// ✅ Solution 3: Command pattern with discriminated unions
type Command =
  | { type: 'add'; a: number; b: number }
  | { type: 'multiply'; a: number; b: number }
  | { type: 'greet'; name: string; formal: boolean }
  | { type: 'uppercase'; text: string }

type CommandHandler<T extends Command> = (cmd: T) => any

const handlers: {
  [K in Command['type']]: CommandHandler<Extract<Command, { type: K }>>
} = {
  add: (cmd) => cmd.a + cmd.b,
  multiply: (cmd) => cmd.a * cmd.b,
  greet: (cmd) => (cmd.formal ? `Hello, ${cmd.name}` : `Hi ${cmd.name}`),
  uppercase: (cmd) => cmd.text.toUpperCase(),
}

function execute(cmd: Command): any {
  return handlers[cmd.type](cmd as any)
}

console.log(execute({ type: 'add', a: 5, b: 3 })) // 8
console.log(execute({ type: 'greet', name: 'Alice', formal: true })) // Hello, Alice

// ✅ Solution 4: Plugin system pattern
interface Plugin {
  name: string
  init: () => void
  process: (data: any) => any
  cleanup?: () => void
}

class PluginSystem {
  private plugins: Plugin[] = []

  register(plugin: Plugin): void {
    this.plugins.push(plugin)
    plugin.init()
  }

  processAll(data: any): any[] {
    return this.plugins.map((p) => p.process(data))
  }

  cleanup(): void {
    this.plugins.forEach((p) => p.cleanup?.())
  }
}

// Specific plugins with different internal types
const uppercasePlugin: Plugin = {
  name: 'uppercase',
  init: () => console.log('Uppercase plugin initialized'),
  process: (data: string) => data.toUpperCase(),
}

const doublePlugin: Plugin = {
  name: 'double',
  init: () => console.log('Double plugin initialized'),
  process: (data: number) => data * 2,
}

// Real-world example: Event emitter
type EventMap = {
  click: [x: number, y: number]
  change: [value: string]
  submit: [data: FormData]
}

type FormData = { [key: string]: string }

class TypedEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((fn) => fn(...args))
    }
  }
}

const emitter = new TypedEventEmitter()
emitter.on('click', (x, y) => console.log(`Clicked at ${x}, ${y}`))
emitter.on('change', (value) => console.log(`Changed to: ${value}`))
emitter.emit('click', 100, 200) // Clicked at 100, 200
