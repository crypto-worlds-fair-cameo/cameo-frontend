import { Link } from 'react-router';

const HeaderLogo = ({ onNavigate }: { onNavigate?: () => void }) => {
  return (
    <Link onClick={onNavigate} to="/" className="flex min-w-0 items-center">
      <img
        src="/images/cameo_LOGO.svg"
        alt="CAMEO"
        width={115.2}
        height={25.6}
        className="h-[25.6px] w-[115.2px] max-w-full object-contain object-left"
      />
    </Link>
  );
};

export default HeaderLogo;
