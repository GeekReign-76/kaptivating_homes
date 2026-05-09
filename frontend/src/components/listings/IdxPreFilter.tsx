'use client';

const IDX_BASE = 'https://matrix.canopymls.com/Matrix/Public/IDXMap.aspx?count=1&idx=d95436b2';

interface IdxPreFilterProps {
  src?: string; // override the default IDX src (e.g. KW proxy URL)
}

export function IdxPreFilter({ src }: IdxPreFilterProps) {
  return (
    <iframe
      src={src ?? IDX_BASE}
      width="100%"
      height="100%"
      frameBorder="0"
      marginWidth={0}
      marginHeight={0}
      title="Search MLS Listings — Kaptivating Homes by Karsten"
      className="w-full h-full block"
    />
  );
}
