/** Mini versão do ícone do app: pinguim pescando com âncora de isca. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* pinguim */}
      <ellipse cx="7.2" cy="8.6" rx="4" ry="5.2" fill="#0f172a" />
      <ellipse cx="7.2" cy="10" rx="2.4" ry="3.4" fill="#f8fafc" />
      <circle cx="6" cy="6.2" r="0.8" fill="#f8fafc" />
      <circle cx="8.4" cy="6.2" r="0.8" fill="#f8fafc" />
      <polygon points="6.4,7.6 8,7.6 7.2,8.8" fill="#f59e0b" />
      {/* vara e linha */}
      <path d="M9.5 5.5 L18.5 2.5" stroke="#92400e" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M18.5 2.5 L18.5 15" stroke="#f8fafc" strokeWidth="0.7" strokeLinecap="round" />
      {/* âncora (isca) */}
      <circle cx="18.5" cy="15.6" r="0.9" stroke="#f8fafc" strokeWidth="0.7" fill="none" />
      <path d="M18.5 16.5 L18.5 20" stroke="#f8fafc" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M16.9 17.6 L20.1 17.6" stroke="#f8fafc" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M16.6 19.2 Q18.5 21.2 20.4 19.2" stroke="#f8fafc" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* ondas */}
      <path d="M2.5 20.5 Q4 19.5 5.5 20.5 Q7 21.5 8.5 20.5" stroke="#7dd3fc" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M9.5 22 Q11 21 12.5 22 Q14 23 15.5 22" stroke="#7dd3fc" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
