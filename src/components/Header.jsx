import { Link, useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1350px] mx-auto px-6">
        <nav className="h-14">
          <ul className="flex items-center h-full space-x-8">
            <li className="text-lg font-semibold text-gray-900">Invero</li>
            <li>
              <Link
                to="/"
                className={`text-sm transition-colors focus:outline-none relative ${
                  location.pathname === "/"
                    ? "text-indigo-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Početna
                {location.pathname === "/" && (
                  <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </Link>
            </li>
            <li>
              <Link
                to="/artikli"
                className={`text-sm transition-colors focus:outline-none relative ${
                  location.pathname === "/artikli"
                    ? "text-indigo-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Artikli
                {location.pathname === "/artikli" && (
                  <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;
