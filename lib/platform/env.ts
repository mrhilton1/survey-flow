export function getRuntimeEnv(name: string): string | undefined {
  const processValue = process.env[name]
  if (processValue) {
    return processValue
  }

  return undefined
}

