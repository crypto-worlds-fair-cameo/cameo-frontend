import { useState } from 'react';
import { useLocation } from 'react-router';

export function useMobileNavigation() {
    const { key } = useLocation();
    const [locationKey, setLocationKey] = useState(key);
    const [open, setOpen] = useState(false);

    if (locationKey !== key) {
        setLocationKey(key);
        setOpen(false);
    }

    return { open, setOpen, close: () => setOpen(false) };
}
