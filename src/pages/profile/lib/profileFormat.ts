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

/** 같은 해의 기간은 시작일의 연도를 생략한다. 예: Oct 12 – Nov 1, 2026 */
export function formatDateRange(startIso: string, endIso: string, locale: string) {
  const sameYear = new Date(startIso).getFullYear() === new Date(endIso).getFullYear();
  const start = sameYear ? formatMonthDay(startIso, locale) : formatDate(startIso, locale);
  return `${start} – ${formatDate(endIso, locale)}`;
}

/** SOL 금액을 소수 2~4자리로 표시한다. 출금은 디자인과 같은 마이너스 기호(−)를 붙인다. */
export function formatSol(amount: number, locale: string) {
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '−' : ''}${value} SOL`;
}
