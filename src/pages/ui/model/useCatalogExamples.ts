import { useEffect, useRef, useState } from 'react';

export function useInputExamples() {
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(true);
  const [slider, setSlider] = useState(40);
  const [color, setColor] = useState('#641acb');
  const [opacity, setOpacity] = useState(80);
  const [brush, setBrush] = useState(12);
  return {
    search,
    setSearch,
    checked,
    setChecked,
    slider,
    setSlider,
    color,
    setColor,
    opacity,
    setOpacity,
    brush,
    setBrush,
  };
}
export function useNavigationExamples() {
  const [top, setTop] = useState('#main-canvas');
  const [sidebar, setSidebar] = useState('#profile');
  const [tab, setTab] = useState('main');
  const [page, setPage] = useState(1);
  return { top, setTop, sidebar, setSidebar, tab, setTab, page, setPage };
}
export function useCanvasExamples() {
  const [tool, setTool] = useState('brush');
  const [zoom, setZoom] = useState(100);
  return { tool, setTool, zoom, setZoom };
}
export function useActionExamples() {
  const [message, setMessage] = useState('버튼을 눌러 동작을 확인하세요.');
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function runDemo() {
    if (loading) return;
    setLoading(true);
    setMessage('데모 서명 처리 중…');
    timer.current = setTimeout(() => {
      setLoading(false);
      setMessage('데모 완료. 실제 거래는 발생하지 않았습니다.');
    }, 1200);
  }
  return { message, setMessage, loading, runDemo };
}
export function useOverlayExamples() {
  const [dialog, setDialog] = useState<'modal' | 'glass' | null>(null);
  const [message, setMessage] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  function openDialog(kind: 'modal' | 'glass', button: HTMLButtonElement) {
    trigger.current = button;
    setDialog(kind);
  }
  function closeDialog() {
    setDialog(null);
  }
  function confirm() {
    setMessage('확인했습니다. 실제 저장이나 거래는 발생하지 않습니다.');
    closeDialog();
  }
  return { dialog, setDialog, message, trigger, openDialog, closeDialog, confirm };
}
export function useSelectionExamples() {
  const [wallet, setWallet] = useState('');
  const [connected, setConnected] = useState(false);
  const [help, setHelp] = useState(false);
  return { wallet, setWallet, connected, setConnected, help, setHelp };
}
