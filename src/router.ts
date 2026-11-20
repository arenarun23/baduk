import { useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#/, '') || '/';

export function go(path: string) {
  window.location.hash = path;
}

export function useRoute(): string[] {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => {
      setPath(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('/').filter(Boolean);
}
