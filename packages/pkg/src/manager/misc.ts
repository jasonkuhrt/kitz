export const isSpecifierFromPackage = (specifier: string, packageName: string): boolean => {
  return specifier === packageName || specifier.startsWith(packageName + `/`)
}

export interface ResolveHookContextLike {
  parentURL?: string
  conditions?: readonly string[]
  importAttributes?: Record<string, string>
}

export interface ImportEvent {
  specifier: string
  context: ResolveHookContextLike
}
