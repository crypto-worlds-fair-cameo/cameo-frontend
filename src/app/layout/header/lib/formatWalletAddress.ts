/** 긴 지갑 주소를 앞 4자와 뒤 4자만 남겨 좁은 목록 칸에 표시한다. */
export function formatWalletAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
