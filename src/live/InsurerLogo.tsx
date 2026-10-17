import pingAn from '@/assets/insurers/pingan.svg';
import picc from '@/assets/insurers/picc.png';

/** Unchanged public official assets; unknown insurers keep their written name. */
export function InsurerLogo({ name }: { name: string }) {
  const brand = /平安|ping\s*an/i.test(name)
    ? { src: pingAn, alt: '中国平安 PING AN', width: 238, height: 38 }
    : /人民保险|人民财产|中国人保|\bPICC\b/i.test(name)
      ? { src: picc, alt: 'PICC 中国人民保险（集团品牌标志）', width: 645, height: 168 }
      : null;
  return <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginBlock: 8 }}>
    {brand ? <span style={{ display: 'inline-flex', background: 'var(--wb-white, #fff)', padding: 8, maxWidth: '100%' }}><img src={brand.src} alt={brand.alt} width={brand.width} height={brand.height} loading="lazy" decoding="async" style={{ display: 'block', width: 126, maxWidth: '100%', height: 'auto', objectFit: 'contain' }} /></span> : null}
    <span>{name}</span>
  </span>;
}
