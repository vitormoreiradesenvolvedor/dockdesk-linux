import icon from '../assets/icon.png';

/** Ícone oficial do app (pinguim pescando a baleia com âncora de isca). */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src={icon}
      width={size}
      height={size}
      className="logo-mark-img"
      alt="DockDesk"
      draggable={false}
    />
  );
}
