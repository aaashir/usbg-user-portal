'use client';

import { createContext, useContext, useState } from 'react';

type CrmCtx = { search: string; setSearch: (v: string) => void };
const Ctx = createContext<CrmCtx>({ search: '', setSearch: () => {} });

export const useCrmSearch = () => useContext(Ctx);

export function CrmSearchProvider({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState('');
  return <Ctx.Provider value={{ search, setSearch }}>{children}</Ctx.Provider>;
}
