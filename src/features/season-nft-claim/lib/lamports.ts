/** bigint 문자열을 Number로 바꾸지 않고 lamports를 정확한 SOL 소수 문자열로 표시한다. */
export function lamportsToSol(value: string): string {
  const amount = BigInt(value);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/u, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}
