import { FaFacebookF, FaInstagram } from "react-icons/fa";

const networks = [
  { name: "Facebook", href: "https://www.facebook.com/gaspronal.colombia/", Icon: FaFacebookF },
  { name: "Instagram", href: "https://www.instagram.com/gaspronal/", Icon: FaInstagram },
];

export default function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div aria-label="Redes sociales de Gaspronal" className={`flex items-center gap-2 ${className}`}>
      {networks.map(({ name, href, Icon }) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Gaspronal en ${name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/20 transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2">
          <Icon size={18} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
