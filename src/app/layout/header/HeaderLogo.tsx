import { Link } from 'react-router';

const HeaderLogo = ({ onNavigate }: { onNavigate?: () => void }) => {
  return (
    <Link onClick={onNavigate} to="/" className="flex min-w-0 items-center">
      <img
        src="/images/cameo_LOGO.svg"
        alt="CAMEO"
        width={144}
        height={32}
        className="h-8 w-36 max-w-full object-contain object-left"
      />
    </Link>
  );
};

export default HeaderLogo;
