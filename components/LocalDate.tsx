"use client";

type Props = {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
};

export default function LocalDate({ iso, options }: Props) {
  return <>{new Date(iso).toLocaleDateString("en-US", options)}</>;
}
