export interface PhoneCountry {
  iso2: string
  name: string
  dialCode: string
  flag: string
  minDigits: number
  maxDigits: number
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", minDigits: 10, maxDigits: 10 },
  { iso2: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", minDigits: 10, maxDigits: 10 },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", minDigits: 10, maxDigits: 10 },
  { iso2: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺", minDigits: 9, maxDigits: 9 },
  { iso2: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽", minDigits: 10, maxDigits: 10 },
  { iso2: "IN", name: "India", dialCode: "+91", flag: "🇮🇳", minDigits: 10, maxDigits: 10 },
  { iso2: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", minDigits: 10, maxDigits: 11 },
  { iso2: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", minDigits: 9, maxDigits: 9 },
  { iso2: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷", minDigits: 10, maxDigits: 11 },
  { iso2: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦", minDigits: 9, maxDigits: 9 }
]

export function getPhoneCountry(iso2?: string | null) {
  return PHONE_COUNTRIES.find((country) => country.iso2 === iso2) || PHONE_COUNTRIES[0]
}

export function detectPhoneCountry(value: string, fallbackIso2 = "US") {
  const trimmed = value.trim()
  if (!trimmed.startsWith("+")) return getPhoneCountry(fallbackIso2)

  const digitsWithPlus = `+${trimmed.replace(/[^\d]/g, "")}`
  const candidates = PHONE_COUNTRIES
    .filter((country) => digitsWithPlus.startsWith(country.dialCode))
    .sort((a, b) => b.dialCode.length - a.dialCode.length)

  return candidates[0] || getPhoneCountry(fallbackIso2)
}

export function normalizePhoneToE164(value: unknown, countryIso2 = "US") {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const country = detectPhoneCountry(trimmed, countryIso2)
  const digits = trimmed.replace(/[^\d]/g, "")
  if (!digits) return null

  if (trimmed.startsWith("+")) {
    const nationalDigits = digits.slice(country.dialCode.replace(/[^\d]/g, "").length)
    const e164 = `+${digits}`
    if (!isValidE164Phone(e164)) return null
    if (nationalDigits.length < country.minDigits || nationalDigits.length > country.maxDigits) return null
    return e164
  }

  if (digits.length < country.minDigits || digits.length > country.maxDigits) return null
  const e164 = `${country.dialCode}${digits}`
  return isValidE164Phone(e164) ? e164 : null
}

export function isValidE164Phone(value: unknown) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value.trim())
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function isValidEmail(value: unknown) {
  const normalized = normalizeEmail(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}
