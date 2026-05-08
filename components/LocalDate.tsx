"use client";

import { useState, useEffect } from "react";

type Props = {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
};

export default function LocalDate({ iso, options }: Props) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(new Date(iso).toLocaleDateString("en-US", options));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return <>{label}</>;
}
