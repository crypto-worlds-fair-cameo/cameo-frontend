/** 지갑 주소를 앞뒤 4자리로 줄인다. 헤더 계정 버튼과 같은 표기다. */
export function shortenAddress(address: string) {
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

/** 예: Sep 10, 2026 */
export function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

/** 예: Sep 28 */
export function formatMonthDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** lamports를 Number로 바꾸지 않고 SOL로 표기한다. 소수는 maxFractionDigits에서 버린다. 예: 1,222.33 */
export function formatSol(lamports: string, locale: string, maxFractionDigits = 9) {
  const value = BigInt(lamports);
  const whole = new Intl.NumberFormat(locale).format(value / 1_000_000_000n);
  const fraction = (value % 1_000_000_000n)
    .toString()
    .padStart(9, '0')
    .slice(0, maxFractionDigits)
    .replace(/0+$/u, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** 올해 날짜는 월·일만, 다른 해는 연도까지 표시한다. */
export function formatActivityDate(iso: string, locale: string, now = new Date()) {
  return new Date(iso).getFullYear() === now.getFullYear()
    ? formatMonthDay(iso, locale)
    : formatDate(iso, locale);
}

/** 같은 해의 기간은 시작일의 연도를 생략한다. 예: Oct 12 – Nov 1, 2026 */
export function formatDateRange(startIso: string, endIso: string, locale: string) {
  const sameYear = new Date(startIso).getFullYear() === new Date(endIso).getFullYear();
  const start = sameYear ? formatMonthDay(startIso, locale) : formatDate(startIso, locale);
  return `${start} – ${formatDate(endIso, locale)}`;
}
